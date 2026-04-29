/* bulk-ops.js — bulk close + bulk label helpers.
 *
 * Both helpers iterate `prNumbers` serially (one fetch per PR), capture
 * per-PR errors, and never throw — the caller renders per-row results.
 * Serial-by-default keeps us under GitHub's secondary-rate-limit ceiling
 * for write operations.
 *
 * Note: GitHub's REST API treats issues and pulls interchangeably for
 * label CRUD (a PR has both /pulls/:n and /issues/:n endpoints; labels
 * live on /issues/:n/labels for both).
 */

(function attach(scope) {
  const DEFAULT_CONFIRM_THRESHOLD = 5;

  function _api() {
    return (typeof scope !== "undefined" && scope.QM_API)
      || (typeof window !== "undefined" && window.QM_API)
      || (typeof globalThis !== "undefined" && globalThis.QM_API)
      || null;
  }

  function _splitRepo(repoFullName) {
    const idx = String(repoFullName || "").indexOf("/");
    if (idx <= 0) throw new Error(`bulk-ops: invalid repoFullName "${repoFullName}"`);
    return {
      owner: repoFullName.slice(0, idx),
      repo: repoFullName.slice(idx + 1),
    };
  }

  /**
   * Close N PRs by issuing PATCH /pulls/:n with { state: "closed" }.
   * @returns {Array<{number: number, ok: boolean, error?: string}>}
   */
  async function closePRs(repoFullName, prNumbers, token, opts) {
    if (!Array.isArray(prNumbers) || prNumbers.length === 0) return [];
    const apiHelper = (opts && opts.api) || _api();
    if (!apiHelper) throw new Error("bulk-ops: lib/api.js (QM_API) not available");
    const { owner, repo } = _splitRepo(repoFullName);

    const results = [];
    for (const number of prNumbers) {
      try {
        await apiHelper._request
          ? await apiHelper._request("PATCH", `/repos/${owner}/${repo}/pulls/${number}`, { token, body: { state: "closed" }, fetchImpl: opts && opts.fetchImpl })
          : await _patch(apiHelper, `/repos/${owner}/${repo}/pulls/${number}`, { state: "closed" }, token, opts);
        results.push({ number, ok: true });
      } catch (err) {
        results.push({ number, ok: false, error: (err && err.message) || String(err) });
      }
    }
    return results;
  }

  /**
   * Apply a label set to N PRs via POST /issues/:n/labels.
   * Each call adds the labels (idempotent — GitHub dedupes server-side).
   * @returns {Array<{number: number, ok: boolean, error?: string}>}
   */
  async function labelPRs(repoFullName, prNumbers, labels, token, opts) {
    if (!Array.isArray(prNumbers) || prNumbers.length === 0) return [];
    if (!Array.isArray(labels) || labels.length === 0) return [];
    const apiHelper = (opts && opts.api) || _api();
    if (!apiHelper) throw new Error("bulk-ops: lib/api.js (QM_API) not available");
    const { owner, repo } = _splitRepo(repoFullName);

    const results = [];
    for (const number of prNumbers) {
      try {
        await apiHelper.apiPost(
          `/repos/${owner}/${repo}/issues/${number}/labels`,
          { labels },
          { token, fetchImpl: opts && opts.fetchImpl },
        );
        results.push({ number, ok: true });
      } catch (err) {
        results.push({ number, ok: false, error: (err && err.message) || String(err) });
      }
    }
    return results;
  }

  // Internal: PATCH wrapper (lib/api.js doesn't expose PATCH yet — fall back
  // to building a fetch directly via the helper's ghHeaders).
  async function _patch(apiHelper, path, body, token, opts) {
    const url = path.startsWith("http") ? path : `${apiHelper.API_BASE || "https://api.github.com"}${path}`;
    const _fetch = (opts && opts.fetchImpl) || (typeof fetch === "function" ? fetch : null);
    if (!_fetch) throw new Error("bulk-ops: no fetch available");
    const res = await _fetch(url, {
      method: "PATCH",
      headers: { ...apiHelper.ghHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const data = await res.json(); if (data && data.message) msg = data.message; } catch (_) { /* ignore */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : await res.json().catch(() => null);
  }

  const api = {
    closePRs,
    labelPRs,
    DEFAULT_CONFIRM_THRESHOLD,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_BULK_OPS = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
