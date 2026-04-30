import { test, expect } from '../fixtures/base';

/**
 * QM-513 visual baselines for the row badge strip + filter bar.
 *
 * A real github.com /pulls page requires E2E_GH_TOKEN, so we mount the
 * Track A + B + C DOM into the extension popup (which already loads
 * theme.css) and snapshot each render mode. Stable host = stable
 * baselines.
 */
test.describe('visual: list badges + filter bar', () => {
  async function mountFixture(page: any, extensionId: string) {
    await page.setViewportSize({ width: 800, height: 400 });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="repository-content"></div>
        <div class="js-issue-row" id="row" data-qm-injected="true">
          <span class="qm-container"></span>
          <span class="row-content">octocat/hello-world#42 — Refactor login flow</span>
        </div>
      `;
      const scripts = ['/lib/qm-size-classify.js', '/lib/qm-row-badges.js', '/lib/qm-filters.js', '/lib/qm-filter-bar.js'];
      return Promise.all(scripts.map((src) => new Promise((res) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        document.head.appendChild(s);
      })));
    });
  }

  test('row badges — all four (CI success / size S / 3 comments / ready)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mountFixture(page, extensionId);
    await page.evaluate(() => {
      const RB = (window as any).QM_ROW_BADGES;
      const row = document.getElementById('row')!;
      const container = row.querySelector('.qm-container') as HTMLElement;
      RB.applyRowBadges(container, {
        additions: 30, deletions: 17, comments: 3,
        mergeable_state: 'clean', behind_by: 0, draft: false,
      }, { owner: 'octocat', repo: 'hello-world', num: 42 });
      RB.applyCiState(container, { state: 'success', failingContexts: [] });
    });
    await expect(page.locator('#row')).toHaveScreenshot('list-row-all-badges.png');
    await page.close();
  });

  test('row badges — CI failing tooltip + L size + no ready', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mountFixture(page, extensionId);
    await page.evaluate(() => {
      const RB = (window as any).QM_ROW_BADGES;
      const row = document.getElementById('row')!;
      const container = row.querySelector('.qm-container') as HTMLElement;
      RB.applyRowBadges(container, {
        additions: 200, deletions: 150, comments: 8,
        mergeable_state: 'blocked', behind_by: 3, draft: false,
      }, { owner: 'octocat', repo: 'hello-world', num: 42 });
      RB.applyCiState(container, { state: 'failure', failingContexts: ['unit', 'e2e'] });
    });
    await expect(page.locator('#row')).toHaveScreenshot('list-row-blocked.png');
    await page.close();
  });

  test('filter bar — idle (all chips inactive)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mountFixture(page, extensionId);
    await page.evaluate(() => {
      const FB = (window as any).QM_FILTER_BAR;
      FB.ensureFilterBar({ filters: {}, onChange: () => {} });
    });
    await expect(page.locator('#qm-filter-bar')).toHaveScreenshot('filter-bar-idle.png');
    await page.close();
  });

  test('filter bar — Mine + Ready active', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mountFixture(page, extensionId);
    await page.evaluate(() => {
      const FB = (window as any).QM_FILTER_BAR;
      FB.ensureFilterBar({ filters: { mine: true, ready: true }, onChange: () => {} });
    });
    await expect(page.locator('#qm-filter-bar')).toHaveScreenshot('filter-bar-mine-ready.png');
    await page.close();
  });

  test('filter bar — Hide bots + Hide drafts active (exclusion variant)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await mountFixture(page, extensionId);
    await page.evaluate(() => {
      const FB = (window as any).QM_FILTER_BAR;
      FB.ensureFilterBar({ filters: { hideDependabot: true, hideDrafts: true }, onChange: () => {} });
    });
    await expect(page.locator('#qm-filter-bar')).toHaveScreenshot('filter-bar-noise-on.png');
    await page.close();
  });
});
