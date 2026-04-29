/* MV3 service worker — relays APIs that aren't accessible from content scripts.
 * Currently: install-type lookup so content.js can gate dev-only affordances.
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "qm:get-install-type") {
    chrome.management.getSelf((info) => {
      sendResponse({ installType: info?.installType ?? "unknown" });
    });
    return true; // keep channel open for async sendResponse
  }
});
