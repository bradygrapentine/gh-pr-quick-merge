import { describe, it, expect } from "vitest";
import mod from "../lib/repo-defaults.js";

const { getDefault, setDefault, clearDefault, listDefaults, KEY } = mod;

function makeMockStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(key) {
      if (key in data) return { [key]: data[key] };
      return {};
    },
    async set(obj) {
      Object.assign(data, obj);
    },
    async remove(key) {
      delete data[key];
    },
  };
}

describe("KEY", () => {
  it("exports the storage key constant", () => {
    expect(KEY).toBe("repoDefaults");
  });
});

describe("getDefault", () => {
  it("returns the stored method for a known repo", async () => {
    const store = makeMockStore({
      repoDefaults: { "octocat/hello-world": "squash" },
    });
    expect(await getDefault("octocat", "hello-world", store)).toBe("squash");
  });

  it("returns null when the repo has no default", async () => {
    const store = makeMockStore({
      repoDefaults: { "octocat/other": "merge" },
    });
    expect(await getDefault("octocat", "hello-world", store)).toBeNull();
  });

  it("returns null when the store has no repoDefaults key", async () => {
    const store = makeMockStore();
    expect(await getDefault("octocat", "hello-world", store)).toBeNull();
  });
});

describe("setDefault", () => {
  it("stores squash", async () => {
    const store = makeMockStore();
    await setDefault("o", "r", "squash", store);
    expect(store.data.repoDefaults).toEqual({ "o/r": "squash" });
  });

  it("stores merge", async () => {
    const store = makeMockStore();
    await setDefault("o", "r", "merge", store);
    expect(store.data.repoDefaults).toEqual({ "o/r": "merge" });
  });

  it("stores rebase", async () => {
    const store = makeMockStore();
    await setDefault("o", "r", "rebase", store);
    expect(store.data.repoDefaults).toEqual({ "o/r": "rebase" });
  });

  it("throws on invalid method", async () => {
    const store = makeMockStore();
    await expect(setDefault("o", "r", "bogus", store)).rejects.toThrow();
    await expect(setDefault("o", "r", undefined, store)).rejects.toThrow();
  });

  it("overwrites an existing entry without disturbing others", async () => {
    const store = makeMockStore({
      repoDefaults: { "o/r": "squash", "o/keep": "rebase" },
    });
    await setDefault("o", "r", "merge", store);
    expect(store.data.repoDefaults).toEqual({
      "o/r": "merge",
      "o/keep": "rebase",
    });
  });
});

describe("clearDefault", () => {
  it("removes a single entry, leaving others intact", async () => {
    const store = makeMockStore({
      repoDefaults: { "o/r": "squash", "o/keep": "rebase" },
    });
    await clearDefault("o", "r", store);
    expect(store.data.repoDefaults).toEqual({ "o/keep": "rebase" });
  });

  it("removes the entire repoDefaults key when clearing the last entry", async () => {
    const store = makeMockStore({
      repoDefaults: { "o/r": "squash" },
    });
    await clearDefault("o", "r", store);
    expect("repoDefaults" in store.data).toBe(false);
  });

  it("is idempotent when the entry does not exist", async () => {
    const store = makeMockStore({
      repoDefaults: { "o/keep": "rebase" },
    });
    await clearDefault("o", "missing", store);
    expect(store.data.repoDefaults).toEqual({ "o/keep": "rebase" });
  });

  it("is idempotent when repoDefaults key is absent", async () => {
    const store = makeMockStore();
    await clearDefault("o", "r", store);
    expect("repoDefaults" in store.data).toBe(false);
  });
});

describe("listDefaults", () => {
  it("returns {} when the store is empty", async () => {
    const store = makeMockStore();
    expect(await listDefaults(store)).toEqual({});
  });

  it("returns the full map when populated", async () => {
    const map = { "o/r": "squash", "o/keep": "rebase" };
    const store = makeMockStore({ repoDefaults: map });
    expect(await listDefaults(store)).toEqual(map);
  });
});
