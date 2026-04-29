/* auto-rebase.js — orchestrates "rebase if behind, then merge".
 *
 * Decoupled from update-branch + the merge call: callers pass `mergeFn`
 * (the function that should run after rebasing succeeds, or directly if
 * no rebase is needed). Tests mock both updateBranch and mergeFn.
 */

(function attach(scope) {
  /**
   * @param {object} args
   * @param {number} args.behindBy
   * @param {number} args.threshold  0 disables auto-rebase entirely
   * @returns {boolean}
   */
  function shouldAutoRebase({ behindBy, threshold }) {
    const b = Number(behindBy);
    const t = Number(threshold);
    if (!Number.isFinite(b) || !Number.isFinite(t)) return false;
    if (t <= 0) return false;
    if (b <= 0) return false;
    return b >= t;
  }

  /**
   * @param {object} opts
   * @param {string} opts.owner
   * @param {string} opts.repo
   * @param {number} opts.pullNumber
   * @param {string} [opts.expectedHeadSha]
   * @param {number} opts.behindBy
   * @param {number} opts.autoRebaseThreshold
   * @param {string} [opts.mergeStrategy]   "merge" | "rebase" — passed to updateBranch
   * @param {() => Promise<any>} opts.mergeFn  caller's merge action
   * @param {() => void} [opts.onRebaseStart]
   * @param {() => void} [opts.onRebaseEnd]
   * @param {object} [opts.updateBranchModule]   injectable for tests
   * @returns {Promise<{ rebased: boolean, merged: boolean }>}
   */
  async function rebaseThenMerge(opts) {
    if (!opts || typeof opts.mergeFn !== "function") {
      throw new Error("rebaseThenMerge: mergeFn required");
    }
    const willRebase = shouldAutoRebase({
      behindBy: opts.behindBy,
      threshold: opts.autoRebaseThreshold,
    });

    if (!willRebase) {
      await opts.mergeFn();
      return { rebased: false, merged: true };
    }

    const updateBranchMod = opts.updateBranchModule
      || (typeof scope !== "undefined" && scope.QM_UPDATE_BRANCH)
      || (typeof window !== "undefined" && window.QM_UPDATE_BRANCH)
      || (typeof globalThis !== "undefined" && globalThis.QM_UPDATE_BRANCH)
      || null;

    if (!updateBranchMod || !updateBranchMod.updateBranch) {
      throw new Error("rebaseThenMerge: lib/update-branch.js (QM_UPDATE_BRANCH) not available");
    }

    if (typeof opts.onRebaseStart === "function") opts.onRebaseStart();
    try {
      await updateBranchMod.updateBranch({
        owner: opts.owner,
        repo: opts.repo,
        pullNumber: opts.pullNumber,
        expectedHeadSha: opts.expectedHeadSha,
        strategy: opts.mergeStrategy === "rebase" ? "rebase" : "merge",
        token: opts.token,
        api: opts.api,
        fetchImpl: opts.fetchImpl,
      });
    } finally {
      if (typeof opts.onRebaseEnd === "function") opts.onRebaseEnd();
    }

    await opts.mergeFn();
    return { rebased: true, merged: true };
  }

  const api = { shouldAutoRebase, rebaseThenMerge };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_AUTO_REBASE = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
