import { describe, it, expect } from "vitest";
import api from "../lib/qm-size-classify.js";

const { classifySize, isSmall } = api;

describe("classifySize (QM-501)", () => {
  it.each([
    // [additions, deletions, expected tag, lines]
    [0, 0, "XS", 0],
    [4, 5, "XS", 9],          // boundary: <=9 is XS
    [10, 0, "S", 10],         // 10 → S
    [25, 24, "S", 49],        // 49 → S
    [25, 25, "M", 50],        // 50 → M
    [100, 99, "M", 199],      // 199 → M
    [100, 100, "L", 200],     // 200 → L
    [250, 249, "L", 499],     // 499 → L
    [250, 250, "XL", 500],    // 500 → XL
    [10_000, 0, "XL", 10_000],
  ])("classifies a=%d d=%d as %s (%d lines)", (a, d, tag, lines) => {
    expect(classifySize({ additions: a, deletions: d })).toEqual({ tag, lines });
  });

  it("treats missing fields as zero", () => {
    expect(classifySize({})).toEqual({ tag: "XS", lines: 0 });
    expect(classifySize(null)).toEqual({ tag: "XS", lines: 0 });
    expect(classifySize({ additions: "not a number" })).toEqual({ tag: "XS", lines: 0 });
  });
});

describe("isSmall (QM-508 helper)", () => {
  it.each([
    [{ additions: 0, deletions: 0 }, true],   // XS
    [{ additions: 30, deletions: 19 }, true], // S
    [{ additions: 25, deletions: 25 }, false],// M
    [{ additions: 1000, deletions: 0 }, false], // XL
  ])("isSmall(%j) -> %s", (state, expected) => {
    expect(isSmall(state)).toBe(expected);
  });
});
