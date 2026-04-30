/* qm-row-badges.js — Epic 11 Track A (QM-500..503).
 *
 * Mounts CI status / size / comments badges + ready-to-merge highlight
 * onto PR rows on github.com/pulls.
 *
 * Pure DOM — no fetch in here, no chrome.*. content.js owns data flow:
 *   applyRowBadges(container, prState, pr, { onCiNeeded });
 *
 * Idempotency: each badge carries `data-qm-badge` so re-application
 * during pjax / turbo re-injection is a swap, not a duplicate.
 */

(function attach(scope) {
  const BADGE_ATTR = "data-qm-badge";
  const READY_ATTR = "data-qm-ready";

  function _classifySize(state) {
    const sizer = (scope && scope.QM_SIZE) || (typeof require === "function" ? null : null);
    if (sizer && typeof sizer.classifySize === "function") return sizer.classifySize(state);
    // Defensive fallback if QM_SIZE isn't loaded yet — count lines and
    // pick a tag inline. Mirrors the buckets in qm-size-classify.js.
    const a = Number(state && state.additions) || 0;
    const d = Number(state && state.deletions) || 0;
    const lines = a + d;
    const tag = lines < 10 ? "XS" : lines < 50 ? "S" : lines < 200 ? "M" : lines < 500 ? "L" : "XL";
    return { tag, lines };
  }

  /**
   * Build / return the badge container, mounted next to the PR title
   * rather than inline with the merge buttons. Keeps the action bay
   * uncluttered.
   */
  function _ensureBadgeStrip(container) {
    const row = container.closest(".js-issue-row") || container.parentElement;
    if (row) {
      const existing = row.querySelector('[data-qm-badge="strip"]');
      if (existing) return existing;
    }
    const strip = document.createElement("span");
    strip.className = "qm-row-badge-strip";
    strip.setAttribute(BADGE_ATTR, "strip");

    // Preferred mount: BEFORE the PR title anchor as a leading inline
    // strip. Putting the badges before the title keeps them on the
    // same baseline regardless of how GitHub flexes the title row,
    // and matches the docs/ui_ux.md PR Row layout
    //   [Title] [CI] [Size] [Stale] [Comments] [Actions]
    // which we approximate as [CI/Size/Comments] [Title] for stronger
    // left-edge scanning.
    const titleLink = row && (
      row.querySelector("a[data-hovercard-type='pull_request']") ||
      row.querySelector("a[id^='issue_'][href*='/pull/']") ||
      row.querySelector("a[href*='/pull/']")
    );
    if (titleLink && titleLink.parentNode) {
      titleLink.parentNode.insertBefore(strip, titleLink);
    } else {
      container.insertBefore(strip, container.firstChild);
    }
    return strip;
  }

  function _swapBadge(strip, kind, el) {
    const existing = strip.querySelector(`[${BADGE_ATTR}="${kind}"]`);
    if (el) {
      el.setAttribute(BADGE_ATTR, kind);
      if (existing) strip.replaceChild(el, existing);
      else strip.appendChild(el);
    } else if (existing) {
      existing.remove();
    }
  }

  // ===== Individual badge builders ========================================

  function buildCiBadge(ciState) {
    if (!ciState || !ciState.state) return null;
    const dot = document.createElement("span");
    dot.className = `qm-row-badge qm-row-badge-ci qm-row-badge-ci-${ciState.state}`;
    dot.textContent = ciState.state === "success" ? "●"
      : ciState.state === "failure" ? "✕"
      : "…";
    const failing = Array.isArray(ciState.failingContexts) ? ciState.failingContexts : [];
    const tip = ciState.state === "failure" && failing.length
      ? `CI failing: ${failing.slice(0, 3).join(", ")}${failing.length > 3 ? "…" : ""}`
      : ciState.state === "success" ? "CI passing"
      : "CI pending";
    dot.title = tip;
    dot.setAttribute("aria-label", tip);
    return dot;
  }

  function buildSizeBadge(state) {
    if (!state) return null;
    const { tag, lines } = _classifySize(state);
    const span = document.createElement("span");
    span.className = `qm-row-badge qm-row-badge-size qm-row-badge-size-${tag.toLowerCase()}`;
    span.textContent = tag;
    span.title = `${lines} lines changed`;
    span.setAttribute("aria-label", `Size ${tag}, ${lines} lines changed`);
    return span;
  }

  function buildCommentsBadge(state, pr) {
    if (!state || !pr) return null;
    const count = Number(state.comments);
    if (!Number.isFinite(count) || count <= 0) return null;
    const a = document.createElement("a");
    a.className = "qm-row-badge qm-row-badge-comments";
    a.href = `/${pr.owner}/${pr.repo}/pull/${pr.num}#issue-comment-area`;
    a.textContent = `💬 ${count}`;
    a.setAttribute("aria-label", `${count} comment${count === 1 ? "" : "s"} — jump to comments`);
    return a;
  }

  /** QM-503 — Ready highlight via a row-level data attribute. */
  function _setReadyHighlight(rowEl, state) {
    if (!rowEl) return;
    const ready = !!(state
      && state.mergeable_state === "clean"
      && Number(state.behind_by) === 0
      && state.draft !== true);
    if (ready) rowEl.setAttribute(READY_ATTR, "true");
    else rowEl.removeAttribute(READY_ATTR);
  }

  // ===== Public surface ====================================================

  /**
   * @param {HTMLElement} container  the .qm-container injected into the row
   * @param {object} state           fetchPrState() output (may be partial)
   * @param {object} pr              { owner, repo, num }
   * @param {object} [opts]
   * @param {object|null} [opts.ciState]  shape from fetchCiState; null/omitted
   *   leaves the CI badge hidden (caller may render it later via applyCiState).
   */
  function applyRowBadges(container, state, pr, opts = {}) {
    if (!container || !state) return;
    const strip = _ensureBadgeStrip(container);

    _swapBadge(strip, "ci", buildCiBadge(opts.ciState));
    _swapBadge(strip, "size", buildSizeBadge(state));
    _swapBadge(strip, "comments", buildCommentsBadge(state, pr));

    // Ready highlight goes on the row (not the strip), matching GitHub's
    // own row-level decoration patterns.
    const row = container.closest(".js-issue-row") || container.parentElement;
    _setReadyHighlight(row, state);
  }

  /** Update only the CI badge once the async fetch returns. */
  function applyCiState(container, ciState) {
    if (!container) return;
    const strip = container.querySelector('[data-qm-badge="strip"]');
    if (!strip) return;
    _swapBadge(strip, "ci", buildCiBadge(ciState));
  }

  function teardown(container) {
    if (!container) return;
    const strip = container.querySelector('[data-qm-badge="strip"]');
    if (strip) strip.remove();
    const row = container.closest(".js-issue-row") || container.parentElement;
    if (row) row.removeAttribute(READY_ATTR);
  }

  const api = {
    applyRowBadges,
    applyCiState,
    buildCiBadge,
    buildSizeBadge,
    buildCommentsBadge,
    teardown,
    BADGE_ATTR,
    READY_ATTR,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_ROW_BADGES = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
