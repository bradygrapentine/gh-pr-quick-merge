/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "../lib/qm-auto-rebase-toggle.js";

const { loadAutoRebaseMap, saveAutoRebaseMap, isEnabled, setEnabled, mountToggle, teardown, STORAGE_KEY, TOGGLE_FLAG } = api;

const PR = (overrides = {}) => ({ owner: "octo", repo: "x", num: 1, ...overrides });

function fakeStorage(initial = {}) {
  let store = { ...initial };
  return {
    get: (key, cb) => cb({ [key]: store[key] }),
    set: (obj, cb) => { Object.assign(store, obj); if (cb) cb(); },
    _peek: () => ({ ...store }),
  };
}

describe("isEnabled / setEnabled (pure)", () => {
  it("isEnabled returns false when key missing", () => {
    expect(isEnabled(PR(), {})).toBe(false);
    expect(isEnabled(PR(), null)).toBe(false);
    expect(isEnabled(null, { "octo/x#1": true })).toBe(false);
  });
  it("isEnabled returns true when key present", () => {
    expect(isEnabled(PR(), { "octo/x#1": true })).toBe(true);
  });
  it("setEnabled adds the key when enabling", () => {
    const next = setEnabled(PR(), {}, true);
    expect(next).toEqual({ "octo/x#1": true });
  });
  it("setEnabled removes the key when disabling", () => {
    const next = setEnabled(PR(), { "octo/x#1": true, "other/r#5": true }, false);
    expect(next).toEqual({ "other/r#5": true });
  });
  it("setEnabled returns a fresh object reference", () => {
    const map = { "octo/x#1": true };
    const next = setEnabled(PR(), map, true);
    expect(next).not.toBe(map);
  });
  it("setEnabled is a no-op when pr is null", () => {
    const map = { "octo/x#1": true };
    const next = setEnabled(null, map, true);
    expect(next).toEqual(map);
  });
});

describe("storage round-trip", () => {
  it("loadAutoRebaseMap returns empty when missing", async () => {
    expect(await loadAutoRebaseMap(fakeStorage())).toEqual({});
  });
  it("loadAutoRebaseMap returns persisted shape", async () => {
    const s = fakeStorage({ [STORAGE_KEY]: { "a/b#1": true } });
    expect(await loadAutoRebaseMap(s)).toEqual({ "a/b#1": true });
  });
  it("loadAutoRebaseMap tolerates a non-object stored value", async () => {
    expect(await loadAutoRebaseMap(fakeStorage({ [STORAGE_KEY]: ["not", "object"] }))).toEqual({});
    expect(await loadAutoRebaseMap(fakeStorage({ [STORAGE_KEY]: "garbage" }))).toEqual({});
  });
  it("saveAutoRebaseMap writes through", async () => {
    const s = fakeStorage();
    await saveAutoRebaseMap({ "x/y#9": true }, s);
    expect(s._peek()).toEqual({ [STORAGE_KEY]: { "x/y#9": true } });
  });
});

describe("mountToggle / teardown DOM", () => {
  beforeEach(() => { document.body.innerHTML = '<span class="qm-container"></span>'; });
  const container = () => document.querySelector(".qm-container");

  it("mounts a checkbox with the right initial state", () => {
    mountToggle(container(), PR(), { enabled: false, onChange: () => {} });
    const wrap = container().querySelector(`[${TOGGLE_FLAG}]`);
    expect(wrap).toBeTruthy();
    const cb = wrap.querySelector("input[type='checkbox']");
    expect(cb.checked).toBe(false);
    expect(cb.getAttribute("aria-label")).toMatch(/octo\/x#1/);
  });

  it("renders checked when enabled is true", () => {
    mountToggle(container(), PR(), { enabled: true, onChange: () => {} });
    expect(container().querySelector("input[type='checkbox']").checked).toBe(true);
  });

  it("change event fires onChange with new bool value", () => {
    const onChange = vi.fn();
    mountToggle(container(), PR(), { enabled: false, onChange });
    const cb = container().querySelector("input[type='checkbox']");
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(true);
    cb.checked = false;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("re-mounting refreshes the checkbox state without duplicating", () => {
    mountToggle(container(), PR(), { enabled: false, onChange: () => {} });
    mountToggle(container(), PR(), { enabled: true, onChange: () => {} });
    const wraps = container().querySelectorAll(`[${TOGGLE_FLAG}]`);
    expect(wraps.length).toBe(1);
    expect(wraps[0].querySelector("input[type='checkbox']").checked).toBe(true);
  });

  it("teardown removes the toggle", () => {
    mountToggle(container(), PR(), { enabled: true, onChange: () => {} });
    teardown(container());
    expect(container().querySelector(`[${TOGGLE_FLAG}]`)).toBeNull();
  });

  it("mountToggle returns null on missing args", () => {
    expect(mountToggle(null, PR(), {})).toBeNull();
    expect(mountToggle(container(), null, {})).toBeNull();
  });
});
