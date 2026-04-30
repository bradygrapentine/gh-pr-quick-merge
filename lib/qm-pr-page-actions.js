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
   * @param {boolean} [opts.nativeControlPresent]  GitHub's own merge-status
   *   panel currently shows an update/rebase control (DOM probe). Acts as
   *   an OR signal on top of behind_by / mergeable_state — if GitHub
   *   itself surfaces the action, we should too even if API state is stale.
   */
  function decideRebaseUi(state, opts = {}) {
    if (state == null) {
      return opts.writePermDenied ? "show-disabled" : "hide";
    }
    if (typeof state !== "object") return "hide";
    if (opts.writePermDenied) return "show-disabled";

    const behind = Number(state.behind_by) > 0;
    const ms = state.mergeable_state;
    const explicitBehind = ms === "behind";
    const native = !!opts.nativeControlPresent;

    // Native control is an authoritative positive signal — show even if
    // our API view says otherwise.
    if (native) return "show";

    // Hide when GitHub doesn't expose update-branch.
    const cleanOrBlocked = ms === "clean" || ms === "blocked";
    if (cleanOrBlocked && !behind) return "hide";

    if (behind || explicitBehind) return "show";
    return "hide";
  }

  /**
   * Decide whether Merge / Squash buttons render on the PR page action
   * bar. Returns "show" only when the PR is in a state where a merge
   * would actually succeed — clean mergeable_state, not behind, not
   * draft. We deliberately don't render these on a behind branch so
   * the user is steered to Update branch first.
   */
  function decideMergeUi(state) {
    if (!state || typeof state !== "object") return "hide";
    if (state.draft === true) return "hide";
    if (Number(state.behind_by) > 0) return "hide";
    // Accept either signal — mergeable_state === 'clean' OR
    // mergeable === true. GitHub computes mergeable_state lazily; the
    // boolean `mergeable` lands first, so falling back to it lets the
    // bar render sooner.
    const stateOk = state.mergeable_state === "clean";
    const booleanOk = state.mergeable === true && state.mergeable_state !== "blocked" && state.mergeable_state !== "dirty";
    if (!stateOk && !booleanOk) return "hide";
    return "show";
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
      // React PR view fallbacks — GitHub rolled out a rebuild that
      // doesn't ship .gh-header-actions on most viewports.
      doc.querySelector("[data-testid='pull-request-header']") ||
      doc.querySelector("[data-component='PH_Title']") ||
      doc.body
    );
  }

  /**
   * Build the bar DOM. Returns the element; caller mounts it.
   * Kept as a small pure-DOM helper so tests can snapshot the markup.
   */
  function buildActionBar({ rebaseMode, showApprove, showMerge, showSquash }) {
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.className = "qm-pr-action-bar";
    bar.setAttribute(BAR_FLAG, "true");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "PR Quick Merge actions");

    // Action layout per github_power_suite_docs_updated/ui_ux.md
    // §PR Page Action Clarity:
    //   [Approve] [Rebase / Update Branch] [Merge] [Squash & Merge]
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

    if (showMerge) {
      const merge = document.createElement("button");
      merge.type = "button";
      merge.className = "qm-pr-action qm-pr-action-merge";
      merge.dataset.qmAction = "merge";
      merge.setAttribute("aria-label", "Merge this pull request");
      merge.textContent = "Merge";
      bar.appendChild(merge);
    }

    if (showSquash) {
      const squash = document.createElement("button");
      squash.type = "button";
      squash.className = "qm-pr-action qm-pr-action-squash";
      squash.dataset.qmAction = "squash";
      squash.setAttribute("aria-label", "Squash and merge this pull request");
      squash.textContent = "Squash & Merge";
      bar.appendChild(squash);
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
   * @param {object} ctx.handlers  { onRebaseClick, onApproveClick, onMergeClick, onSquashClick }
   * @param {boolean} [ctx.writePermDenied]
   * @param {boolean} [ctx.nativeControlPresent]
   * @param {Document} [ctx.doc]
   */
  function ensurePrPageActionBar(ctx) {
    const doc = ctx && ctx.doc ? ctx.doc : document;
    if (!ctx || !ctx.state) return null;

    const rebaseMode = decideRebaseUi(ctx.state, {
      writePermDenied: ctx.writePermDenied,
      nativeControlPresent: ctx.nativeControlPresent,
    });
    const approveMode = decideApproveUi(ctx.state, ctx.viewer);
    const mergeMode = decideMergeUi(ctx.state);
    if (rebaseMode === "hide" && approveMode === "hide" && mergeMode === "hide") {
      removePrPageActionBar(doc);
      return null;
    }

    // Idempotency: tear down any prior bar before re-mounting so toggling
    // between modes (e.g. rebase succeeded → behind_by===0 → hide rebase
    // but keep approve) doesn't leave stale buttons.
    removePrPageActionBar(doc);

    const mount = findActionBarMount(doc);
    if (!mount) return null;

    // Always render every applicable merge method — the user picks per
    // PR. (Earlier pass tried gating on repo default; user feedback
    // said they wanted full choice on the action bar.)
    const showMerge = mergeMode === "show";
    const showSquash = mergeMode === "show";

    const bar = buildActionBar({
      rebaseMode,
      showApprove: approveMode === "show",
      showMerge,
      showSquash,
    });

    // Floating-fallback flag: when we couldn't find an in-page anchor
    // we mount on document.body. CSS pins those bars to the bottom-
    // right of the viewport so users always see them.
    if (mount === doc.body) bar.classList.add("qm-pr-action-bar-floating");

    const onRebase = ctx.handlers && ctx.handlers.onRebaseClick;
    const onApprove = ctx.handlers && ctx.handlers.onApproveClick;
    const onMerge = ctx.handlers && ctx.handlers.onMergeClick;
    const onSquash = ctx.handlers && ctx.handlers.onSquashClick;
    const rebaseBtn = bar.querySelector('[data-qm-action="rebase"]');
    const approveBtn = bar.querySelector('[data-qm-action="approve"]');
    const mergeBtn = bar.querySelector('[data-qm-action="merge"]');
    const squashBtn = bar.querySelector('[data-qm-action="squash"]');
    if (rebaseBtn && onRebase && !rebaseBtn.disabled) rebaseBtn.addEventListener("click", onRebase);
    if (approveBtn && onApprove) approveBtn.addEventListener("click", onApprove);
    if (mergeBtn && onMerge) mergeBtn.addEventListener("click", onMerge);
    if (squashBtn && onSquash) squashBtn.addEventListener("click", onSquash);

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

  // ===== Confirmation modal (QM-403 / merge confirms) ======================

  // Doc-verbatim safety copy keys per action — the rebase string is
  // already pinned by docs; merge / squash mirror its tone (final-action
  // warning + reversible note).
  const CONFIRM_COPY = {
    rebase: {
      title: "Update branch?",
      body: "This may update the branch and retrigger CI. Continue?",
      confirm: "Update branch",
    },
    merge: {
      title: "Merge this pull request?",
      body: "The base branch will receive a merge commit. Reverts can undo it later, but reviewers and CI consumers see the merge immediately.",
      confirm: "Merge",
    },
    squash: {
      title: "Squash and merge?",
      body: "All commits on the head branch will be squashed into a single commit on the base. The original commit history is lost on the base branch.",
      confirm: "Squash & merge",
    },
  };

  /**
   * Generic confirm modal — same a11y contract as the original rebase
   * modal, parameterised on copy. Returns a promise resolving to
   * true (confirm) / false (cancel/dismiss).
   */
  function showActionConfirmModal({ doc = document, trigger, action = "rebase", title, body: bodyText, confirmLabel } = {}) {
    return new Promise((resolve) => {
      closeRebaseConfirmModal(doc);

      const copy = CONFIRM_COPY[action] || CONFIRM_COPY.rebase;
      const titleText = title || copy.title;
      const bodyCopy = bodyText || copy.body;
      const confirmText = confirmLabel || copy.confirm;

      const overlay = doc.createElement("div");
      overlay.id = MODAL_ID;
      overlay.className = "qm-pr-modal-overlay";
      overlay.setAttribute("role", "presentation");

      const dialog = doc.createElement("div");
      dialog.className = "qm-pr-modal";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", `${MODAL_ID}-title`);

      const titleEl = doc.createElement("h2");
      titleEl.id = `${MODAL_ID}-title`;
      titleEl.className = "qm-pr-modal-title";
      titleEl.textContent = titleText;

      const body = doc.createElement("p");
      body.className = "qm-pr-modal-body";
      body.textContent = bodyCopy;

      const actions = doc.createElement("div");
      actions.className = "qm-pr-modal-actions";

      const cancel = doc.createElement("button");
      cancel.type = "button";
      cancel.className = "qm-pr-modal-cancel";
      cancel.textContent = "Cancel";
      cancel.dataset.qmModalAction = "cancel";

      const confirm = doc.createElement("button");
      confirm.type = "button";
      confirm.className = `qm-pr-modal-confirm qm-pr-modal-confirm-${action}`;
      confirm.textContent = confirmText;
      confirm.dataset.qmModalAction = "confirm";

      actions.appendChild(cancel);
      actions.appendChild(confirm);
      dialog.appendChild(titleEl);
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

  /** Backward-compat wrapper — delegates to the generic confirm. */
  function showRebaseConfirmModal(opts = {}) {
    return showActionConfirmModal({ ...opts, action: "rebase" });
  }

  // ===== Public surface =====================================================

  const surface = {
    // pure
    parsePrPagePath,
    decideRebaseUi,
    decideApproveUi,
    decideMergeUi,
    submitReview,
    // DOM
    ensurePrPageActionBar,
    removePrPageActionBar,
    buildActionBar,
    findActionBarMount,
    showActionConfirmModal,
    showRebaseConfirmModal,
    closeRebaseConfirmModal,
    CONFIRM_COPY,
    // constants
    BAR_ID,
    BAR_FLAG,
    MODAL_ID,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = surface;
  if (scope) scope.QM_PR_PAGE_ACTIONS = surface;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
