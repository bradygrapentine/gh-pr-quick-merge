import { describe, it, expect, vi } from "vitest";
import mod from "../lib/auto-rebase.js";

const { shouldAutoRebase, rebaseThenMerge } = mod;

function fakeUpdateBranchModule(impl) {
  return { updateBranch: impl || (async () => ({ queued: true })) };
}

describe("shouldAutoRebase", () => {
  it("returns false when threshold is 0", () => {
    expect(shouldAutoRebase({ behindBy: 50, threshold: 0 })).toBe(false);
  });

  it("returns false when behindBy < threshold", () => {
    expect(shouldAutoRebase({ behindBy: 1, threshold: 5 })).toBe(false);
  });

  it("returns true when behindBy >= threshold and threshold > 0", () => {
    expect(shouldAutoRebase({ behindBy: 5, threshold: 5 })).toBe(true);
    expect(shouldAutoRebase({ behindBy: 10, threshold: 1 })).toBe(true);
  });

  it("returns false on non-numeric inputs", () => {
    expect(shouldAutoRebase({ behindBy: "lots", threshold: 1 })).toBe(false);
    expect(shouldAutoRebase({ behindBy: 5, threshold: NaN })).toBe(false);
  });
});

describe("rebaseThenMerge", () => {
  it("skips rebase when shouldAutoRebase is false; calls mergeFn directly", async () => {
    const mergeFn = vi.fn(async () => ({ ok: true }));
    const out = await rebaseThenMerge({
      owner: "o", repo: "r", pullNumber: 1,
      behindBy: 0, autoRebaseThreshold: 1,
      mergeFn,
      updateBranchModule: fakeUpdateBranchModule(),
    });
    expect(out).toEqual({ rebased: false, merged: true });
    expect(mergeFn).toHaveBeenCalledOnce();
  });

  it("invokes onRebaseStart and onRebaseEnd around the rebase", async () => {
    const events = [];
    const mergeFn = vi.fn(async () => events.push("merge"));
    await rebaseThenMerge({
      owner: "o", repo: "r", pullNumber: 1,
      behindBy: 5, autoRebaseThreshold: 1,
      mergeFn,
      onRebaseStart: () => events.push("start"),
      onRebaseEnd: () => events.push("end"),
      updateBranchModule: fakeUpdateBranchModule(async () => events.push("rebase")),
    });
    expect(events).toEqual(["start", "rebase", "end", "merge"]);
  });

  it("calls mergeFn after a successful rebase", async () => {
    const mergeFn = vi.fn(async () => ({ ok: true }));
    const out = await rebaseThenMerge({
      owner: "o", repo: "r", pullNumber: 1,
      behindBy: 3, autoRebaseThreshold: 1,
      mergeFn,
      updateBranchModule: fakeUpdateBranchModule(),
    });
    expect(out).toEqual({ rebased: true, merged: true });
    expect(mergeFn).toHaveBeenCalledOnce();
  });

  it("propagates updateBranch errors without calling mergeFn", async () => {
    const mergeFn = vi.fn();
    const onEnd = vi.fn();
    const err = new Error("rebase failed");
    await expect(
      rebaseThenMerge({
        owner: "o", repo: "r", pullNumber: 1,
        behindBy: 5, autoRebaseThreshold: 1,
        mergeFn,
        onRebaseEnd: onEnd,
        updateBranchModule: fakeUpdateBranchModule(async () => { throw err; }),
      }),
    ).rejects.toBe(err);
    expect(mergeFn).not.toHaveBeenCalled();
    // onRebaseEnd MUST still fire so the UI can clear the spinner.
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("forwards mergeStrategy='rebase' through to updateBranch", async () => {
    let received;
    const ub = fakeUpdateBranchModule(async (opts) => { received = opts; });
    await rebaseThenMerge({
      owner: "o", repo: "r", pullNumber: 1,
      behindBy: 3, autoRebaseThreshold: 1,
      mergeStrategy: "rebase",
      mergeFn: async () => {},
      updateBranchModule: ub,
    });
    expect(received.strategy).toBe("rebase");
  });

  it("missing mergeFn throws synchronously", async () => {
    await expect(rebaseThenMerge({})).rejects.toThrow(/mergeFn/);
  });

  it("does not mutate input options", async () => {
    const opts = {
      owner: "o", repo: "r", pullNumber: 1,
      behindBy: 5, autoRebaseThreshold: 1,
      mergeFn: async () => {},
      updateBranchModule: fakeUpdateBranchModule(),
    };
    const snapshot = JSON.stringify({ ...opts, mergeFn: undefined, updateBranchModule: undefined });
    await rebaseThenMerge(opts);
    expect(JSON.stringify({ ...opts, mergeFn: undefined, updateBranchModule: undefined })).toBe(snapshot);
  });
});
