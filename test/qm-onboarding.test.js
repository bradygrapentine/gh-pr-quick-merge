/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "../lib/qm-onboarding.js";

const { shouldShow, makeCard, maybeRender, STORE_KEY, TOTAL_STEPS } = api;

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

describe("makeCard — multi-step shell", () => {
  it("returns a section with the dialog role and a 3-dot indicator", () => {
    const card = makeCard({});
    expect(card.tagName).toBe("SECTION");
    expect(card.getAttribute("role")).toBe("dialog");
    expect(card.querySelectorAll(".qm-onboarding-dot").length).toBe(TOTAL_STEPS);
  });

  it("starts on step 1 with the merge-method explainer", () => {
    const card = makeCard({});
    expect(card.dataset.qmStep).toBe("1");
    expect(card.querySelector(".qm-onboarding-title").textContent).toMatch(/Welcome/i);
    // Step 1 renders the 3 merge-method list rows (S/M/R).
    expect(card.querySelectorAll(".qm-onboarding-step").length).toBe(3);
  });

  it("step 1 hides Back; shows Skip + Next; hides Connect", () => {
    const card = makeCard({});
    expect(card.querySelector(".qm-onboarding-back").hidden).toBe(true);
    expect(card.querySelector(".qm-onboarding-skip").hidden).toBe(false);
    expect(card.querySelector(".qm-onboarding-next").hidden).toBe(false);
    expect(card.querySelector(".qm-onboarding-cta").hidden).toBe(true);
  });

  it("Next advances to step 2 and shows the row-widget mock", () => {
    const card = makeCard({});
    card.querySelector(".qm-onboarding-next").click();
    expect(card.dataset.qmStep).toBe("2");
    expect(card.querySelector(".qm-onboarding-title").textContent).toMatch(/list/i);
    expect(card.querySelector(".qm-onboarding-mock-row")).toBeTruthy();
    // Now Back is visible.
    expect(card.querySelector(".qm-onboarding-back").hidden).toBe(false);
  });

  it("Next from step 2 lands on step 3 with Connect visible", () => {
    const card = makeCard({});
    card.querySelector(".qm-onboarding-next").click();
    card.querySelector(".qm-onboarding-next").click();
    expect(card.dataset.qmStep).toBe("3");
    expect(card.querySelector(".qm-onboarding-mock-toggle")).toBeTruthy();
    expect(card.querySelector(".qm-onboarding-cta").hidden).toBe(false);
    expect(card.querySelector(".qm-onboarding-skip").hidden).toBe(true);
    expect(card.querySelector(".qm-onboarding-next").hidden).toBe(true);
  });

  it("Back from step 3 returns to step 2", () => {
    const card = makeCard({ startStep: 3 });
    card.querySelector(".qm-onboarding-back").click();
    expect(card.dataset.qmStep).toBe("2");
  });

  it("Next on the last step is a no-op (clamped)", () => {
    const card = makeCard({ startStep: 3 });
    expect(card.querySelector(".qm-onboarding-next").hidden).toBe(true);
    // Programmatic clamp guard:
    card.__qmGoToStep(99);
    expect(card.__qmCurrentStep).toBe(TOTAL_STEPS);
  });

  it("indicator marks current step active and earlier steps done", () => {
    const card = makeCard({ startStep: 2 });
    const dots = Array.from(card.querySelectorAll(".qm-onboarding-dot"));
    expect(dots[0].dataset.qmDone).toBe("true");
    expect(dots[1].dataset.qmActive).toBe("true");
    expect(dots[2].dataset.qmActive).toBe("false");
  });

  it("connect button fires onConnect (step 3)", () => {
    const onConnect = vi.fn();
    const card = makeCard({ onConnect, startStep: 3 });
    card.querySelector(".qm-onboarding-cta").click();
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it("dismiss button calls onDismiss then removes itself", async () => {
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    const card = makeCard({ onDismiss });
    document.body.appendChild(card);
    card.querySelector(".qm-onboarding-dismiss").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(document.body.contains(card)).toBe(false);
  });

  it("Skip on intermediate steps also dismisses", async () => {
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    const card = makeCard({ onDismiss, startStep: 2 });
    document.body.appendChild(card);
    card.querySelector(".qm-onboarding-skip").click();
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
