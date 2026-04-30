/* options-shell.js — non-module shell behaviors for the redesigned
 * options page: side-nav routing, brand mark, theme + visual-prefs
 * bootstrap, Tweaks panel wiring, and About-pane version stamp.
 *
 * Loaded as a classic script before options.js (which is the module
 * that owns the legacy form handlers). Both share the DOM and run
 * in the same global; this file only owns IDs that options.js does
 * not touch.
 */

(function () {
  const ACCENT_PALETTE = [
    "#1f6feb", // blue (default)
    "#8957e5", // purple
    "#bf3989", // pink
    "#cf222e", // red
    "#bc4c00", // orange
    "#9a6700", // yellow
    "#1a7f37", // green
    "#1b7c83", // teal
  ];

  const $ = (id) => document.getElementById(id);

  function _initNav() {
    const items = document.querySelectorAll(".qm-options-nav-item");
    const panes = document.querySelectorAll(".qm-options-pane");
    function activate(target) {
      items.forEach((b) => {
        const on = b.dataset.paneTarget === target;
        if (on) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
      });
      panes.forEach((p) => { p.hidden = p.dataset.pane !== target; });
      try { history.replaceState(null, "", `#${target}`); } catch (_e) { /* file:// throws */ }
    }
    items.forEach((b) => {
      b.addEventListener("click", () => activate(b.dataset.paneTarget));
    });
    const fromHash = (location.hash || "").replace(/^#/, "");
    const valid = Array.from(panes).map((p) => p.dataset.pane);
    activate(valid.includes(fromHash) ? fromHash : "signin");
  }

  function _injectBrand() {
    const slot = $("brandSlot");
    if (slot && window.QM_BRAND && typeof window.QM_BRAND.makeMark === "function") {
      slot.innerHTML = "";
      const mark = window.QM_BRAND.makeMark();
      mark.style.color = "var(--qm-accent, #1f6feb)";
      slot.appendChild(mark);
    }
  }

  function _stampVersion() {
    const el = $("aboutVersion");
    if (!el) return;
    let version = "—";
    try {
      if (chrome && chrome.runtime && typeof chrome.runtime.getManifest === "function") {
        const m = chrome.runtime.getManifest();
        if (m && m.version) version = m.version;
      }
    } catch (_e) { /* keep dash */ }
    el.textContent = version;
  }

  function _setStatus(idOrEl, msg, kind = "") {
    const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
    if (!el) return;
    el.textContent = msg;
    el.className = `status ${kind}`;
  }

  async function _bootstrapPrefs() {
    const root = document.documentElement;
    let themeCtl = null;
    let prefsCtl = null;
    try {
      if (window.QM_THEME && chrome.storage && chrome.storage.sync) {
        themeCtl = await window.QM_THEME.bootstrap({ root, store: chrome.storage.sync });
      }
    } catch (_e) { /* defaults */ }
    try {
      if (window.QM_VISUAL_PREFS && chrome.storage && chrome.storage.sync) {
        prefsCtl = await window.QM_VISUAL_PREFS.bootstrap({ root, store: chrome.storage.sync });
      }
    } catch (_e) { /* defaults */ }
    return { themeCtl, prefsCtl };
  }

  function _renderAccentSwatches(prefsCtl) {
    const container = $("accentSwatches");
    if (!container) return;
    container.innerHTML = "";
    const current = prefsCtl ? prefsCtl.get().accent : ACCENT_PALETTE[0];
    for (const hex of ACCENT_PALETTE) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "qm-tweaks-swatch";
      btn.style.background = hex;
      btn.dataset.accentValue = hex;
      btn.setAttribute("aria-label", `Accent ${hex}`);
      btn.setAttribute("aria-pressed", hex === current ? "true" : "false");
      btn.addEventListener("click", async () => {
        if (!prefsCtl) return;
        await prefsCtl.set({ accent: hex });
        container.querySelectorAll(".qm-tweaks-swatch").forEach((s) => {
          s.setAttribute("aria-pressed", s.dataset.accentValue === hex ? "true" : "false");
        });
        _setStatus("tweaksStatus", "Accent saved.", "ok");
      });
      container.appendChild(btn);
    }
  }

  function _wireSegmented(rootSelector, dataAttr, current, onPick) {
    const segs = document.querySelectorAll(`${rootSelector} .qm-tweaks-seg`);
    segs.forEach((seg) => {
      const value = seg.dataset[dataAttr];
      seg.setAttribute("aria-pressed", value === current ? "true" : "false");
      seg.addEventListener("click", async () => {
        segs.forEach((s) => s.setAttribute("aria-pressed", s.dataset[dataAttr] === value ? "true" : "false"));
        await onPick(value);
      });
    });
  }

  function _wireTweaks({ themeCtl, prefsCtl }) {
    const prefs = prefsCtl ? prefsCtl.get() : { density: "comfortable", fontFamily: "system" };
    const themeNow = themeCtl ? themeCtl.get() : "auto";
    // Theme segmented control
    _wireSegmented('[data-pane="appearance"] [aria-label="Theme"]', "themeValue", themeNow, async (value) => {
      try { if (themeCtl) await themeCtl.set(value); _setStatus("tweaksStatus", "Theme saved.", "ok"); }
      catch (e) { _setStatus("tweaksStatus", `Failed: ${e.message || e}`, "err"); }
    });
    _wireSegmented('[data-pane="appearance"] [aria-label="Density"]', "densityValue", prefs.density, async (value) => {
      if (!prefsCtl) return;
      await prefsCtl.set({ density: value });
      _setStatus("tweaksStatus", "Density saved.", "ok");
    });
    _wireSegmented('[data-pane="appearance"] [aria-label="Font family"]', "fontValue", prefs.fontFamily, async (value) => {
      if (!prefsCtl) return;
      await prefsCtl.set({ fontFamily: value });
      _setStatus("tweaksStatus", "Font saved.", "ok");
    });
    _renderAccentSwatches(prefsCtl);
  }

  async function _wireSentryConsent() {
    const cb = $("sentryConsent");
    if (!cb || !chrome.storage) return;
    try {
      const { qm_sentry_consent } = await chrome.storage.sync.get("qm_sentry_consent");
      cb.checked = !!qm_sentry_consent;
    } catch (_e) { /* default off */ }
    cb.addEventListener("change", async () => {
      try {
        await chrome.storage.sync.set({ qm_sentry_consent: cb.checked });
        _setStatus("sentryConsentStatus",
          cb.checked ? "Crash reports enabled — takes effect on next reload."
                     : "Crash reports disabled.",
          "ok");
      } catch (e) {
        _setStatus("sentryConsentStatus", `Failed: ${e.message || e}`, "err");
      }
    });
  }

  async function _wireShortcutMode() {
    const sel = $("shortcutModeSelect");
    if (!sel || !chrome.storage) return;
    try {
      const { qm_shortcut_mode } = await chrome.storage.sync.get("qm_shortcut_mode");
      sel.value = qm_shortcut_mode === "active" ? "active" : "off";
    } catch (_e) { /* default */ }
    sel.addEventListener("change", async () => {
      try {
        await chrome.storage.sync.set({ qm_shortcut_mode: sel.value });
        _setStatus("shortcutModeStatus", "Saved.", "ok");
      } catch (e) {
        _setStatus("shortcutModeStatus", `Failed: ${e.message || e}`, "err");
      }
    });
  }

  // Generic dismiss for any Sponsor / Pro overlay rendered on a settings
  // surface — keeps the close button working when content.js isn't loaded.
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.classList && target.classList.contains("qm-pro-close")) {
      const overlay = target.closest("#qm-pro-modal, .qm-sponsor-overlay");
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    _initNav();
    _injectBrand();
    _stampVersion();
    const ctls = await _bootstrapPrefs();
    _wireTweaks(ctls);
    _wireShortcutMode();
    _wireSentryConsent();
  });
})();
