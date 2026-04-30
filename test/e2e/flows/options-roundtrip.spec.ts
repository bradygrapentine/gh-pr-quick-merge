import { test, expect } from '../fixtures/base';

/**
 * Options page round-trip — set every persisted preference and verify it
 * survives a reload by reading chrome.storage directly. Catches regressions
 * where a section silently stops persisting.
 */
test.describe('options page round-trip', () => {
  test('settings persist across reload', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
    });
    await page.reload();

    await page.locator('[data-pane-target="defaults"]').click();
    await page.locator('#updateBranchStrategy').selectOption('rebase');
    await page.locator('#autoRebaseThreshold').fill('3');
    await page.locator('#autoRebaseThreshold').dispatchEvent('change');
    await page.locator('[data-pane-target="stale"]').click();
    await page.locator('#staleDaysInput').fill('21');
    await page.locator('#staleDaysInput').dispatchEvent('change');
    await page.locator('[data-pane-target="sync"]').click();
    await page.locator('#listModeEnabled').check();

    await page.reload();

    const sync = await page.evaluate(() => chrome.storage.sync.get(null));
    expect(sync.updateBranchStrategy).toBe('rebase');
    expect(sync.autoRebaseThreshold).toBe(3);
    expect(sync.qm_stale_days).toBe(21);
    expect(sync.listModeEnabled).toBe(true);

    await page.locator('[data-pane-target="defaults"]').click();
    await expect(page.locator('#updateBranchStrategy')).toHaveValue('rebase');
    await expect(page.locator('#autoRebaseThreshold')).toHaveValue('3');
    await page.locator('[data-pane-target="stale"]').click();
    await expect(page.locator('#staleDaysInput')).toHaveValue('21');
    await page.locator('[data-pane-target="sync"]').click();
    await expect(page.locator('#listModeEnabled')).toBeChecked();

    await page.close();
  });

  test('per-repo stale override saves and lists', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.sync.clear();
    });
    await page.reload();

    await page.locator('[data-pane-target="stale"]').click();
    await page.locator('#repoStaleRepo').fill('octocat/hello-world');
    await page.locator('#repoStaleDays').fill('7');
    await page.locator('#repoStaleAdd').click();

    await expect(page.locator('#repoStaleList')).toContainText('octocat/hello-world');
    await expect(page.locator('#repoStaleList')).toContainText('7 days');

    const sync = await page.evaluate(() => chrome.storage.sync.get('qm_repo_stale_thresholds'));
    expect(sync.qm_repo_stale_thresholds).toEqual({ 'octocat/hello-world': 7 });

    await page.close();
  });

  test('template editor saves and removes', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.sync.clear();
    });
    await page.reload();

    await page.locator('[data-pane-target="templates"]').click();
    await page.locator('#templateName').fill('release');
    await page.locator('#templateBody').fill('Release {title}\n\n{body}');
    await page.locator('#templateSave').click();

    await expect(page.locator('#templatesList')).toContainText('release');

    const sync = await page.evaluate(() => chrome.storage.sync.get('qm_templates'));
    expect(sync.qm_templates).toMatchObject({ release: expect.stringContaining('Release {title}') });

    await page.close();
  });
});
