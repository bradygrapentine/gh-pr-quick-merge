/* host-tokens.js — per-host token storage (QM-303 / Epic 9 Phase 0).
 *
 * v1.0 / v1.1 stored a single GitHub token at chrome.storage.local.token.
 * v2.0's GitLab adapter needs separate tokens per host, so the new shape is:
 *
 *   chrome.storage.local.tokens = {
 *     "github.com": "ghp_...",
 *     "gitlab.com": "glpat-...",
 *     "gitlab.example.org": "..."  // self-hosted, added in Phase 3
 *   }
 *
 * This module provides:
 *   - migrate(store): one-shot upgrade that reads the legacy `token` key
 *     and writes it to tokens["github.com"]. Idempotent. The legacy key
 *     is kept around during the v2.0 transition so v1.1-era code paths
 *     keep working; a future cleanup pass removes it once Epic 9 ships.
 *   - getHostToken(hostId, store): read a single host's token. Falls
 *     back to the legacy `token` key when hostId === "github" and the
 *     new shape doesn't have an entry yet.
 *   - setHostToken(hostId, value, store): write a single host's token.
 *     Mirrors writes back to the legacy `token` key for "github" so
 *     existing v1.1 readers stay in sync until they're migrated.
 *   - removeHostToken(hostId, store): delete a single host's token.
 */

(function attach(scope) {
  const TOKENS_KEY = "tokens";
  const LEGACY_TOKEN_KEY = "token";

  // Map from HostAdapter.hostId → the storage key used in `tokens`.
  // Adapters may serve multiple hostnames (e.g. self-hosted GitLab),
  // but for the single-instance hosts in REGISTRY we use a fixed
  // canonical name.
  const HOST_ID_TO_STORAGE_KEY = {
    github: "github.com",
    gitlab: "gitlab.com",
  };

  function _resolveKey(hostId) {
    return HOST_ID_TO_STORAGE_KEY[hostId] || hostId;
  }

  /**
   * One-shot migration. Reads the legacy `chrome.storage.local.token`
   * and copies it to `tokens["github.com"]` if the new shape doesn't
   * already have an entry there. Safe to call repeatedly.
   *
   * @param {{get: Function, set: Function}} store — chrome.storage.local-shaped
   * @returns {Promise<{migrated: boolean, reason: string}>}
   */
  async function migrate(store) {
    if (!store || typeof store.get !== "function" || typeof store.set !== "function") {
      throw new Error("host-tokens.migrate: store must expose get + set");
    }
    const data = await store.get([LEGACY_TOKEN_KEY, TOKENS_KEY]);
    const legacy = data && data[LEGACY_TOKEN_KEY];
    const existing = (data && data[TOKENS_KEY] && typeof data[TOKENS_KEY] === "object")
      ? data[TOKENS_KEY]
      : {};
    const githubKey = HOST_ID_TO_STORAGE_KEY.github;

    if (existing[githubKey]) {
      return { migrated: false, reason: "tokens['github.com'] already populated" };
    }
    if (!legacy) {
      // No legacy token at all → nothing to migrate. Still ensure the
      // tokens map is initialised so downstream code can assume the
      // shape exists.
      if (!data || !data[TOKENS_KEY]) {
        await store.set({ [TOKENS_KEY]: {} });
      }
      return { migrated: false, reason: "no legacy token to migrate" };
    }
    await store.set({ [TOKENS_KEY]: { ...existing, [githubKey]: legacy } });
    return { migrated: true, reason: "copied legacy token to tokens['github.com']" };
  }

  /**
   * Read a single host's token. Returns "" when missing.
   *
   * @param {string} hostId — e.g. "github" or "gitlab"
   * @param {{get: Function}} store
   * @returns {Promise<string>}
   */
  async function getHostToken(hostId, store) {
    const data = await store.get([TOKENS_KEY, LEGACY_TOKEN_KEY]);
    const tokens = (data && data[TOKENS_KEY]) || {};
    const key = _resolveKey(hostId);
    if (tokens[key]) return tokens[key];
    // Legacy fallback: a v1.1-shape store with only `token` set is
    // still valid for the GitHub host. Read once, defer migration.
    if (hostId === "github" && data && data[LEGACY_TOKEN_KEY]) return data[LEGACY_TOKEN_KEY];
    return "";
  }

  /**
   * Write a single host's token. Mirrors GitHub writes back to the
   * legacy `token` key so v1.1-era readers stay in sync until they're
   * migrated.
   *
   * @param {string} hostId
   * @param {string} value — empty string or null clears the entry
   * @param {{get: Function, set: Function, remove: Function}} store
   * @returns {Promise<void>}
   */
  async function setHostToken(hostId, value, store) {
    const key = _resolveKey(hostId);
    const data = await store.get(TOKENS_KEY);
    const tokens = (data && data[TOKENS_KEY] && typeof data[TOKENS_KEY] === "object")
      ? { ...data[TOKENS_KEY] }
      : {};
    if (value) {
      tokens[key] = value;
    } else {
      delete tokens[key];
    }
    await store.set({ [TOKENS_KEY]: tokens });
    if (hostId === "github") {
      if (value) {
        await store.set({ [LEGACY_TOKEN_KEY]: value });
      } else if (typeof store.remove === "function") {
        await store.remove(LEGACY_TOKEN_KEY);
      }
    }
  }

  /**
   * Remove a single host's token entirely.
   *
   * @param {string} hostId
   * @param {{get: Function, set: Function, remove: Function}} store
   * @returns {Promise<void>}
   */
  async function removeHostToken(hostId, store) {
    return setHostToken(hostId, "", store);
  }

  const exported = {
    migrate,
    getHostToken,
    setHostToken,
    removeHostToken,
    HOST_ID_TO_STORAGE_KEY,
    TOKENS_KEY,
    LEGACY_TOKEN_KEY,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  if (scope) scope.QM_HOST_TOKENS = exported;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
