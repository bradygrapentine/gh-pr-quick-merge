/* hosts/index.js — host detection + HostAdapter interface (Epic 9 / QM-300).
 *
 * The contract every host adapter (GitHub, GitLab, …) must satisfy. This
 * file is the seam content.js will eventually call into; today it just
 * exposes detect() and the interface description so adapters can self-check
 * their shape and tests can verify conformance without importing the real
 * implementations.
 *
 * Phase 0a (this PR): scaffold + GitHub-only detection. No code switches
 * over yet — Phase 0b (QM-302) wires content.js to call adapters by name.
 *
 * @typedef {object} HostAdapter
 * @property {string} hostId                                              Stable string id, e.g. "github" or "gitlab".
 * @property {string[]} hostMatches                                       Hostnames this adapter handles, e.g. ["github.com"].
 * @property {{apiGet:Function, apiPost:Function, apiPut:Function, apiDelete:Function}} api
 *   Adapter-scoped REST helpers. Same signatures as lib/hosts/github/api.js.
 * @property {(row: HTMLElement) => HTMLAnchorElement|null} findPrAnchor  Find the PR/MR anchor inside a row.
 * @property {(anchor: HTMLAnchorElement|string) => {owner:string, repo:string, num:number}|null} parsePrLink
 *   Extract owner / repo / number from a row anchor href.
 * @property {string} ROW_SELECTOR                                        DOM selector for the per-PR row container.
 * @property {string} INJECTED_ATTR                                       Marker attribute set when a row has been augmented.
 */

(function attach(scope) {
  const INTERFACE_VERSION = 1;

  // Single source of truth for the hostnames each adapter claims. Update here
  // when adding a new host; detect() and the manifest content_scripts matches
  // both reference these.
  const REGISTRY = {
    github: {
      hostId: "github",
      hostMatches: ["github.com"],
    },
    // gitlab adapter lands in Phase 1 (QM-312) — slot reserved here so
    // detect() returns a stable shape across phases.
    gitlab: {
      hostId: "gitlab",
      hostMatches: ["gitlab.com"],
      // selfHosted: true — runtime-permission flow lands in Phase 3 (QM-318).
    },
  };

  /**
   * Resolve the hostId for a given URL or location-like object. Returns null
   * if no adapter claims the hostname (the caller should no-op rather than
   * inject a partial UI).
   *
   * @param {string|{hostname:string}} input
   * @returns {string|null}
   */
  function detect(input) {
    if (input == null) return null;
    let hostname = "";
    if (typeof input === "string") {
      try { hostname = new URL(input).hostname; } catch (_e) { return null; }
    } else if (typeof input.hostname === "string") {
      hostname = input.hostname;
    }
    if (!hostname) return null;
    for (const [, entry] of Object.entries(REGISTRY)) {
      if (entry.hostMatches.includes(hostname)) return entry.hostId;
    }
    return null;
  }

  /**
   * Validate a candidate adapter against the expected interface keys. Used
   * by adapter unit tests as a contract check; throws a descriptive error
   * naming the missing key so failures point at the adapter, not the test.
   *
   * @param {object} adapter
   * @returns {true}
   */
  function assertHostAdapterShape(adapter) {
    if (!adapter || typeof adapter !== "object") {
      throw new Error("HostAdapter: candidate is not an object");
    }
    const required = ["hostId", "hostMatches", "api", "findPrAnchor", "parsePrLink", "ROW_SELECTOR", "INJECTED_ATTR"];
    for (const key of required) {
      if (!(key in adapter)) throw new Error(`HostAdapter: missing key ${key}`);
    }
    if (typeof adapter.hostId !== "string" || !adapter.hostId) {
      throw new Error("HostAdapter: hostId must be a non-empty string");
    }
    if (!Array.isArray(adapter.hostMatches) || adapter.hostMatches.length === 0) {
      throw new Error("HostAdapter: hostMatches must be a non-empty array");
    }
    for (const m of ["apiGet", "apiPost", "apiPut"]) {
      if (typeof adapter.api[m] !== "function") {
        throw new Error(`HostAdapter: api.${m} must be a function`);
      }
    }
    if (typeof adapter.findPrAnchor !== "function") throw new Error("HostAdapter: findPrAnchor must be a function");
    if (typeof adapter.parsePrLink !== "function") throw new Error("HostAdapter: parsePrLink must be a function");
    return true;
  }

  const api = {
    INTERFACE_VERSION,
    REGISTRY,
    detect,
    assertHostAdapterShape,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_HOSTS = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
