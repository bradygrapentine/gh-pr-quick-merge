/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import api from "../lib/host-tokens.js";

const { migrate, getHostToken, setHostToken, removeHostToken, TOKENS_KEY, LEGACY_TOKEN_KEY } = api;

function fakeStore(initial = {}) {
  const data = { ...initial };
  return {
    _data: data,
    get: async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    set: async (obj) => {
      Object.assign(data, obj);
    },
    remove: async (key) => {
      delete data[key];
    },
  };
}

describe("host-tokens.migrate", () => {
  it("copies legacy token to tokens['github.com'] on first run", async () => {
    const store = fakeStore({ [LEGACY_TOKEN_KEY]: "ghp_abc" });
    const result = await migrate(store);
    expect(result.migrated).toBe(true);
    expect(store._data[TOKENS_KEY]).toEqual({ "github.com": "ghp_abc" });
    expect(store._data[LEGACY_TOKEN_KEY]).toBe("ghp_abc"); // legacy retained
  });

  it("is idempotent — second call doesn't overwrite an existing entry", async () => {
    const store = fakeStore({
      [LEGACY_TOKEN_KEY]: "ghp_old",
      [TOKENS_KEY]: { "github.com": "ghp_new" },
    });
    const result = await migrate(store);
    expect(result.migrated).toBe(false);
    expect(store._data[TOKENS_KEY]["github.com"]).toBe("ghp_new");
  });

  it("preserves other entries in the tokens map", async () => {
    const store = fakeStore({
      [LEGACY_TOKEN_KEY]: "ghp_xyz",
      [TOKENS_KEY]: { "gitlab.com": "glpat-foo" },
    });
    await migrate(store);
    expect(store._data[TOKENS_KEY]).toEqual({
      "github.com": "ghp_xyz",
      "gitlab.com": "glpat-foo",
    });
  });

  it("initialises an empty tokens map when there's nothing to migrate", async () => {
    const store = fakeStore({});
    const result = await migrate(store);
    expect(result.migrated).toBe(false);
    expect(store._data[TOKENS_KEY]).toEqual({});
  });

  it("doesn't touch tokens when legacy token is missing AND tokens already exists", async () => {
    const store = fakeStore({ [TOKENS_KEY]: { "gitlab.com": "glpat-bar" } });
    const result = await migrate(store);
    expect(result.migrated).toBe(false);
    expect(store._data[TOKENS_KEY]).toEqual({ "gitlab.com": "glpat-bar" });
  });

  it("rejects a missing or malformed store", async () => {
    await expect(migrate(null)).rejects.toThrow(/store/);
    await expect(migrate({})).rejects.toThrow(/store/);
  });
});

describe("host-tokens.getHostToken", () => {
  it("reads from the new tokens shape", async () => {
    const store = fakeStore({ [TOKENS_KEY]: { "github.com": "ghp_a", "gitlab.com": "glpat-b" } });
    expect(await getHostToken("github", store)).toBe("ghp_a");
    expect(await getHostToken("gitlab", store)).toBe("glpat-b");
  });

  it("falls back to legacy token for GitHub", async () => {
    const store = fakeStore({ [LEGACY_TOKEN_KEY]: "ghp_legacy" });
    expect(await getHostToken("github", store)).toBe("ghp_legacy");
  });

  it("does NOT fall back for non-GitHub hosts", async () => {
    const store = fakeStore({ [LEGACY_TOKEN_KEY]: "ghp_legacy" });
    expect(await getHostToken("gitlab", store)).toBe("");
  });

  it("returns empty string when nothing is stored", async () => {
    const store = fakeStore({});
    expect(await getHostToken("github", store)).toBe("");
    expect(await getHostToken("gitlab", store)).toBe("");
  });

  it("prefers the new shape over the legacy fallback", async () => {
    const store = fakeStore({
      [TOKENS_KEY]: { "github.com": "ghp_new" },
      [LEGACY_TOKEN_KEY]: "ghp_old",
    });
    expect(await getHostToken("github", store)).toBe("ghp_new");
  });
});

describe("host-tokens.setHostToken / removeHostToken", () => {
  it("writes a new tokens entry and mirrors GitHub to the legacy key", async () => {
    const store = fakeStore({});
    await setHostToken("github", "ghp_fresh", store);
    expect(store._data[TOKENS_KEY]).toEqual({ "github.com": "ghp_fresh" });
    expect(store._data[LEGACY_TOKEN_KEY]).toBe("ghp_fresh");
  });

  it("does NOT mirror non-GitHub writes to the legacy key", async () => {
    const store = fakeStore({});
    await setHostToken("gitlab", "glpat-x", store);
    expect(store._data[TOKENS_KEY]).toEqual({ "gitlab.com": "glpat-x" });
    expect(store._data[LEGACY_TOKEN_KEY]).toBeUndefined();
  });

  it("removeHostToken('github') clears both shape entries", async () => {
    const store = fakeStore({
      [TOKENS_KEY]: { "github.com": "ghp_a", "gitlab.com": "glpat-b" },
      [LEGACY_TOKEN_KEY]: "ghp_a",
    });
    await removeHostToken("github", store);
    expect(store._data[TOKENS_KEY]).toEqual({ "gitlab.com": "glpat-b" });
    expect(store._data[LEGACY_TOKEN_KEY]).toBeUndefined();
  });

  it("removeHostToken('gitlab') leaves the legacy key alone", async () => {
    const store = fakeStore({
      [TOKENS_KEY]: { "github.com": "ghp_a", "gitlab.com": "glpat-b" },
      [LEGACY_TOKEN_KEY]: "ghp_a",
    });
    await removeHostToken("gitlab", store);
    expect(store._data[TOKENS_KEY]).toEqual({ "github.com": "ghp_a" });
    expect(store._data[LEGACY_TOKEN_KEY]).toBe("ghp_a");
  });

  it("setHostToken with empty string clears the entry", async () => {
    const store = fakeStore({ [TOKENS_KEY]: { "github.com": "ghp_a" }, [LEGACY_TOKEN_KEY]: "ghp_a" });
    await setHostToken("github", "", store);
    expect(store._data[TOKENS_KEY]).toEqual({});
    expect(store._data[LEGACY_TOKEN_KEY]).toBeUndefined();
  });
});
