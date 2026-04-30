/* qm-filters.js — Epic 11 Track B (QM-505..508).
 *
 * Pure-fn predicates + composer for the /pulls quick-filter bar. Each
 * predicate takes (prState, pr, ctx) and returns true when the row
 * should be kept under that filter's lens.
 *
 * Composition is union (OR) across active include-filters — toggling
 * Mine + Ready shows rows matching either. Track C extends with
 * exclusion filters (intersection / AND-NOT) layered on top.
 */

(function attach(scope) {
  // ===== Individual predicates =============================================

  function isMine(_state, pr, ctx) {
    if (!ctx || !ctx.viewerLogin) return false;
    return pr && pr.author === ctx.viewerLogin;
  }

  function isReady(state) {
    if (!state) return false;
    return state.mergeable_state === "clean"
      && Number(state.behind_by) === 0
      && state.draft !== true;
  }

  function isStale(state, _pr, ctx) {
    if (!state) return false;
    const stale = ctx && ctx.staleHelpers;
    if (!stale || typeof stale.classifyStaleness !== "function") return false;
    const bucket = stale.classifyStaleness(
      {
        updatedAt: state.updated_at,
        draft: !!state.draft,
        hasReviewerRequested: state.has_reviewer_requested !== false,
      },
      ctx.staleThresholds,
      ctx.now,
    );
    return bucket === "stale" || bucket === "abandoned";
  }

  function isSmall(state, _pr, ctx) {
    const sizer = ctx && ctx.sizer;
    if (sizer && typeof sizer.isSmall === "function") return sizer.isSmall(state);
    // Fallback: inline classifier mirroring qm-size-classify buckets.
    const a = Number(state && state.additions) || 0;
    const d = Number(state && state.deletions) || 0;
    return a + d < 50;
  }

  const PREDICATES = {
    mine: isMine,
    ready: isReady,
    stale: isStale,
    small: isSmall,
  };

  // ===== Composer ==========================================================

  /**
   * Build a row-keeper function from the user's filter selections.
   *
   * @param {object} filters  { mine?: bool, ready?: bool, stale?: bool, small?: bool }
   * @param {object} ctx      { viewerLogin, staleHelpers, sizer, ... }
   * @returns {(state: object, pr: object) => boolean}
   */
  function composeFilter(filters, ctx) {
    const active = Object.entries(filters || {})
      .filter(([k, v]) => v && PREDICATES[k])
      .map(([k]) => PREDICATES[k]);
    if (active.length === 0) return () => true;
    return (state, pr) => active.some((fn) => {
      try { return fn(state, pr, ctx || {}); }
      catch (_e) { return false; }
    });
  }

  /**
   * Apply the keeper to live rows. Row keeps an attribute flag so the
   * decision is reversible when a chip turns off.
   */
  function applyFiltersToRows(keeperFn, rows, getStateFor) {
    if (!keeperFn || !rows) return { kept: 0, hidden: 0 };
    let kept = 0;
    let hidden = 0;
    rows.forEach((row) => {
      const ctx = getStateFor && getStateFor(row);
      if (!ctx) return;
      const keep = keeperFn(ctx.state, ctx.pr);
      if (keep) {
        row.removeAttribute("data-qm-hidden-by-filter");
        kept++;
      } else {
        row.setAttribute("data-qm-hidden-by-filter", "true");
        hidden++;
      }
    });
    return { kept, hidden };
  }

  const api = {
    PREDICATES,
    composeFilter,
    applyFiltersToRows,
    isMine,
    isReady,
    isStale,
    isSmall,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_FILTERS = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
