/* qm-theme.js — light/dark theme resolution + persistence.
 *
 * Resolves the active theme for a surface using this precedence:
 *   1. user override stored at chrome.storage.sync.qm_theme
 *      ("light" | "dark" | "auto")
 *   2. on github.com pages: GitHub's own data-color-mode if set to "light"
 *      or "dark" (so we follow whatever theme the user picked there)
 *   3. prefers-color-scheme media query
 *   4. fallback: light
 *
 * Applies the resolved theme by writing data-theme="light" or "dark" on
 * the supplied root element. Also subscribes to storage + media-query
 * changes so the surface reacts live.
 *
 * Pure-ish: chrome.storage is optional (tests inject a fake store).
 * matchMedia / document detection is best-effort and skipped if unavailable.
 */

(function attach(scope) {
  const STORE_KEY = "qm_theme";
  const VALID = ["light", "dark", "auto"];

  function _resolveAuto({ doc, mql }) {
    if (doc && doc.documentElement) {
      const ghMode = doc.documentElement.getAttribute("data-color-mode");
      if (ghMode === "light" || ghMode === "dark") return ghMode;
    }
    if (mql && typeof mql.matches === "boolean") {
      return mql.matches ? "dark" : "light";
    }
    return "light";
  }

  function resolveTheme({ override, doc, mql }) {
    if (override === "light" || override === "dark") return override;
    return _resolveAuto({ doc, mql });
  }

  function applyTheme(rootEl, theme) {
    if (!rootEl || (theme !== "light" && theme !== "dark")) return;
    rootEl.setAttribute("data-theme", theme);
  }

  /**
   * Bootstrap a surface: resolve once, apply, and wire reactive updates.
   *
   * @param {object} opts
   * @param {HTMLElement} opts.root — element receiving data-theme.
   * @param {object} [opts.store] — chrome.storage.sync (or compatible fake).
   * @param {Document} [opts.doc] — DOM document; defaults to global.
   * @param {MediaQueryList} [opts.mql] — defaults to matchMedia query.
   * @returns {{ get: () => string, set: (override) => Promise<void>, dispose: () => void }}
   */
  async function bootstrap({ root, store, doc, mql } = {}) {
    if (!root) throw new Error("qm-theme: root element required");
    const _doc = doc || (typeof document !== "undefined" ? document : null);
    const _mql = mql ?? (typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null);
    let override = "auto";
    if (store && typeof store.get === "function") {
      try {
        const data = await store.get(STORE_KEY);
        const v = data && data[STORE_KEY];
        if (VALID.includes(v)) override = v;
      } catch (_e) { /* storage unavailable in some test envs; default auto */ }
    }

    let current = resolveTheme({ override, doc: _doc, mql: _mql });
    applyTheme(root, current);

    const handleMql = () => {
      if (override !== "auto") return;
      const next = resolveTheme({ override, doc: _doc, mql: _mql });
      if (next !== current) {
        current = next;
        applyTheme(root, current);
      }
    };
    if (_mql && typeof _mql.addEventListener === "function") {
      _mql.addEventListener("change", handleMql);
    }

    let storageHandler = null;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      storageHandler = (changes, area) => {
        if (area !== "sync" || !changes[STORE_KEY]) return;
        const v = changes[STORE_KEY].newValue;
        override = VALID.includes(v) ? v : "auto";
        const next = resolveTheme({ override, doc: _doc, mql: _mql });
        if (next !== current) {
          current = next;
          applyTheme(root, current);
        }
      };
      chrome.storage.onChanged.addListener(storageHandler);
    }

    return {
      get: () => current,
      async set(value) {
        if (!VALID.includes(value)) throw new Error(`qm-theme: invalid value ${value}`);
        override = value;
        const next = resolveTheme({ override, doc: _doc, mql: _mql });
        if (next !== current) {
          current = next;
          applyTheme(root, current);
        }
        if (store && typeof store.set === "function") {
          await store.set({ [STORE_KEY]: value });
        }
      },
      dispose() {
        if (_mql && typeof _mql.removeEventListener === "function") {
          _mql.removeEventListener("change", handleMql);
        }
        if (storageHandler && typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
          chrome.storage.onChanged.removeListener(storageHandler);
        }
      },
    };
  }

  const api = { bootstrap, resolveTheme, applyTheme, STORE_KEY, VALID };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_THEME = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
