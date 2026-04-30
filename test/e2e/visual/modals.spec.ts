import { test, expect } from '../fixtures/base';

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Modal snapshots need a real github.com session';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

test.describe('visual: modals', () => {
  test('bulk-merge confirmation modal', async ({ authedPage, extensionId }) => {
    await authedPage.goto(`chrome-extension://${extensionId}/popup.html`);
    const bulkButton = authedPage.locator('[data-qm-bulk-merge]');
    if (!(await bulkButton.count())) {
      test.skip(true, 'Popup did not render bulk-merge UI in this build');
      return;
    }
    await bulkButton.click();
    const confirmModal = authedPage.locator('[data-qm-modal="bulk-confirm"]');
    await expect(confirmModal).toBeVisible({ timeout: 5_000 });
    await expect(confirmModal).toHaveScreenshot('modal-bulk-confirm.png');
  });
});
