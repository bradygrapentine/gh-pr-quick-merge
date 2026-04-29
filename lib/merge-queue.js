/* merge-queue.js — persistent queue of "merge once green" PR requests,
 * stored in chrome.storage.local under the key "mergeQueue".
 *
 * Shape on disk:
 *   {
 *     "owner/repo#42": {
 *       owner: "owner", repo: "repo", pullNumber: 42,
 *       addedAt: 1714500000000,
 *       status: "watching" | "merged" | "failed"
 *     },
 *     ...
 *   }
 *
 * The background-service-worker poller (QM-055) reads this map every
 * minute and fires the merge for entries whose checks have all turned
 * green.
 */

(function attach(scope) {
  const KEY = "mergeQueue";
  const MAX_ENTRIES = 10;

  function makeKey({ owner, repo, pullNumber }) {
    return `${owner}/${repo}#${pullNumber}`;
  }

  async function _readMap(store) {
    const data = await store.get(KEY);
    return (data && data[KEY] && typeof data[KEY] === "object") ? { ...data[KEY] } : {};
  }

  async function _writeMap(store, map) {
    await store.set({ [KEY]: map });
  }

  /** Add a PR to the watch queue. Caps at MAX_ENTRIES; rejects beyond that. */
  async function enqueue(entry, store) {
    if (!entry || !entry.owner || !entry.repo || !entry.pullNumber) {
      throw new Error("enqueue: { owner, repo, pullNumber } required");
    }
    const map = await _readMap(store);
    const key = makeKey(entry);
    if (Object.keys(map).length >= MAX_ENTRIES && !map[key]) {
      throw new Error(`mergeQueue full (cap ${MAX_ENTRIES}); dequeue an entry first`);
    }
    map[key] = {
      owner: entry.owner,
      repo: entry.repo,
      pullNumber: entry.pullNumber,
      addedAt: typeof entry.addedAt === "number" ? entry.addedAt : Date.now(),
      status: "watching",
    };
    await _writeMap(store, map);
    return map[key];
  }

  /** Remove an entry by key, returning the removed value or null. */
  async function dequeue(key, store) {
    const map = await _readMap(store);
    if (!Object.prototype.hasOwnProperty.call(map, key)) return null;
    const removed = map[key];
    delete map[key];
    await _writeMap(store, map);
    return removed;
  }

  /** Return all entries as an array. */
  async function list(store) {
    const map = await _readMap(store);
    return Object.values(map);
  }

  /** Mutate ONLY the status field of an existing entry. No-op if missing. */
  async function updateStatus(key, status, store) {
    const map = await _readMap(store);
    if (!map[key]) return null;
    map[key] = { ...map[key], status };
    await _writeMap(store, map);
    return map[key];
  }

  /** Wipe all entries. */
  async function clear(store) {
    await _writeMap(store, {});
  }

  const mergeQueue = {
    enqueue,
    dequeue,
    list,
    updateStatus,
    clear,
    makeKey,
    KEY,
    MAX_ENTRIES,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = mergeQueue;
  if (scope) scope.QM_MERGE_QUEUE = mergeQueue;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
