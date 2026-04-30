/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "../lib/qm-onboarding.js";

const { shouldShow, makeCard, maybeRender, STORE_KEY } = api;

function fakeLocal(initial = {}) {
  const data = { ...initial };
  return {
    async get(keys) {
      const out = {};
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(updates) { Object.assign(data, updates); },
    _data: data,
  };
}
function fakeSync(initial = {}) {
  const data = { ...initial };
  return {
    async get(key) { return key in data ? { [key]: data[key] } : {}; },
    _data: data,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("shouldShow", () => {
  it("true when nothing configured + not dismissed", () => {
    expect(shouldShow({})).toBe(true);
  });
  it("false when dismissed", () => {
    expect(shouldShow({ dismissed: true })).toBe(false);
  });
  it("false when token already present", () => {
    expect(shouldShow({ token: "ghp_xxx" })).toBe(false);
  });
  it("false when clientId already saved", () => {
    expect(shouldShow({ clientId: "Iv1.abc" })).toBe(false);
  });
});

describe("makeCard", () => {
  it("returns a section with the dialog role and three steps", () => {
    const card = makeCard({});
    expect(card.tagName).toBe("SECTION");
    expect(card.getAttribute("role")).toBe("dialog");
    expect(card.querySelectorAll(".qm-onboarding-step").length).toBe(3);
    expect(card.querySelector(".qm-onboarding-cta").textContent).toMatch(/Continue/i);
  });

  it("connect button fires onConnect", () => {
    const onConnect = vi.fn();
    const card = makeCard({ onConnect });
    card.querySelector(".qm-onboarding-cta").click();
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it("dismiss button calls onDismiss then removes itself", async () => {
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    const card = makeCard({ onDismiss });
    document.body.appendChild(card);
    card.querySelector(".qm-onboarding-dismiss").click();
    // Wait a microtask for the async handler.
    await new Promise((r) => setTimeout(r, 0));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(document.body.contains(card)).toBe(false);
  });
});

describe("maybeRender", () => {
  it("renders when no clientId, no token, not dismissed", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const card = await maybeRender({
      mount,
      localStore: fakeLocal(),
      syncStore: fakeSync(),
      onConnect: () => {},
    });
    expect(card).not.toBeNull();
    expect(mount.querySelector(".qm-onboarding")).toBeTruthy();
  });

  it("skips rendering when token present", async () => {
    const mount = document.createElement("div");
    const card = await maybeRender({
      mount,
      localStore: fakeLocal({ token: "ghp_xxx" }),
      syncStore: fakeSync(),
      onConnect: () => {},
    });
    expect(card).toBeNull();
  });

  it("skips rendering when previously dismissed", async () => {
    const mount = document.createElement("div");
    const card = await maybeRender({
      mount,
      localStore: fakeLocal({ [STORE_KEY]: true }),
      syncStore: fakeSync(),
      onConnect: () => {},
    });
    expect(card).toBeNull();
  });

  it("dismiss persists to localStore", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const localStore = fakeLocal();
    const card = await maybeRender({
      mount,
      localStore,
      syncStore: fakeSync(),
      onConnect: () => {},
    });
    card.querySelector(".qm-onboarding-dismiss").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(localStore._data[STORE_KEY]).toBe(true);
  });
});
