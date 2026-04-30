/* qm-filter-bar.js — Epic 11 Track B (QM-504).
 *
 * Renders the Mine / Ready / Stale / Small chip bar above the PR list.
 * Persists active selections in chrome.storage.sync.qm_filters; emits
 * a change callback so content.js can re-apply filters to the row set.
 *
 * Pure DOM + storage glue here — predicate logic lives in qm-filters.js.
 */

(function attach(scope) {
  const BAR_ID = "qm-filter-bar";
  const BAR_FLAG = "data-qm-filter-bar";
  const STORAGE_KEY = "qm_filters";

  const CHIPS = [
    { key: "mine", label: "Mine" },
    { key: "ready", label: "Ready" },
    { key: "stale", label: "Stale" },
    { key: "small", label: "Small" },
  ];

  function buildBar(filters) {
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.className = "qm-filter-bar";
    bar.setAttribute(BAR_FLAG, "true");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "PR Quick Merge filters");
    CHIPS.forEach(({ key, label }) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "qm-filter-chip";
      chip.dataset.qmFilter = key;
      chip.textContent = label;
      const active = !!(filters && filters[key]);
      chip.classList.toggle("qm-filter-chip-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
      bar.appendChild(chip);
    });
    return bar;
  }

  /**
   * Mount or refresh the filter bar above the PR list.
   *
   * @param {object} ctx
   * @param {object} ctx.filters     current selections (e.g. from storage)
   * @param {(filters: object) => void} ctx.onChange  fires after a chip
   *   toggle. Caller persists to storage and re-applies the row keeper.
   * @param {Element} [ctx.mount]    parent to attach into; defaults to a
   *   container injected just inside `.repository-content`.
   * @param {Document} [ctx.doc]
   */
  function ensureFilterBar(ctx) {
    const doc = (ctx && ctx.doc) || document;
    const filters = (ctx && ctx.filters) || {};
    let mount = (ctx && ctx.mount) || findMount(doc);
    if (!mount) return null;

    const existing = doc.getElementById(BAR_ID);
    if (existing) existing.remove();

    const bar = buildBar(filters);
    mount.insertBefore(bar, mount.firstChild);

    bar.addEventListener("click", (ev) => {
      const chip = ev.target instanceof Element && ev.target.closest("[data-qm-filter]");
      if (!chip) return;
      const key = chip.dataset.qmFilter;
      const next = { ...filters, [key]: !filters[key] };
      const isActive = !!next[key];
      chip.classList.toggle("qm-filter-chip-active", isActive);
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      // Mutate the captured `filters` object so subsequent toggles see
      // the latest state even before storage round-trips.
      filters[key] = isActive;
      if (ctx && typeof ctx.onChange === "function") ctx.onChange({ ...next });
    });
    return bar;
  }

  function findMount(doc = document) {
    return (
      doc.querySelector(".repository-content") ||
      doc.querySelector("[data-testid='issue-list']") ||
      doc.querySelector(".js-repo-pjax-container") ||
      doc.body
    );
  }

  function removeFilterBar(doc = document) {
    const el = doc.getElementById(BAR_ID);
    if (el) el.remove();
  }

  // ===== Storage helpers ==================================================

  /** Read filters from chrome.storage.sync; resolves to a plain object. */
  async function loadFilters(storage) {
    const s = storage || (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync);
    if (!s) return {};
    return new Promise((resolve) => {
      try {
        s.get(STORAGE_KEY, (out) => {
          const v = out && out[STORAGE_KEY];
          resolve(v && typeof v === "object" ? v : {});
        });
      } catch (_e) { resolve({}); }
    });
  }

  function saveFilters(filters, storage) {
    const s = storage || (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync);
    if (!s) return Promise.resolve();
    return new Promise((resolve) => {
      try { s.set({ [STORAGE_KEY]: filters }, () => resolve()); }
      catch (_e) { resolve(); }
    });
  }

  const api = {
    ensureFilterBar,
    removeFilterBar,
    buildBar,
    findMount,
    loadFilters,
    saveFilters,
    CHIPS,
    BAR_ID,
    BAR_FLAG,
    STORAGE_KEY,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_FILTER_BAR = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
