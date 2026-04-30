/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../lib/qm-size-classify.js"; // populates window.QM_SIZE
import api from "../lib/qm-row-badges.js";

const { applyRowBadges, applyCiState, buildCiBadge, buildSizeBadge, buildCommentsBadge, teardown, READY_ATTR } = api;

function makeRow() {
  const row = document.createElement("div");
  row.className = "js-issue-row";
  const container = document.createElement("span");
  container.className = "qm-container";
  row.appendChild(container);
  document.body.appendChild(row);
  return { row, container };
}

describe("buildSizeBadge", () => {
  it("renders S · 47 for a 47-line PR", () => {
    const el = buildSizeBadge({ additions: 30, deletions: 17 });
    expect(el.textContent).toBe("S · 47");
    expect(el.className).toContain("qm-row-badge-size-s");
    expect(el.getAttribute("aria-label")).toMatch(/47 lines/);
  });
  it("returns null on null state", () => {
    expect(buildSizeBadge(null)).toBeNull();
  });
});

describe("buildCommentsBadge", () => {
  const pr = { owner: "octo", repo: "world", num: 5 };
  it("renders bubble + count and links to #issue-comment-area", () => {
    const el = buildCommentsBadge({ comments: 3 }, pr);
    expect(el.textContent).toBe("💬 3");
    expect(el.getAttribute("href")).toBe("/octo/world/pull/5#issue-comment-area");
  });
  it("hides when count is zero or missing", () => {
    expect(buildCommentsBadge({ comments: 0 }, pr)).toBeNull();
    expect(buildCommentsBadge({}, pr)).toBeNull();
    expect(buildCommentsBadge(null, pr)).toBeNull();
  });
});

describe("buildCiBadge", () => {
  it("renders success dot with passing tooltip", () => {
    const el = buildCiBadge({ state: "success", failingContexts: [] });
    expect(el.textContent).toBe("●");
    expect(el.title).toBe("CI passing");
    expect(el.className).toContain("qm-row-badge-ci-success");
  });
  it("renders failure with failing contexts in tooltip", () => {
    const el = buildCiBadge({ state: "failure", failingContexts: ["unit", "lint"] });
    expect(el.title).toBe("CI failing: unit, lint");
  });
  it("renders pending dot", () => {
    const el = buildCiBadge({ state: "pending", failingContexts: [] });
    expect(el.textContent).toBe("…");
  });
  it("returns null for unknown / missing state", () => {
    expect(buildCiBadge(null)).toBeNull();
    expect(buildCiBadge({ state: null })).toBeNull();
  });
});

describe("applyRowBadges (QM-500..503)", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  const pr = { owner: "octo", repo: "world", num: 5 };

  it("mounts size + comments badges from state", () => {
    const { container } = makeRow();
    applyRowBadges(container, { additions: 30, deletions: 19, comments: 2, mergeable_state: "blocked", behind_by: 1 }, pr);
    const strip = container.querySelector('[data-qm-badge="strip"]');
    expect(strip).toBeTruthy();
    expect(strip.querySelector('[data-qm-badge="size"]').textContent).toBe("S · 49");
    expect(strip.querySelector('[data-qm-badge="comments"]').textContent).toBe("💬 2");
    expect(strip.querySelector('[data-qm-badge="ci"]')).toBeNull(); // ciState not provided
  });

  it("is idempotent — rerun replaces, doesn't duplicate", () => {
    const { container } = makeRow();
    applyRowBadges(container, { additions: 5, deletions: 3, comments: 1 }, pr);
    applyRowBadges(container, { additions: 100, deletions: 50, comments: 4 }, pr);
    const strips = container.querySelectorAll('[data-qm-badge="strip"]');
    expect(strips.length).toBe(1);
    expect(strips[0].querySelector('[data-qm-badge="size"]').textContent).toBe("M · 150");
    expect(strips[0].querySelector('[data-qm-badge="comments"]').textContent).toBe("💬 4");
  });

  it("sets data-qm-ready on the row when state is clean + caught up", () => {
    const { row, container } = makeRow();
    applyRowBadges(container, { additions: 5, deletions: 5, mergeable_state: "clean", behind_by: 0, draft: false }, pr);
    expect(row.getAttribute(READY_ATTR)).toBe("true");
  });

  it("clears ready highlight when state goes blocked", () => {
    const { row, container } = makeRow();
    applyRowBadges(container, { additions: 5, deletions: 5, mergeable_state: "clean", behind_by: 0 }, pr);
    expect(row.getAttribute(READY_ATTR)).toBe("true");
    applyRowBadges(container, { additions: 5, deletions: 5, mergeable_state: "blocked", behind_by: 0 }, pr);
    expect(row.getAttribute(READY_ATTR)).toBeNull();
  });

  it("does not flag drafts as ready", () => {
    const { row, container } = makeRow();
    applyRowBadges(container, { mergeable_state: "clean", behind_by: 0, draft: true }, pr);
    expect(row.getAttribute(READY_ATTR)).toBeNull();
  });

  it("applyCiState fills in the badge after async fetch", () => {
    const { container } = makeRow();
    applyRowBadges(container, { additions: 1, deletions: 1, comments: 0 }, pr);
    expect(container.querySelector('[data-qm-badge="ci"]')).toBeNull();
    applyCiState(container, { state: "success", failingContexts: [] });
    expect(container.querySelector('[data-qm-badge="ci"]').className).toContain("qm-row-badge-ci-success");
  });

  it("teardown removes the strip and the ready flag", () => {
    const { row, container } = makeRow();
    applyRowBadges(container, { additions: 5, deletions: 5, mergeable_state: "clean", behind_by: 0 }, pr);
    teardown(container);
    expect(container.querySelector('[data-qm-badge="strip"]')).toBeNull();
    expect(row.getAttribute(READY_ATTR)).toBeNull();
  });

  it("no-ops when state is null", () => {
    const { container } = makeRow();
    applyRowBadges(container, null, pr);
    expect(container.querySelector('[data-qm-badge="strip"]')).toBeNull();
  });
});
