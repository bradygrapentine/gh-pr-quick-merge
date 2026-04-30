import { test, expect } from '../fixtures/base';

/**
 * Popup manage-mode — covers QM-041 and QM-042 paths without hitting GitHub.
 * Pinned-repo storage is mutated; popup state is read directly from storage
 * because /pulls fetches without a token short-circuit to the empty path.
 */
test.describe('popup manage mode', () => {
  test('add and remove a pinned repo', async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/options.html`);
    await popup.evaluate(async () => {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
    });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    // No token — manage button should still be reachable.
    await popup.locator('#manageBtn').click();
    await expect(popup.locator('#manageBox')).toBeVisible();

    await popup.locator('#manageRepoInput').fill('octocat/hello-world');
    await popup.locator('#manageAddBtn').click();
    await expect(popup.locator('#manageStatus')).toContainText('Added');

    const after = await popup.evaluate(() => chrome.storage.sync.get('pinnedRepos'));
    expect(after.pinnedRepos).toEqual(['octocat/hello-world']);

    // Toggle manage off then on; row should still be there with a remove button.
    await popup.locator('#manageBtn').click();
    await popup.locator('#manageBtn').click();

    // Remove via the per-row button.
    await popup.locator('.qm-popup-row-remove').first().click();
    await expect(popup.locator('#manageStatus')).toContainText('Removed');

    const cleared = await popup.evaluate(() => chrome.storage.sync.get('pinnedRepos'));
    expect(cleared.pinnedRepos).toEqual([]);

    await popup.close();
  });

  test('rejects malformed slug input', async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/options.html`);
    await popup.evaluate(async () => {
      await chrome.storage.sync.clear();
    });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator('#manageBtn').click();
    await popup.locator('#manageRepoInput').fill('not-a-valid-slug');
    await popup.locator('#manageAddBtn').click();
    await expect(popup.locator('#manageStatus')).toContainText('owner/repo');
    await popup.close();
  });

  test('token-stale banner appears when tokenStale flag is set', async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/options.html`);
    await popup.evaluate(async () => {
      await chrome.storage.local.set({ tokenStale: true });
    });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator('#staleBanner')).toBeVisible();
    await popup.close();
  });
});
