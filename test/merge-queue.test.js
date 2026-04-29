import { describe, it, expect, beforeEach } from "vitest";
import mod from "../lib/merge-queue.js";

const { enqueue, dequeue, list, updateStatus, clear, makeKey, MAX_ENTRIES, KEY } = mod;

function makeStore(initial = {}) {
  const data = { ...initial };
  return {
    async get(key) {
      const k = Array.isArray(key) ? key : [key];
      const out = {};
      for (const kk of k) if (kk in data) out[kk] = data[kk];
      return out;
    },
    async set(updates) { Object.assign(data, updates); },
    async remove(k) { delete data[k]; },
    _data: data,
  };
}

let store;

beforeEach(() => {
  store = makeStore();
});

describe("merge-queue", () => {
  it("enqueue persists entry with status: 'watching' and addedAt", async () => {
    const out = await enqueue({ owner: "o", repo: "r", pullNumber: 1 }, store);
    expect(out.status).toBe("watching");
    expect(typeof out.addedAt).toBe("number");
    expect(store._data[KEY]["o/r#1"]).toEqual(out);
  });

  it("list() returns all entries as an array", async () => {
    await enqueue({ owner: "a", repo: "x", pullNumber: 1 }, store);
    await enqueue({ owner: "b", repo: "y", pullNumber: 2 }, store);
    const all = await list(store);
    expect(all.length).toBe(2);
    expect(all.map((e) => e.owner).sort()).toEqual(["a", "b"]);
  });

  it("list() on empty store returns []", async () => {
    expect(await list(store)).toEqual([]);
  });

  it("dequeue removes entry and returns it", async () => {
    await enqueue({ owner: "o", repo: "r", pullNumber: 1 }, store);
    const removed = await dequeue("o/r#1", store);
    expect(removed.pullNumber).toBe(1);
    expect(store._data[KEY]["o/r#1"]).toBeUndefined();
  });

  it("dequeue on missing key returns null", async () => {
    expect(await dequeue("ghost/key#999", store)).toBeNull();
  });

  it("updateStatus mutates only the status field", async () => {
    const before = await enqueue({ owner: "o", repo: "r", pullNumber: 1, addedAt: 12345 }, store);
    await updateStatus("o/r#1", "merged", store);
    const after = (await list(store))[0];
    expect(after.status).toBe("merged");
    expect(after.addedAt).toBe(before.addedAt);
    expect(after.pullNumber).toBe(1);
  });

  it("updateStatus on missing key is a no-op", async () => {
    const out = await updateStatus("ghost#1", "merged", store);
    expect(out).toBeNull();
  });

  it("clear() empties the store", async () => {
    await enqueue({ owner: "o", repo: "r", pullNumber: 1 }, store);
    await clear(store);
    expect(await list(store)).toEqual([]);
  });

  it("multiple enqueues do not overwrite each other", async () => {
    await enqueue({ owner: "a", repo: "x", pullNumber: 1 }, store);
    await enqueue({ owner: "b", repo: "y", pullNumber: 2 }, store);
    const all = await list(store);
    expect(all.length).toBe(2);
  });

  it("re-enqueueing the same key updates rather than failing on the cap", async () => {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      await enqueue({ owner: "o", repo: `r${i}`, pullNumber: 1 }, store);
    }
    // Re-enqueue an existing key — should NOT throw.
    await expect(enqueue({ owner: "o", repo: "r0", pullNumber: 1 }, store)).resolves.toBeDefined();
  });

  it("rejects beyond MAX_ENTRIES distinct keys", async () => {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      await enqueue({ owner: "o", repo: `r${i}`, pullNumber: 1 }, store);
    }
    await expect(enqueue({ owner: "o", repo: "rOver", pullNumber: 1 }, store)).rejects.toThrow(/full/);
  });

  it("makeKey format is exactly 'owner/repo#number'", () => {
    expect(makeKey({ owner: "a", repo: "b", pullNumber: 42 })).toBe("a/b#42");
  });

  it("enqueue without required fields throws", async () => {
    await expect(enqueue({}, store)).rejects.toThrow(/required/);
  });
});
