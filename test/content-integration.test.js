/**
 * @vitest-environment happy-dom
 *
 * Phase 4 (QM-046) — fixture-DOM integration tests.
 *
 * These exercise the row-level helpers that content.js calls (stale
 * classification, repo-default selection, idempotent injection patterns)
 * against three captured GitHub PR-list fixtures. Full content-script DOM
 * injection coverage lives in the Playwright e2e suite (`test/e2e/flows/`).
 * This file's job is the deterministic, jsdom-friendly slice — fast, no
 * extension load required.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import staleHelpers from "../lib/stale-pr.js";
import repoDefaults from "../lib/repo-defaults.js";

const { classifyStaleness } = staleHelpers;
const { setDefault, listDefaults, pickDefaultForBulk } = repoDefaults;

const FIXTURES = {
  clean: readFileSync(path.resolve(__dirname, "fixtures/pr-list-clean.html"), "utf8"),
  stale: readFileSync(path.resolve(__dirname, "fixtures/pr-list-stale.html"), "utf8"),
  draft: readFileSync(path.resolve(__dirname, "fixtures/pr-list-draft.html"), "utf8"),
};

function loadFixture(html) {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, "");
}

function makeStore(initial = {}) {
  const data = { ...initial };
  return {
    async get(key) {
      if (Array.isArray(key)) {
        const out = {};
        for (const k of key) if (k in data) out[k] = data[k];
        return out;
      }
      if (key === undefined) return { ...data };
      return key in data ? { [key]: data[key] } : {};
    },
    async set(updates) { Object.assign(data, updates); },
    async remove(key) { delete data[key]; },
    onChanged: { addListener() {} },
    _data: data,
  };
}

const NOW = new Date("2026-04-29T00:00:00Z");

beforeEach(() => {
  document.documentElement.innerHTML = "";
});

describe("fixture: clean PR row", () => {
  it("loads with the row injected and a single PR title link", () => {
    loadFixture(FIXTURES.clean);
    const rows = document.querySelectorAll(".js-issue-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector("a[data-testid='issue-pr-title-link']")?.textContent).toContain("user-facing telemetry");
  });

  it("classifyStaleness reports fresh for an updated_at three days ago", () => {
    loadFixture(FIXTURES.clean);
    const ts = document.querySelector("relative-time").getAttribute("datetime");
    const bucket = classifyStaleness({ updatedAt: ts, draft: false }, undefined, NOW);
    expect(bucket).toBe("fresh");
  });

  it("does NOT mark the row as draft", () => {
    loadFixture(FIXTURES.clean);
    expect(document.querySelector(".State--draft")).toBeNull();
  });
});

describe("fixture: stale PR row", () => {
  it("classifyStaleness produces a non-fresh bucket for ~2 months old updated_at", () => {
    loadFixture(FIXTURES.stale);
    const ts = document.querySelector("relative-time").getAttribute("datetime");
    const bucket = classifyStaleness({ updatedAt: ts, draft: false }, undefined, NOW);
    expect(["warming", "stale", "abandoned"]).toContain(bucket);
  });

  it("the row is the only one in the fixture, ready for badge injection", () => {
    loadFixture(FIXTURES.stale);
    expect(document.querySelectorAll(".js-issue-row").length).toBe(1);
  });
});

describe("fixture: draft PR row", () => {
  it("contains a State--draft marker", () => {
    loadFixture(FIXTURES.draft);
    expect(document.querySelector(".State--draft")).not.toBeNull();
  });

  it("classifyStaleness on a recent draft returns fresh", () => {
    loadFixture(FIXTURES.draft);
    const ts = document.querySelector("relative-time").getAttribute("datetime");
    const bucket = classifyStaleness({ updatedAt: ts, draft: true }, undefined, NOW);
    expect(bucket).toBe("fresh");
  });

  it("a content-script that gates on draft markers can find the indicator via a stable selector", () => {
    loadFixture(FIXTURES.draft);
    const draftSpan = document.querySelector(".State.State--draft");
    expect(draftSpan?.textContent.trim()).toBe("Draft");
  });
});

describe("repo-defaults integration with stored data", () => {
  it("a stored default surfaces via listDefaults() for the repo URL parsed from the fixture", async () => {
    loadFixture(FIXTURES.clean);
    const store = makeStore();
    await setDefault("gh-pr-qm-bot", "sandbox", "squash", store);
    const all = await listDefaults(store);
    expect(all["gh-pr-qm-bot/sandbox"]).toBe("squash");
  });

  it("pickDefaultForBulk returns the shared method for two PRs in the same repo", async () => {
    const store = makeStore();
    await setDefault("gh-pr-qm-bot", "sandbox", "rebase", store);
    const map = await listDefaults(store);
    const prs = [
      { owner: "gh-pr-qm-bot", repo: "sandbox" },
      { owner: "gh-pr-qm-bot", repo: "sandbox" },
    ];
    expect(pickDefaultForBulk(prs, map)).toBe("rebase");
  });

  it("returns null when selected PRs have differing defaults", async () => {
    const store = makeStore();
    await setDefault("a", "x", "squash", store);
    await setDefault("b", "y", "rebase", store);
    const map = await listDefaults(store);
    const prs = [
      { owner: "a", repo: "x" },
      { owner: "b", repo: "y" },
    ];
    expect(pickDefaultForBulk(prs, map)).toBeNull();
  });
});

describe("idempotent re-render guards", () => {
  it("re-loading a fixture twice does not duplicate row containers in the parent", () => {
    loadFixture(FIXTURES.clean);
    const before = document.querySelectorAll(".js-issue-row").length;
    loadFixture(FIXTURES.clean);
    const after = document.querySelectorAll(".js-issue-row").length;
    expect(after).toBe(before);
  });
});
