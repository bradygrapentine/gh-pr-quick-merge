import { describe, it, expect } from "vitest";
import mod from "../lib/list-mode.js";

const { fetchPRList, normalizePR, LIST_MODE_FIELDS } = mod;

function makeRes({ status = 200, body = [], linkHeader = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => name.toLowerCase() === "link" ? linkHeader : null,
    },
    json: async () => body,
  };
}

describe("normalizePR", () => {
  it("maps updated_at -> updatedAt", () => {
    const out = normalizePR({ number: 1, title: "x", updated_at: "2026-04-29T00:00:00Z" });
    expect(out.updatedAt).toBe("2026-04-29T00:00:00Z");
  });

  it("sets mergeable_state: null even if raw provides one", () => {
    const out = normalizePR({ number: 1, mergeable_state: "clean" });
    expect(out.mergeable_state).toBeNull();
  });

  it("preserves number, title, draft, user.login -> user, labels", () => {
    const out = normalizePR({
      number: 42,
      title: "Add feature",
      draft: true,
      user: { login: "alice" },
      labels: [{ name: "bug" }, { name: "high" }],
    });
    expect(out).toMatchObject({
      number: 42, title: "Add feature", draft: true, user: "alice", labels: ["bug", "high"],
    });
  });

  it("handles missing nested objects gracefully", () => {
    const out = normalizePR({ number: 1 });
    expect(out.user).toBe("");
    expect(out.headSha).toBeNull();
    expect(out.baseRef).toBeNull();
  });
});

describe("fetchPRList", () => {
  it("single page, no Link header — returns normalized array", async () => {
    const fetchImpl = async () => makeRes({ body: [{ number: 1, title: "p", updated_at: "t" }] });
    const out = await fetchPRList("o/r", "tok", { fetchImpl });
    expect(out).toHaveLength(1);
    expect(out[0].number).toBe(1);
    expect(out[0].mergeable_state).toBeNull();
  });

  it("two pages via Link rel=next — concatenates", async () => {
    let page = 0;
    const fetchImpl = async (url) => {
      page++;
      if (page === 1) {
        return makeRes({
          body: [{ number: 1, title: "a" }],
          linkHeader: '<https://api.github.com/repos/o/r/pulls?state=open&per_page=100&page=2>; rel="next"',
        });
      }
      return makeRes({ body: [{ number: 2, title: "b" }] });
    };
    const out = await fetchPRList("o/r", "tok", { fetchImpl });
    expect(out.map((p) => p.number)).toEqual([1, 2]);
  });

  it("empty list returns []", async () => {
    const fetchImpl = async () => makeRes({ body: [] });
    expect(await fetchPRList("o/r", "tok", { fetchImpl })).toEqual([]);
  });

  it("passes token in Authorization header", async () => {
    let init;
    const fetchImpl = async (_, i) => { init = i; return makeRes({ body: [] }); };
    await fetchPRList("o/r", "tk", { fetchImpl });
    expect(init.headers.Authorization).toBe("Bearer tk");
  });

  it("non-200 throws with status", async () => {
    const fetchImpl = async () => makeRes({ status: 403, body: { message: "forbidden" } });
    await expect(fetchPRList("o/r", "tok", { fetchImpl })).rejects.toThrow(/403/);
  });

  it("requests per_page=100 in URL", async () => {
    let calledUrl;
    const fetchImpl = async (u) => { calledUrl = u; return makeRes({ body: [] }); };
    await fetchPRList("o/r", "tok", { fetchImpl });
    expect(calledUrl).toContain("per_page=100");
  });

  it("invalid repoFullName throws", async () => {
    await expect(fetchPRList("badname", "tok", { fetchImpl: async () => makeRes() })).rejects.toThrow(/invalid repoFullName/);
  });
});

describe("LIST_MODE_FIELDS", () => {
  it("does NOT include mergeable_state", () => {
    expect(LIST_MODE_FIELDS).not.toContain("mergeable_state");
  });

  it("includes the core fields the list endpoint provides", () => {
    for (const f of ["number", "title", "draft", "updatedAt", "user", "labels"]) {
      expect(LIST_MODE_FIELDS).toContain(f);
    }
  });
});
