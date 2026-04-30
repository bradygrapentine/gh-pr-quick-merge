/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import prState from "../lib/hosts/github/pr-state.js";

const { fetchPrState, fetchCiState, prKey, API_BASE } = prState;

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

  it("surfaces auto_merge when GitHub has it armed (QM-406 fallback signal)", async () => {
    const fetchImpl = fakeFetch(
      jsonRes({
        head: {},
        base: {},
        auto_merge: { merge_method: "squash", enabled_by: { login: "carol" } },
      })
    );
    const out = await fetchPrState(PR, "tok", { fetchImpl, cache: new Map() });
    expect(out.auto_merge).toEqual({ merge_method: "squash", enabled_by: "carol" });
  });

  it("auto_merge is null when GitHub has no auto-merge armed", async () => {
    const fetchImpl = fakeFetch(jsonRes({ head: {}, base: {} }));
    const out = await fetchPrState(PR, "tok", { fetchImpl, cache: new Map() });
    expect(out.auto_merge).toBeNull();
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

describe("pr-state — fetchCiState (QM-500)", () => {
  it("returns the combined-status state on success", async () => {
    const fetchImpl = fakeFetch(jsonRes({ state: "success", statuses: [] }));
    const out = await fetchCiState("abc123", "tok", {
      fetchImpl,
      cache: new Map(),
      path: "/repos/o/r/commits/abc123/status",
    });
    expect(out).toEqual({ state: "success", failingContexts: [] });
  });

  it("collects failing contexts from the statuses array", async () => {
    const fetchImpl = fakeFetch(
      jsonRes({
        state: "failure",
        statuses: [
          { state: "success", context: "lint" },
          { state: "failure", context: "unit" },
          { state: "failure", context: "e2e" },
        ],
      })
    );
    const out = await fetchCiState("abc", "tok", {
      fetchImpl,
      cache: new Map(),
      path: "/repos/o/r/commits/abc/status",
    });
    expect(out).toEqual({ state: "failure", failingContexts: ["unit", "e2e"] });
  });

  it("collapses unknown states to null", async () => {
    const fetchImpl = fakeFetch(jsonRes({ state: "weird", statuses: [] }));
    const out = await fetchCiState("abc", "tok", {
      fetchImpl,
      cache: new Map(),
      path: "/repos/o/r/commits/abc/status",
    });
    expect(out.state).toBeNull();
  });

  it("returns null state on HTTP error and caches it", async () => {
    const fetchImpl = fakeFetch(jsonRes({}, { ok: false, status: 404 }));
    const cache = new Map();
    const out = await fetchCiState("abc", "tok", {
      fetchImpl,
      cache,
      path: "/repos/o/r/commits/abc/status",
    });
    expect(out.state).toBeNull();
    expect(cache.has("ci:abc")).toBe(true);
  });

  it("hits the cache on the second call (keyed by SHA)", async () => {
    const fetchImpl = fakeFetch(jsonRes({ state: "success", statuses: [] }));
    const cache = new Map();
    await fetchCiState("dup", "tok", { fetchImpl, cache, path: "/x" });
    await fetchCiState("dup", "tok", { fetchImpl, cache, path: "/x" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns null state when no SHA passed", async () => {
    const out = await fetchCiState(null, "tok", { path: "/x" });
    expect(out.state).toBeNull();
  });

  it("returns null state when no path supplied", async () => {
    const out = await fetchCiState("abc", "tok", { cache: new Map() });
    expect(out.state).toBeNull();
  });
});
