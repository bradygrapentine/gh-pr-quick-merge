/* pr-state.js — GitHub-side PR state fetcher.
 *
 * Extracted from content.js so the PR page (Epic 10 / QM-402) can reuse the
 * exact same shape and caching contract that the /pulls list relies on.
 *
 * Pure-ish: caller injects the cache Map and (optionally) fetch. No globals,
 * no DOM. Caches the normalised shape; for `mergeable === null` (GitHub still
 * computing), the entry self-evicts after 4s so the next caller refetches.
 */

(function attach(scope) {
  const API_BASE = "https://api.github.com";

  function ghHeaders(token) {
    return {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  const prKey = (pr) => `${pr.owner}/${pr.repo}#${pr.num}`;

  async function fetchPrState(pr, token, opts = {}) {
    const cache = opts.cache;
    const apiBase = opts.apiBase || API_BASE;
    const _fetch = opts.fetchImpl || (typeof fetch === "function" ? fetch : null);
    if (!_fetch) throw new Error("pr-state.js: no fetch implementation available");

    const { owner, repo, num } = pr;
    const key = prKey(pr);
    if (cache && cache.has(key)) return cache.get(key);

    try {
      const res = await _fetch(`${apiBase}/repos/${owner}/${repo}/pulls/${num}`, {
        headers: ghHeaders(token),
      });
      if (!res.ok) {
        const err = { error: `HTTP ${res.status}` };
        if (cache) cache.set(key, err);
        return err;
      }
      const data = await res.json();
      const out = {
        mergeable: data.mergeable,
        mergeable_state: data.mergeable_state,
        head_sha: data.head?.sha,
        title: data.title || "",
        body: data.body || "",
        author: data.user?.login || "",
        branch: data.head?.ref || "",
        base: data.base?.ref || "",
        updated_at: data.updated_at || null,
        draft: !!data.draft,
        has_reviewer_requested: Array.isArray(data.requested_reviewers)
          ? data.requested_reviewers.length > 0
          : false,
        behind_by: typeof data.behind_by === "number" ? data.behind_by : 0,
        // QM-406 fallback: skip the in-extension Update affordance when
        // GitHub's own auto-merge is already armed for the PR.
        auto_merge: data.auto_merge ? {
          merge_method: data.auto_merge.merge_method || null,
          enabled_by: data.auto_merge.enabled_by?.login || null,
        } : null,
        // QM-501 / QM-502 — line counts and comments come for free on the
        // /pulls/:n response, no extra fetch.
        additions: typeof data.additions === "number" ? data.additions : 0,
        deletions: typeof data.deletions === "number" ? data.deletions : 0,
        comments: typeof data.comments === "number" ? data.comments : 0,
      };
      if (cache) {
        cache.set(key, out);
        if (data.mergeable === null) {
          setTimeout(() => cache.delete(key), 4000);
        }
      }
      return out;
    } catch (e) {
      return { error: `${e.name || "Error"}: ${(e.message || "").slice(0, 200)}` };
    }
  }

  /**
   * QM-500 — combined CI status for a head SHA. Single REST call;
   * cache keyed by SHA in the supplied Map so it persists per commit
   * (no TTL — the SHA is its own cache key).
   *
   * @returns {Promise<{state: "success"|"failure"|"pending"|null, failingContexts: string[]}>}
   */
  async function fetchCiState(headSha, token, opts = {}) {
    if (!headSha) return { state: null, failingContexts: [] };
    const cache = opts.cache;
    const apiBase = opts.apiBase || API_BASE;
    const _fetch = opts.fetchImpl || (typeof fetch === "function" ? fetch : null);
    if (!_fetch) return { state: null, failingContexts: [] };
    const cacheKey = `ci:${headSha}`;
    if (cache && cache.has(cacheKey)) return cache.get(cacheKey);

    // The "owner/repo" needed for /commits/:sha/status varies per row, so
    // require the caller to pass the full path.
    const path = opts.path;
    if (!path) return { state: null, failingContexts: [] };
    try {
      const res = await _fetch(`${apiBase}${path}`, { headers: ghHeaders(token) });
      if (!res.ok) {
        const out = { state: null, failingContexts: [] };
        if (cache) cache.set(cacheKey, out);
        return out;
      }
      const data = await res.json();
      // GitHub's combined-status endpoint returns "success" | "failure" |
      // "pending" — or "success" with zero statuses on a fresh repo. The
      // doc'd shape collapses neatly.
      const stateRaw = data.state;
      const state = stateRaw === "success" || stateRaw === "failure" || stateRaw === "pending"
        ? stateRaw
        : null;
      const failingContexts = Array.isArray(data.statuses)
        ? data.statuses
            .filter((s) => s && s.state === "failure")
            .map((s) => s.context || "unknown check")
        : [];
      const out = { state, failingContexts };
      if (cache) cache.set(cacheKey, out);
      return out;
    } catch (_e) {
      return { state: null, failingContexts: [] };
    }
  }

  const exported = { fetchPrState, fetchCiState, prKey, ghHeaders, API_BASE };

  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  if (scope) scope.QM_GITHUB_PR_STATE = exported;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
