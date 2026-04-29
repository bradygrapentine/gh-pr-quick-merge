/* sentry-sanitize.js — pure functions used as Sentry's `beforeSend` and
 * `beforeBreadcrumb` hooks. NO side effects, NO Sentry SDK imports.
 *
 * Goal: never let a credential, full GitHub URL with sensitive query, or
 * raw user content reach Sentry. F-15 from the SECURITY findings is the
 * concrete spec; this file is its enforcement.
 *
 * Exports a single `globalThis.QM_SENTRY_SANITIZE` so the file can be
 * loaded in a classic service-worker `importScripts` context.
 */

(function attach(scope) {
  const TOKEN_PATTERNS = [
    /\b(?:gh[psour]_[A-Za-z0-9]{36,})\b/g,                 // GitHub PAT/OAuth tokens
    /\b(?:Bearer\s+)[A-Za-z0-9._-]{20,}/gi,                // Bearer <token>
    /\bclient_secret=[^&\s"']+/g,
    /\baccess_token=[^&\s"']+/g,
  ];

  const SENSITIVE_KEY_RE = /^(?:authorization|cookie|x-access-token|token|auth|api[_-]?key|secret|password)$/i;
  const SENSITIVE_CTX_RE = /^(?:token|auth|key|secret|password|bearer)/i;

  function redactString(s) {
    if (typeof s !== "string") return s;
    let out = s;
    for (const re of TOKEN_PATTERNS) out = out.replace(re, "[redacted]");
    return out;
  }

  function redactGithubUrl(s) {
    if (typeof s !== "string") return s;
    if (!/^https?:\/\/(?:[^/]*\.)?github\.com\b/i.test(s)) return s;
    return "[github-url-redacted]";
  }

  function scrubObject(obj, depth) {
    if (obj == null || typeof obj !== "object") return obj;
    if (depth > 6) return obj;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) obj[i] = scrubValue(obj[i], depth + 1);
      return obj;
    }
    for (const k of Object.keys(obj)) {
      if (SENSITIVE_KEY_RE.test(k) || SENSITIVE_CTX_RE.test(k)) {
        obj[k] = "[redacted]";
      } else {
        obj[k] = scrubValue(obj[k], depth + 1);
      }
    }
    return obj;
  }

  function scrubValue(v, depth) {
    if (typeof v === "string") return redactString(v);
    if (typeof v === "object") return scrubObject(v, depth);
    return v;
  }

  function sanitizeBreadcrumb(crumb) {
    if (!crumb) return crumb;
    if (crumb.message) crumb.message = redactString(crumb.message);
    if (crumb.data) {
      if (crumb.data.url) crumb.data.url = redactGithubUrl(crumb.data.url);
      crumb.data = scrubObject(crumb.data, 0);
    }
    if (crumb.category === "navigation" && crumb.data) {
      if (crumb.data.from) crumb.data.from = redactGithubUrl(crumb.data.from);
      if (crumb.data.to) crumb.data.to = redactGithubUrl(crumb.data.to);
    }
    return crumb;
  }

  function sanitizeRequest(req) {
    if (!req) return req;
    if (req.headers) req.headers = scrubObject({ ...req.headers }, 0);
    if (req.url) req.url = redactGithubUrl(req.url);
    if (req.cookies) delete req.cookies;
    if (req.query_string) delete req.query_string;
    return req;
  }

  function sanitizeException(ex) {
    if (!ex || !ex.values) return ex;
    for (const e of ex.values) {
      if (e.value) e.value = redactString(e.value);
      if (e.stacktrace && Array.isArray(e.stacktrace.frames)) {
        for (const f of e.stacktrace.frames) {
          if (f.filename) f.filename = redactGithubUrl(redactString(f.filename));
          if (f.vars) f.vars = scrubObject(f.vars, 0);
        }
      }
    }
    return ex;
  }

  /**
   * `beforeSend` hook: receives the full Sentry event payload before
   * transmit. Returning `null` drops the event entirely.
   */
  function beforeSend(event) {
    if (!event) return event;
    if (event.message) event.message = redactString(event.message);
    if (event.request) event.request = sanitizeRequest(event.request);
    if (event.exception) event.exception = sanitizeException(event.exception);
    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs.map(sanitizeBreadcrumb);
    }
    if (event.contexts) event.contexts = scrubObject(event.contexts, 0);
    if (event.extra) event.extra = scrubObject(event.extra, 0);
    if (event.tags) event.tags = scrubObject(event.tags, 0);
    return event;
  }

  function beforeBreadcrumb(crumb) {
    return sanitizeBreadcrumb(crumb);
  }

  const api = {
    beforeSend,
    beforeBreadcrumb,
    sanitizeBreadcrumb,
    sanitizeRequest,
    sanitizeException,
    redactString,
    redactGithubUrl,
  };

  scope.QM_SENTRY_SANITIZE = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
