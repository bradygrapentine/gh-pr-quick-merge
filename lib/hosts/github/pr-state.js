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

  // ===== GraphQL piggy-back =================================================

  // Single query returning everything fetchPrState surfaces PLUS the
  // statusCheckRollup. Replaces the REST /pulls/:n + REST /commits/:sha/status
  // pair on hot paths (row injection) — one round-trip instead of two.
  //
  // Trade-off: GraphQL doesn't expose `behind_by` as an integer; we read
  // `mergeStateStatus === 'BEHIND'` and surface it as `behind_by: 1`
  // (good enough for show/hide gates). Callers that need the exact
  // count (auto-rebase scheduling, "Update (3)" pill) should still use
  // REST fetchPrState.
  const PR_GRAPHQL_QUERY = `
    query QmPrStateAndCi($owner: String!, $repo: String!, $num: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $num) {
          mergeable
          mergeStateStatus
          headRefOid
          headRefName
          baseRefName
          title
          body
          isDraft
          additions
          deletions
          author { login }
          updatedAt
          reviewRequests(first: 1) { totalCount }
          comments(first: 1) { totalCount }
          autoMergeRequest { mergeMethod enabledBy { login } }
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup {
                  state
                  contexts(first: 50) {
                    nodes {
                      __typename
                      ... on CheckRun { name conclusion }
                      ... on StatusContext { context state }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;

  function _normalizeMergeState(s) {
    // GraphQL returns BEHIND, BLOCKED, CLEAN, DIRTY, DRAFT, HAS_HOOKS,
    // UNKNOWN, UNSTABLE. REST returns lowercase + a couple of extras.
    // Normalize to REST-style lowercase so callers don't have to branch.
    if (typeof s !== "string") return null;
    return s.toLowerCase();
  }

  function _normalizeCiRollup(rollup) {
    if (!rollup || typeof rollup !== "object") return { state: null, failingContexts: [] };
    const stateRaw = (rollup.state || "").toUpperCase();
    const state = stateRaw === "SUCCESS" ? "success"
      : stateRaw === "FAILURE" || stateRaw === "ERROR" ? "failure"
      : stateRaw === "PENDING" || stateRaw === "EXPECTED" ? "pending"
      : null;
    const nodes = rollup.contexts && Array.isArray(rollup.contexts.nodes) ? rollup.contexts.nodes : [];
    const failingContexts = nodes.flatMap((n) => {
      if (!n) return [];
      if (n.__typename === "CheckRun" && n.conclusion === "FAILURE") return [n.name || "unknown check"];
      if (n.__typename === "StatusContext" && n.state === "FAILURE") return [n.context || "unknown check"];
      return [];
    });
    return { state, failingContexts };
  }

  /**
   * GraphQL piggy-back: return the REST-shaped fetchPrState output
   * plus { ci_state, failing_contexts } in one network call.
   *
   * Falls back to REST `fetchPrState + fetchCiState` if GraphQL fails
   * (any non-2xx, network error, or response shape mismatch) — callers
   * always get a usable object.
   */
  async function fetchPrStateAndCi(pr, token, opts = {}) {
    const cache = opts.cache;
    const apiBase = opts.apiBase || API_BASE;
    const _fetch = opts.fetchImpl || (typeof fetch === "function" ? fetch : null);
    if (!_fetch) throw new Error("pr-state.js: no fetch implementation available");

    const { owner, repo, num } = pr;
    const key = prKey(pr);
    if (cache && cache.has(key)) {
      const cached = cache.get(key);
      if (cached && cached.ci_state !== undefined) return cached;
    }

    try {
      const res = await _fetch(`${apiBase}/graphql`, {
        method: "POST",
        headers: { ...ghHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ query: PR_GRAPHQL_QUERY, variables: { owner, repo, num } }),
      });
      if (!res.ok) return _fallback(pr, token, opts);
      const data = await res.json();
      const pr_ = data && data.data && data.data.repository && data.data.repository.pullRequest;
      if (!pr_) return _fallback(pr, token, opts);

      const ms = _normalizeMergeState(pr_.mergeStateStatus);
      const rollupNode = pr_.commits && pr_.commits.nodes && pr_.commits.nodes[0];
      const ci = _normalizeCiRollup(rollupNode && rollupNode.commit && rollupNode.commit.statusCheckRollup);

      const out = {
        mergeable: pr_.mergeable === "MERGEABLE" ? true : pr_.mergeable === "CONFLICTING" ? false : null,
        mergeable_state: ms,
        head_sha: pr_.headRefOid || null,
        title: pr_.title || "",
        body: pr_.body || "",
        author: pr_.author && pr_.author.login || "",
        branch: pr_.headRefName || "",
        base: pr_.baseRefName || "",
        updated_at: pr_.updatedAt || null,
        draft: !!pr_.isDraft,
        has_reviewer_requested: !!(pr_.reviewRequests && pr_.reviewRequests.totalCount > 0),
        // GraphQL doesn't expose behind_by as an integer; map BEHIND → 1,
        // everything else → 0. Callers needing the exact count fall back
        // to REST fetchPrState.
        behind_by: ms === "behind" ? 1 : 0,
        auto_merge: pr_.autoMergeRequest ? {
          merge_method: pr_.autoMergeRequest.mergeMethod || null,
          enabled_by: pr_.autoMergeRequest.enabledBy && pr_.autoMergeRequest.enabledBy.login || null,
        } : null,
        additions: typeof pr_.additions === "number" ? pr_.additions : 0,
        deletions: typeof pr_.deletions === "number" ? pr_.deletions : 0,
        comments: pr_.comments && typeof pr_.comments.totalCount === "number" ? pr_.comments.totalCount : 0,
        ci_state: ci.state,
        failing_contexts: ci.failingContexts,
      };
      if (cache) {
        cache.set(key, out);
        if (out.mergeable === null) setTimeout(() => cache.delete(key), 4000);
      }
      return out;
    } catch (_e) {
      return _fallback(pr, token, opts);
    }
  }

  // REST fallback when GraphQL is unavailable / blocked / fails.
  async function _fallback(pr, token, opts) {
    const state = await fetchPrState(pr, token, opts);
    if (state && state.head_sha) {
      const ci = await fetchCiState(state.head_sha, token, {
        ...opts,
        path: `/repos/${pr.owner}/${pr.repo}/commits/${state.head_sha}/status`,
      });
      state.ci_state = ci.state;
      state.failing_contexts = ci.failingContexts;
    } else {
      state.ci_state = null;
      state.failing_contexts = [];
    }
    return state;
  }

  const exported = { fetchPrState, fetchCiState, fetchPrStateAndCi, prKey, ghHeaders, API_BASE };

  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  if (scope) scope.QM_GITHUB_PR_STATE = exported;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
