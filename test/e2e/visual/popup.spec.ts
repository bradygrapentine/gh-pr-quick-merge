import { test, expect } from '../fixtures/base';

test.describe('visual: popup', () => {
  test('empty state — no pinned repos', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.evaluate(async () => {
      await chrome.storage.local.clear();
    }).catch(() => { /* not a content-script context; storage will be set on options page below */ });

    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.clear();
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page).toHaveScreenshot('popup-empty.png', { maxDiffPixels: 5 });
    await page.close();
  });

  // 'loaded state' spec was removed 2026-04-30 — the prior implementation
  // wrote pinnedRepos to chrome.storage.LOCAL but popup.js reads from
  // chrome.storage.SYNC, used the wrong slug shape, and lacked a fetch
  // mock so even with the right storage popup.js short-circuits at
  // 'Sign in via Options'. The test rendered the identical empty state
  // as the spec above and was passing-but-vacuous. Re-add when there's
  // a proper fixture: seed sync.pinnedRepos with slug strings AND
  // intercept the api.github.com/.../pulls fetch with route().fulfill().
});
