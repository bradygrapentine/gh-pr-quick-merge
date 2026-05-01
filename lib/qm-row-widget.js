/* qm-row-widget.js — single compact pill that replaces the v0.2-era
 * three-button (Squash / Merge / Rebase) stack on every PR row.
 *
 * Design source: handoff_pr_quick_merge_design/components/gh-pr-list.jsx
 * (`QMRowWidget`). Status pill on the left (READY / BEHIND / BLOCKED /
 * DRAFT / FAST), divider, main "Merge" button labelled with the active
 * method, caret to the right that opens a 3-method picker.
 *
 * Pure DOM construction; no chrome.* dependencies. Caller wires
 * onMerge / onMethodChange / shortcutHint via the constructor opts so
 * the same widget is reusable in tests with synthetic state.
 */

(function attach(scope) {
  const STATUS_LABEL = {
    ready:   { label: "READY",   kind: "success" },
    behind:  { label: "BEHIND",  kind: "warn" },
    blocked: { label: "BLOCKED", kind: "danger" },
    draft:   { label: "DRAFT",   kind: "muted" },
    fast:    { label: "FAST",    kind: "muted" },
    pending: { label: "…",        kind: "muted" },
    error:   { label: "ERR",     kind: "danger" },
  };

  const METHOD_LABELS = {
    squash: "Squash & merge",
    merge:  "Merge",
    rebase: "Rebase & merge",
  };
  const METHOD_ORDER = ["merge", "squash", "rebase"];

  function _classifyState(prState) {
    if (!prState) return "pending";
    if (prState.error) return "error";
    if (prState.listMode) return "fast";
    if (prState.draft) return "draft";
    const ms = prState.mergeable_state;
    if (ms === "clean" || ms === "has_hooks" || ms === "unstable") return "ready";
    if (ms === "behind") return "behind";
    if (ms === "blocked" || ms === "dirty") return "blocked";
    return "pending";
  }

  /**
   * @param {object} opts
   * @param {{owner: string, repo: string, num: number}} opts.pr
   * @param {object|null} opts.prState
   * @param {() => string} [opts.getDefaultMethod]  returns "squash"|"merge"|"rebase"; default "squash"
   * @param {(method: string) => Promise<void>} opts.onMerge  called when user clicks main button
   * @param {(method: string) => void} [opts.onMethodChange]   fires when caret picker switches method
   * @param {() => string|null} [opts.getShortcutHint]         returns text like "S to squash" or null
   * @returns {{ root: HTMLElement, setState: (prState) => void, getActiveMethod: () => string, dispose: () => void }}
   */
  function makeRowWidget(opts) {
    if (!opts || !opts.pr || typeof opts.onMerge !== "function") {
      throw new Error("qm-row-widget: { pr, onMerge } required");
    }
    const { pr } = opts;
    const getDefault = typeof opts.getDefaultMethod === "function" ? opts.getDefaultMethod : () => "merge";
    let activeMethod = getDefault() || "merge";
    if (!METHOD_ORDER.includes(activeMethod)) activeMethod = "merge";

    const root = document.createElement("span");
    root.className = "qm-row-widget";
    root.dataset.qmKey = `${pr.owner}/${pr.repo}#${pr.num}`;

    // Status pill removed (UI pass 13). State is now expressed via the
    // merge button's color directly: green=ready, red=blocked,
    // yellow=behind, muted=draft/pending. Keep a hidden span around so
    // existing dataset.state hooks (tests, callers) keep working.
    const statusPill = document.createElement("span");
    statusPill.className = "qm-row-widget-status";
    statusPill.hidden = true;
    statusPill.style.display = "none";
    root.appendChild(statusPill);

    const mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "qm-button qm-button-primary qm-button-sm qm-row-widget-main";
    mainBtn.dataset.qmAction = "merge";
    root.appendChild(mainBtn);

    const caretBtn = document.createElement("button");
    caretBtn.type = "button";
    caretBtn.className = "qm-button qm-button-primary qm-button-sm qm-row-widget-caret";
    caretBtn.setAttribute("aria-label", "Choose merge method");
    caretBtn.setAttribute("aria-haspopup", "menu");
    caretBtn.setAttribute("aria-expanded", "false");
    // Build caret chevron via DOM (no innerHTML) — MV3 reviewers'
    // static linter flags innerHTML assignment as UNSAFE_VAR_ASSIGNMENT.
    {
      const svgNs = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNs, "svg");
      svg.setAttribute("width", "10");
      svg.setAttribute("height", "10");
      svg.setAttribute("viewBox", "0 0 16 16");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(svgNs, "path");
      path.setAttribute("d", "M3 6l5 5 5-5");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
      caretBtn.appendChild(svg);
    }
    root.appendChild(caretBtn);

    let menu = null;
    let menuOutsideClick = null;

    function _renderMain() {
      const defaultMethod = getDefault() || "squash";
      const isDefault = activeMethod === defaultMethod;
      mainBtn.textContent = "";
      mainBtn.appendChild(document.createTextNode(METHOD_LABELS[activeMethod] || "Merge"));
      if (isDefault) {
        const dot = document.createElement("span");
        dot.className = "qm-row-widget-default-dot";
        dot.setAttribute("aria-hidden", "true");
        dot.title = `Repo default: ${defaultMethod}`;
        mainBtn.appendChild(dot);
      }
      const hint = typeof opts.getShortcutHint === "function" ? opts.getShortcutHint() : null;
      if (hint) {
        const hintEl = document.createElement("span");
        hintEl.className = "qm-row-widget-shortcut";
        hintEl.textContent = hint;
        mainBtn.appendChild(hintEl);
      }
    }

    function _setStatus(klass) {
      const conf = STATUS_LABEL[klass] || STATUS_LABEL.pending;
      statusPill.textContent = conf.label;
      statusPill.dataset.kind = conf.kind;
      statusPill.dataset.state = klass;
      // The pill is hidden; the merge button itself signals state via
      // data-state. CSS handles the green/red/yellow/muted coloring.
      mainBtn.dataset.state = klass;
      root.dataset.state = klass;
    }

    function _enableForState(klass) {
      const enabled = klass === "ready";
      mainBtn.disabled = !enabled;
      caretBtn.disabled = !enabled;
      mainBtn.title = enabled
        ? `${METHOD_LABELS[activeMethod]} #${pr.num}`
        : klass === "behind" ? "Branch is behind base — Update first"
        : klass === "blocked" ? "Cannot merge — checks failing or required reviews"
        : klass === "draft" ? "Draft PR"
        : klass === "fast" ? "Fast mode — disable in Options to merge"
        : "Checking mergeability…";
    }

    function _closeMenu() {
      if (!menu) return;
      menu.remove();
      menu = null;
      caretBtn.setAttribute("aria-expanded", "false");
      if (menuOutsideClick) {
        document.removeEventListener("click", menuOutsideClick, true);
        menuOutsideClick = null;
      }
    }

    function _openMenu() {
      if (menu) return;
      const defaultMethod = getDefault() || "squash";
      menu = document.createElement("div");
      menu.className = "qm-row-widget-menu qm-card";
      menu.setAttribute("role", "menu");
      for (const m of METHOD_ORDER) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "qm-row-widget-menuitem";
        item.dataset.qmMethod = m;
        item.setAttribute("role", "menuitem");
        item.textContent = METHOD_LABELS[m];
        if (m === activeMethod) item.dataset.active = "true";
        if (m === defaultMethod) {
          const tag = document.createElement("span");
          tag.className = "qm-row-widget-menutag";
          tag.textContent = "default";
          item.appendChild(tag);
        }
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          activeMethod = m;
          _renderMain();
          if (typeof opts.onMethodChange === "function") opts.onMethodChange(m);
          _closeMenu();
        });
        menu.appendChild(item);
      }
      // Render in document.body using fixed positioning so the
      // widget's `overflow: hidden` doesn't clip it. Anchor to the
      // caret's bounding rect. Right-align by default, but clamp left
      // if that would push the menu off-screen on narrow viewports.
      const caretRect = caretBtn.getBoundingClientRect();
      const ESTIMATED_MENU_WIDTH = 180;
      menu.style.position = "fixed";
      menu.style.top = `${Math.round(caretRect.bottom + 4)}px`;
      const rightAligned = window.innerWidth - caretRect.right;
      const wouldGoOffLeft = caretRect.right - ESTIMATED_MENU_WIDTH < 8;
      if (wouldGoOffLeft) {
        // Anchor to caret's left edge so the menu opens rightward.
        menu.style.left = `${Math.max(8, Math.round(caretRect.left))}px`;
        menu.style.transformOrigin = "top left";
      } else {
        menu.style.right = `${Math.round(rightAligned)}px`;
        menu.style.transformOrigin = "top right";
      }
      document.body.appendChild(menu);
      caretBtn.setAttribute("aria-expanded", "true");
      menuOutsideClick = (e) => {
        if (root.contains(e.target)) return;
        if (menu && menu.contains(e.target)) return;
        _closeMenu();
      };
      // Defer to next tick so the click that opened us doesn't immediately close.
      setTimeout(() => document.addEventListener("click", menuOutsideClick, true), 0);
    }

    caretBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menu) _closeMenu(); else _openMenu();
    });

    mainBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (mainBtn.disabled) return;
      const method = activeMethod;
      const originalLabel = mainBtn.textContent;
      // Optimistic UI: disable, swap label to spinner, swap to "Merged ✓" on
      // success, revert on failure (caller dispatches the toast).
      mainBtn.disabled = true;
      caretBtn.disabled = true;
      mainBtn.classList.add("qm-row-widget-loading");
      mainBtn.textContent = "";
      const spinner = document.createElement("span");
      spinner.className = "qm-row-widget-spinner";
      mainBtn.appendChild(spinner);
      try {
        await opts.onMerge(method);
        mainBtn.classList.remove("qm-row-widget-loading");
        mainBtn.classList.add("qm-row-widget-success");
        mainBtn.textContent = "Merged ✓";
      } catch (err) {
        mainBtn.classList.remove("qm-row-widget-loading");
        mainBtn.disabled = false;
        caretBtn.disabled = false;
        mainBtn.textContent = originalLabel;
        _renderMain();
        throw err;
      }
    });

    function setState(prState) {
      const klass = _classifyState(prState);
      _setStatus(klass);
      _enableForState(klass);
      _renderMain();
    }

    function dispose() {
      _closeMenu();
    }

    setState(opts.prState || null);

    return {
      root,
      setState,
      getActiveMethod: () => activeMethod,
      dispose,
    };
  }

  const api = { makeRowWidget, _classifyState, METHOD_LABELS, METHOD_ORDER };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_ROW_WIDGET = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
