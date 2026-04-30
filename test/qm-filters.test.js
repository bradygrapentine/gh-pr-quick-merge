/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from "vitest";
import filters from "../lib/qm-filters.js";
import sizer from "../lib/qm-size-classify.js";
import staleHelpers from "../lib/stale-pr.js";

const { isMine, isReady, isStale, isSmall, isNoiseAuthor, isDraft, composeFilter, applyFiltersToRows, DEFAULT_NOISE_AUTHORS } = filters;

const PR = (overrides = {}) => ({ owner: "octo", repo: "x", num: 1, author: "alice", ...overrides });
const STATE = (overrides = {}) => ({
  mergeable_state: "blocked",
  behind_by: 0,
  draft: false,
  additions: 5,
  deletions: 5,
  comments: 0,
  updated_at: new Date().toISOString(),
  has_reviewer_requested: true,
  ...overrides,
});

describe("isMine (QM-505)", () => {
  it("true when pr.author === viewerLogin", () => {
    expect(isMine(STATE(), PR({ author: "alice" }), { viewerLogin: "alice" })).toBe(true);
  });
  it("false when author differs", () => {
    expect(isMine(STATE(), PR({ author: "bob" }), { viewerLogin: "alice" })).toBe(false);
  });
  it("false when no viewer cached", () => {
    expect(isMine(STATE(), PR(), {})).toBe(false);
    expect(isMine(STATE(), PR(), null)).toBe(false);
  });
});

describe("isReady (QM-506)", () => {
  it("true on clean + caught-up + non-draft", () => {
    expect(isReady(STATE({ mergeable_state: "clean" }))).toBe(true);
  });
  it("false when behind", () => {
    expect(isReady(STATE({ mergeable_state: "clean", behind_by: 3 }))).toBe(false);
  });
  it("false on draft", () => {
    expect(isReady(STATE({ mergeable_state: "clean", draft: true }))).toBe(false);
  });
  it("false on blocked / dirty", () => {
    expect(isReady(STATE({ mergeable_state: "blocked" }))).toBe(false);
    expect(isReady(STATE({ mergeable_state: "dirty" }))).toBe(false);
  });
  it("false on null state", () => {
    expect(isReady(null)).toBe(false);
  });
});

describe("isStale (QM-507)", () => {
  const ctx = { staleHelpers, staleThresholds: staleHelpers.DEFAULT_THRESHOLDS, now: new Date("2026-04-30T00:00:00Z") };
  it("true when last update >= 14 days old", () => {
    const s = STATE({ updated_at: "2026-04-10T00:00:00Z" });
    expect(isStale(s, PR(), ctx)).toBe(true);
  });
  it("true when abandoned (>30 days)", () => {
    const s = STATE({ updated_at: "2026-03-01T00:00:00Z" });
    expect(isStale(s, PR(), ctx)).toBe(true);
  });
  it("false when fresh", () => {
    const s = STATE({ updated_at: "2026-04-29T00:00:00Z" });
    expect(isStale(s, PR(), ctx)).toBe(false);
  });
  it("false without stale helpers in ctx", () => {
    expect(isStale(STATE({ updated_at: "2026-04-10T00:00:00Z" }), PR(), {})).toBe(false);
  });
});

describe("isSmall (QM-508)", () => {
  it("uses sizer.isSmall when available", () => {
    expect(isSmall(STATE({ additions: 30, deletions: 19 }), PR(), { sizer })).toBe(true);  // S
    expect(isSmall(STATE({ additions: 30, deletions: 30 }), PR(), { sizer })).toBe(false); // M
  });
  it("fallback inline classifier matches the buckets", () => {
    expect(isSmall(STATE({ additions: 49, deletions: 0 }), PR(), {})).toBe(true);
    expect(isSmall(STATE({ additions: 50, deletions: 0 }), PR(), {})).toBe(false);
  });
});

describe("composeFilter — composition semantics", () => {
  const ctx = {
    viewerLogin: "alice",
    staleHelpers,
    staleThresholds: staleHelpers.DEFAULT_THRESHOLDS,
    sizer,
    now: new Date("2026-04-30T00:00:00Z"),
  };

  it("no filters active → keep everything", () => {
    const fn = composeFilter({}, ctx);
    expect(fn(STATE(), PR())).toBe(true);
    expect(fn(STATE({ mergeable_state: "blocked" }), PR({ author: "bob" }))).toBe(true);
  });

  it("single filter — Mine only keeps the user's PRs", () => {
    const fn = composeFilter({ mine: true }, ctx);
    expect(fn(STATE(), PR({ author: "alice" }))).toBe(true);
    expect(fn(STATE(), PR({ author: "bob" }))).toBe(false);
  });

  it("two filters union — Mine OR Ready", () => {
    const fn = composeFilter({ mine: true, ready: true }, ctx);
    // Mine wins
    expect(fn(STATE({ mergeable_state: "blocked" }), PR({ author: "alice" }))).toBe(true);
    // Ready wins
    expect(fn(STATE({ mergeable_state: "clean" }), PR({ author: "bob" }))).toBe(true);
    // Neither
    expect(fn(STATE({ mergeable_state: "blocked" }), PR({ author: "bob" }))).toBe(false);
  });

  it("Stale + Small union", () => {
    const fn = composeFilter({ stale: true, small: true }, ctx);
    // Stale only
    expect(fn(STATE({ updated_at: "2026-04-10T00:00:00Z", additions: 100, deletions: 100 }), PR(), ctx)).toBe(true);
    // Small only
    expect(fn(STATE({ updated_at: "2026-04-29T00:00:00Z", additions: 5, deletions: 5 }), PR())).toBe(true);
    // Neither
    expect(fn(STATE({ updated_at: "2026-04-29T00:00:00Z", additions: 100, deletions: 100 }), PR())).toBe(false);
  });

  it("predicates that throw are treated as miss", () => {
    const fn = composeFilter({ mine: true }, { viewerLogin: undefined });
    expect(fn(STATE(), PR())).toBe(false);
  });
});

describe("applyFiltersToRows", () => {
  it("toggles data-qm-hidden-by-filter on rows that fail the keeper", () => {
    document.body.innerHTML = `
      <div class="js-issue-row" id="r1" data-qm-injected="true"></div>
      <div class="js-issue-row" id="r2" data-qm-injected="true"></div>
    `;
    const rows = document.querySelectorAll(".js-issue-row");
    const keeper = (state) => state && state.behind_by === 0;
    const stateLookup = (row) => row.id === "r1"
      ? { state: { behind_by: 0 }, pr: PR() }
      : { state: { behind_by: 5 }, pr: PR() };
    const result = applyFiltersToRows(keeper, rows, stateLookup);
    expect(result).toEqual({ kept: 1, hidden: 1 });
    expect(document.getElementById("r1").getAttribute("data-qm-hidden-by-filter")).toBeNull();
    expect(document.getElementById("r2").getAttribute("data-qm-hidden-by-filter")).toBe("true");
  });

  it("clears prior hidden flag when row now matches", () => {
    document.body.innerHTML = `
      <div class="js-issue-row" id="r1" data-qm-injected="true" data-qm-hidden-by-filter="true"></div>
    `;
    const rows = document.querySelectorAll(".js-issue-row");
    applyFiltersToRows(() => true, rows, () => ({ state: STATE(), pr: PR() }));
    expect(document.getElementById("r1").getAttribute("data-qm-hidden-by-filter")).toBeNull();
  });

  it("skips rows whose state can't be resolved (returns no kept/hidden change)", () => {
    document.body.innerHTML = `<div class="js-issue-row" id="r1" data-qm-injected="true"></div>`;
    const rows = document.querySelectorAll(".js-issue-row");
    const result = applyFiltersToRows(() => false, rows, () => null);
    expect(result).toEqual({ kept: 0, hidden: 0 });
  });
});

describe("isNoiseAuthor (QM-509)", () => {
  it("matches default bot list", () => {
    expect(isNoiseAuthor(null, PR({ author: "dependabot[bot]" }), {})).toBe(true);
    expect(isNoiseAuthor(null, PR({ author: "renovate[bot]" }), {})).toBe(true);
    expect(isNoiseAuthor(null, PR({ author: "github-actions[bot]" }), {})).toBe(true);
  });
  it("ignores non-bot authors", () => {
    expect(isNoiseAuthor(null, PR({ author: "alice" }), {})).toBe(false);
  });
  it("respects ctx.noiseAuthors override", () => {
    expect(isNoiseAuthor(null, PR({ author: "alice" }), { noiseAuthors: ["alice"] })).toBe(true);
    expect(isNoiseAuthor(null, PR({ author: "dependabot[bot]" }), { noiseAuthors: ["alice"] })).toBe(false);
  });
  it("falls back to defaults on empty override array", () => {
    expect(isNoiseAuthor(null, PR({ author: "dependabot[bot]" }), { noiseAuthors: [] })).toBe(true);
  });
  it("DEFAULT_NOISE_AUTHORS is frozen", () => {
    expect(Object.isFrozen(DEFAULT_NOISE_AUTHORS)).toBe(true);
  });
});

describe("isDraft (QM-510)", () => {
  it("true when state.draft === true", () => {
    expect(isDraft({ draft: true })).toBe(true);
  });
  it("false otherwise", () => {
    expect(isDraft({ draft: false })).toBe(false);
    expect(isDraft({})).toBe(false);
    expect(isDraft(null)).toBe(false);
  });
});

describe("composeFilter — Track C exclusion semantics", () => {
  const baseCtx = {
    viewerLogin: "alice",
    staleHelpers,
    staleThresholds: staleHelpers.DEFAULT_THRESHOLDS,
    sizer,
    now: new Date("2026-04-30T00:00:00Z"),
  };

  it("hideDependabot drops bot PRs while keeping the rest", () => {
    const fn = composeFilter({ hideDependabot: true }, baseCtx);
    expect(fn(STATE(), PR({ author: "alice" }))).toBe(true);
    expect(fn(STATE(), PR({ author: "dependabot[bot]" }))).toBe(false);
  });

  it("hideDrafts drops drafts only", () => {
    const fn = composeFilter({ hideDrafts: true }, baseCtx);
    expect(fn(STATE({ draft: false }), PR())).toBe(true);
    expect(fn(STATE({ draft: true }), PR())).toBe(false);
  });

  it("exclusion runs after inclusion (Mine + hideDependabot — bots authored by viewer still drop)", () => {
    const fn = composeFilter({ mine: true, hideDependabot: true }, { ...baseCtx, viewerLogin: "dependabot[bot]" });
    // Mine matches (viewer == author == bot), but exclude wins.
    expect(fn(STATE(), PR({ author: "dependabot[bot]" }))).toBe(false);
  });

  it("two excludes compose as AND-NOT (drafts AND bots both drop)", () => {
    const fn = composeFilter({ hideDependabot: true, hideDrafts: true }, baseCtx);
    expect(fn(STATE({ draft: false }), PR({ author: "alice" }))).toBe(true);
    expect(fn(STATE({ draft: false }), PR({ author: "dependabot[bot]" }))).toBe(false);
    expect(fn(STATE({ draft: true }), PR({ author: "alice" }))).toBe(false);
  });

  it("only excludes active = pure no-op gate (everything passes)", () => {
    const fn = composeFilter({ hideDrafts: false, hideDependabot: false }, baseCtx);
    expect(fn(STATE({ draft: true }), PR({ author: "dependabot[bot]" }))).toBe(true);
  });
});
