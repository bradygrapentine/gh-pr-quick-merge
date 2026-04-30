import { test, expect } from '../fixtures/base';
import { createFixtureRepo, teardownFixtureRepo, type FixtureRepo } from '../helpers/fixture-repo';

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Set E2E_GH_TOKEN to run pr-page-rebase';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

/**
 * QM-409 — PR-page action bar e2e.
 *
 * Creates a fixture PR whose head branch is intentionally behind main,
 * navigates to its dedicated PR page (not the list), and asserts the
 * always-visible action bar renders. Soft-nav between two PRs must
 * leave exactly one bar.
 */
test.describe('PR-page action bar', () => {
  let fixture: FixtureRepo;

  test.beforeAll(async () => {
    fixture = await createFixtureRepo({ prCount: 2 });
    const token = process.env.E2E_GH_TOKEN!;
    // Push a fresh commit to main so both PRs land "behind" — the bar's
    // gate is `behind_by > 0 || mergeable_state === 'behind'`.
    await fetch(
      `https://api.github.com/repos/${fixture.owner}/${fixture.repo}/contents/main-bump-${Date.now()}.md`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'main: bump for pr-page e2e',
          content: Buffer.from('bump\n').toString('base64'),
          branch: 'main',
        }),
      },
    );
  });

  test.afterAll(async () => {
    if (fixture) await teardownFixtureRepo(fixture);
  });

  test('action bar mounts on PR page; soft-nav keeps exactly one', async ({ authedPage }) => {
    test.setTimeout(60_000);
    const [pr1, pr2] = fixture.prs;

    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pull/${pr1.number}`);
    const bar = authedPage.locator('#qm-pr-action-bar');
    await expect(bar).toBeVisible({ timeout: 10_000 });
    await expect(bar.locator('[data-qm-action="rebase"]')).toBeVisible();

    // Soft-nav to the second PR; expect exactly one bar after.
    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pull/${pr2.number}`);
    await authedPage.waitForTimeout(2_000);
    const count = await authedPage.locator('#qm-pr-action-bar').count();
    expect(count).toBe(1);

    // Clicking opens the confirm modal; cancel keeps state intact.
    await authedPage.locator('[data-qm-action="rebase"]').click();
    await expect(authedPage.locator('#qm-pr-action-modal')).toBeVisible();
    await authedPage.locator('[data-qm-modal-action="cancel"]').click();
    await expect(authedPage.locator('#qm-pr-action-modal')).toHaveCount(0);
  });
});
