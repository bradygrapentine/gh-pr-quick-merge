/* api.js — minimal GitHub REST helpers shared by content.js + lib/*.
 *
 * Each helper returns the parsed JSON body on success and throws a typed
 * error on non-2xx. Callers that need the raw status (e.g. 202 = queued)
 * can pass `expectedStatus` to short-circuit the throw and return a
 * sentinel `{ status }` object.
 */

(function attach(scope) {
  const API = "https://api.github.com";

  function ghHeaders(token) {
    return {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  class GitHubApiError extends Error {
    constructor(status, message, path) {
      super(`GitHub ${status} on ${path}: ${message}`);
      this.name = "GitHubApiError";
      this.status = status;
      this.path = path;
    }
  }

  async function _request(method, path, { token, body, expectedStatus, fetchImpl } = {}) {
    const url = path.startsWith("http") ? path : `${API}${path}`;
    const init = {
      method,
      headers: ghHeaders(token),
    };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const _fetch = fetchImpl || (typeof fetch === "function" ? fetch : null);
    if (!_fetch) throw new Error("api.js: no fetch implementation available");

    const res = await _fetch(url, init);
    if (expectedStatus !== undefined && res.status === expectedStatus) {
      return { status: res.status, queued: res.status === 202 };
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data && data.message) msg = data.message;
      } catch (_e) { /* response not JSON */ }
      throw new GitHubApiError(res.status, msg, path);
    }
    if (res.status === 204) return null;
    try {
      return await res.json();
    } catch (_e) {
      return null;
    }
  }

  function apiGet(path, opts = {}) {
    return _request("GET", path, opts);
  }
  function apiPost(path, body, opts = {}) {
    return _request("POST", path, { ...opts, body });
  }
  function apiPut(path, body, opts = {}) {
    return _request("PUT", path, { ...opts, body });
  }
  function apiDelete(path, opts = {}) {
    return _request("DELETE", path, opts);
  }

  const api = {
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    ghHeaders,
    GitHubApiError,
    API_BASE: API,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_API = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
