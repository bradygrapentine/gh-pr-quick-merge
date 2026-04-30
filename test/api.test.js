import { describe, it, expect } from "vitest";
import api from "../lib/api.js";

function makeRes({ status = 200, body = {}, ok } = {}) {
  return {
    status,
    ok: ok === undefined ? status >= 200 && status < 300 : ok,
    json: async () => body,
  };
}

describe("api.apiGet", () => {
  it("calls fetch with API_BASE prefix when path starts with /", async () => {
    let calledUrl, calledInit;
    const fetchImpl = (u, i) => { calledUrl = u; calledInit = i; return makeRes({ body: { ok: 1 } }); };
    const out = await api.apiGet("/repos/x/y", { token: "t", fetchImpl });
    expect(calledUrl).toBe("https://api.github.com/repos/x/y");
    expect(calledInit.method).toBe("GET");
    expect(calledInit.headers.Authorization).toBe("Bearer t");
    expect(out).toEqual({ ok: 1 });
  });

  it("preserves an absolute URL unchanged", async () => {
    let url;
    const fetchImpl = (u) => { url = u; return makeRes({ body: { x: 1 } }); };
    await api.apiGet("https://example.com/foo", { fetchImpl });
    expect(url).toBe("https://example.com/foo");
  });

  it("omits Authorization when token is empty", async () => {
    let init;
    const fetchImpl = (_, i) => { init = i; return makeRes(); };
    await api.apiGet("/x", { fetchImpl });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("throws GitHubApiError with API message on non-2xx", async () => {
    const fetchImpl = () => makeRes({ status: 404, body: { message: "Not Found" } });
    await expect(api.apiGet("/repos/x/y", { fetchImpl })).rejects.toThrow(/404.*Not Found/);
  });

  it("falls back to HTTP <status> when error body is not JSON", async () => {
    const fetchImpl = () => ({ status: 500, ok: false, json: async () => { throw new Error("not json"); } });
    await expect(api.apiGet("/x", { fetchImpl })).rejects.toThrow(/500/);
  });

  it("returns null for 204 No Content", async () => {
    const fetchImpl = () => ({ status: 204, ok: true, json: async () => null });
    expect(await api.apiGet("/x", { fetchImpl })).toBeNull();
  });
});

describe("api.apiPost", () => {
  it("serializes body and sets Content-Type", async () => {
    let init;
    const fetchImpl = (_, i) => { init = i; return makeRes({ status: 201, body: { id: 1 } }); };
    await api.apiPost("/x", { foo: "bar" }, { token: "t", fetchImpl });
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ foo: "bar" }));
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("returns sentinel for expectedStatus match (e.g. 202 queued)", async () => {
    const fetchImpl = () => makeRes({ status: 202, body: {} });
    const out = await api.apiPost("/x", null, { fetchImpl, expectedStatus: 202 });
    expect(out).toEqual({ status: 202, queued: true });
  });
});

describe("api.apiPut", () => {
  it("issues a PUT request with body", async () => {
    let init;
    const fetchImpl = (_, i) => { init = i; return makeRes({ body: { merged: true } }); };
    const out = await api.apiPut("/repos/x/y/pulls/1/merge", { merge_method: "squash" }, { token: "t", fetchImpl });
    expect(init.method).toBe("PUT");
    expect(init.body).toContain("squash");
    expect(out.merged).toBe(true);
  });
});

describe("api.GitHubApiError", () => {
  it("carries status and path", async () => {
    const fetchImpl = () => makeRes({ status: 422, body: { message: "Unprocessable" } });
    try {
      await api.apiGet("/x", { fetchImpl });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e.name).toBe("GitHubApiError");
      expect(e.status).toBe(422);
      expect(e.path).toBe("/x");
    }
  });
});
