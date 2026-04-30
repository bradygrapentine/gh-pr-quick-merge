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

  // ===== Track C — exclusion predicates (QM-509, QM-510) ==================

  // Default bot-author list. Users extend / override via
  // chrome.storage.sync.qm_noise_authors.
  const DEFAULT_NOISE_AUTHORS = Object.freeze([
    "dependabot[bot]",
    "renovate[bot]",
    "github-actions[bot]",
  ]);

  /** True when the PR was opened by an author in the noise list. */
  function isNoiseAuthor(_state, pr, ctx) {
    if (!pr || !pr.author) return false;
    const list = (ctx && Array.isArray(ctx.noiseAuthors) && ctx.noiseAuthors.length > 0)
      ? ctx.noiseAuthors
      : DEFAULT_NOISE_AUTHORS;
    return list.includes(pr.author);
  }

  /** True when the PR is a draft. */
  function isDraft(state) {
    return !!(state && state.draft === true);
  }

  const EXCLUDERS = {
    hideDependabot: isNoiseAuthor,
    hideDrafts: isDraft,
  };

  // ===== Composer ==========================================================

  /**
   * Build a row-keeper function from the user's filter selections.
   *
   * Includes (mine/ready/stale/small) compose with **OR**: a row is kept
   * if it matches any active include-filter (or if none are active).
   *
   * Excludes (hideDependabot/hideDrafts) compose with **AND-NOT**, applied
   * after inclusion: a row that passed inclusion is dropped if any
   * active exclude-filter matches it.
   *
   * @param {object} filters  e.g. { mine: true, hideDependabot: true }
   * @param {object} ctx      { viewerLogin, staleHelpers, sizer, noiseAuthors, ... }
   * @returns {(state: object, pr: object) => boolean}
   */
  function composeFilter(filters, ctx) {
    const includes = Object.entries(filters || {})
      .filter(([k, v]) => v && PREDICATES[k])
      .map(([k]) => PREDICATES[k]);
    const excludes = Object.entries(filters || {})
      .filter(([k, v]) => v && EXCLUDERS[k])
      .map(([k]) => EXCLUDERS[k]);
    return (state, pr) => {
      const passesInclude = includes.length === 0
        || includes.some((fn) => {
          try { return fn(state, pr, ctx || {}); }
          catch (_e) { return false; }
        });
      if (!passesInclude) return false;
      // Exclusions are short-circuit: any matching excluder drops the row.
      for (const fn of excludes) {
        try { if (fn(state, pr, ctx || {})) return false; }
        catch (_e) { /* exclude predicate threw — treat as miss */ }
      }
      return true;
    };
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
    EXCLUDERS,
    DEFAULT_NOISE_AUTHORS,
    composeFilter,
    applyFiltersToRows,
    isMine,
    isReady,
    isStale,
    isSmall,
    isNoiseAuthor,
    isDraft,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_FILTERS = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
