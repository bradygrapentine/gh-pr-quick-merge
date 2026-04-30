import { test, expect } from '../fixtures/base';

/**
 * QM-410 visual baselines for the PR-page action bar.
 *
 * A real GitHub PR page requires E2E_GH_TOKEN, so we instead mount the
 * action bar against a controlled host page (the extension popup, which
 * already loads theme.css and lib/qm-pr-page-actions.js) and snapshot
 * each render mode. The popup is a stable in-extension surface so
 * baselines don't drift with GitHub's DOM.
 */
test.describe('visual: pr-page action bar', () => {
  async function mountFixture(page: any, extensionId: string) {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.evaluate(() => {
      document.body.innerHTML = '';
      // Re-import the module — popup.html doesn't ship it yet, so add it
      // dynamically. The script is bundled with the extension and
      // available via a relative path.
      const s = document.createElement('script');
      s.src = '/lib/qm-pr-page-actions.js';
      document.head.appendChild(s);
      return new Promise((res) => { s.onload = res; });
    });
  }

  test('idle — rebase shown', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mountFixture(page, extensionId);
    await page.evaluate(() => {
      const api = (window as any).QM_PR_PAGE_ACTIONS;
      api.ensurePrPageActionBar({
        state: { behind_by: 3, mergeable_state: 'behind' },
        viewer: { login: 'alice' },
        handlers: {},
      });
    });
    await expect(page.locator('#qm-pr-action-bar')).toBeVisible();
    await expect(page.locator('#qm-pr-action-bar')).toHaveScreenshot('pr-page-bar-idle.png');
    await page.close();
  });

  test('disabled fallback — write perm denied', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mountFixture(page, extensionId);
    await page.evaluate(() => {
      const api = (window as any).QM_PR_PAGE_ACTIONS;
      api.ensurePrPageActionBar({
        state: { behind_by: 3, mergeable_state: 'behind' },
        viewer: { login: 'alice' },
        writePermDenied: true,
        handlers: {},
      });
    });
    await expect(page.locator('#qm-pr-action-bar')).toHaveScreenshot('pr-page-bar-disabled.png');
    await page.close();
  });

  test('confirm modal open', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mountFixture(page, extensionId);
    await page.evaluate(() => {
      const api = (window as any).QM_PR_PAGE_ACTIONS;
      api.showRebaseConfirmModal();
    });
    await expect(page.locator('#qm-pr-action-modal')).toBeVisible();
    await expect(page.locator('#qm-pr-action-modal')).toHaveScreenshot('pr-page-modal.png');
    await page.close();
  });
});
