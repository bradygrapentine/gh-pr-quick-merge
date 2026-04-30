/* qm-pr-page-actions.js — Epic 10 (QM-402..408).
 *
 * Mounts a persistent action bar on every GitHub PR page exposing:
 *  - "Update branch" (rebase) — warning-styled, gated on a confirmation
 *    modal; calls updateBranch().
 *  - "Approve" — single-click; submits an APPROVE review.
 *
 * Pure-logic (decideRebaseUi, decideApproveUi, parsePrPagePath,
 * submitReview) is unit-tested against fixture state. DOM mount /
 * teardown is exercised end-to-end via Playwright (QM-409).
 *
 * Idempotency: the bar carries `data-gps-visible-rebase="true"`; calling
 * ensurePrPageActionBar() twice is a no-op. Soft-nav (turbo:render /
 * pjax:end) calls removePrPageActionBar() first, then re-mounts.
 *
 * NO direct chrome.* or fetch in this file — all HTTP goes through
 * QM_API; storage reads happen at the call site.
 */

(function attach(scope) {
  const BAR_ID = "qm-pr-action-bar";
  const BAR_FLAG = "data-gps-visible-rebase";
  const MODAL_ID = "qm-pr-action-modal";

  // ===== Pure logic =========================================================

  /**
   * Parse /<owner>/<repo>/pull/<n> (with optional sub-tab) into parts.
   * Returns null on miss — keep symmetric with isPullRequestPage so callers
   * can do `const parts = parsePrPagePath(...); if (!parts) return;`.
   */
  function parsePrPagePath(pathname) {
    if (!pathname) return null;
    const m = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/.exec(pathname);
    if (!m) return null;
    return { owner: m[1], repo: m[2], num: Number(m[3]) };
  }

  /**
   * Decide what the rebase button should render given current PR state and
   * the user's permission cache. Returns one of:
   *   "show"          — yellow/warn button, click opens confirm modal
   *   "show-disabled" — disabled fallback + "Open merge panel" link
   *   "hide"          — render nothing
   *
   * QM-406 fallback matrix lives here.
   *
   * @param {object} state           shape from fetchPrState
   * @param {object} [opts]
   * @param {boolean} [opts.writePermDenied]  cached 403 from a prior
   *   updateBranch attempt → render disabled with "Open merge panel" link
   *   instead of the active button.
   */
  function decideRebaseUi(state, opts = {}) {
    if (!state || typeof state !== "object") return "hide";
    if (opts.writePermDenied) return "show-disabled";

    const behind = Number(state.behind_by) > 0;
    const ms = state.mergeable_state;
    const explicitBehind = ms === "behind";

    // Hide when GitHub doesn't expose update-branch.
    const cleanOrBlocked = ms === "clean" || ms === "blocked";
    if (cleanOrBlocked && !behind) return "hide";

    if (behind || explicitBehind) return "show";
    return "hide";
  }

  /**
   * Decide whether the inline Approve button should render. Hide when:
   *  - we don't know the current viewer (logged-out content script), or
   *  - the PR is authored by the current user (cannot self-approve), or
   *  - the PR is already approved by the current user (POST would 422).
   *
   * @param {object} state
   * @param {object} viewer  { login: string } | null
   */
  function decideApproveUi(state, viewer) {
    if (!state || typeof state !== "object") return "hide";
    if (!viewer || !viewer.login) return "hide";
    const author = state.author && state.author.login;
    if (author && author === viewer.login) return "hide";
    if (state.viewer_has_approved) return "hide";
    return "show";
  }

  /**
   * Submit an APPROVE review on a PR. Wraps QM_API.apiPost so callers
   * don't need to remember the endpoint shape.
   *
   * @returns {Promise<object>} parsed review response from GitHub
   */
  async function submitReview({ owner, repo, pullNumber, event = "APPROVE", body = "", token, api }) {
    if (!owner || !repo || !pullNumber) {
      throw new Error("submitReview: { owner, repo, pullNumber } required");
    }
    const apiHelper = api || (scope && scope.QM_API);
    if (!apiHelper || !apiHelper.apiPost) {
      throw new Error("submitReview: QM_API.apiPost unavailable");
    }
    return apiHelper.apiPost(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
      { event, body },
      { token }
    );
  }

  // ===== DOM mount / teardown ==============================================

  /**
   * Locate where to mount the action bar on a PR page. Tries the modern
   * merge-status panel first (where GitHub puts its own update-branch
   * button when applicable), falls back to .gh-header-actions, falls
   * back to inserting at the top of #partial-discussion-header so the
   * bar at least appears even on layout drift.
   */
  function findActionBarMount(doc = document) {
    return (
      doc.querySelector(".js-merge-pr") ||
      doc.querySelector(".mergeability-details") ||
      doc.querySelector(".gh-header-actions") ||
      doc.querySelector("#partial-discussion-header") ||
      doc.body
    );
  }

  /**
   * Build the bar DOM. Returns the element; caller mounts it.
   * Kept as a small pure-DOM helper so tests can snapshot the markup.
   */
  function buildActionBar({ rebaseMode, showApprove }) {
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.className = "qm-pr-action-bar";
    bar.setAttribute(BAR_FLAG, "true");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "PR Quick Merge actions");

    if (showApprove) {
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "qm-pr-action qm-pr-action-approve";
      approve.dataset.qmAction = "approve";
      approve.setAttribute("aria-label", "Approve this pull request");
      approve.textContent = "Approve";
      bar.appendChild(approve);
    }

    if (rebaseMode === "show" || rebaseMode === "show-disabled") {
      const rebase = document.createElement("button");
      rebase.type = "button";
      rebase.className = "qm-pr-action qm-pr-action-rebase";
      rebase.dataset.qmAction = "rebase";
      if (rebaseMode === "show-disabled") {
        rebase.disabled = true;
        rebase.classList.add("qm-pr-action-disabled");
        rebase.textContent = "Rebase available in merge panel";
        rebase.setAttribute("aria-label", "Rebase available in merge panel — open it to update branch");
      } else {
        rebase.textContent = "Update branch";
        rebase.setAttribute("aria-label", "Update branch (may retrigger CI)");
      }
      bar.appendChild(rebase);

      if (rebaseMode === "show-disabled") {
        const link = document.createElement("a");
        link.className = "qm-pr-action-link";
        link.href = "#partial-pull-merging";
        link.textContent = "Open merge panel";
        bar.appendChild(link);
      }
    }

    return bar;
  }

  /**
   * Mount or refresh the action bar. Called from content.js on initial
   * load and on every soft-nav. Idempotent.
   *
   * @param {object} ctx
   * @param {object} ctx.state     latest fetchPrState() response
   * @param {object|null} ctx.viewer  { login } | null
   * @param {object} ctx.handlers  { onRebaseClick, onApproveClick }
   * @param {boolean} [ctx.writePermDenied]
   * @param {Document} [ctx.doc]
   */
  function ensurePrPageActionBar(ctx) {
    const doc = ctx && ctx.doc ? ctx.doc : document;
    if (!ctx || !ctx.state) return null;

    const rebaseMode = decideRebaseUi(ctx.state, { writePermDenied: ctx.writePermDenied });
    const approveMode = decideApproveUi(ctx.state, ctx.viewer);
    if (rebaseMode === "hide" && approveMode === "hide") {
      removePrPageActionBar(doc);
      return null;
    }

    // Idempotency: tear down any prior bar before re-mounting so toggling
    // between modes (e.g. rebase succeeded → behind_by===0 → hide rebase
    // but keep approve) doesn't leave stale buttons.
    removePrPageActionBar(doc);

    const mount = findActionBarMount(doc);
    if (!mount) return null;

    const bar = buildActionBar({ rebaseMode, showApprove: approveMode === "show" });

    const onRebase = ctx.handlers && ctx.handlers.onRebaseClick;
    const onApprove = ctx.handlers && ctx.handlers.onApproveClick;
    const rebaseBtn = bar.querySelector('[data-qm-action="rebase"]');
    const approveBtn = bar.querySelector('[data-qm-action="approve"]');
    if (rebaseBtn && onRebase && !rebaseBtn.disabled) {
      rebaseBtn.addEventListener("click", onRebase);
    }
    if (approveBtn && onApprove) {
      approveBtn.addEventListener("click", onApprove);
    }

    mount.parentNode === doc.body || mount === doc.body
      ? mount.appendChild(bar)
      : mount.parentNode.insertBefore(bar, mount.nextSibling);
    return bar;
  }

  /** Remove any mounted bar + modal. Called on soft-nav and before remount. */
  function removePrPageActionBar(doc = document) {
    const bar = doc.getElementById(BAR_ID);
    if (bar) bar.remove();
    closeRebaseConfirmModal(doc);
  }

  // ===== Confirmation modal (QM-403) =======================================

  /**
   * Open a modal asking the user to confirm a rebase. Returns a promise
   * that resolves with true on confirm, false on cancel. Focus trap +
   * ESC-to-close + Enter-to-confirm are handled here.
   */
  function showRebaseConfirmModal({ doc = document, trigger } = {}) {
    return new Promise((resolve) => {
      closeRebaseConfirmModal(doc);

      const overlay = doc.createElement("div");
      overlay.id = MODAL_ID;
      overlay.className = "qm-pr-modal-overlay";
      overlay.setAttribute("role", "presentation");

      const dialog = doc.createElement("div");
      dialog.className = "qm-pr-modal";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", `${MODAL_ID}-title`);

      const title = doc.createElement("h2");
      title.id = `${MODAL_ID}-title`;
      title.className = "qm-pr-modal-title";
      title.textContent = "Update branch?";

      const body = doc.createElement("p");
      body.className = "qm-pr-modal-body";
      body.textContent =
        "GitHub will merge the latest changes from the base branch into this PR. " +
        "CI may rerun. This is reversible — you can always force-push back.";

      const actions = doc.createElement("div");
      actions.className = "qm-pr-modal-actions";

      const cancel = doc.createElement("button");
      cancel.type = "button";
      cancel.className = "qm-pr-modal-cancel";
      cancel.textContent = "Cancel";
      cancel.dataset.qmModalAction = "cancel";

      const confirm = doc.createElement("button");
      confirm.type = "button";
      confirm.className = "qm-pr-modal-confirm";
      confirm.textContent = "Update branch";
      confirm.dataset.qmModalAction = "confirm";

      actions.appendChild(cancel);
      actions.appendChild(confirm);
      dialog.appendChild(title);
      dialog.appendChild(body);
      dialog.appendChild(actions);
      overlay.appendChild(dialog);
      doc.body.appendChild(overlay);

      function done(value) {
        overlay.removeEventListener("keydown", onKey);
        overlay.removeEventListener("click", onOverlayClick);
        overlay.remove();
        if (trigger && typeof trigger.focus === "function") trigger.focus();
        resolve(value);
      }
      function onKey(ev) {
        if (ev.key === "Escape") { ev.preventDefault(); done(false); return; }
        if (ev.key === "Enter") { ev.preventDefault(); done(true); return; }
        if (ev.key === "Tab") {
          // Trap: only two interactive elements, cycle.
          const focusables = [cancel, confirm];
          const idx = focusables.indexOf(doc.activeElement);
          ev.preventDefault();
          const next = ev.shiftKey
            ? focusables[(idx - 1 + focusables.length) % focusables.length]
            : focusables[(idx + 1) % focusables.length];
          if (next && next !== doc.activeElement) next.focus();
          else focusables[0].focus();
        }
      }
      function onOverlayClick(ev) {
        if (ev.target === overlay) done(false);
      }
      cancel.addEventListener("click", () => done(false));
      confirm.addEventListener("click", () => done(true));
      overlay.addEventListener("keydown", onKey);
      overlay.addEventListener("click", onOverlayClick);
      // Focus the confirm button so Enter is the default — mirrors
      // GitHub's own confirmation patterns.
      confirm.focus();
    });
  }

  function closeRebaseConfirmModal(doc = document) {
    const m = doc.getElementById(MODAL_ID);
    if (m) m.remove();
  }

  // ===== Public surface =====================================================

  const surface = {
    // pure
    parsePrPagePath,
    decideRebaseUi,
    decideApproveUi,
    submitReview,
    // DOM
    ensurePrPageActionBar,
    removePrPageActionBar,
    buildActionBar,
    findActionBarMount,
    showRebaseConfirmModal,
    closeRebaseConfirmModal,
    // constants
    BAR_ID,
    BAR_FLAG,
    MODAL_ID,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = surface;
  if (scope) scope.QM_PR_PAGE_ACTIONS = surface;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
