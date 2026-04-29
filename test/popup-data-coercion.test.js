/* Coercion / malformed-input tests for lib/popup-data.js.
 * Existing popup-data.test.js assumes well-formed input; these tests verify
 * defensive behavior when upstream callers (popup.js fetch, network glitches)
 * supply garbage shapes.
 */
import { describe, it, expect } from "vitest";
import popupData from "../lib/popup-data.js";

const { aggregateMergeable, formatPopupRow } = popupData;

describe("aggregateMergeable — malformed input", () => {
  it("returns [] for non-array (null, undefined, object, string)", () => {
    expect(aggregateMergeable(null)).toEqual([]);
    expect(aggregateMergeable(undefined)).toEqual([]);
    expect(aggregateMergeable({})).toEqual([]);
    expect(aggregateMergeable("oops")).toEqual([]);
  });

  it("treats non-array prs field as empty", () => {
    const [entry] = aggregateMergeable([
      { owner: "o", repo: "r", prs: null },
    ]);
    expect(entry.totalCount).toBe(0);
    expect(entry.mergeableCount).toBe(0);
    expect(entry.prs).toEqual([]);
  });

  it("skips null/undefined pr objects without throwing", () => {
    const [entry] = aggregateMergeable([
      {
        owner: "o",
        repo: "r",
        prs: [null, undefined, { number: 1, mergeable_state: "clean" }],
      },
    ]);
    expect(entry.totalCount).toBe(3);
    expect(entry.mergeableCount).toBe(1);
  });

  it("treats missing mergeable_state as not-ready", () => {
    const [entry] = aggregateMergeable([
      { owner: "o", repo: "r", prs: [{ number: 1 }, { number: 2 }] },
    ]);
    expect(entry.mergeableCount).toBe(0);
    expect(entry.totalCount).toBe(2);
  });

  it("preserves unicode owner/repo names verbatim", () => {
    const [entry] = aggregateMergeable([
      {
        owner: "ünïcødé-org",
        repo: "日本語-repo",
        prs: [{ number: 1, mergeable_state: "clean" }],
      },
    ]);
    expect(entry.owner).toBe("ünïcødé-org");
    expect(entry.repo).toBe("日本語-repo");
    const row = formatPopupRow(entry);
    expect(row.label).toBe("ünïcødé-org/日本語-repo");
    // URL building should not throw on unicode segments — Chrome will handle
    // percent-encoding when the user clicks. The string is left raw here.
    expect(row.url).toContain("ünïcødé-org");
  });

  it("handles undefined owner without crashing (edge of bad upstream data)", () => {
    const [entry] = aggregateMergeable([
      {
        owner: undefined,
        repo: "r",
        prs: [{ number: 1, mergeable_state: "clean" }],
      },
    ]);
    expect(entry.owner).toBeUndefined();
    expect(entry.repo).toBe("r");
    expect(entry.mergeableCount).toBe(1);
  });
});
