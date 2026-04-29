/* import-export.js — bundle/restore user-tunable settings as a JSON blob.
 *
 * Out of scope: tokens (NEVER export auth credentials), client_id (per-user
 * registration), and any chrome.storage.local entry that's a runtime cache.
 *
 * Sync-store keys covered: pinnedRepos, qm_repo_defaults, qm_templates,
 * qm_shortcuts, qm_stale_days, clientId. clientId IS exported because losing
 * it on machine migration is a worse failure mode than the (mild) leakage
 * concern — Client IDs are public per OAuth Device Flow.
 */

(function attach(scope) {
  const SCHEMA_VERSION = 1;

  const EXPORTED_KEYS = [
    "pinnedRepos",
    "qm_repo_defaults",
    "qm_templates",
    "qm_shortcuts",
    "qm_stale_days",
    "clientId",
  ];

  async function exportAll(store) {
    const data = await store.get(EXPORTED_KEYS);
    const blob = { _schema: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
    for (const k of EXPORTED_KEYS) {
      if (data && Object.prototype.hasOwnProperty.call(data, k) && data[k] !== undefined) {
        blob[k] = data[k];
      }
    }
    return blob;
  }

  function validateBlob(blob) {
    if (!blob || typeof blob !== "object") return { valid: false, error: "Not an object." };
    if (blob._schema !== SCHEMA_VERSION) {
      return { valid: false, error: `Unsupported schema version (got ${blob._schema}, expected ${SCHEMA_VERSION}).` };
    }
    if (blob.pinnedRepos !== undefined && !Array.isArray(blob.pinnedRepos)) {
      return { valid: false, error: "pinnedRepos must be an array." };
    }
    if (blob.qm_repo_defaults !== undefined && (typeof blob.qm_repo_defaults !== "object" || Array.isArray(blob.qm_repo_defaults))) {
      return { valid: false, error: "qm_repo_defaults must be an object." };
    }
    if (blob.qm_templates !== undefined && (typeof blob.qm_templates !== "object" || Array.isArray(blob.qm_templates))) {
      return { valid: false, error: "qm_templates must be an object." };
    }
    if (blob.qm_shortcuts !== undefined && !Array.isArray(blob.qm_shortcuts)) {
      return { valid: false, error: "qm_shortcuts must be an array." };
    }
    if (blob.qm_stale_days !== undefined) {
      const n = Number(blob.qm_stale_days);
      if (!Number.isFinite(n) || n < 1 || n > 365) {
        return { valid: false, error: "qm_stale_days must be a number between 1 and 365." };
      }
    }
    if (blob.clientId !== undefined && typeof blob.clientId !== "string") {
      return { valid: false, error: "clientId must be a string." };
    }
    return { valid: true };
  }

  async function importAll(blob, store) {
    const result = validateBlob(blob);
    if (!result.valid) throw new Error(result.error);
    const writes = {};
    for (const k of EXPORTED_KEYS) {
      if (Object.prototype.hasOwnProperty.call(blob, k)) {
        writes[k] = blob[k];
      }
    }
    await store.set(writes);
    return { written: Object.keys(writes) };
  }

  function parseBlob(text) {
    const parsed = JSON.parse(text);
    const result = validateBlob(parsed);
    if (!result.valid) throw new Error(result.error);
    return parsed;
  }

  const api = {
    exportAll,
    importAll,
    validateBlob,
    parseBlob,
    SCHEMA_VERSION,
    EXPORTED_KEYS,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_IMPORT_EXPORT = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
