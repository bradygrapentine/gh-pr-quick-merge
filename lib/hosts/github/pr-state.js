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

  const exported = { fetchPrState, prKey, ghHeaders, API_BASE };

  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  if (scope) scope.QM_GITHUB_PR_STATE = exported;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
