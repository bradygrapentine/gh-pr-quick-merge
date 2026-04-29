import { describe, it, expect } from "vitest";
import mod from "../lib/repo-defaults.js";

const { pickDefaultForBulk, setDefault, clearDefault, listDefaults } = mod;

function makeMockStore(initial = {}) {
  const data = { ...initial };
  const listeners = [];
  return {
    data,
    listeners,
    async get(key) {
      if (key in data) return { [key]: data[key] };
      return {};
    },
    async set(obj) {
      const changes = {};
      for (const k of Object.keys(obj)) {
        changes[k] = { oldValue: data[k], newValue: obj[k] };
        data[k] = obj[k];
      }
      listeners.forEach((fn) => fn(changes));
    },
    async remove(key) {
      const changes = { [key]: { oldValue: data[key], newValue: undefined } };
      delete data[key];
      listeners.forEach((fn) => fn(changes));
    },
    onChanged: {
      addListener(fn) {
        listeners.push(fn);
      },
    },
  };
}

describe("pickDefaultForBulk", () => {
  it("returns the shared method when all selected PRs have the same default", () => {
    const prs = [
      { owner: "o", repo: "a" },
      { owner: "o", repo: "b" },
    ];
    const map = { "o/a": "squash", "o/b": "squash" };
    expect(pickDefaultForBulk(prs, map)).toBe("squash");
  });

  it("returns null when selected PRs have different defaults", () => {
    const prs = [
      { owner: "o", repo: "a" },
      { owner: "o", repo: "b" },
    ];
    const map = { "o/a": "squash", "o/b": "merge" };
    expect(pickDefaultForBulk(prs, map)).toBeNull();
  });

  it("returns null when none of the selected PRs have a default", () => {
    const prs = [
      { owner: "o", repo: "a" },
      { owner: "o", repo: "b" },
    ];
    expect(pickDefaultForBulk(prs, {})).toBeNull();
  });

  it("returns null for an empty selection", () => {
    expect(pickDefaultForBulk([], { "o/a": "squash" })).toBeNull();
  });

  it("returns null when only some selected PRs have a default (divergence)", () => {
    const prs = [
      { owner: "o", repo: "a" },
      { owner: "o", repo: "b" },
    ];
    const map = { "o/a": "squash" };
    expect(pickDefaultForBulk(prs, map)).toBeNull();
  });

  it("returns null when defaults map only covers a subset of selection", () => {
    const prs = [
      { owner: "o", repo: "a" },
      { owner: "o", repo: "b" },
      { owner: "o", repo: "c" },
    ];
    const map = { "o/a": "rebase", "o/b": "rebase" };
    expect(pickDefaultForBulk(prs, map)).toBeNull();
  });

  it("handles a single-item selection with a default", () => {
    const prs = [{ owner: "o", repo: "a" }];
    const map = { "o/a": "rebase" };
    expect(pickDefaultForBulk(prs, map)).toBe("rebase");
  });

  it("handles a single-item selection without a default", () => {
    const prs = [{ owner: "o", repo: "a" }];
    expect(pickDefaultForBulk(prs, {})).toBeNull();
  });

  it("treats a null/undefined map as no defaults", () => {
    const prs = [{ owner: "o", repo: "a" }];
    expect(pickDefaultForBulk(prs, null)).toBeNull();
    expect(pickDefaultForBulk(prs, undefined)).toBeNull();
  });
});

describe("storage change handling", () => {
  it("invokes the storage change handler when a default is added", async () => {
    const store = makeMockStore();
    let observed = null;
    store.onChanged.addListener((changes) => {
      if (changes.repoDefaults) observed = changes.repoDefaults.newValue;
    });
    await setDefault("o", "r", "squash", store);
    expect(observed).toEqual({ "o/r": "squash" });
  });

  it("listDefaults reflects clearDefault immediately", async () => {
    const store = makeMockStore({
      repoDefaults: { "o/r": "squash", "o/keep": "rebase" },
    });
    await clearDefault("o", "r", store);
    expect(await listDefaults(store)).toEqual({ "o/keep": "rebase" });
  });
});
