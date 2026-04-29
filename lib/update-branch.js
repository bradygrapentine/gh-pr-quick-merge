/* update-branch.js — wrapper for GitHub's
 * POST /repos/{owner}/{repo}/pulls/{pull_number}/update-branch endpoint.
 *
 * Returns { queued: true } on the API's 202 Accepted (the merge / rebase
 * happens asynchronously on GitHub's side). Throws typed errors on 4xx/5xx
 * so callers can render distinct UI for "conflict" vs "forbidden" vs
 * "transient network failure".
 */

(function attach(scope) {
  class UpdateConflictError extends Error {
    constructor(message, expectedHeadSha, currentHeadSha) {
      super(message);
      this.name = "UpdateConflictError";
      this.status = 422;
      this.expectedHeadSha = expectedHeadSha;
      this.currentHeadSha = currentHeadSha;
    }
  }
  class UpdateForbiddenError extends Error {
    constructor(message) {
      super(message);
      this.name = "UpdateForbiddenError";
      this.status = 403;
    }
  }

  function _api() {
    return (typeof scope !== "undefined" && scope.QM_API)
      || (typeof window !== "undefined" && window.QM_API)
      || (typeof globalThis !== "undefined" && globalThis.QM_API)
      || null;
  }

  /**
   * @param {object} opts
   * @param {string} opts.owner
   * @param {string} opts.repo
   * @param {number} opts.pullNumber
   * @param {string} [opts.expectedHeadSha]   forwarded as `expected_head_sha`
   * @param {"merge"|"rebase"} [opts.strategy]  defaults to "merge"
   * @param {object} [opts.token]              GitHub token (forwarded to api)
   * @param {object} [opts.api]                injectable api helper (tests)
   * @returns {Promise<{queued: true}>}
   */
  async function updateBranch(opts) {
    if (!opts || !opts.owner || !opts.repo || !opts.pullNumber) {
      throw new Error("updateBranch: { owner, repo, pullNumber } required");
    }
    const strategy = opts.strategy === "rebase" ? "rebase" : "merge";
    const body = { expected_head_oid: opts.expectedHeadSha || undefined };
    if (strategy === "rebase") body.merge_method = "rebase";
    // GitHub accepts an empty body; only set keys when present so tests can
    // assert "no spurious fields".
    const cleanBody = {};
    if (body.expected_head_oid) cleanBody.expected_head_oid = body.expected_head_oid;
    if (body.merge_method) cleanBody.merge_method = body.merge_method;

    const apiHelper = opts.api || _api();
    if (!apiHelper || !apiHelper.apiPost) {
      throw new Error("updateBranch: lib/api.js (QM_API.apiPost) not available");
    }

    const path = `/repos/${opts.owner}/${opts.repo}/pulls/${opts.pullNumber}/update-branch`;
    try {
      const out = await apiHelper.apiPost(path, cleanBody, {
        token: opts.token,
        expectedStatus: 202,
        fetchImpl: opts.fetchImpl,
      });
      if (out && out.status === 202) return { queued: true };
      // Some servers return 200 with the updated PR — treat as success.
      return { queued: true };
    } catch (err) {
      if (err && err.status === 422) {
        throw new UpdateConflictError(err.message || "Conflict updating branch", opts.expectedHeadSha, undefined);
      }
      if (err && err.status === 403) {
        throw new UpdateForbiddenError(err.message || "Forbidden");
      }
      throw err;
    }
  }

  const api = {
    updateBranch,
    UpdateConflictError,
    UpdateForbiddenError,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_UPDATE_BRANCH = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
