/* qm-size-classify.js — QM-501.
 *
 * Pure-fn PR-size classifier. Mirrors the convention many tools have
 * settled on (`size/XS` … `size/XL` labels) so the badge user sees on
 * our row matches what GitHub-side bots tend to put on the PR itself.
 *
 * Buckets are off `additions + deletions` — cheap to compute, already
 * in the `/pulls/:n` response, no extra fetch.
 */

(function attach(scope) {
  const BUCKETS = [
    { tag: "XS", max: 9 },
    { tag: "S", max: 49 },
    { tag: "M", max: 199 },
    { tag: "L", max: 499 },
    { tag: "XL", max: Infinity },
  ];

  /**
   * @param {object} state  fetchPrState() output (uses .additions + .deletions)
   * @returns {{ tag: "XS"|"S"|"M"|"L"|"XL", lines: number }}
   */
  function classifySize(state) {
    const additions = state && Number(state.additions);
    const deletions = state && Number(state.deletions);
    const a = Number.isFinite(additions) ? additions : 0;
    const d = Number.isFinite(deletions) ? deletions : 0;
    const lines = a + d;
    const bucket = BUCKETS.find((b) => lines <= b.max) || BUCKETS[BUCKETS.length - 1];
    return { tag: bucket.tag, lines };
  }

  /** Inverse helper for filter predicates (QM-508). */
  function isSmall(state) {
    const { tag } = classifySize(state);
    return tag === "XS" || tag === "S";
  }

  const api = { classifySize, isSmall, BUCKETS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_SIZE = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
