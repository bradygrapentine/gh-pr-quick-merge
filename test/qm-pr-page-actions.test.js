/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "../lib/qm-pr-page-actions.js";

const {
  parsePrPagePath,
  decideRebaseUi,
  decideApproveUi,
  submitReview,
  ensurePrPageActionBar,
  removePrPageActionBar,
  buildActionBar,
  showRebaseConfirmModal,
  closeRebaseConfirmModal,
  BAR_ID,
  BAR_FLAG,
  MODAL_ID,
} = api;

describe("parsePrPagePath", () => {
  it("parses canonical PR url", () => {
    expect(parsePrPagePath("/octocat/hello-world/pull/42")).toEqual({
      owner: "octocat", repo: "hello-world", num: 42,
    });
  });
  it("parses sub-tab segments", () => {
    expect(parsePrPagePath("/o/r/pull/1/files")).toEqual({ owner: "o", repo: "r", num: 1 });
    expect(parsePrPagePath("/o/r/pull/9/checks")).toEqual({ owner: "o", repo: "r", num: 9 });
  });
  it("returns null on miss", () => {
    expect(parsePrPagePath("/o/r/pulls")).toBeNull();
    expect(parsePrPagePath("/")).toBeNull();
    expect(parsePrPagePath("")).toBeNull();
    expect(parsePrPagePath(null)).toBeNull();
  });
});

describe("decideRebaseUi (QM-406 fallback matrix)", () => {
  // [state, opts, expected, description]
  it.each([
    [{ behind_by: 3, mergeable_state: "behind" }, {}, "show", "behind + behind_by>0"],
    [{ behind_by: 0, mergeable_state: "behind" }, {}, "show", "explicit behind state, behind_by stale"],
    [{ behind_by: 5, mergeable_state: "dirty" }, {}, "show", "behind_by>0 even on conflicts"],
    [{ behind_by: 0, mergeable_state: "clean" }, {}, "hide", "clean + caught up"],
    [{ behind_by: 0, mergeable_state: "blocked" }, {}, "hide", "blocked but caught up"],
    [{ behind_by: 0, mergeable_state: "unknown" }, {}, "hide", "unknown + caught up"],
    [{ behind_by: 2, mergeable_state: "blocked" }, {}, "show", "blocked + behind"],
    [{ behind_by: 1 }, { writePermDenied: true }, "show-disabled", "no perms → fallback"],
    [{ behind_by: 0, mergeable_state: "clean" }, { writePermDenied: true }, "show-disabled", "fallback wins over hide"],
    [null, {}, "hide", "null state"],
    [undefined, {}, "hide", "undefined state"],
  ])("decideRebaseUi(%j, %j) -> %s (%s)", (state, opts, expected) => {
    expect(decideRebaseUi(state, opts)).toBe(expected);
  });
});

describe("decideApproveUi (QM-408)", () => {
  const viewer = { login: "alice" };
  it.each([
    [{ author: { login: "bob" } }, viewer, "show", "viewer != author"],
    [{ author: { login: "alice" } }, viewer, "hide", "self-PR"],
    [{ author: { login: "bob" }, viewer_has_approved: true }, viewer, "hide", "already approved"],
    [{ author: { login: "bob" } }, null, "hide", "logged-out viewer"],
    [{}, viewer, "show", "missing author info — allow attempt"],
    [null, viewer, "hide", "null state"],
  ])("decideApproveUi(%j, %j) -> %s (%s)", (state, v, expected) => {
    expect(decideApproveUi(state, v)).toBe(expected);
  });
});

describe("submitReview", () => {
  it("posts to /reviews with the right body", async () => {
    const apiPost = vi.fn().mockResolvedValue({ id: 99 });
    const out = await submitReview({
      owner: "o", repo: "r", pullNumber: 7, token: "t",
      api: { apiPost },
    });
    expect(apiPost).toHaveBeenCalledWith(
      "/repos/o/r/pulls/7/reviews",
      { event: "APPROVE", body: "" },
      { token: "t" },
    );
    expect(out).toEqual({ id: 99 });
  });
  it("rejects without owner/repo/pullNumber", async () => {
    await expect(submitReview({ owner: "o", repo: "r" })).rejects.toThrow(/required/);
  });
});

describe("buildActionBar markup (QM-402, QM-403)", () => {
  it("renders rebase + approve buttons in show mode", () => {
    const bar = buildActionBar({ rebaseMode: "show", showApprove: true });
    expect(bar.id).toBe(BAR_ID);
    expect(bar.getAttribute(BAR_FLAG)).toBe("true");
    expect(bar.querySelector('[data-qm-action="rebase"]')).toBeTruthy();
    expect(bar.querySelector('[data-qm-action="rebase"]').textContent).toBe("Update branch");
    expect(bar.querySelector('[data-qm-action="approve"]')).toBeTruthy();
    expect(bar.getAttribute("role")).toBe("group");
  });
  it("renders disabled fallback in show-disabled mode", () => {
    const bar = buildActionBar({ rebaseMode: "show-disabled", showApprove: false });
    const btn = bar.querySelector('[data-qm-action="rebase"]');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/merge panel/i);
    expect(bar.querySelector(".qm-pr-action-link")).toBeTruthy();
    expect(bar.querySelector('[data-qm-action="approve"]')).toBeNull();
  });
  it("approve-only when rebase hidden but approve shown", () => {
    const bar = buildActionBar({ rebaseMode: "hide", showApprove: true });
    expect(bar.querySelector('[data-qm-action="rebase"]')).toBeNull();
    expect(bar.querySelector('[data-qm-action="approve"]')).toBeTruthy();
  });
});

describe("ensurePrPageActionBar mount/teardown (QM-402, QM-405)", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="gh-header-actions"></div>';
  });

  it("mounts a bar when rebase shows", () => {
    const onRebase = vi.fn();
    ensurePrPageActionBar({
      state: { behind_by: 2, mergeable_state: "behind" },
      viewer: null,
      handlers: { onRebaseClick: onRebase },
    });
    const bar = document.getElementById(BAR_ID);
    expect(bar).toBeTruthy();
    bar.querySelector('[data-qm-action="rebase"]').click();
    expect(onRebase).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — calling twice does not duplicate the bar", () => {
    const ctx = {
      state: { behind_by: 2, mergeable_state: "behind" },
      viewer: null,
      handlers: {},
    };
    ensurePrPageActionBar(ctx);
    ensurePrPageActionBar(ctx);
    expect(document.querySelectorAll(`[${BAR_FLAG}]`).length).toBe(1);
  });

  it("removes the bar when state transitions to hidden", () => {
    ensurePrPageActionBar({
      state: { behind_by: 2, mergeable_state: "behind" },
      viewer: null,
      handlers: {},
    });
    expect(document.getElementById(BAR_ID)).toBeTruthy();
    ensurePrPageActionBar({
      state: { behind_by: 0, mergeable_state: "clean" },
      viewer: null,
      handlers: {},
    });
    expect(document.getElementById(BAR_ID)).toBeNull();
  });

  it("removePrPageActionBar removes both bar and modal", () => {
    document.body.innerHTML += `<div id="${BAR_ID}"></div><div id="${MODAL_ID}"></div>`;
    removePrPageActionBar();
    expect(document.getElementById(BAR_ID)).toBeNull();
    expect(document.getElementById(MODAL_ID)).toBeNull();
  });
});

describe("showRebaseConfirmModal (QM-403 a11y)", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("resolves true on Enter key", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const promise = showRebaseConfirmModal({ trigger });
    const overlay = document.getElementById(MODAL_ID);
    expect(overlay.querySelector('[role="dialog"]').getAttribute("aria-modal")).toBe("true");
    overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await expect(promise).resolves.toBe(true);
    expect(document.getElementById(MODAL_ID)).toBeNull();
  });

  it("resolves false on Escape key", async () => {
    const promise = showRebaseConfirmModal();
    const overlay = document.getElementById(MODAL_ID);
    overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await expect(promise).resolves.toBe(false);
  });

  it("resolves false when the cancel button is clicked", async () => {
    const promise = showRebaseConfirmModal();
    document.querySelector('[data-qm-modal-action="cancel"]').click();
    await expect(promise).resolves.toBe(false);
  });

  it("resolves true when the confirm button is clicked", async () => {
    const promise = showRebaseConfirmModal();
    document.querySelector('[data-qm-modal-action="confirm"]').click();
    await expect(promise).resolves.toBe(true);
  });

  it("resolves false on overlay backdrop click", async () => {
    const promise = showRebaseConfirmModal();
    const overlay = document.getElementById(MODAL_ID);
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect(promise).resolves.toBe(false);
  });

  it("returns focus to the trigger element on close", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const focusSpy = vi.spyOn(trigger, "focus");
    const promise = showRebaseConfirmModal({ trigger });
    document.querySelector('[data-qm-modal-action="cancel"]').click();
    await promise;
    expect(focusSpy).toHaveBeenCalled();
  });

  it("closeRebaseConfirmModal removes overlay if present", () => {
    showRebaseConfirmModal();
    expect(document.getElementById(MODAL_ID)).toBeTruthy();
    closeRebaseConfirmModal();
    expect(document.getElementById(MODAL_ID)).toBeNull();
  });
});
