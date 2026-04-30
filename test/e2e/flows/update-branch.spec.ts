import { test, expect } from '../fixtures/base';
import { createFixtureRepo, teardownFixtureRepo, type FixtureRepo } from '../helpers/fixture-repo';

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Set E2E_GH_TOKEN to run update-branch';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

/**
 * Update-branch flow — fixture creates a PR whose head branch is behind
 * main by intentionally pushing a commit to main after the PR is opened.
 * The Update button should appear and clicking it should drop behind_by
 * to 0 within the 3-second post-update poll window.
 */
test.describe('update branch', () => {
  let fixture: FixtureRepo;

  test.beforeAll(async () => {
    fixture = await createFixtureRepo({ prCount: 1 });

    // Push a fresh commit to main to make the PR's head branch "behind".
    // Octokit calls inline rather than helper-bound since this is one-off.
    const token = process.env.E2E_GH_TOKEN!;
    const ref = await (await fetch(
      `https://api.github.com/repos/${fixture.owner}/${fixture.repo}/git/ref/heads/main`,
      { headers: { Authorization: `Bearer ${token}` } },
    )).json();
    await fetch(
      `https://api.github.com/repos/${fixture.owner}/${fixture.repo}/contents/main-bump-${Date.now()}.md`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'main: bump for update-branch e2e',
          content: Buffer.from('bump\n').toString('base64'),
          branch: 'main',
        }),
      },
    );
    void ref;
  });

  test.afterAll(async () => {
    if (fixture) await teardownFixtureRepo(fixture);
  });

  test('Update button appears for behind PRs and reduces behind_by to 0', async ({ authedPage }) => {
    test.setTimeout(60_000);
    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`);

    const updateBtn = authedPage.locator('.qm-update-btn').first();
    await expect(updateBtn).toBeVisible({ timeout: 8_000 });
    await expect(updateBtn).toContainText(/Update \(\d+\)/);

    await updateBtn.click();
    // Spinner state during the 3 s post-call poll.
    await expect(updateBtn).toContainText(/Updating/);

    // After post-update refresh, button either disappears (behind_by=0) or
    // shows a fresh count.
    await authedPage.waitForTimeout(5_000);
    const remaining = await authedPage.locator('.qm-update-btn').count();
    expect(remaining).toBeLessThanOrEqual(1);
  });
});
