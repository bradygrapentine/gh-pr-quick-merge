import { describe, it, expect } from "vitest";
import mod from "../lib/update-branch.js";

const { updateBranch, UpdateConflictError, UpdateForbiddenError } = mod;

function makeApi(handler) {
  return {
    apiPost: handler,
  };
}

describe("updateBranch", () => {
  it("happy path — 202 returns { queued: true }", async () => {
    const api = makeApi(async (path, body, opts) => {
      expect(opts.expectedStatus).toBe(202);
      return { status: 202, queued: true };
    });
    const out = await updateBranch({ owner: "o", repo: "r", pullNumber: 1, api });
    expect(out).toEqual({ queued: true });
  });

  it("strategy defaults to merge — no merge_method in body", async () => {
    let receivedBody;
    const api = makeApi(async (path, body) => { receivedBody = body; return { status: 202 }; });
    await updateBranch({ owner: "o", repo: "r", pullNumber: 1, api });
    expect(receivedBody.merge_method).toBeUndefined();
  });

  it("strategy 'rebase' sets merge_method=rebase in body", async () => {
    let receivedBody;
    const api = makeApi(async (path, body) => { receivedBody = body; return { status: 202 }; });
    await updateBranch({ owner: "o", repo: "r", pullNumber: 1, strategy: "rebase", api });
    expect(receivedBody.merge_method).toBe("rebase");
  });

  it("expected_head_oid forwarded when provided, omitted when absent", async () => {
    let withSha, withoutSha;
    const api1 = makeApi(async (p, body) => { withSha = body; return { status: 202 }; });
    await updateBranch({ owner: "o", repo: "r", pullNumber: 1, expectedHeadSha: "abc", api: api1 });
    expect(withSha.expected_head_oid).toBe("abc");

    const api2 = makeApi(async (p, body) => { withoutSha = body; return { status: 202 }; });
    await updateBranch({ owner: "o", repo: "r", pullNumber: 1, api: api2 });
    expect(withoutSha.expected_head_oid).toBeUndefined();
  });

  it("422 conflict throws UpdateConflictError", async () => {
    const api = makeApi(async () => {
      const e = new Error("conflict");
      e.status = 422;
      throw e;
    });
    await expect(updateBranch({ owner: "o", repo: "r", pullNumber: 1, api })).rejects.toBeInstanceOf(UpdateConflictError);
  });

  it("403 forbidden throws UpdateForbiddenError", async () => {
    const api = makeApi(async () => {
      const e = new Error("forbidden");
      e.status = 403;
      throw e;
    });
    await expect(updateBranch({ owner: "o", repo: "r", pullNumber: 1, api })).rejects.toBeInstanceOf(UpdateForbiddenError);
  });

  it("unknown error propagates unchanged", async () => {
    const cause = Object.assign(new Error("boom"), { status: 500 });
    const api = makeApi(async () => { throw cause; });
    await expect(updateBranch({ owner: "o", repo: "r", pullNumber: 1, api })).rejects.toBe(cause);
  });

  it("does not mutate the input options object", async () => {
    const opts = { owner: "o", repo: "r", pullNumber: 1, expectedHeadSha: "abc", strategy: "rebase",
                   api: makeApi(async () => ({ status: 202 })) };
    const snapshot = JSON.stringify({ ...opts, api: undefined });
    await updateBranch(opts);
    expect(JSON.stringify({ ...opts, api: undefined })).toBe(snapshot);
  });

  it("missing required fields throws synchronously", async () => {
    await expect(updateBranch({})).rejects.toThrow(/required/);
  });
});
