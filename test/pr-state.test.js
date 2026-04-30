/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import prState from "../lib/hosts/github/pr-state.js";

const { fetchPrState, prKey, API_BASE } = prState;

function fakeFetch(response) {
  return vi.fn(async () => response);
}

function jsonRes(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

const PR = { owner: "octo", repo: "demo", num: 42 };

describe("pr-state — fetchPrState", () => {
  it("normalises the PR payload into the documented shape", async () => {
    const fetchImpl = fakeFetch(
      jsonRes({
        mergeable: true,
        mergeable_state: "clean",
        head: { sha: "abc123", ref: "feat/x" },
        base: { ref: "main" },
        title: "T",
        body: "B",
        user: { login: "alice" },
        updated_at: "2026-04-30T00:00:00Z",
        draft: false,
        requested_reviewers: [{ login: "bob" }],
        behind_by: 3,
      })
    );
    const out = await fetchPrState(PR, "tok", { fetchImpl, cache: new Map() });
    expect(out).toMatchObject({
      mergeable: true,
      mergeable_state: "clean",
      head_sha: "abc123",
      title: "T",
      author: "alice",
      branch: "feat/x",
      base: "main",
      draft: false,
      has_reviewer_requested: true,
      behind_by: 3,
    });
  });

  it("hits api.github.com with auth + version headers", async () => {
    const fetchImpl = fakeFetch(jsonRes({ head: {}, base: {} }));
    await fetchPrState(PR, "tok", { fetchImpl, cache: new Map() });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${API_BASE}/repos/octo/demo/pulls/42`);
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("returns cached entry without refetching", async () => {
    const cache = new Map();
    const fetchImpl = fakeFetch(jsonRes({ head: {}, base: {}, mergeable: true }));
    await fetchPrState(PR, "tok", { fetchImpl, cache });
    await fetchPrState(PR, "tok", { fetchImpl, cache });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(cache.has(prKey(PR))).toBe(true);
  });

  it("caches HTTP error sentinel and surfaces the status", async () => {
    const cache = new Map();
    const fetchImpl = fakeFetch({ ok: false, status: 404, json: async () => ({}) });
    const out = await fetchPrState(PR, "tok", { fetchImpl, cache });
    expect(out).toEqual({ error: "HTTP 404" });
    expect(cache.get(prKey(PR))).toEqual({ error: "HTTP 404" });
  });

  it("recovers from network throws as a sentinel error object", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const out = await fetchPrState(PR, "tok", { fetchImpl, cache: new Map() });
    expect(out.error).toContain("TypeError");
    expect(out.error).toContain("Failed to fetch");
  });

  it("self-evicts cache entry when mergeable is null (GitHub computing)", async () => {
    vi.useFakeTimers();
    try {
      const cache = new Map();
      const fetchImpl = fakeFetch(
        jsonRes({ mergeable: null, head: {}, base: {} })
      );
      await fetchPrState(PR, "tok", { fetchImpl, cache });
      expect(cache.has(prKey(PR))).toBe(true);
      vi.advanceTimersByTime(4001);
      expect(cache.has(prKey(PR))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("works without an injected cache (PR-page caller, no shared state)", async () => {
    const fetchImpl = fakeFetch(jsonRes({ head: { sha: "z" }, base: {}, behind_by: 2 }));
    const out = await fetchPrState(PR, "tok", { fetchImpl });
    expect(out.head_sha).toBe("z");
    expect(out.behind_by).toBe(2);
  });

  it("defaults behind_by to 0 when GitHub omits it", async () => {
    const fetchImpl = fakeFetch(jsonRes({ head: {}, base: {} }));
    const out = await fetchPrState(PR, "tok", { fetchImpl, cache: new Map() });
    expect(out.behind_by).toBe(0);
  });

  it("flags has_reviewer_requested false when array empty or missing", async () => {
    const empty = await fetchPrState(PR, "tok", {
      fetchImpl: fakeFetch(jsonRes({ head: {}, base: {}, requested_reviewers: [] })),
      cache: new Map(),
    });
    expect(empty.has_reviewer_requested).toBe(false);

    const missing = await fetchPrState(PR, "tok", {
      fetchImpl: fakeFetch(jsonRes({ head: {}, base: {} })),
      cache: new Map(),
    });
    expect(missing.has_reviewer_requested).toBe(false);
  });
});

describe("pr-state — prKey", () => {
  it("formats as owner/repo#num", () => {
    expect(prKey({ owner: "a", repo: "b", num: 7 })).toBe("a/b#7");
  });
});
