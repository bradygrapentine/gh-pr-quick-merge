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

  test('loaded state — one pinned repo with two mergeable PRs', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        pinnedRepos: [{ owner: 'fixture', repo: 'sandbox' }],
        prsByRepo: {
          'fixture/sandbox': [
            { number: 1, title: 'fixture/pr-1', mergeable: true, state: 'open' },
            { number: 2, title: 'fixture/pr-2', mergeable: true, state: 'open' },
          ],
        },
      });
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page).toHaveScreenshot('popup-loaded.png', { maxDiffPixels: 5 });
    await page.close();
  });
});
