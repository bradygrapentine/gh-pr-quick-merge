/* MV3 service worker — relays APIs that aren't accessible from content scripts.
 * Currently: install-type lookup so content.js can gate dev-only affordances.
 * Also: daily token-rotation reminder (QM-043).
 *
 * Sentry crash reporting (QM-126/127): the sanitizer is always loaded so its
 * pure functions are unit-testable; the SDK itself only boots when a vendored
 * bundle exists at lib/vendor/sentry.min.js (added by `npm run vendor:sentry`
 * during build — see scripts/package.sh). Dev runs without the vendor file
 * are a no-op and do NOT silently transmit telemetry.
 */

try {
  // Optional DSN shim — written by scripts/package.sh when SENTRY_DSN is set
  // in the build env. Absent in dev builds, in which case sentry-init.js
  // sees no DSN and stays disabled.
  try {
    importScripts("lib/sentry-dsn.js");
  } catch (_) { /* dev build, no DSN */ }
  importScripts("lib/sentry-sanitize.js", "lib/sentry-init.js");
  try {
    // The Sentry CDN bundle (browser.sentry-cdn.com) references `window`,
    // which doesn't exist in an MV3 service worker. Alias before import
    // so the IIFE evaluates against `self` instead of throwing.
    if (typeof self.window === "undefined") self.window = self;
    importScripts("lib/vendor/sentry.min.js");
  } catch (_) {
    // No vendored bundle in this build — sanitizer is loaded for tests; SDK is a no-op.
  }
  if (self.QM_SENTRY_INIT && typeof self.QM_SENTRY_INIT.boot === "function") {
    Promise.resolve(self.QM_SENTRY_INIT.boot({
      release: chrome.runtime.getManifest && chrome.runtime.getManifest().version,
    })).catch((e) => console.warn("[QM] Sentry boot rejected:", (e && e.message) || e));
  }
} catch (e) {
  // Never let Sentry bootstrap failures take down the service worker.
  console.warn("[QM] Sentry bootstrap skipped:", (e && e.message) || e);
}

// QM-055 — merge-queue poller. Loaded as a classic worker script so it
// attaches to `self` (the SW global). The merge-queue lib + api lib also
// expose dual CJS / global, so importScripts is enough — no module setup.
try {
  // QM-301 — load the canonical GitHub api impl from its new home.
  // lib/api.js is still on disk as a no-op shim through QM-303.
  // QM-303 — host-tokens.js exposes the per-host storage shape that the
  // GitLab adapter (Phase 1) will read from.
  importScripts("lib/hosts/github/api.js", "lib/merge-queue.js", "lib/host-tokens.js");
} catch (e) {
  console.warn("[QM] merge-queue lib bootstrap skipped:", (e && e.message) || e);
}

const TOKEN_STALE_MS = 30 * 86400 * 1000; // 30 days
const TOKEN_CHECK_ALARM = "qm-token-check";
const MERGE_QUEUE_ALARM = "qm-merge-queue-poller";

// QM-303 — one-shot per-host token storage migration. Idempotent;
// runs on install, update, and SW startup so we never miss the case
// where a user upgrades while the SW is asleep.
async function _runHostTokensMigration() {
  try {
    if (self.QM_HOST_TOKENS && typeof self.QM_HOST_TOKENS.migrate === "function") {
      await self.QM_HOST_TOKENS.migrate(chrome.storage.local);
    }
  } catch (e) {
    console.warn("[QM] host-tokens migration failed:", (e && e.message) || e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(TOKEN_CHECK_ALARM, { periodInMinutes: 60 * 24 });
  chrome.alarms.create(MERGE_QUEUE_ALARM, { periodInMinutes: 0.5 });
  _runHostTokensMigration();
});

if (chrome.runtime.onStartup && chrome.runtime.onStartup.addListener) {
  chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create(MERGE_QUEUE_ALARM, { periodInMinutes: 0.5 });
    _runHostTokensMigration();
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TOKEN_CHECK_ALARM) {
    const data = await chrome.storage.local.get("tokenSavedAt");
    const savedAt = data && data.tokenSavedAt;
    if (!savedAt) {
      await chrome.storage.local.set({ tokenStale: false });
      return;
    }
    const stale = Date.now() - savedAt > TOKEN_STALE_MS;
    await chrome.storage.local.set({ tokenStale: stale });
    return;
  }

  if (alarm.name === MERGE_QUEUE_ALARM) {
    await pollMergeQueue();
    return;
  }
});

async function pollMergeQueue() {
  const queue = self.QM_MERGE_QUEUE;
  const api = self.QM_API;
  if (!queue || !api) return;

  const { token } = await chrome.storage.local.get("token");
  if (!token) return; // No auth → nothing to do; user will be prompted on next merge.

  const entries = (await queue.list(chrome.storage.local)).filter((e) => e.status === "watching");
  for (const entry of entries) {
    const key = queue.makeKey(entry);
    try {
      const pr = await api.apiGet(
        `/repos/${entry.owner}/${entry.repo}/pulls/${entry.pullNumber}`,
        { token },
      );
      if (!pr) continue;
      if (pr.state === "closed") {
        // Either someone else merged it or it got closed — stop watching.
        await queue.dequeue(key, chrome.storage.local);
        continue;
      }
      if (pr.mergeable !== true || pr.mergeable_state !== "clean") continue;

      const checks = await api.apiGet(
        `/repos/${entry.owner}/${entry.repo}/commits/${pr.head.sha}/check-runs`,
        { token },
      );
      const runs = (checks && Array.isArray(checks.check_runs)) ? checks.check_runs : [];
      if (runs.length > 0) {
        const allDone = runs.every((r) => r.status === "completed");
        const allGreen = runs.every((r) => r.conclusion === "success" || r.conclusion === "neutral" || r.conclusion === "skipped");
        if (!allDone || !allGreen) continue;
      }

      const sync = await chrome.storage.sync.get(["repoDefaults"]);
      const defaults = (sync && sync.repoDefaults && typeof sync.repoDefaults === "object") ? sync.repoDefaults : {};
      const method = defaults[`${entry.owner}/${entry.repo}`] || "squash";

      try {
        await api.apiPut(
          `/repos/${entry.owner}/${entry.repo}/pulls/${entry.pullNumber}/merge`,
          { merge_method: method, sha: pr.head.sha },
          { token },
        );
        await queue.updateStatus(key, "merged", chrome.storage.local);
      } catch (err) {
        // Most fail modes (status checks failed, conflict reintroduced) are
        // transient. Mark failed so the user can re-queue or take over.
        await queue.updateStatus(key, "failed", chrome.storage.local);
        console.warn(`[QM] merge-queue: ${key} merge failed: ${(err && err.message) || err}`);
      }
    } catch (err) {
      // Don't take the whole tick down for one bad entry.
      console.warn(`[QM] merge-queue: ${key} poll failed: ${(err && err.message) || err}`);
    }
  }
}

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local" && changes.token && changes.token.newValue) {
    await chrome.storage.local.set({ tokenSavedAt: Date.now(), tokenStale: false });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "qm:get-install-type") {
    chrome.management.getSelf((info) => {
      sendResponse({ installType: info?.installType ?? "unknown" });
    });
    return true; // keep channel open for async sendResponse
  }
});
