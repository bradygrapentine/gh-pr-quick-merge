/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import prState from "../lib/hosts/github/pr-state.js";

const { fetchPrState, fetchCiState, fetchPrStateAndCi, prKey, API_BASE } = prState;

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

describe("pr-state — fetchPrStateAndCi (GraphQL piggy-back)", () => {
  function gqlRes(prFields, rollup) {
    return jsonRes({
      data: {
        repository: {
          pullRequest: {
            mergeable: "MERGEABLE",
            mergeStateStatus: "CLEAN",
            headRefOid: "abc123",
            headRefName: "feat/x",
            baseRefName: "main",
            title: "T",
            body: "B",
            isDraft: false,
            additions: 30,
            deletions: 10,
            author: { login: "alice" },
            updatedAt: "2026-04-30T00:00:00Z",
            reviewRequests: { totalCount: 1 },
            comments: { totalCount: 4 },
            autoMergeRequest: null,
            commits: {
              nodes: [{ commit: { statusCheckRollup: rollup } }],
            },
            ...prFields,
          },
        },
      },
    });
  }

  it("normalises a clean+success response into the combined shape", async () => {
    const fetchImpl = fakeFetch(gqlRes({}, {
      state: "SUCCESS",
      contexts: { nodes: [{ __typename: "CheckRun", name: "unit", conclusion: "SUCCESS" }] },
    }));
    const out = await fetchPrStateAndCi(PR, "tok", { fetchImpl, cache: new Map() });
    expect(out).toMatchObject({
      mergeable: true,
      mergeable_state: "clean",
      head_sha: "abc123",
      author: "alice",
      additions: 30,
      deletions: 10,
      comments: 4,
      behind_by: 0,
      ci_state: "success",
      failing_contexts: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${API_BASE}/graphql`);
    expect(fetchImpl.mock.calls[0][1].method).toBe("POST");
  });

  it("maps mergeStateStatus=BEHIND to behind_by=1", async () => {
    const fetchImpl = fakeFetch(gqlRes({ mergeStateStatus: "BEHIND" }, null));
    const out = await fetchPrStateAndCi(PR, "tok", { fetchImpl });
    expect(out.mergeable_state).toBe("behind");
    expect(out.behind_by).toBe(1);
    expect(out.ci_state).toBeNull();
  });

  it("collects failing CheckRun + StatusContext names", async () => {
    const fetchImpl = fakeFetch(gqlRes({}, {
      state: "FAILURE",
      contexts: {
        nodes: [
          { __typename: "CheckRun", name: "unit", conclusion: "FAILURE" },
          { __typename: "CheckRun", name: "lint", conclusion: "SUCCESS" },
          { __typename: "StatusContext", context: "ci/build", state: "FAILURE" },
        ],
      },
    }));
    const out = await fetchPrStateAndCi(PR, "tok", { fetchImpl });
    expect(out.ci_state).toBe("failure");
    expect(out.failing_contexts).toEqual(["unit", "ci/build"]);
  });

  it("falls back to REST when GraphQL returns non-2xx", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/graphql")) return jsonRes({}, { ok: false, status: 502 });
      // REST pulls/:n
      return jsonRes({
        mergeable: true, mergeable_state: "clean", head: { sha: "rest-sha" },
        base: {}, additions: 5, deletions: 3, comments: 1,
      });
    });
    const out = await fetchPrStateAndCi(PR, "tok", { fetchImpl, cache: new Map() });
    expect(out.head_sha).toBe("rest-sha");
    expect(out.mergeable_state).toBe("clean");
    // CI from the REST status follow-up — fakeFetch above returns the
    // same body for it, no `state` field, so ci_state is null.
    expect(out.ci_state).toBeNull();
  });

  it("falls back to REST when GraphQL response shape is wrong", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/graphql")) return jsonRes({ data: { repository: null } });
      return jsonRes({ mergeable: true, mergeable_state: "clean", head: { sha: "x" }, base: {} });
    });
    const out = await fetchPrStateAndCi(PR, "tok", { fetchImpl, cache: new Map() });
    expect(out.head_sha).toBe("x");
  });

  it("hits the cache on the second call", async () => {
    const fetchImpl = fakeFetch(gqlRes({}, { state: "SUCCESS", contexts: { nodes: [] } }));
    const cache = new Map();
    await fetchPrStateAndCi(PR, "tok", { fetchImpl, cache });
    await fetchPrStateAndCi(PR, "tok", { fetchImpl, cache });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("draft + autoMergeRequest fields propagate through", async () => {
    const fetchImpl = fakeFetch(gqlRes({
      isDraft: true,
      autoMergeRequest: { mergeMethod: "SQUASH", enabledBy: { login: "bob" } },
    }, null));
    const out = await fetchPrStateAndCi(PR, "tok", { fetchImpl });
    expect(out.draft).toBe(true);
    expect(out.auto_merge).toEqual({ merge_method: "SQUASH", enabled_by: "bob" });
  });
});
