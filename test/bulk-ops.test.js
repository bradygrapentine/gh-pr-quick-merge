import { describe, it, expect, vi } from "vitest";
import mod from "../lib/bulk-ops.js";

const { closePRs, labelPRs, DEFAULT_CONFIRM_THRESHOLD } = mod;

function makeApi({ post, ghHeaders } = {}) {
  return {
    apiPost: post || vi.fn(async () => ({})),
    ghHeaders: ghHeaders || ((t) => ({ Authorization: `Bearer ${t || ""}` })),
    API_BASE: "https://api.github.com",
  };
}

describe("DEFAULT_CONFIRM_THRESHOLD", () => {
  it("is 5", () => {
    expect(DEFAULT_CONFIRM_THRESHOLD).toBe(5);
  });
});

describe("closePRs", () => {
  it("happy path with one PR — single PATCH, returns ok", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({}) }; };
    const out = await closePRs("o/r", [42], "tok", { api: makeApi(), fetchImpl });
    expect(out).toEqual([{ number: 42, ok: true }]);
    expect(calls.length).toBe(1);
    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].init.body).toBe(JSON.stringify({ state: "closed" }));
  });

  it("issues N PATCHes for N PRs", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url }); return { ok: true, status: 200, json: async () => ({}) }; };
    await closePRs("o/r", [1, 2, 3], "tok", { api: makeApi(), fetchImpl });
    expect(calls.length).toBe(3);
  });

  it("captures per-PR errors without throwing", async () => {
    let i = 0;
    const fetchImpl = async () => {
      i++;
      if (i === 2) return { ok: false, status: 422, json: async () => ({ message: "blocked" }) };
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const out = await closePRs("o/r", [1, 2, 3], "tok", { api: makeApi(), fetchImpl });
    expect(out[0].ok).toBe(true);
    expect(out[1].ok).toBe(false);
    expect(out[1].error).toContain("blocked");
    expect(out[2].ok).toBe(true);
  });

  it("empty prNumbers returns [] without any fetch", async () => {
    const fetchImpl = vi.fn();
    expect(await closePRs("o/r", [], "tok", { api: makeApi(), fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("passes token in Authorization header", async () => {
    let init;
    const fetchImpl = async (_, i) => { init = i; return { ok: true, status: 200, json: async () => ({}) }; };
    await closePRs("o/r", [1], "the-token", { api: makeApi(), fetchImpl });
    expect(init.headers.Authorization).toBe("Bearer the-token");
  });

  it("uses /pulls/:n endpoint (not /issues/:n)", async () => {
    let url;
    const fetchImpl = async (u) => { url = u; return { ok: true, status: 200, json: async () => ({}) }; };
    await closePRs("o/r", [42], "tok", { api: makeApi(), fetchImpl });
    expect(url).toBe("https://api.github.com/repos/o/r/pulls/42");
  });

  it("network rejection captured as ok:false", async () => {
    const fetchImpl = async () => { throw new Error("network down"); };
    const out = await closePRs("o/r", [1], "tok", { api: makeApi(), fetchImpl });
    expect(out[0]).toEqual({ number: 1, ok: false, error: "network down" });
  });

  it("invalid repoFullName throws", async () => {
    await expect(closePRs("badname", [1], "tok", { api: makeApi() })).rejects.toThrow(/invalid repoFullName/);
  });
});

describe("labelPRs", () => {
  it("happy path — one PR, two labels", async () => {
    let receivedBody, receivedPath;
    const post = vi.fn(async (path, body) => { receivedPath = path; receivedBody = body; return {}; });
    const out = await labelPRs("o/r", [1], ["bug", "high"], "tok", { api: makeApi({ post }) });
    expect(out).toEqual([{ number: 1, ok: true }]);
    expect(receivedPath).toBe("/repos/o/r/issues/1/labels");
    expect(receivedBody.labels).toEqual(["bug", "high"]);
  });

  it("issues one POST per PR for multiple PRs", async () => {
    const post = vi.fn(async () => ({}));
    await labelPRs("o/r", [1, 2, 3], ["x"], "tok", { api: makeApi({ post }) });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("422 (label not found) captured per-PR", async () => {
    let i = 0;
    const post = vi.fn(async () => {
      i++;
      if (i === 2) {
        const e = new Error("Label not found");
        e.status = 422;
        throw e;
      }
      return {};
    });
    const out = await labelPRs("o/r", [1, 2, 3], ["bug"], "tok", { api: makeApi({ post }) });
    expect(out[0].ok).toBe(true);
    expect(out[1]).toEqual({ number: 2, ok: false, error: "Label not found" });
    expect(out[2].ok).toBe(true);
  });

  it("empty prNumbers returns [] without any fetch", async () => {
    const post = vi.fn();
    expect(await labelPRs("o/r", [], ["x"], "tok", { api: makeApi({ post }) })).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it("empty labels returns [] without any fetch", async () => {
    const post = vi.fn();
    expect(await labelPRs("o/r", [1], [], "tok", { api: makeApi({ post }) })).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it("uses /issues/:n/labels endpoint", async () => {
    let path;
    const post = vi.fn(async (p) => { path = p; return {}; });
    await labelPRs("o/r", [42], ["bug"], "tok", { api: makeApi({ post }) });
    expect(path).toBe("/repos/o/r/issues/42/labels");
  });

  it("result array order matches prNumbers input order", async () => {
    const post = vi.fn(async () => ({}));
    const out = await labelPRs("o/r", [3, 1, 2], ["x"], "tok", { api: makeApi({ post }) });
    expect(out.map((r) => r.number)).toEqual([3, 1, 2]);
  });
});
