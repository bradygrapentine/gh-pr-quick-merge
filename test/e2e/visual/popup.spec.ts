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

  test('loaded state — one pinned repo with open PRs (all clear)', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Seed real shape: sync.pinnedRepos as slug strings + local.token so
    // popup.js's loadAndRender doesn't short-circuit at 'Sign in via
    // Options'. Done from the options page so chrome.storage is reachable.
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      await chrome.storage.sync.set({ pinnedRepos: ['fixture/sandbox'] });
      await chrome.storage.local.set({ token: 'fixture-token' });
    });

    // Intercept the per-repo /pulls fetch popup.js makes and return two
    // open PRs. popup.js intentionally munges mergeable_state to null on
    // this list-endpoint fetch (the field isn't returned per PR), so the
    // popup's mergeableCount is always 0 — what gets exercised is the
    // 'all-clear' editorial state from refine pass 7 (vitals headline
    // flips to '✓ All clear across 1 repo' in success-green).
    await context.route('https://api.github.com/repos/fixture/sandbox/pulls*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { number: 1, title: 'feat: first', draft: false, updated_at: '2026-04-29T12:00:00Z' },
          { number: 2, title: 'feat: second', draft: false, updated_at: '2026-04-29T13:00:00Z' },
        ]),
      });
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    // Gate the snapshot on the all-clear class arriving — proves the fetch
    // intercept landed and renderSummary ran with the populated entries.
    await page.locator('.qm-popup-summary-stat.all-clear').waitFor({ timeout: 5000 });
    await expect(page).toHaveScreenshot('popup-loaded.png', { maxDiffPixels: 5 });
    await page.close();
  });
});
