/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "../lib/label-picker.js";

const { fetchLabels, aggregateLabels, pickLabels } = api;

beforeEach(() => {
  document.body.innerHTML = "";
});

function fakeFetch(byUrl) {
  return async (url) => {
    const v = byUrl[url];
    if (v instanceof Error) throw v;
    if (!v) return { ok: false, status: 404, async json() { return null; } };
    return { ok: true, status: 200, async json() { return v; } };
  };
}

describe("fetchLabels", () => {
  it("returns normalized label entries", async () => {
    const f = fakeFetch({
      "https://api.github.com/repos/o/r/labels?per_page=100": [
        { name: "bug", color: "d73a4a", description: "Defect" },
        { name: "good first issue", color: "7057ff" },
      ],
    });
    const out = await fetchLabels("o/r", "tok", f);
    expect(out).toEqual([
      { name: "bug", color: "d73a4a", description: "Defect" },
      { name: "good first issue", color: "7057ff", description: null },
    ]);
  });

  it("throws on non-200", async () => {
    const f = fakeFetch({});
    await expect(fetchLabels("o/r", "tok", f)).rejects.toThrow(/HTTP 404/);
  });

  it("returns empty array on null payload", async () => {
    const f = fakeFetch({ "https://api.github.com/repos/o/r/labels?per_page=100": "not-an-array" });
    const out = await fetchLabels("o/r", "tok", f);
    expect(out).toEqual([]);
  });
});

describe("aggregateLabels", () => {
  it("counts repos per label, dedupes by name", () => {
    const byRepo = new Map([
      ["o/a", [{ name: "bug", color: "d73a4a", description: null }, { name: "p1", color: "ff0000", description: null }]],
      ["o/b", [{ name: "bug", color: "d73a4a", description: null }]],
    ]);
    const agg = aggregateLabels(byRepo);
    const bug = agg.find((l) => l.name === "bug");
    const p1 = agg.find((l) => l.name === "p1");
    expect(bug.repoCount).toBe(2);
    expect(p1.repoCount).toBe(1);
  });

  it("sorts alphabetically", () => {
    const byRepo = new Map([["o/a", [
      { name: "z", color: "0", description: null },
      { name: "a", color: "0", description: null },
      { name: "m", color: "0", description: null },
    ]]]);
    const agg = aggregateLabels(byRepo);
    expect(agg.map((l) => l.name)).toEqual(["a", "m", "z"]);
  });

  it("ignores duplicate label names within the same repo", () => {
    const byRepo = new Map([["o/a", [
      { name: "bug", color: "0", description: null },
      { name: "bug", color: "0", description: null },
    ]]]);
    expect(aggregateLabels(byRepo)[0].repoCount).toBe(1);
  });
});

describe("pickLabels", () => {
  it("renders a checkbox per aggregated label and resolves on Apply", async () => {
    const f = fakeFetch({
      "https://api.github.com/repos/o/r/labels?per_page=100": [
        { name: "bug", color: "d73a4a", description: null },
        { name: "feature", color: "00ff00", description: null },
      ],
    });
    const promise = pickLabels({ repos: ["o/r"], token: "tok", fetchImpl: f, doc: document });
    // Wait for async fetch + render.
    await new Promise((r) => setTimeout(r, 0));
    const checks = document.querySelectorAll(".qm-label-picker-list input[type=checkbox]");
    expect(checks.length).toBe(2);
    checks[0].checked = true;
    checks[0].dispatchEvent(new Event("change"));
    document.querySelector(".qm-typed-go").click();
    const result = await promise;
    expect(result).toEqual(["bug"]);
  });

  it("resolves null on Cancel", async () => {
    const f = fakeFetch({ "https://api.github.com/repos/o/r/labels?per_page=100": [{ name: "bug", color: "d73a4a", description: null }] });
    const promise = pickLabels({ repos: ["o/r"], token: "tok", fetchImpl: f, doc: document });
    await new Promise((r) => setTimeout(r, 0));
    document.querySelector(".qm-typed-actions .qm-btn:not(.qm-typed-go)").click();
    expect(await promise).toBeNull();
  });

  it("returns null when repos array empty", async () => {
    const out = await pickLabels({ repos: [], token: "tok", fetchImpl: fakeFetch({}), doc: document });
    expect(out).toBeNull();
  });

  it("renders an error line per repo that failed to fetch", async () => {
    const f = async (url) => {
      if (url.includes("good")) return { ok: true, async json() { return [{ name: "ok", color: "0", description: null }]; } };
      return { ok: false, status: 500, async json() { return null; } };
    };
    pickLabels({ repos: ["o/bad", "o/good"], token: "tok", fetchImpl: f, doc: document });
    await new Promise((r) => setTimeout(r, 0));
    const err = document.querySelector(".qm-label-picker-err");
    expect(err.textContent).toMatch(/o\/bad/);
  });
});
