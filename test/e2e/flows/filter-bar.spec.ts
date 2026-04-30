import { test, expect } from '../fixtures/base';
import { createFixtureRepo, teardownFixtureRepo, type FixtureRepo } from '../helpers/fixture-repo';

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Set E2E_GH_TOKEN to run filter-bar';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

/**
 * QM-512 — quick-filter bar e2e.
 *
 * Creates a fixture repo with a couple of PRs, navigates to its
 * /pulls page, asserts the filter bar mounts, exercises a chip
 * toggle, and verifies the selection persists across a soft-nav.
 */
test.describe('Filter bar', () => {
  let fixture: FixtureRepo;

  test.beforeAll(async () => { fixture = await createFixtureRepo({ prCount: 2 }); });
  test.afterAll(async () => { if (fixture) await teardownFixtureRepo(fixture); });

  test('mounts on /pulls; chip toggle persists across nav', async ({ authedPage }) => {
    test.setTimeout(60_000);
    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`);

    const bar = authedPage.locator('#qm-filter-bar');
    await expect(bar).toBeVisible({ timeout: 10_000 });

    const mine = authedPage.locator('[data-qm-filter="mine"]');
    await expect(mine).toHaveAttribute('aria-pressed', 'false');
    await mine.click();
    await expect(mine).toHaveAttribute('aria-pressed', 'true');

    // Soft-nav to a different repo path and back; chip should stay
    // active because qm_filters is in chrome.storage.sync.
    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/issues`);
    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`);
    await expect(authedPage.locator('[data-qm-filter="mine"]')).toHaveAttribute('aria-pressed', 'true');
  });
});
