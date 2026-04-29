import { test, expect } from '../fixtures/base';

test.describe('visual: options page', () => {
  test('default — no token entered', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.clear();
    });
    await page.reload();
    await expect(page).toHaveScreenshot('options-default.png', { maxDiffPixels: 5 });
    await page.close();
  });

  test('with token entered', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.set({ token: 'ghp_fixture_token_for_visual_snapshot' });
    });
    await page.reload();
    await expect(page).toHaveScreenshot('options-with-token.png', { maxDiffPixels: 5 });
    await page.close();
  });

  test('with one pinned repo', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        token: 'ghp_fixture_token_for_visual_snapshot',
        pinnedRepos: [{ owner: 'fixture', repo: 'sandbox' }],
      });
    });
    await page.reload();
    await expect(page).toHaveScreenshot('options-with-pinned-repo.png', { maxDiffPixels: 5 });
    await page.close();
  });
});
