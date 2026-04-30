/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "../lib/qm-filter-bar.js";

const { ensureFilterBar, removeFilterBar, buildBar, loadFilters, saveFilters, BAR_ID, STORAGE_KEY, CHIPS } = api;

function fakeStorage(initial = {}) {
  let store = { ...initial };
  return {
    get: (key, cb) => cb({ [key]: store[key] }),
    set: (obj, cb) => { Object.assign(store, obj); if (cb) cb(); },
    _peek: () => ({ ...store }),
  };
}

describe("buildBar", () => {
  it("renders one chip per CHIP entry with correct labels", () => {
    const bar = buildBar({});
    const chips = bar.querySelectorAll("[data-qm-filter]");
    expect(chips.length).toBe(CHIPS.length);
    // Primary chips first (Mine / Ready / Hide bots), secondary inside
    // the "More" disclosure (Stale / Small). "Hide drafts" removed in
    // UI pass 6.
    expect(Array.from(chips).map((c) => c.textContent))
      .toEqual(["Mine", "Ready", "Hide bots", "Stale", "Small"]);
  });
  it("marks chips active when filters object says so", () => {
    const bar = buildBar({ mine: true, ready: false });
    const mine = bar.querySelector('[data-qm-filter="mine"]');
    const ready = bar.querySelector('[data-qm-filter="ready"]');
    expect(mine.classList.contains("qm-filter-chip-active")).toBe(true);
    expect(mine.getAttribute("aria-pressed")).toBe("true");
    expect(ready.classList.contains("qm-filter-chip-active")).toBe(false);
    expect(ready.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("ensureFilterBar", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="repository-content"></div>';
  });

  it("mounts the bar inside .repository-content", () => {
    ensureFilterBar({ filters: {}, onChange: () => {} });
    expect(document.getElementById(BAR_ID)).toBeTruthy();
    const parent = document.getElementById(BAR_ID).parentElement;
    expect(parent.classList.contains("repository-content")).toBe(true);
  });

  it("toggling a chip flips aria-pressed and fires onChange", () => {
    const onChange = vi.fn();
    ensureFilterBar({ filters: {}, onChange });
    const mine = document.querySelector('[data-qm-filter="mine"]');
    mine.click();
    expect(mine.getAttribute("aria-pressed")).toBe("true");
    expect(onChange).toHaveBeenCalledWith({ mine: true });
  });

  it("two chip clicks compose into the filters object", () => {
    const onChange = vi.fn();
    ensureFilterBar({ filters: {}, onChange });
    document.querySelector('[data-qm-filter="mine"]').click();
    document.querySelector('[data-qm-filter="ready"]').click();
    expect(onChange).toHaveBeenLastCalledWith({ mine: true, ready: true });
  });

  it("toggling a chip off flips aria-pressed back", () => {
    const onChange = vi.fn();
    ensureFilterBar({ filters: { mine: true }, onChange });
    const mine = document.querySelector('[data-qm-filter="mine"]');
    expect(mine.getAttribute("aria-pressed")).toBe("true");
    mine.click();
    expect(mine.getAttribute("aria-pressed")).toBe("false");
    expect(onChange).toHaveBeenLastCalledWith({ mine: false });
  });

  it("re-mounting with new filters refreshes the chip states", () => {
    ensureFilterBar({ filters: { mine: true }, onChange: () => {} });
    expect(document.querySelector('[data-qm-filter="mine"]').classList.contains("qm-filter-chip-active")).toBe(true);
    ensureFilterBar({ filters: { ready: true }, onChange: () => {} });
    expect(document.querySelectorAll(`#${BAR_ID}`).length).toBe(1);
    expect(document.querySelector('[data-qm-filter="mine"]').classList.contains("qm-filter-chip-active")).toBe(false);
    expect(document.querySelector('[data-qm-filter="ready"]').classList.contains("qm-filter-chip-active")).toBe(true);
  });

  it("removeFilterBar removes the mounted element", () => {
    ensureFilterBar({ filters: {}, onChange: () => {} });
    expect(document.getElementById(BAR_ID)).toBeTruthy();
    removeFilterBar();
    expect(document.getElementById(BAR_ID)).toBeNull();
  });
});

describe("storage helpers", () => {
  it("loadFilters returns empty object when key absent", async () => {
    const s = fakeStorage();
    expect(await loadFilters(s)).toEqual({});
  });

  it("loadFilters returns the persisted shape", async () => {
    const s = fakeStorage({ [STORAGE_KEY]: { mine: true, small: true } });
    expect(await loadFilters(s)).toEqual({ mine: true, small: true });
  });

  it("saveFilters writes through to storage", async () => {
    const s = fakeStorage();
    await saveFilters({ ready: true }, s);
    expect(s._peek()).toEqual({ [STORAGE_KEY]: { ready: true } });
  });

  it("loadFilters tolerates a non-object stored value", async () => {
    const s = fakeStorage({ [STORAGE_KEY]: "garbage" });
    expect(await loadFilters(s)).toEqual({});
  });
});

describe("Track C — exclusion chips", () => {
  beforeEach(() => { document.body.innerHTML = '<div class="repository-content"></div>'; });

  it("renders Hide bots as an exclude-kind chip", () => {
    ensureFilterBar({ filters: {}, onChange: () => {} });
    const dep = document.querySelector('[data-qm-filter="hideDependabot"]');
    expect(dep).toBeTruthy();
    expect(dep.dataset.qmFilterKind).toBe("exclude");
    expect(dep.classList.contains("qm-filter-chip-exclude")).toBe(true);
  });

  it("toggling Hide bots fires onChange with the new flag", () => {
    const onChange = vi.fn();
    ensureFilterBar({ filters: {}, onChange });
    document.querySelector('[data-qm-filter="hideDependabot"]').click();
    expect(onChange).toHaveBeenCalledWith({ hideDependabot: true });
  });

  it("include + exclude chips can be active simultaneously", () => {
    ensureFilterBar({ filters: { mine: true, hideDependabot: true }, onChange: () => {} });
    expect(document.querySelector('[data-qm-filter="mine"]').classList.contains("qm-filter-chip-active")).toBe(true);
    expect(document.querySelector('[data-qm-filter="hideDependabot"]').classList.contains("qm-filter-chip-active")).toBe(true);
  });
});
