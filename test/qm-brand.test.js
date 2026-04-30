/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from "vitest";
import api from "../lib/qm-brand.js";

const { makeMark, makeWordmark, MARK_SVG } = api;

beforeEach(() => {
  document.documentElement.innerHTML = "<body></body>";
});

describe("makeMark", () => {
  it("returns a span.qm-mark containing inline SVG", () => {
    const el = makeMark();
    expect(el.tagName).toBe("SPAN");
    expect(el.classList.contains("qm-mark")).toBe(true);
    expect(el.querySelector("svg")).toBeTruthy();
  });

  it("aria-hidden when no title is supplied", () => {
    expect(makeMark().getAttribute("aria-hidden")).toBe("true");
  });

  it("becomes role=img with aria-label when title is supplied", () => {
    const el = makeMark({ title: "PR Quick Merge" });
    expect(el.getAttribute("role")).toBe("img");
    expect(el.getAttribute("aria-label")).toBe("PR Quick Merge");
    expect(el.getAttribute("aria-hidden")).toBeNull();
  });

  it("MARK_SVG is a string starting with <svg", () => {
    expect(typeof MARK_SVG).toBe("string");
    expect(MARK_SVG.startsWith("<svg")).toBe(true);
  });
});

describe("makeWordmark", () => {
  it("renders mark + product name by default", () => {
    const el = makeWordmark();
    expect(el.classList.contains("qm-wordmark")).toBe(true);
    expect(el.querySelector(".qm-mark")).toBeTruthy();
    expect(el.textContent).toContain("PR Quick Merge");
  });

  it("appends a tag span when tag is supplied", () => {
    const el = makeWordmark({ tag: "EXT" });
    const tag = el.querySelector(".qm-wordmark-tag");
    expect(tag).toBeTruthy();
    expect(tag.textContent).toBe("EXT");
  });

  it("does not render a tag span when tag is omitted", () => {
    expect(makeWordmark().querySelector(".qm-wordmark-tag")).toBeNull();
  });

  it("custom label overrides the default product name", () => {
    expect(makeWordmark({ label: "Custom" }).textContent).toContain("Custom");
  });
});
