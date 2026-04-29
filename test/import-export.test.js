import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = readFileSync(path.resolve(__dirname, "../lib/import-export.js"), "utf8");

let api;

function fakeStore(initial = {}) {
  const data = { ...initial };
  return {
    get(keys) {
      const out = {};
      const list = Array.isArray(keys) ? keys : keys ? [keys] : Object.keys(data);
      for (const k of list) if (k in data) out[k] = data[k];
      return Promise.resolve(out);
    },
    set(updates) {
      Object.assign(data, updates);
      return Promise.resolve();
    },
    _data: data,
  };
}

beforeEach(() => {
  const scope = {};
  // eslint-disable-next-line no-new-func
  new Function("window", "self", "globalThis", "module", `${SRC}`)(scope, scope, scope, undefined);
  api = scope.QM_IMPORT_EXPORT;
});

describe("import-export.exportAll", () => {
  it("returns schema + only the keys present in the store", async () => {
    const store = fakeStore({ pinnedRepos: ["a/b"], qm_stale_days: 21 });
    const blob = await api.exportAll(store);
    expect(blob._schema).toBe(1);
    expect(typeof blob.exportedAt).toBe("string");
    expect(blob.pinnedRepos).toEqual(["a/b"]);
    expect(blob.qm_stale_days).toBe(21);
    expect(blob.qm_templates).toBeUndefined();
  });

  it("works on an empty store", async () => {
    const blob = await api.exportAll(fakeStore());
    expect(blob._schema).toBe(1);
    expect(Object.keys(blob).filter((k) => !k.startsWith("_") && k !== "exportedAt")).toEqual([]);
  });
});

describe("import-export.validateBlob", () => {
  it("rejects non-objects", () => {
    expect(api.validateBlob(null).valid).toBe(false);
    expect(api.validateBlob(42).valid).toBe(false);
  });
  it("rejects unknown schema versions", () => {
    expect(api.validateBlob({ _schema: 999 }).valid).toBe(false);
  });
  it("accepts a minimal valid blob", () => {
    expect(api.validateBlob({ _schema: 1 }).valid).toBe(true);
  });
  it("rejects malformed pinnedRepos", () => {
    expect(api.validateBlob({ _schema: 1, pinnedRepos: "x" }).valid).toBe(false);
  });
  it("rejects out-of-range qm_stale_days", () => {
    expect(api.validateBlob({ _schema: 1, qm_stale_days: 0 }).valid).toBe(false);
    expect(api.validateBlob({ _schema: 1, qm_stale_days: 999 }).valid).toBe(false);
    expect(api.validateBlob({ _schema: 1, qm_stale_days: 30 }).valid).toBe(true);
  });
  it("rejects array qm_templates", () => {
    expect(api.validateBlob({ _schema: 1, qm_templates: [] }).valid).toBe(false);
  });
  it("rejects non-array qm_shortcuts", () => {
    expect(api.validateBlob({ _schema: 1, qm_shortcuts: {} }).valid).toBe(false);
  });
});

describe("import-export.importAll", () => {
  it("writes only present keys to the store", async () => {
    const store = fakeStore({ pinnedRepos: ["existing/x"] });
    const blob = { _schema: 1, qm_stale_days: 21 };
    const result = await api.importAll(blob, store);
    expect(result.written).toEqual(["qm_stale_days"]);
    expect(store._data.qm_stale_days).toBe(21);
    expect(store._data.pinnedRepos).toEqual(["existing/x"]);
  });
  it("overwrites pinnedRepos when present in blob", async () => {
    const store = fakeStore({ pinnedRepos: ["a/b"] });
    await api.importAll({ _schema: 1, pinnedRepos: ["c/d", "e/f"] }, store);
    expect(store._data.pinnedRepos).toEqual(["c/d", "e/f"]);
  });
  it("throws on invalid blobs", async () => {
    await expect(api.importAll({ _schema: 1, pinnedRepos: 42 }, fakeStore())).rejects.toThrow();
  });
});

describe("import-export.parseBlob", () => {
  it("parses + validates a JSON string in one call", () => {
    const text = JSON.stringify({ _schema: 1, qm_stale_days: 30 });
    expect(api.parseBlob(text).qm_stale_days).toBe(30);
  });
  it("throws on malformed JSON", () => {
    expect(() => api.parseBlob("not json")).toThrow();
  });
  it("throws on schema mismatch", () => {
    expect(() => api.parseBlob(JSON.stringify({ _schema: 999 }))).toThrow();
  });
});
