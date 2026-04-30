/* qm-toast.js — toast stack manager (QM-217).
 *
 * Stack rules:
 *   - max 3 visible at once; overflow shifts oldest off-stack early.
 *   - default dismiss after 4000ms; caller can override per-toast.
 *   - clicking the close button dismisses immediately.
 *   - `kind` ∈ ok | warn | err | info.
 *
 * Pure DOM; no chrome.* dependencies. The container element is created
 * lazily on first show() so test environments without a body / DOM still
 * load the module.
 */

(function attach(scope) {
  const MAX_VISIBLE = 3;
  const DEFAULT_DISMISS_MS = 4000;
  const VALID_KINDS = new Set(["ok", "warn", "err", "info"]);
  const LEAVE_ANIM_MS = 180;

  let stackEl = null;
  const live = []; // [{ el, timer }]

  function _ensureStack(parent) {
    if (stackEl && stackEl.isConnected) return stackEl;
    if (!parent) return null;
    stackEl = parent.querySelector(".qm-toast-stack");
    if (!stackEl) {
      stackEl = parent.ownerDocument.createElement("div");
      stackEl.className = "qm-toast-stack";
      stackEl.setAttribute("role", "region");
      stackEl.setAttribute("aria-live", "polite");
      stackEl.setAttribute("aria-label", "Notifications");
      parent.appendChild(stackEl);
    }
    return stackEl;
  }

  function _buildToast({ kind, title, sub, doc }) {
    const root = doc.createElement("div");
    root.className = "qm-toast";
    root.dataset.kind = kind;
    root.setAttribute("role", "status");

    const bar = doc.createElement("span");
    bar.className = "qm-toast-bar";
    bar.setAttribute("aria-hidden", "true");
    root.appendChild(bar);

    const body = doc.createElement("div");
    body.className = "qm-toast-body";
    const titleEl = doc.createElement("div");
    titleEl.className = "qm-toast-title";
    titleEl.textContent = title;
    body.appendChild(titleEl);
    if (sub) {
      const subEl = doc.createElement("div");
      subEl.className = "qm-toast-sub";
      subEl.textContent = sub;
      body.appendChild(subEl);
    }
    root.appendChild(body);

    const close = doc.createElement("button");
    close.type = "button";
    close.className = "qm-toast-close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    root.appendChild(close);

    return { root, close };
  }

  function _detach(entry) {
    if (entry.timer) clearTimeout(entry.timer);
    const i = live.indexOf(entry);
    if (i >= 0) live.splice(i, 1);
    if (!entry.el) return;
    entry.el.classList.add("qm-toast-leaving");
    setTimeout(() => {
      if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    }, LEAVE_ANIM_MS);
  }

  /**
   * Render a toast.
   *
   * @param {object} opts
   * @param {"ok"|"warn"|"err"|"info"} opts.kind
   * @param {string} opts.title
   * @param {string} [opts.sub]
   * @param {number} [opts.dismissMs]   override default 4 s; pass 0 / Infinity to keep it sticky.
   * @param {HTMLElement} [opts.parent] — defaults to document.body.
   * @returns {{ dismiss: () => void } | null} returns null in non-DOM envs.
   */
  function show(opts) {
    if (!opts || !VALID_KINDS.has(opts.kind)) {
      throw new Error("qm-toast: { kind: ok|warn|err|info, title } required");
    }
    if (typeof opts.title !== "string" || opts.title.length === 0) {
      throw new Error("qm-toast: title required");
    }
    const parent = opts.parent || (typeof document !== "undefined" ? document.body : null);
    if (!parent) return null;
    const doc = parent.ownerDocument;
    const stack = _ensureStack(parent);
    if (!stack) return null;

    while (live.length >= MAX_VISIBLE) _detach(live[0]);

    const { root, close } = _buildToast({
      kind: opts.kind,
      title: opts.title,
      sub: opts.sub,
      doc,
    });
    const entry = { el: root, timer: null };

    const dismissMs = typeof opts.dismissMs === "number" ? opts.dismissMs : DEFAULT_DISMISS_MS;
    if (Number.isFinite(dismissMs) && dismissMs > 0) {
      entry.timer = setTimeout(() => _detach(entry), dismissMs);
    }

    close.addEventListener("click", () => _detach(entry));
    stack.appendChild(root);
    live.push(entry);

    return { dismiss: () => _detach(entry) };
  }

  function clearAll() {
    while (live.length) _detach(live[0]);
  }

  function _peekLive() {
    return live.slice();
  }

  const api = { show, clearAll, _peekLive, MAX_VISIBLE, DEFAULT_DISMISS_MS };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_TOAST = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
