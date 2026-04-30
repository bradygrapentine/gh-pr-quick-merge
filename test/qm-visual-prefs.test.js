/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from "vitest";
import api from "../lib/qm-visual-prefs.js";

const { bootstrap, applyPrefs, _normalize, STORE_KEY, DEFAULTS, FONT_STACKS } = api;

function fakeStore(initial = {}) {
  const data = { ...initial };
  return {
    async get(key) { return key in data ? { [key]: data[key] } : {}; },
    async set(updates) { Object.assign(data, updates); },
    _data: data,
  };
}

beforeEach(() => {
  document.documentElement.innerHTML = "<body></body>";
  document.documentElement.removeAttribute("data-qm-density");
  document.documentElement.style.cssText = "";
});

describe("_normalize", () => {
  it("returns defaults when input is falsy", () => {
    expect(_normalize(null)).toEqual(DEFAULTS);
    expect(_normalize(undefined)).toEqual(DEFAULTS);
    expect(_normalize("nope")).toEqual(DEFAULTS);
  });

  it("accepts valid 6-char hex accent (lowercased)", () => {
    expect(_normalize({ accent: "#FF8800" }).accent).toBe("#ff8800");
  });

  it("rejects non-hex accent", () => {
    expect(_normalize({ accent: "red" }).accent).toBe(DEFAULTS.accent);
    expect(_normalize({ accent: "#fff" }).accent).toBe(DEFAULTS.accent);
  });

  it("clamps unknown density and fontFamily", () => {
    expect(_normalize({ density: "huge" }).density).toBe(DEFAULTS.density);
    expect(_normalize({ fontFamily: "comic" }).fontFamily).toBe(DEFAULTS.fontFamily);
  });

  it("preserves valid values", () => {
    expect(_normalize({ density: "compact", fontFamily: "inter", accent: "#abcdef" })).toEqual({
      density: "compact",
      fontFamily: "inter",
      accent: "#abcdef",
    });
  });
});

describe("applyPrefs", () => {
  it("writes CSS vars + density attr on the root", () => {
    applyPrefs(document.documentElement, { accent: "#112233", density: "compact", fontFamily: "inter" });
    expect(document.documentElement.style.getPropertyValue("--qm-accent")).toBe("#112233");
    expect(document.documentElement.dataset.qmDensity).toBe("compact");
    expect(document.documentElement.style.getPropertyValue("--qm-font-family")).toBe(FONT_STACKS.inter);
  });

  it("ignores null root without throwing", () => {
    expect(() => applyPrefs(null, DEFAULTS)).not.toThrow();
  });
});

describe("bootstrap", () => {
  it("requires a root", async () => {
    await expect(bootstrap({})).rejects.toThrow(/root/);
  });

  it("applies stored prefs on init", async () => {
    const store = fakeStore({ [STORE_KEY]: { accent: "#abcdef", density: "compact", fontFamily: "inter" } });
    const ctl = await bootstrap({ root: document.documentElement, store });
    expect(ctl.get()).toEqual({ accent: "#abcdef", density: "compact", fontFamily: "inter" });
    expect(document.documentElement.dataset.qmDensity).toBe("compact");
  });

  it("falls back to defaults when storage empty", async () => {
    const ctl = await bootstrap({ root: document.documentElement, store: fakeStore() });
    expect(ctl.get()).toEqual(DEFAULTS);
  });

  it("set() persists merged prefs and re-applies", async () => {
    const store = fakeStore();
    const ctl = await bootstrap({ root: document.documentElement, store });
    await ctl.set({ accent: "#222222" });
    expect(ctl.get().accent).toBe("#222222");
    expect(ctl.get().density).toBe(DEFAULTS.density);
    expect(store._data[STORE_KEY].accent).toBe("#222222");
    expect(document.documentElement.style.getPropertyValue("--qm-accent")).toBe("#222222");
  });

  it("set() drops invalid partial values silently (defaults preserved)", async () => {
    const store = fakeStore();
    const ctl = await bootstrap({ root: document.documentElement, store });
    await ctl.set({ density: "huge" });
    expect(ctl.get().density).toBe(DEFAULTS.density);
  });

  it("chrome.storage.onChanged broadcasts re-apply", async () => {
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
      const ctl = await bootstrap({ root: document.documentElement, store: fakeStore() });
      storageCb({ [STORE_KEY]: { newValue: { accent: "#333333", density: "compact", fontFamily: "inter" } } }, "sync");
      expect(ctl.get().accent).toBe("#333333");
      expect(ctl.get().density).toBe("compact");
      // Non-sync area ignored.
      storageCb({ [STORE_KEY]: { newValue: { accent: "#444444" } } }, "local");
      expect(ctl.get().accent).toBe("#333333");
      ctl.dispose();
    } finally {
      globalThis.chrome = prev;
    }
  });
});
