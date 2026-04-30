/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "../lib/qm-row-widget.js";

const { makeRowWidget, _classifyState, METHOD_LABELS, METHOD_ORDER } = api;

const PR = { owner: "octocat", repo: "hello", num: 42 };

beforeEach(() => {
  document.documentElement.innerHTML = "<body></body>";
});

describe("_classifyState", () => {
  it("returns 'pending' for null state", () => {
    expect(_classifyState(null)).toBe("pending");
  });
  it("'error' when state has error", () => {
    expect(_classifyState({ error: "boom" })).toBe("error");
  });
  it("'fast' when listMode flag is set", () => {
    expect(_classifyState({ listMode: true })).toBe("fast");
  });
  it("'draft' when draft true", () => {
    expect(_classifyState({ draft: true })).toBe("draft");
  });
  it("maps mergeable_state to ready / behind / blocked", () => {
    expect(_classifyState({ mergeable_state: "clean" })).toBe("ready");
    expect(_classifyState({ mergeable_state: "behind" })).toBe("behind");
    expect(_classifyState({ mergeable_state: "blocked" })).toBe("blocked");
    expect(_classifyState({ mergeable_state: "dirty" })).toBe("blocked");
  });
});

describe("makeRowWidget construction", () => {
  it("requires { pr, onMerge }", () => {
    expect(() => makeRowWidget({})).toThrow(/required/);
    expect(() => makeRowWidget({ pr: PR })).toThrow(/required/);
  });

  it("renders status pill, main button, caret button", () => {
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "clean" }, onMerge: vi.fn() });
    document.body.appendChild(w.root);
    expect(w.root.querySelector(".qm-row-widget-status")).toBeTruthy();
    expect(w.root.querySelector(".qm-row-widget-main")).toBeTruthy();
    expect(w.root.querySelector(".qm-row-widget-caret")).toBeTruthy();
  });

  it("disables main + caret when not ready", () => {
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "blocked" }, onMerge: vi.fn() });
    expect(w.root.querySelector(".qm-row-widget-main").disabled).toBe(true);
    expect(w.root.querySelector(".qm-row-widget-caret").disabled).toBe(true);
  });

  it("enables when ready", () => {
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "clean" }, onMerge: vi.fn() });
    expect(w.root.querySelector(".qm-row-widget-main").disabled).toBe(false);
  });

  it("applies status pill data-kind based on classification", () => {
    const cases = [
      [{ mergeable_state: "clean" }, "ready", "success"],
      [{ mergeable_state: "behind" }, "behind", "warn"],
      [{ mergeable_state: "blocked" }, "blocked", "danger"],
      [{ draft: true }, "draft", "muted"],
    ];
    for (const [state, expectedState, expectedKind] of cases) {
      const w = makeRowWidget({ pr: PR, prState: state, onMerge: vi.fn() });
      const pill = w.root.querySelector(".qm-row-widget-status");
      expect(pill.dataset.state).toBe(expectedState);
      expect(pill.dataset.kind).toBe(expectedKind);
    }
  });
});

describe("setState updates", () => {
  it("transitioning behind → ready re-enables the buttons", () => {
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "behind" }, onMerge: vi.fn() });
    expect(w.root.querySelector(".qm-row-widget-main").disabled).toBe(true);
    w.setState({ mergeable_state: "clean" });
    expect(w.root.querySelector(".qm-row-widget-main").disabled).toBe(false);
  });

  it("listMode flag classifies as fast", () => {
    const w = makeRowWidget({ pr: PR, prState: { listMode: true }, onMerge: vi.fn() });
    expect(w.root.querySelector(".qm-row-widget-status").dataset.state).toBe("fast");
  });
});

describe("default-method dot + active method label", () => {
  it("main button shows the default method label by default", () => {
    const w = makeRowWidget({
      pr: PR,
      prState: { mergeable_state: "clean" },
      getDefaultMethod: () => "rebase",
      onMerge: vi.fn(),
    });
    expect(w.root.querySelector(".qm-row-widget-main").textContent).toContain("Rebase");
    expect(w.getActiveMethod()).toBe("rebase");
  });

  it("default-method dot renders only when active = default", () => {
    const w = makeRowWidget({
      pr: PR,
      prState: { mergeable_state: "clean" },
      getDefaultMethod: () => "squash",
      onMerge: vi.fn(),
    });
    expect(w.root.querySelector(".qm-row-widget-default-dot")).toBeTruthy();
  });

  it("falls back to 'squash' when getDefaultMethod returns invalid", () => {
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "clean" }, getDefaultMethod: () => "bogus", onMerge: vi.fn() });
    expect(w.getActiveMethod()).toBe("squash");
  });
});

describe("caret menu (QM-207)", () => {
  it("clicking caret opens a 3-item menu", () => {
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "clean" }, onMerge: vi.fn() });
    document.body.appendChild(w.root);
    w.root.querySelector(".qm-row-widget-caret").click();
    const items = w.root.querySelectorAll(".qm-row-widget-menuitem");
    expect(items.length).toBe(3);
    expect(Array.from(items).map((el) => el.dataset.qmMethod)).toEqual(METHOD_ORDER);
  });

  it("clicking a menu item switches active method + closes the menu", () => {
    const onMethodChange = vi.fn();
    const w = makeRowWidget({
      pr: PR,
      prState: { mergeable_state: "clean" },
      getDefaultMethod: () => "squash",
      onMerge: vi.fn(),
      onMethodChange,
    });
    document.body.appendChild(w.root);
    w.root.querySelector(".qm-row-widget-caret").click();
    const rebaseItem = w.root.querySelector('[data-qm-method="rebase"]');
    rebaseItem.click();
    expect(w.getActiveMethod()).toBe("rebase");
    expect(onMethodChange).toHaveBeenCalledWith("rebase");
    expect(w.root.querySelector(".qm-row-widget-menu")).toBeNull();
  });

  it("the menu marks the active method", () => {
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "clean" }, getDefaultMethod: () => "merge", onMerge: vi.fn() });
    document.body.appendChild(w.root);
    w.root.querySelector(".qm-row-widget-caret").click();
    const active = w.root.querySelector('.qm-row-widget-menuitem[data-active="true"]');
    expect(active.dataset.qmMethod).toBe("merge");
  });

  it("clicking caret again closes an open menu", () => {
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "clean" }, onMerge: vi.fn() });
    document.body.appendChild(w.root);
    const caret = w.root.querySelector(".qm-row-widget-caret");
    caret.click();
    expect(w.root.querySelector(".qm-row-widget-menu")).toBeTruthy();
    caret.click();
    expect(w.root.querySelector(".qm-row-widget-menu")).toBeNull();
  });
});

describe("optimistic UI on main-button click (QM-210)", () => {
  it("inserts a spinner during the merge promise", async () => {
    let resolveMerge;
    const onMerge = vi.fn(() => new Promise((r) => { resolveMerge = r; }));
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "clean" }, onMerge });
    document.body.appendChild(w.root);
    const main = w.root.querySelector(".qm-row-widget-main");
    main.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(main.classList.contains("qm-row-widget-loading")).toBe(true);
    expect(main.querySelector(".qm-row-widget-spinner")).toBeTruthy();
    resolveMerge();
    await new Promise((r) => setTimeout(r, 0));
    expect(main.classList.contains("qm-row-widget-success")).toBe(true);
    expect(main.textContent).toContain("Merged");
  });

  it("reverts to original label on rejection", async () => {
    const onMerge = vi.fn(() => Promise.reject(new Error("boom")));
    const w = makeRowWidget({ pr: PR, prState: { mergeable_state: "clean" }, getDefaultMethod: () => "squash", onMerge });
    document.body.appendChild(w.root);
    const main = w.root.querySelector(".qm-row-widget-main");
    let caught;
    main.addEventListener("click", () => {});
    try {
      await main.click();
    } catch (_) { /* click handler does throw */ }
    // Wait for the async path to settle.
    await new Promise((r) => setTimeout(r, 5));
    try {
      // The onMerge rejection bubbles out of the click handler; vitest swallows it.
      // We only assert end-state.
    } catch (e) { caught = e; }
    expect(main.disabled).toBe(false);
    expect(main.textContent).toContain("Squash");
    expect(main.classList.contains("qm-row-widget-success")).toBe(false);
  });
});

describe("hover shortcut hint (QM-209)", () => {
  it("renders the hint span when getShortcutHint returns a value", () => {
    const w = makeRowWidget({
      pr: PR,
      prState: { mergeable_state: "clean" },
      getShortcutHint: () => "S",
      onMerge: vi.fn(),
    });
    expect(w.root.querySelector(".qm-row-widget-shortcut")).toBeTruthy();
    expect(w.root.querySelector(".qm-row-widget-shortcut").textContent).toBe("S");
  });

  it("omits the hint span when getShortcutHint returns null", () => {
    const w = makeRowWidget({
      pr: PR,
      prState: { mergeable_state: "clean" },
      getShortcutHint: () => null,
      onMerge: vi.fn(),
    });
    expect(w.root.querySelector(".qm-row-widget-shortcut")).toBeNull();
  });
});

describe("METHOD_LABELS / METHOD_ORDER", () => {
  it("METHOD_ORDER is squash → merge → rebase", () => {
    expect(METHOD_ORDER).toEqual(["squash", "merge", "rebase"]);
  });
  it("METHOD_LABELS has every method", () => {
    for (const m of METHOD_ORDER) expect(METHOD_LABELS[m]).toBeTruthy();
  });
});
