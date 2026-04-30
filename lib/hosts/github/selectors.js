/* hosts/github/selectors.js — DOM selectors + parsing helpers for the
 * GitHub PR list (Epic 9 / QM-304).
 *
 * Extracted from content.js so the GitLab adapter (Phase 1) has a parallel
 * file to drop next to it. Pure DOM — no chrome.*, no fetch.
 *
 * Consumers read window.QM_GITHUB_SELECTORS. content.js falls back to the
 * old inline definitions if this lib didn't load (defensive — the
 * extension never goes blank).
 */

(function attach(scope) {
  // Row container on github.com/pulls and github.com/<o>/<r>/pulls. The
  // testid alternate covers GitHub's React-rebuilt issue list rollout.
  const ROW_SELECTOR = ".js-issue-row, [data-testid='issue-pr-title-link']";

  // Marker attribute set on rows we've already augmented, so a re-scan after
  // pjax / turbo navigation doesn't double-inject.
  const INJECTED_ATTR = "data-qm-injected";

  /**
   * Locate the PR anchor inside a row, ordered by selector specificity so
   * we hit the data-hovercard variant on the React list before the legacy
   * `id="issue_*"` anchors.
   *
   * @param {HTMLElement} row
   * @returns {HTMLAnchorElement|null}
   */
  function findPrAnchor(row) {
    if (!row || typeof row.querySelector !== "function") return null;
    return (
      row.querySelector("a[data-hovercard-type='pull_request']") ||
      row.querySelector("a[id^='issue_'][href*='/pull/']") ||
      row.querySelector("a[href*='/pull/']")
    );
  }

  /**
   * Parse owner / repo / pull number out of a row anchor href. Accepts
   * either an HTMLAnchorElement (we read .getAttribute("href") preferring
   * the literal markup over the resolved absolute URL) or a string href.
   *
   * Delegates the actual parse to lib/pr-helpers.js's parsePrLink — kept
   * thin here so the regex stays in one place across selectors variants.
   *
   * @param {HTMLAnchorElement|string} anchor
   * @returns {{owner:string, repo:string, num:number}|null}
   */
  function parsePrLink(anchor) {
    if (!anchor) return null;
    const helpers = scope && scope.QM_HELPERS;
    if (!helpers || typeof helpers.parsePrLink !== "function") return null;
    const href = typeof anchor === "string"
      ? anchor
      : (anchor.getAttribute && anchor.getAttribute("href")) || anchor.href || "";
    return helpers.parsePrLink(href);
  }

  // QM-400: PR-page detection. Matches the canonical
  // /<owner>/<repo>/pull/<number> path; the trailing segments
  // (/files, /commits, /checks, etc.) are PR sub-tabs and still count
  // as the "PR page" for action-bar injection purposes.
  const PR_PAGE_PATH_RE = /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/|$)/;

  /**
   * Returns true when the given pathname looks like a GitHub PR page.
   * Falls back to `window.location.pathname` when no argument is passed
   * so callers in `content.js` can `if (isPullRequestPage()) ...`.
   *
   * @param {string} [pathname]
   * @returns {boolean}
   */
  function isPullRequestPage(pathname) {
    const path = pathname != null
      ? pathname
      : (typeof location !== "undefined" ? location.pathname : "");
    return PR_PAGE_PATH_RE.test(path || "");
  }

  // Selectors GitHub uses for its native "Update branch" / "Update with
  // merge commit" / "Update with rebase" controls inside the merge-status
  // panel. Listed in current → legacy order so we hit the React-rebuilt
  // PR view first. Centralized here per
  // github_power_suite_docs_updated/dom_injection.md §PR Page Rebase
  // Button Injection — DOM probing is an additional positive signal on
  // top of the API state.
  const NATIVE_UPDATE_BRANCH_SELECTORS = [
    "[data-update-branch-pr]",
    "form[action$='/update_branch']",
    "button.js-update-branch",
    "button[name='update_branch']",
  ];

  /**
   * Returns true when GitHub's own merge-status panel currently exposes
   * an update/rebase action. Used as a positive co-signal alongside
   * fetchPrState — when GitHub itself shows the action, we should too,
   * even if our API view of mergeable_state is stale.
   *
   * @param {Document|Element} [root]
   * @returns {boolean}
   */
  function hasNativeUpdateBranchControl(root) {
    const r = root || (typeof document !== "undefined" ? document : null);
    if (!r || typeof r.querySelector !== "function") return false;
    return NATIVE_UPDATE_BRANCH_SELECTORS.some((sel) => r.querySelector(sel));
  }

  const api = {
    ROW_SELECTOR,
    INJECTED_ATTR,
    findPrAnchor,
    parsePrLink,
    isPullRequestPage,
    NATIVE_UPDATE_BRANCH_SELECTORS,
    hasNativeUpdateBranchControl,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_GITHUB_SELECTORS = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
