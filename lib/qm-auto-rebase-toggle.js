/* qm-auto-rebase-toggle.js — per-PR auto-rebase opt-in.
 *
 * UX:
 *   A tiny checkbox lives in each row's `.qm-container`. When checked,
 *   the PR's key (`owner/repo#num`) is added to
 *   `chrome.storage.sync.qm_auto_rebase`. While that key is set,
 *   content.js triggers `updateBranch()` automatically every time the
 *   row's state shows mergeable_state === 'behind' (or behind_by > 0).
 *
 *   Persists across reloads + syncs across devices via chrome.storage.sync.
 *   Survives a successful rebase — if the PR drifts behind again later,
 *   the next state-poll re-triggers.
 *
 * Pure DOM + storage helpers here. Decision logic + actual updateBranch
 * call live in content.js.
 */

(function attach(scope) {
  const STORAGE_KEY = "qm_auto_rebase";
  const TOGGLE_FLAG = "data-qm-auto-rebase";

  function _key(pr) {
    if (!pr) return null;
    return `${pr.owner}/${pr.repo}#${pr.num}`;
  }

  // ===== Storage helpers ===================================================

  /** Read the full opt-in map. Returns {} when missing or corrupt. */
  async function loadAutoRebaseMap(storage) {
    const s = storage || (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync);
    if (!s) return {};
    return new Promise((resolve) => {
      try {
        s.get(STORAGE_KEY, (out) => {
          const v = out && out[STORAGE_KEY];
          resolve(v && typeof v === "object" && !Array.isArray(v) ? v : {});
        });
      } catch (_e) { resolve({}); }
    });
  }

  function saveAutoRebaseMap(map, storage) {
    const s = storage || (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync);
    if (!s) return Promise.resolve();
    return new Promise((resolve) => {
      try { s.set({ [STORAGE_KEY]: map }, () => resolve()); }
      catch (_e) { resolve(); }
    });
  }

  /** Pure helper — true when the PR's key is set in the supplied map. */
  function isEnabled(pr, map) {
    const k = _key(pr);
    return !!(k && map && map[k]);
  }

  /** Mutate the map immutably; returns a new object reference. */
  function setEnabled(pr, map, enabled) {
    const k = _key(pr);
    if (!k) return map || {};
    const next = { ...(map || {}) };
    if (enabled) next[k] = true;
    else delete next[k];
    return next;
  }

  // ===== DOM mount ========================================================

  /**
   * Mount (or refresh) the toggle inside the row's `.qm-container`.
   *
   * @param {HTMLElement} container       row's qm-container
   * @param {object} pr                   { owner, repo, num }
   * @param {object} ctx
   * @param {boolean} ctx.enabled         current selection (from the map)
   * @param {(next: boolean) => void} ctx.onChange  fires after click;
   *   caller persists to storage and re-evaluates the rebase trigger.
   */
  function mountToggle(container, pr, ctx) {
    if (!container || !pr) return null;
    const existing = container.querySelector(`[${TOGGLE_FLAG}]`);
    if (existing) {
      const cb = existing.querySelector("input[type='checkbox']");
      if (cb) cb.checked = !!(ctx && ctx.enabled);
      return existing;
    }
    const wrap = document.createElement("label");
    wrap.className = "qm-auto-rebase-toggle";
    wrap.setAttribute(TOGGLE_FLAG, "true");
    wrap.title = "Auto-rebase: keep this PR up to date with its base branch.";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "qm-auto-rebase-checkbox";
    cb.checked = !!(ctx && ctx.enabled);
    cb.setAttribute("aria-label", `Auto-rebase ${pr.owner}/${pr.repo}#${pr.num}`);

    const txt = document.createElement("span");
    txt.className = "qm-auto-rebase-label";
    txt.textContent = "Auto rebase";

    wrap.appendChild(cb);
    wrap.appendChild(txt);
    container.appendChild(wrap);

    cb.addEventListener("change", () => {
      const next = !!cb.checked;
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(next);
    });
    return wrap;
  }

  function teardown(container) {
    if (!container) return;
    const el = container.querySelector(`[${TOGGLE_FLAG}]`);
    if (el) el.remove();
  }

  const api = {
    loadAutoRebaseMap,
    saveAutoRebaseMap,
    isEnabled,
    setEnabled,
    mountToggle,
    teardown,
    STORAGE_KEY,
    TOGGLE_FLAG,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_AUTO_REBASE_TOGGLE = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
