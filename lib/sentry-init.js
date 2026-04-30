/* sentry-init.js — boots Sentry (if vendored) with the sanitizer attached.
 *
 * The MV3 service worker runs as a classic worker; npm packages cannot be
 * imported directly. To wire Sentry in production:
 *
 *   1. Run `npm run vendor:sentry` (a follow-up commit will add this) which
 *      copies node_modules/@sentry/browser/build/bundles/bundle.tracing.min.js
 *      to lib/vendor/sentry.min.js.
 *   2. The build (`scripts/package.sh`) calls importScripts on that vendored
 *      bundle inside background.js.
 *   3. background.js calls QM_SENTRY_INIT.boot(...) AFTER the vendor bundle
 *      has loaded; the boot function is a no-op if `globalThis.Sentry` is
 *      missing, so dev runs without the vendor file behave correctly.
 *
 * Until vendoring lands, this file is the integration seam — its presence on
 * main lets the sanitizer be unit-tested today and the SDK to be plugged in
 * tomorrow without further surgery on background.js.
 */

(function attach(scope) {
  const SENTRY_DSN = scope.QM_SENTRY_DSN || "";
  const RELEASE = scope.QM_SENTRY_RELEASE || "";
  const ENV = scope.QM_SENTRY_ENV || "production";

  /**
   * Read the user's consent flag from chrome.storage.sync. QM-173.
   * Default: false (opt-in). Async, so callers must await.
   */
  async function _consentGranted() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
      return false;
    }
    try {
      const data = await chrome.storage.sync.get("qm_sentry_consent");
      return !!(data && data.qm_sentry_consent);
    } catch (_e) { return false; }
  }

  async function boot(options) {
    options = options || {};
    const Sentry = scope.Sentry;
    const sanitize = scope.QM_SENTRY_SANITIZE;

    if (!Sentry) {
      console.info("[QM] Sentry not vendored; crash reporting disabled.");
      return { booted: false, reason: "no-sentry-global" };
    }
    if (!sanitize) {
      console.warn("[QM] sentry-sanitize.js not loaded — refusing to boot Sentry without sanitizer.");
      return { booted: false, reason: "no-sanitizer" };
    }
    if (!SENTRY_DSN && !options.dsn) {
      console.info("[QM] no Sentry DSN configured; crash reporting disabled.");
      return { booted: false, reason: "no-dsn" };
    }
    // QM-173 — explicit user consent gate. Bypass possible in tests via
    // options.skipConsent or QM_SENTRY_FORCE on the global.
    if (!options.skipConsent && !scope.QM_SENTRY_FORCE) {
      const consent = await _consentGranted();
      if (!consent) {
        console.info("[QM] Sentry consent not granted; crash reporting disabled.");
        return { booted: false, reason: "no-consent" };
      }
    }

    Sentry.init({
      dsn: options.dsn || SENTRY_DSN,
      release: options.release || RELEASE || undefined,
      environment: options.environment || ENV,
      sampleRate: 1.0,
      tracesSampleRate: 0,
      autoSessionTracking: false,
      sendDefaultPii: false,
      beforeSend: sanitize.beforeSend,
      beforeBreadcrumb: sanitize.beforeBreadcrumb,
    });

    return { booted: true };
  }

  scope.QM_SENTRY_INIT = { boot, _consentGranted };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { boot, _consentGranted };
  }
})(typeof self !== "undefined" ? self : globalThis);
