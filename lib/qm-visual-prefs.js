/* qm-visual-prefs.js — accent / density / font preferences shared
 * across popup, options, and the injected content surface.
 *
 * Stored at chrome.storage.sync.qm_visual_prefs as a single object so
 * one onChanged event broadcasts to all surfaces. Each surface calls
 * bootstrap(root, store) once on load; the controller writes
 * --qm-accent, --qm-density, --qm-font-family + a data-qm-density
 * attribute on the supplied root, and re-applies on storage changes.
 *
 * Pure-ish: storage is optional (tests inject a fake). DOM writes
 * happen via root.style.setProperty so they layer over theme.css.
 */

(function attach(scope) {
  const STORE_KEY = "qm_visual_prefs";
  const DEFAULTS = Object.freeze({
    accent: "#1f6feb",
    density: "comfortable",
    fontFamily: "system",
  });
  const VALID_DENSITY = ["compact", "comfortable"];
  const VALID_FONT = ["system", "inter"];
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  const FONT_STACKS = {
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    inter: '"Inter Tight", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  };

  function _normalize(raw) {
    const out = { ...DEFAULTS };
    if (!raw || typeof raw !== "object") return out;
    if (typeof raw.accent === "string" && HEX_RE.test(raw.accent)) out.accent = raw.accent.toLowerCase();
    if (VALID_DENSITY.includes(raw.density)) out.density = raw.density;
    if (VALID_FONT.includes(raw.fontFamily)) out.fontFamily = raw.fontFamily;
    return out;
  }

  function applyPrefs(root, prefs) {
    if (!root) return;
    const p = _normalize(prefs);
    root.style.setProperty("--qm-accent", p.accent);
    root.style.setProperty("--qm-font-family", FONT_STACKS[p.fontFamily]);
    root.dataset.qmDensity = p.density;
  }

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.root — element receiving CSS vars + density attr.
   * @param {object} [opts.store] — chrome.storage.sync (or compatible fake).
   * @returns {{ get: () => object, set: (partial) => Promise<void>, dispose: () => void }}
   */
  async function bootstrap({ root, store } = {}) {
    if (!root) throw new Error("qm-visual-prefs: root element required");
    let current = { ...DEFAULTS };
    if (store && typeof store.get === "function") {
      try {
        const data = await store.get(STORE_KEY);
        current = _normalize(data && data[STORE_KEY]);
      } catch (_e) { /* defaults */ }
    }
    applyPrefs(root, current);

    let storageHandler = null;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      storageHandler = (changes, area) => {
        if (area !== "sync" || !changes[STORE_KEY]) return;
        current = _normalize(changes[STORE_KEY].newValue);
        applyPrefs(root, current);
      };
      chrome.storage.onChanged.addListener(storageHandler);
    }

    return {
      get: () => ({ ...current }),
      async set(partial) {
        const next = _normalize({ ...current, ...partial });
        current = next;
        applyPrefs(root, current);
        if (store && typeof store.set === "function") {
          await store.set({ [STORE_KEY]: current });
        }
      },
      dispose() {
        if (storageHandler && typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
          chrome.storage.onChanged.removeListener(storageHandler);
        }
      },
    };
  }

  const api = {
    bootstrap,
    applyPrefs,
    _normalize,
    STORE_KEY,
    DEFAULTS,
    VALID_DENSITY,
    VALID_FONT,
    FONT_STACKS,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_VISUAL_PREFS = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
