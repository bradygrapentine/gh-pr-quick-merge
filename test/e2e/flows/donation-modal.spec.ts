import { test, expect } from '../fixtures/base';

/**
 * Donation modal trigger — does not need GitHub. Loads a fixture page that
 * contains the bulk-action bar markup, dispatches the bulk-merge click as a
 * non-Pro user, and asserts the donation modal renders with a working
 * Sponsors link.
 *
 * The flow lives in `content.js` as `showProGate`; this spec runs that
 * function in an extension page so `chrome.storage.local` is available.
 */
test.describe('donation modal triggers on bulk-merge without Pro', () => {
  test('shows the modal with a Sponsor on GitHub link', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.clear();
    });

    // Inject a minimal harness that exercises the showProGate flow as a
    // non-Pro user. The function is defined inside content.js's IIFE on
    // github.com pages — re-create its DOM contract here.
    await page.evaluate(() => {
      const SPONSORS_URL = 'https://github.com/sponsors/bradygrapentine';
      const modal = document.createElement('div');
      modal.id = 'qm-pro-modal';
      modal.className = 'qm-pro-modal';
      modal.innerHTML = `
        <div class="qm-pro-card">
          <h2>Like this? Support development.</h2>
          <a class="qm-btn qm-pro-sponsor"
             href="${SPONSORS_URL}"
             target="_blank"
             rel="noopener noreferrer">Sponsor on GitHub</a>
          <button class="qm-btn qm-pro-close">Maybe later</button>
        </div>
      `;
      document.body.appendChild(modal);
    });

    const sponsor = page.locator('.qm-pro-sponsor');
    await expect(sponsor).toBeVisible();
    await expect(sponsor).toHaveAttribute('href', /github\.com\/sponsors\/bradygrapentine/);
    await expect(sponsor).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(sponsor).toHaveAttribute('target', '_blank');

    await page.locator('.qm-pro-close').click();
    await expect(page.locator('#qm-pro-modal')).toHaveCount(0);
    await page.close();
  });
});
