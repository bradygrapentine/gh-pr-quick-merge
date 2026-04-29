import { describe, it, expect } from "vitest";
import helpers from "../lib/pr-helpers.js";

const { parsePrLink, classifyMergeState, mergeMethodFromKind } = helpers;

describe("parsePrLink", () => {
  it("parses a root-relative PR path", () => {
    expect(parsePrLink("/octocat/hello-world/pull/42")).toEqual({
      owner: "octocat",
      repo: "hello-world",
      num: 42,
    });
  });

  it("parses a full GitHub URL with extra path segments", () => {
    expect(
      parsePrLink("https://github.com/octocat/hello-world/pull/7/files")
    ).toEqual({ owner: "octocat", repo: "hello-world", num: 7 });
  });

  it("returns null for an issue page (non-PR)", () => {
    expect(parsePrLink("/octocat/hello-world/issues/42")).toBeNull();
  });

  it("returns null for a root path", () => {
    expect(parsePrLink("/")).toBeNull();
  });

  it("returns null for missing input", () => {
    expect(parsePrLink(null)).toBeNull();
    expect(parsePrLink(undefined)).toBeNull();
    expect(parsePrLink("")).toBeNull();
  });
});

describe("classifyMergeState", () => {
  it("clean + mergeable=true => ready", () => {
    expect(
      classifyMergeState({ mergeable: true, mergeable_state: "clean" })
    ).toBe("ready");
  });

  it("unstable + mergeable=true => ready", () => {
    expect(
      classifyMergeState({ mergeable: true, mergeable_state: "unstable" })
    ).toBe("ready");
  });

  it("has_hooks + mergeable=true => ready", () => {
    expect(
      classifyMergeState({ mergeable: true, mergeable_state: "has_hooks" })
    ).toBe("ready");
  });

  it("dirty => blocked", () => {
    expect(
      classifyMergeState({ mergeable: false, mergeable_state: "dirty" })
    ).toBe("blocked");
  });

  it("blocked state => blocked", () => {
    expect(
      classifyMergeState({ mergeable: true, mergeable_state: "blocked" })
    ).toBe("blocked");
  });

  it("mergeable=false => blocked", () => {
    expect(
      classifyMergeState({ mergeable: false, mergeable_state: "unknown" })
    ).toBe("blocked");
  });

  it("mergeable=null => pending", () => {
    expect(
      classifyMergeState({ mergeable: null, mergeable_state: "unknown" })
    ).toBe("pending");
  });

  it("empty object => pending", () => {
    expect(classifyMergeState({})).toBe("pending");
  });
});

describe("mergeMethodFromKind", () => {
  it("squash => squash", () => {
    expect(mergeMethodFromKind("squash")).toBe("squash");
  });

  it("rebase => rebase", () => {
    expect(mergeMethodFromKind("rebase")).toBe("rebase");
  });

  it("merge => merge", () => {
    expect(mergeMethodFromKind("merge")).toBe("merge");
  });

  it("unknown kind defaults to merge", () => {
    expect(mergeMethodFromKind("bogus")).toBe("merge");
    expect(mergeMethodFromKind(undefined)).toBe("merge");
  });
});
