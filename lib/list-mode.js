/* list-mode.js — "fast mode" PR fetching.
 *
 * Uses GitHub's GET /repos/{owner}/{repo}/pulls list endpoint, which is
 * cheaper than per-PR /pulls/:n calls but does NOT return mergeable_state
 * (callers see null and must downgrade UI accordingly).
 *
 * Paginates via the standard `Link: <url>; rel="next"` header.
 */

(function attach(scope) {
  const LIST_MODE_FIELDS = Object.freeze([
    "number",
    "title",
    "draft",
    "updatedAt",
    "user",
    "labels",
    "headSha",
    "headRef",
    "baseRef",
    "state",
  ]);

  function _api() {
    return (typeof scope !== "undefined" && scope.QM_API)
      || (typeof window !== "undefined" && window.QM_API)
      || (typeof globalThis !== "undefined" && globalThis.QM_API)
      || null;
  }

  /** Pure mapper from raw list-endpoint object to normalized shape. */
  function normalizePR(rawPR) {
    if (!rawPR || typeof rawPR !== "object") return rawPR;
    return {
      number: rawPR.number,
      title: rawPR.title || "",
      draft: !!rawPR.draft,
      updatedAt: rawPR.updated_at || null,
      user: rawPR.user && rawPR.user.login ? rawPR.user.login : "",
      labels: Array.isArray(rawPR.labels) ? rawPR.labels.map((l) => (typeof l === "string" ? l : (l && l.name) || "")) : [],
      headSha: rawPR.head && rawPR.head.sha ? rawPR.head.sha : null,
      headRef: rawPR.head && rawPR.head.ref ? rawPR.head.ref : null,
      baseRef: rawPR.base && rawPR.base.ref ? rawPR.base.ref : null,
      state: rawPR.state || "open",
      // List endpoint never returns this — leave explicit so callers know.
      mergeable_state: null,
    };
  }

  function _parseNextLink(linkHeader) {
    if (!linkHeader) return null;
    // Link: <https://api.github.com/...?page=2>; rel="next", <...>; rel="last"
    const parts = linkHeader.split(",");
    for (const p of parts) {
      const m = p.match(/<([^>]+)>;\s*rel="next"/i);
      if (m) return m[1];
    }
    return null;
  }

  /**
   * @param {string} repoFullName  "owner/repo"
   * @param {string} token
   * @param {object} [opts]
   * @param {Function} [opts.fetchImpl]
   * @returns {Promise<Array>} normalized PRs across all pages
   */
  async function fetchPRList(repoFullName, token, opts) {
    const idx = String(repoFullName || "").indexOf("/");
    if (idx <= 0) throw new Error(`fetchPRList: invalid repoFullName "${repoFullName}"`);
    const owner = repoFullName.slice(0, idx);
    const repo = repoFullName.slice(idx + 1);
    const apiHelper = (opts && opts.api) || _api();
    const _fetch = (opts && opts.fetchImpl) || (typeof fetch === "function" ? fetch : null);
    if (!_fetch) throw new Error("fetchPRList: no fetch available");

    const headers = (apiHelper && apiHelper.ghHeaders) ? apiHelper.ghHeaders(token) : {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`;
    const out = [];
    let safety = 0;
    while (url) {
      safety++;
      if (safety > 10) break; // > 1000 PRs in fast mode is a misuse
      const res = await _fetch(url, { method: "GET", headers });
      if (!res.ok) {
        const e = new Error(`fetchPRList HTTP ${res.status}`);
        e.status = res.status;
        throw e;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const pr of data) out.push(normalizePR(pr));
      }
      const link = (res.headers && typeof res.headers.get === "function")
        ? res.headers.get("Link") || res.headers.get("link")
        : (res.headers && (res.headers.Link || res.headers.link)) || null;
      url = _parseNextLink(link);
    }
    return out;
  }

  const api = {
    fetchPRList,
    normalizePR,
    LIST_MODE_FIELDS,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_LIST_MODE = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
