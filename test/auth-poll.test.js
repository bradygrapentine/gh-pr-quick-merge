/* Device-flow polling-loop tests for auth.js.
 *
 * Strategy: drive the public surface (startDeviceFlow) end-to-end by
 * mocking globalThis.fetch and chrome.storage.local. We use vitest fake
 * timers so the polling loop's `setTimeout`-based sleeps resolve
 * immediately under our control — without this, slow_down's
 * pollInterval bump would spend 5 real seconds per iteration.
 *
 * Each test scripts a sequence of /login/oauth/access_token responses
 * to walk a specific code path (authorization_pending → success,
 * slow_down → success, expired_token, access_denied, etc.).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startDeviceFlow } from "../auth.js";
import utils from "../lib/test-utils.js";

const { makeMockFetch } = utils;

const DEVICE_OK = {
  device_code: "devcode-xyz",
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 1,
};

let originalFetch;
let originalChrome;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        _data: {},
        async set(obj) {
          Object.assign(this._data, obj);
        },
      },
    },
  };
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  globalThis.chrome = originalChrome;
});

// Helper: kick off startDeviceFlow, then drive fake timers until the
// returned promise settles. Without this, sleep() sits on a pending
// setTimeout that fake timers never advance.
async function runFlow(clientId, hooks = {}) {
  const promise = startDeviceFlow(clientId, hooks);
  // Repeatedly drain pending timers + microtasks until the promise
  // resolves. Cap at 100 iterations as a safety net against infinite
  // loops in the production code.
  let settled = false;
  let result;
  promise.then((r) => { settled = true; result = r; });
  for (let i = 0; i < 100 && !settled; i++) {
    await vi.advanceTimersByTimeAsync(10_000);
  }
  if (!settled) throw new Error("runFlow: promise did not settle");
  return result;
}

describe("startDeviceFlow — happy path & polling errors", () => {
  it("returns ok=false immediately if clientId is missing", async () => {
    globalThis.fetch = makeMockFetch([]); // should not be called
    const result = await runFlow("");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Client ID/i);
  });

  it("happy path: pending → access_token → fetch user → success", async () => {
    globalThis.fetch = makeMockFetch([
      { match: "/login/device/code", body: DEVICE_OK },
      { match: "access_token", body: { error: "authorization_pending" } },
      { match: "access_token", body: { access_token: "ghp_FAKE" } },
      { match: "api.github.com/user", body: { login: "octocat" } },
    ]);
    const result = await runFlow("client-1");
    expect(result.ok).toBe(true);
    expect(result.token).toBe("ghp_FAKE");
    expect(result.login).toBe("octocat");
    expect(globalThis.chrome.storage.local._data.token).toBe("ghp_FAKE");
  });

  it("slow_down bumps the poll interval and continues", async () => {
    const onStatus = [];
    globalThis.fetch = makeMockFetch([
      { match: "/login/device/code", body: DEVICE_OK },
      { match: "access_token", body: { error: "slow_down" } },
      { match: "access_token", body: { access_token: "ghp_2" } },
      { match: "api.github.com/user", body: { login: "u" } },
    ]);
    const result = await runFlow("client-1", {
      onStatus: (m) => onStatus.push(m),
    });
    expect(result.ok).toBe(true);
    // Interval should have grown from 1 to 6 after slow_down (spec: +5).
    expect(onStatus.some((m) => /slow down/i.test(m))).toBe(true);
    expect(onStatus.some((m) => /every 6s/.test(m))).toBe(true);
  });

  it("repeated slow_down caps the poll interval at 60s", async () => {
    const onStatus = [];
    // 12 slow_down responses then success. Without a cap, pollInterval would
    // climb to 1 + 12*5 = 61. With the 60s cap, it must clamp.
    const script = [{ match: "/login/device/code", body: DEVICE_OK }];
    for (let i = 0; i < 12; i++) {
      script.push({ match: "access_token", body: { error: "slow_down" } });
    }
    script.push({ match: "access_token", body: { access_token: "ghp_capped" } });
    script.push({ match: "api.github.com/user", body: { login: "u" } });
    globalThis.fetch = makeMockFetch(script);

    const result = await runFlow("client-1", {
      onStatus: (m) => onStatus.push(m),
    });
    expect(result.ok).toBe(true);
    const intervals = onStatus
      .map((m) => Number((m.match(/every (\d+)s/) || [])[1]))
      .filter(Number.isFinite);
    expect(intervals.length).toBeGreaterThan(0);
    expect(Math.max(...intervals)).toBeLessThanOrEqual(60);
  });

  it("slow_down honors a server-supplied interval if larger than current", async () => {
    const onStatus = [];
    globalThis.fetch = makeMockFetch([
      { match: "/login/device/code", body: DEVICE_OK },
      { match: "access_token", body: { error: "slow_down", interval: 10 } },
      { match: "access_token", body: { access_token: "ghp_x" } },
      { match: "api.github.com/user", body: { login: "u" } },
    ]);
    const result = await runFlow("client-1", {
      onStatus: (m) => onStatus.push(m),
    });
    expect(result.ok).toBe(true);
    expect(onStatus.some((m) => /every 10s/.test(m))).toBe(true);
  });

  it("expired_token returns failure with helpful message", async () => {
    globalThis.fetch = makeMockFetch([
      { match: "/login/device/code", body: DEVICE_OK },
      { match: "access_token", body: { error: "expired_token" } },
    ]);
    const result = await runFlow("client-1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it("access_denied returns failure with denial message", async () => {
    globalThis.fetch = makeMockFetch([
      { match: "/login/device/code", body: DEVICE_OK },
      { match: "access_token", body: { error: "access_denied" } },
    ]);
    const result = await runFlow("client-1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/denied/i);
  });

  it("incorrect_client_credentials surfaces the OAuth error description", async () => {
    globalThis.fetch = makeMockFetch([
      { match: "/login/device/code", body: DEVICE_OK },
      {
        match: "access_token",
        body: {
          error: "incorrect_client_credentials",
          error_description: "Bad client id",
        },
      },
    ]);
    const result = await runFlow("client-1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Bad client id/);
  });

  it("unknown OAuth error short-circuits the loop", async () => {
    globalThis.fetch = makeMockFetch([
      { match: "/login/device/code", body: DEVICE_OK },
      {
        match: "access_token",
        body: { error: "totally_unknown", error_description: "weird" },
      },
    ]);
    const result = await runFlow("client-1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/weird/);
  });

  it("device-code request HTTP failure returns a clear error", async () => {
    globalThis.fetch = makeMockFetch([
      {
        match: "/login/device/code",
        body: {},
        status: 503,
      },
    ]);
    const result = await runFlow("client-1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/HTTP 503/);
  });

  it("malformed device-code response (missing fields) returns failure", async () => {
    globalThis.fetch = makeMockFetch([
      {
        match: "/login/device/code",
        body: { user_code: "ABCD" }, // missing device_code + verification_uri
      },
    ]);
    const result = await runFlow("client-1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Malformed/i);
  });
});
