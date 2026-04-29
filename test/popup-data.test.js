import { describe, it, expect } from "vitest";
import popupData from "../lib/popup-data.js";

const { aggregateMergeable, formatPopupRow, EMPTY_STATE_HINT } = popupData;

const pr = (number, mergeable_state, title = `pr-${number}`) => ({
  number,
  mergeable_state,
  title,
});

describe("aggregateMergeable", () => {
  it("returns [] for empty input", () => {
    expect(aggregateMergeable([])).toEqual([]);
  });

  it("counts only ready states (clean/has_hooks/unstable) toward mergeable", () => {
    const [entry] = aggregateMergeable([
      {
        owner: "octo",
        repo: "alpha",
        prs: [
          pr(1, "clean"),
          pr(2, "has_hooks"),
          pr(3, "unstable"),
          pr(4, "dirty"),
          pr(5, "blocked"),
        ],
      },
    ]);
    expect(entry.mergeableCount).toBe(3);
    expect(entry.totalCount).toBe(5);
  });

  it("excludes pending (mergeable_state=null) from count but keeps in total", () => {
    const [entry] = aggregateMergeable([
      {
        owner: "o",
        repo: "r",
        prs: [pr(1, "clean"), pr(2, null), pr(3, null)],
      },
    ]);
    expect(entry.mergeableCount).toBe(1);
    expect(entry.totalCount).toBe(3);
  });

  it("sorts by mergeableCount descending", () => {
    const result = aggregateMergeable([
      { owner: "o", repo: "low", prs: [pr(1, "clean")] },
      { owner: "o", repo: "high", prs: [pr(1, "clean"), pr(2, "clean"), pr(3, "clean")] },
      { owner: "o", repo: "mid", prs: [pr(1, "clean"), pr(2, "clean")] },
    ]);
    expect(result.map((e) => e.repo)).toEqual(["high", "mid", "low"]);
  });

  it("breaks ties alphabetically by owner/repo", () => {
    const result = aggregateMergeable([
      { owner: "b-org", repo: "z-repo", prs: [pr(1, "clean")] },
      { owner: "a-org", repo: "y-repo", prs: [pr(1, "clean")] },
      { owner: "a-org", repo: "x-repo", prs: [pr(1, "clean")] },
    ]);
    expect(result.map((e) => `${e.owner}/${e.repo}`)).toEqual([
      "a-org/x-repo",
      "a-org/y-repo",
      "b-org/z-repo",
    ]);
  });

  it("does not mutate input arrays", () => {
    const input = [{ owner: "o", repo: "r", prs: [pr(1, "clean")] }];
    const snapshot = JSON.stringify(input);
    aggregateMergeable(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("handles repos with zero PRs", () => {
    const [entry] = aggregateMergeable([{ owner: "o", repo: "empty", prs: [] }]);
    expect(entry.mergeableCount).toBe(0);
    expect(entry.totalCount).toBe(0);
  });

  it("preserves the prs array on each entry", () => {
    const prs = [pr(1, "clean"), pr(2, "dirty")];
    const [entry] = aggregateMergeable([{ owner: "o", repo: "r", prs }]);
    expect(entry.prs).toHaveLength(2);
    expect(entry.prs[0].number).toBe(1);
  });
});

describe("formatPopupRow", () => {
  it("happy path: 3 of 7 ready", () => {
    expect(
      formatPopupRow({
        owner: "octo",
        repo: "hello",
        mergeableCount: 3,
        totalCount: 7,
        prs: [],
      })
    ).toEqual({
      label: "octo/hello",
      subtitle: "3 of 7 ready to merge",
      url: "https://github.com/octo/hello/pulls",
    });
  });

  it("0 mergeable but PRs exist", () => {
    const row = formatPopupRow({
      owner: "o",
      repo: "r",
      mergeableCount: 0,
      totalCount: 4,
      prs: [],
    });
    expect(row.subtitle).toBe("0 of 4 ready to merge");
  });

  it("totalCount of 0 → 'no open PRs'", () => {
    const row = formatPopupRow({
      owner: "o",
      repo: "r",
      mergeableCount: 0,
      totalCount: 0,
      prs: [],
    });
    expect(row.subtitle).toBe("no open PRs");
  });

  it("URL format is exact", () => {
    const row = formatPopupRow({
      owner: "octo",
      repo: "hello-world",
      mergeableCount: 1,
      totalCount: 1,
      prs: [],
    });
    expect(row.url).toBe("https://github.com/octo/hello-world/pulls");
  });

  it("does not truncate long owner/repo labels", () => {
    const longOwner = "a-very-long-organisation-name";
    const longRepo = "an-equally-verbose-repository-identifier";
    const row = formatPopupRow({
      owner: longOwner,
      repo: longRepo,
      mergeableCount: 1,
      totalCount: 1,
      prs: [],
    });
    expect(row.label).toBe(`${longOwner}/${longRepo}`);
  });
});

describe("EMPTY_STATE_HINT", () => {
  it("is a non-empty string", () => {
    expect(typeof EMPTY_STATE_HINT).toBe("string");
    expect(EMPTY_STATE_HINT.length).toBeGreaterThan(0);
  });
});
