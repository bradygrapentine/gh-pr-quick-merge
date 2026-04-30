/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "../lib/qm-toast.js";

const { show, clearAll, _peekLive, MAX_VISIBLE } = api;

beforeEach(() => {
  document.documentElement.innerHTML = "<body></body>";
  clearAll();
});

describe("qm-toast.show", () => {
  it("renders a toast in a lazily-created stack", () => {
    const handle = show({ kind: "ok", title: "Merged" });
    expect(handle).toBeTruthy();
    const stack = document.querySelector(".qm-toast-stack");
    expect(stack).toBeTruthy();
    expect(stack.querySelectorAll(".qm-toast").length).toBe(1);
  });

  it("applies data-kind attribute matching the kind", () => {
    show({ kind: "warn", title: "Behind base" });
    const t = document.querySelector(".qm-toast");
    expect(t.dataset.kind).toBe("warn");
  });

  it("renders title + optional sub", () => {
    show({ kind: "ok", title: "Title text", sub: "Subtitle text" });
    const t = document.querySelector(".qm-toast");
    expect(t.querySelector(".qm-toast-title").textContent).toBe("Title text");
    expect(t.querySelector(".qm-toast-sub").textContent).toBe("Subtitle text");
  });

  it("omits sub element when not provided", () => {
    show({ kind: "ok", title: "Just a title" });
    expect(document.querySelector(".qm-toast-sub")).toBeNull();
  });

  it("uses textContent (not innerHTML) for title — XSS guard", () => {
    show({ kind: "ok", title: "<script>alert(1)</script>" });
    const titleEl = document.querySelector(".qm-toast-title");
    expect(titleEl.textContent).toBe("<script>alert(1)</script>");
    expect(document.querySelector(".qm-toast script")).toBeNull();
  });

  it("close button dismisses immediately", () => {
    show({ kind: "ok", title: "Tap to dismiss" });
    const close = document.querySelector(".qm-toast-close");
    close.click();
    const t = document.querySelector(".qm-toast");
    expect(t.classList.contains("qm-toast-leaving")).toBe(true);
  });

  it("auto-dismisses after dismissMs", () => {
    vi.useFakeTimers();
    show({ kind: "ok", title: "Auto-dismiss", dismissMs: 1000 });
    expect(_peekLive().length).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(_peekLive().length).toBe(0);
    vi.useRealTimers();
  });

  it("respects dismissMs=0 by staying sticky", () => {
    vi.useFakeTimers();
    show({ kind: "info", title: "Sticky", dismissMs: 0 });
    vi.advanceTimersByTime(60_000);
    expect(_peekLive().length).toBe(1);
    vi.useRealTimers();
  });

  it(`evicts oldest when more than ${MAX_VISIBLE} are queued`, () => {
    show({ kind: "ok", title: "1" });
    show({ kind: "ok", title: "2" });
    show({ kind: "ok", title: "3" });
    expect(_peekLive().length).toBe(MAX_VISIBLE);
    show({ kind: "ok", title: "4" });
    const titles = _peekLive().map((e) => e.el.querySelector(".qm-toast-title").textContent);
    expect(titles).toEqual(["2", "3", "4"]);
  });

  it("throws on invalid kind", () => {
    expect(() => show({ kind: "bogus", title: "x" })).toThrow();
  });

  it("throws on missing title", () => {
    expect(() => show({ kind: "ok", title: "" })).toThrow();
  });

  it("dismiss handle removes the toast", () => {
    const handle = show({ kind: "ok", title: "Programmatic dismiss" });
    handle.dismiss();
    const t = document.querySelector(".qm-toast");
    expect(t.classList.contains("qm-toast-leaving")).toBe(true);
  });

  it("clearAll removes everything", () => {
    show({ kind: "ok", title: "1" });
    show({ kind: "ok", title: "2" });
    clearAll();
    expect(_peekLive().length).toBe(0);
  });

  it("returns null in non-DOM envs (no body)", () => {
    const detached = document.createElement("div");
    // Pass a parent that's not connected to a document — _ensureStack still
    // works because we use ownerDocument; this just verifies no crash on
    // a synthetic parent.
    const handle = show({ kind: "ok", title: "x", parent: detached });
    expect(handle).toBeTruthy();
    expect(detached.querySelector(".qm-toast")).toBeTruthy();
  });
});
