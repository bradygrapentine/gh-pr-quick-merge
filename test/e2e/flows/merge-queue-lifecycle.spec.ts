import { test, expect } from '../fixtures/base';
import { createFixtureRepo, teardownFixtureRepo, pollPrClosed, type FixtureRepo } from '../helpers/fixture-repo';

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Set E2E_GH_TOKEN to run merge-queue lifecycle';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

/**
 * Merge-queue lifecycle: enqueue a PR, wait for the background poller to
 * fire the merge once it's mergeable + checks-clean, assert the entry's
 * status flips watching → merged. Bounded to 90 s per the wave-plan spec.
 */
test.describe('merge-queue: end-to-end watching → merged', () => {
  let fixture: FixtureRepo;

  test.beforeAll(async () => {
    fixture = await createFixtureRepo({ prCount: 1 });
  });

  test.afterAll(async () => {
    if (fixture) await teardownFixtureRepo(fixture);
  });

  test('enqueueing flips status to "merged" within ~90 s', async ({ context, extensionId, authedPage }) => {
    test.setTimeout(120_000);
    const pr = fixture.prs[0];

    await authedPage.goto(`chrome-extension://${extensionId}/options.html`);
    await authedPage.evaluate(async (entry) => {
      await chrome.storage.local.set({
        mergeQueue: {
          [`${entry.owner}/${entry.repo}#${entry.number}`]: {
            owner: entry.owner,
            repo: entry.repo,
            pullNumber: entry.number,
            addedAt: Date.now(),
            status: 'watching',
          },
        },
      });
    }, { owner: fixture.owner, repo: fixture.repo, number: pr.number });

    const closed = await pollPrClosed(fixture, pr.number, 90_000);
    expect(closed).toBe(true);

    const queue = await authedPage.evaluate(() => chrome.storage.local.get('mergeQueue'));
    const entry = queue.mergeQueue[`${fixture.owner}/${fixture.repo}#${pr.number}`];
    expect(entry.status).toBe('merged');
  });
});
