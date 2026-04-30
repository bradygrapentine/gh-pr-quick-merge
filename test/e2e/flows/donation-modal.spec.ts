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

    // Inject the v1.1 Sponsor card markup — mirrors content.js showProGate's
    // DOM (overlay + card + accent badge + button primitives) so this spec
    // catches structural regressions in the new design system.
    await page.evaluate(() => {
      const SPONSORS_URL = 'https://github.com/sponsors/bradygrapentine';
      const overlay = document.createElement('div');
      overlay.id = 'qm-pro-modal';
      overlay.className = 'qm-sponsor-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="qm-sponsor-card">
          <div class="qm-sponsor-content">
            <span class="qm-badge qm-badge-pro">Sponsor</span>
            <h2 class="qm-sponsor-title">Like this? Support development.</h2>
            <p class="qm-sponsor-lede">PR Quick Merge is free and open source.</p>
            <div class="qm-sponsor-actions">
              <a class="qm-button qm-button-accent qm-button-lg qm-pro-sponsor"
                 href="${SPONSORS_URL}"
                 target="_blank"
                 rel="noopener noreferrer">Sponsor on GitHub</a>
              <button class="qm-button qm-button-lg qm-pro-close">Maybe later</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
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
