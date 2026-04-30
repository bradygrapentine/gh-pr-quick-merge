import { test, expect } from '../fixtures/base';
import { createFixtureRepo, teardownFixtureRepo, type FixtureRepo } from '../helpers/fixture-repo';

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Set E2E_GH_TOKEN to run bulk-close';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

test.describe('bulk close', () => {
  let fixture: FixtureRepo;

  test.beforeAll(async () => {
    fixture = await createFixtureRepo({ prCount: 3 });
  });

  test.afterAll(async () => {
    if (fixture) await teardownFixtureRepo(fixture);
  });

  test('closes selected PRs and renders per-row Closed pills', async ({ authedPage }) => {
    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`);

    const checkboxes = authedPage.locator('.qm-select');
    await expect(checkboxes.first()).toBeVisible({ timeout: 5_000 });

    const selectable = await checkboxes.evaluateAll((els) =>
      els.filter((e) => !(e as HTMLInputElement).disabled).length,
    );
    if (selectable < 2) test.skip(true, 'fixture PRs were not detected as ready in time');

    authedPage.on('dialog', (d) => d.accept());

    const all = await checkboxes.elementHandles();
    for (const cb of all.slice(0, 2)) await cb.click();

    await authedPage.locator('.qm-bulk-close').click();
    await authedPage.waitForTimeout(2_000);

    const closedPills = authedPage.locator('.qm-row-flash-pill', { hasText: /closed/i });
    await expect(closedPills.first()).toBeVisible({ timeout: 10_000 });

    // Verify via API that at least 2 fixture PRs ended up closed.
    const closedCount = await authedPage.evaluate(async ({ owner, repo, token }) => {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await res.json()).length;
    }, { owner: fixture.owner, repo: fixture.repo, token: process.env.E2E_GH_TOKEN! });
    expect(closedCount).toBeGreaterThanOrEqual(2);
  });
});
