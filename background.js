/* MV3 service worker — relays APIs that aren't accessible from content scripts.
 * Currently: install-type lookup so content.js can gate dev-only affordances.
 * Also: daily token-rotation reminder (QM-043).
 */

const TOKEN_STALE_MS = 30 * 86400 * 1000; // 30 days
const TOKEN_CHECK_ALARM = "qm-token-check";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(TOKEN_CHECK_ALARM, { periodInMinutes: 60 * 24 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== TOKEN_CHECK_ALARM) return;
  const data = await chrome.storage.local.get("tokenSavedAt");
  const savedAt = data && data.tokenSavedAt;
  if (!savedAt) {
    await chrome.storage.local.set({ tokenStale: false });
    return;
  }
  const stale = Date.now() - savedAt > TOKEN_STALE_MS;
  await chrome.storage.local.set({ tokenStale: stale });
});

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
