/* Shared test-only helpers. Mirrors the dual CJS+window export pattern of
 * lib/pr-helpers.js so these utilities work under either module style.
 *
 * Used by 2+ test files (test/auth-poll.test.js + future suites).
 */

/**
 * Build a fake `fetch` whose responses are scripted by URL prefix.
 *
 * @param {Array<{match: string|RegExp, body: any, status?: number, ok?: boolean}>} script
 *        Ordered list of canned responses. Each entry is matched once unless
 *        `repeat: true` is set, in which case it stays at the head until a
 *        later entry matches.
 *
 *        match: substring or RegExp tested against the request URL.
 *        body:  JSON-serializable body returned by .json().
 *        status / ok: HTTP shape (defaults: 200 / true).
 *        repeat: keep this entry available across multiple calls.
 *
 * Calls in order: each invocation pulls the first un-consumed entry whose
 * match hits the URL. If nothing matches, the mock throws — making missed
 * cases loud rather than silent.
 *
 * @returns {Function & {calls: Array<{url: string, init: object}>}}
 */
function makeMockFetch(script) {
  const queue = script.map((s) => ({ ...s, _used: false }));
  const fn = async (url, init = {}) => {
    fn.calls.push({ url: String(url), init });
    const idx = queue.findIndex(
      (s) => !s._used && matches(s.match, String(url)),
    );
    if (idx === -1) {
      throw new Error(`makeMockFetch: no scripted response for ${url}`);
    }
    const entry = queue[idx];
    if (!entry.repeat) entry._used = true;
    const status = entry.status ?? 200;
    const ok = entry.ok ?? (status >= 200 && status < 300);
    return {
      ok,
      status,
      json: async () => entry.body,
    };
  };
  fn.calls = [];
  return fn;
}

function matches(pattern, url) {
  if (pattern instanceof RegExp) return pattern.test(url);
  return url.includes(pattern);
}

/**
 * Build a minimal in-memory chrome.storage-like store for tests.
 *
 * @returns {{get: Function, set: Function, _data: object}}
 */
function makeMockStore(initial = {}) {
  const data = { ...initial };
  return {
    _data: data,
    get: async (keys) => {
      if (!keys) return { ...data };
      if (typeof keys === "string") return { [keys]: data[keys] };
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((k) => [k, data[keys]]));
      }
      // object-with-defaults form
      const out = { ...keys };
      for (const k of Object.keys(keys)) {
        if (k in data) out[k] = data[k];
      }
      return out;
    },
    set: async (obj) => {
      Object.assign(data, obj);
    },
  };
}

const utils = { makeMockFetch, makeMockStore };

if (typeof module !== "undefined") module.exports = utils;
if (typeof window !== "undefined") window.QM_TEST_UTILS = utils;
