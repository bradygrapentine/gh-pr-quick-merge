/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from "vitest";
import api from "../lib/qm-theme.js";

const { resolveTheme, applyTheme, bootstrap, STORE_KEY, VALID } = api;

function fakeStore(initial = {}) {
  const data = { ...initial };
  return {
    async get(key) {
      if (key in data) return { [key]: data[key] };
      return {};
    },
    async set(updates) { Object.assign(data, updates); },
    _data: data,
  };
}

function fakeMql(matches) {
  return {
    matches,
    addEventListener() {},
    removeEventListener() {},
  };
}

beforeEach(() => {
  document.documentElement.innerHTML = "<body></body>";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-color-mode");
});

describe("resolveTheme", () => {
  it("explicit override wins over everything", () => {
    expect(resolveTheme({ override: "dark", mql: fakeMql(false) })).toBe("dark");
    expect(resolveTheme({ override: "light", mql: fakeMql(true) })).toBe("light");
  });

  it("auto + GitHub data-color-mode='dark' resolves to dark", () => {
    document.documentElement.setAttribute("data-color-mode", "dark");
    expect(resolveTheme({ override: "auto", doc: document, mql: fakeMql(false) })).toBe("dark");
  });

  it("auto + prefers-color-scheme dark resolves to dark when GitHub mode absent", () => {
    expect(resolveTheme({ override: "auto", doc: document, mql: fakeMql(true) })).toBe("dark");
  });

  it("auto + no signals falls back to light", () => {
    expect(resolveTheme({ override: "auto", doc: document, mql: fakeMql(false) })).toBe("light");
  });
});

describe("applyTheme", () => {
  it("writes data-theme on the supplied root", () => {
    applyTheme(document.documentElement, "dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("ignores invalid theme values", () => {
    applyTheme(document.documentElement, "invalid");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});

describe("bootstrap", () => {
  it("applies stored override on init", async () => {
    const store = fakeStore({ [STORE_KEY]: "dark" });
    const root = document.documentElement;
    const ctl = await bootstrap({ root, store, doc: document, mql: fakeMql(false) });
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(ctl.get()).toBe("dark");
  });

  it("set() updates root + persists to store", async () => {
    const store = fakeStore();
    const root = document.documentElement;
    const ctl = await bootstrap({ root, store, doc: document, mql: fakeMql(false) });
    await ctl.set("dark");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(store._data[STORE_KEY]).toBe("dark");
  });

  it("set() rejects unknown values", async () => {
    const store = fakeStore();
    const ctl = await bootstrap({ root: document.documentElement, store, doc: document, mql: fakeMql(false) });
    await expect(ctl.set("blue")).rejects.toThrow();
  });

  it("requires a root", async () => {
    await expect(bootstrap({})).rejects.toThrow(/root/);
  });

  it("VALID lists exactly light, dark, auto", () => {
    expect(VALID).toEqual(["light", "dark", "auto"]);
  });

  it("dispose() detaches matchMedia + storage listeners", async () => {
    let added = 0, removed = 0;
    const mql = {
      matches: false,
      addEventListener: () => { added++; },
      removeEventListener: () => { removed++; },
    };
    const ctl = await bootstrap({ root: document.documentElement, store: fakeStore(), doc: document, mql });
    expect(added).toBe(1);
    ctl.dispose();
    expect(removed).toBe(1);
  });

  it("matchMedia change re-resolves when override is auto", async () => {
    let listener = null;
    const mql = {
      matches: false,
      addEventListener: (_, fn) => { listener = fn; },
      removeEventListener() {},
    };
    const ctl = await bootstrap({ root: document.documentElement, store: fakeStore(), doc: document, mql });
    expect(ctl.get()).toBe("light");
    mql.matches = true;
    listener({ matches: true });
    expect(ctl.get()).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("matchMedia change is ignored when override is not auto", async () => {
    let listener = null;
    const mql = {
      matches: false,
      addEventListener: (_, fn) => { listener = fn; },
      removeEventListener() {},
    };
    const ctl = await bootstrap({ root: document.documentElement, store: fakeStore({ [STORE_KEY]: "light" }), doc: document, mql });
    mql.matches = true;
    listener({ matches: true });
    expect(ctl.get()).toBe("light");
  });

  it("invalid stored value falls back to auto", async () => {
    const store = fakeStore({ [STORE_KEY]: "neon" });
    const ctl = await bootstrap({ root: document.documentElement, store, doc: document, mql: fakeMql(true) });
    expect(ctl.get()).toBe("dark"); // auto + mql.matches=true
  });

  it("chrome.storage.onChanged listener flips theme when sync key changes", async () => {
    let storageCb = null;
    const fakeChrome = {
      storage: {
        onChanged: {
          addListener: (cb) => { storageCb = cb; },
          removeListener: () => { storageCb = null; },
        },
      },
    };
    const prev = globalThis.chrome;
    globalThis.chrome = fakeChrome;
    try {
      const ctl = await bootstrap({ root: document.documentElement, store: fakeStore(), doc: document, mql: fakeMql(false) });
      expect(ctl.get()).toBe("light");
      // Simulate storage flip from another surface.
      storageCb({ [STORE_KEY]: { newValue: "dark" } }, "sync");
      expect(ctl.get()).toBe("dark");
      // Non-sync area is ignored.
      storageCb({ [STORE_KEY]: { newValue: "light" } }, "local");
      expect(ctl.get()).toBe("dark");
      // Unrelated key is ignored.
      storageCb({ otherKey: { newValue: "x" } }, "sync");
      expect(ctl.get()).toBe("dark");
      ctl.dispose();
    } finally {
      globalThis.chrome = prev;
    }
  });
});
