import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock chrome APIs before importing background.js logic.
// background.js registers listeners at module evaluation time via chrome.*,
// so we set up chrome global first, then manually invoke the handlers.

let onInstalledCallback;
let onAlarmCallback;
let onChangedCallback;

const localStore = {};

const chromeMock = {
  runtime: {
    onInstalled: {
      addListener: vi.fn((cb) => {
        onInstalledCallback = cb;
      }),
    },
    onMessage: {
      addListener: vi.fn(),
    },
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn((cb) => {
        onAlarmCallback = cb;
      }),
    },
  },
  storage: {
    local: {
      get: vi.fn(async (key) => {
        if (localStore[key] !== undefined) return { [key]: localStore[key] };
        return {};
      }),
      set: vi.fn(async (obj) => {
        Object.assign(localStore, obj);
      }),
    },
    onChanged: {
      addListener: vi.fn((cb) => {
        onChangedCallback = cb;
      }),
    },
  },
  management: {
    getSelf: vi.fn(),
  },
};

global.chrome = chromeMock;

// Import background.js — listeners register on module load.
await import("../background.js");

describe("QM-043 — background token-rotation logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset local store between tests
    for (const key of Object.keys(localStore)) delete localStore[key];
    // Re-wire mocks after clearAllMocks
    chromeMock.storage.local.get.mockImplementation(async (key) => {
      if (localStore[key] !== undefined) return { [key]: localStore[key] };
      return {};
    });
    chromeMock.storage.local.set.mockImplementation(async (obj) => {
      Object.assign(localStore, obj);
    });
  });

  it("onInstalled creates the daily alarm", () => {
    onInstalledCallback();
    expect(chromeMock.alarms.create).toHaveBeenCalledWith("qm-token-check", {
      periodInMinutes: 60 * 24,
    });
  });

  it("alarm with tokenSavedAt > 30d sets tokenStale=true", async () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 86400 * 1000;
    localStore.tokenSavedAt = thirtyOneDaysAgo;
    await onAlarmCallback({ name: "qm-token-check" });
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ tokenStale: true });
  });

  it("alarm with tokenSavedAt < 30d sets tokenStale=false", async () => {
    const fiveDaysAgo = Date.now() - 5 * 86400 * 1000;
    localStore.tokenSavedAt = fiveDaysAgo;
    await onAlarmCallback({ name: "qm-token-check" });
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ tokenStale: false });
  });

  it("alarm with no tokenSavedAt sets tokenStale=false (no spurious badge)", async () => {
    // localStore is empty (no tokenSavedAt)
    await onAlarmCallback({ name: "qm-token-check" });
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ tokenStale: false });
  });

  it("storage onChanged with new token refreshes tokenSavedAt and clears stale", async () => {
    const before = Date.now();
    await onChangedCallback({ token: { newValue: "ghp_abc123" } }, "local");
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ tokenStale: false }),
    );
    const call = chromeMock.storage.local.set.mock.calls[0][0];
    expect(call.tokenSavedAt).toBeGreaterThanOrEqual(before);
  });
});
