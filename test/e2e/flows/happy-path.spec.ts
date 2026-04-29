import { test, expect } from '../fixtures/base';
import { createFixtureRepo, teardownFixtureRepo, pollPrClosed, type FixtureRepo } from '../helpers/fixture-repo';

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Set E2E_GH_TOKEN to run this spec';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

test.describe('happy-path: single PR squash from list view', () => {
  let fixture: FixtureRepo;

  test.beforeAll(async () => {
    fixture = await createFixtureRepo({ prCount: 1 });
  });

  test.afterAll(async () => {
    if (fixture) await teardownFixtureRepo(fixture);
  });

  test('Quick Merge button appears within 2s and squash closes the PR', async ({ authedPage }) => {
    const pr = fixture.prs[0];

    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`);

    const squashButton = authedPage.locator('[data-qm-button="squash"]').first();
    await expect(squashButton).toBeVisible({ timeout: 2_000 });

    authedPage.on('dialog', (d) => d.accept());
    await squashButton.click();

    const closed = await pollPrClosed(fixture, pr.number, 15_000);
    expect(closed).toBe(true);

    const toast = authedPage.locator('[data-qm-toast]').filter({ hasText: /merged|success/i });
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });
  });
});
