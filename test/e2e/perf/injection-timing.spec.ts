import { test, expect } from '../fixtures/base';
import { createFixtureRepo, teardownFixtureRepo, type FixtureRepo } from '../helpers/fixture-repo';

const PERF_BUDGET_SCALE = Number(process.env.PERF_BUDGET_SCALE ?? (process.env.CI ? '1.6' : '1.0'));
const BUDGET_MS = 50 * PERF_BUDGET_SCALE;

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Set E2E_GH_TOKEN to run perf specs';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

test.describe('perf: button injection p95', () => {
  let fixture: FixtureRepo;

  test.beforeAll(async () => {
    fixture = await createFixtureRepo({ prCount: 5 });
  });

  test.afterAll(async () => {
    if (fixture) await teardownFixtureRepo(fixture);
  });

  test(`p95 of qm:button-injected mark < ${BUDGET_MS}ms over 10 iterations`, async ({ authedPage }) => {
    const samples: number[] = [];

    for (let i = 0; i < 10; i++) {
      await authedPage.addInitScript(() => {
        const obs = new MutationObserver(() => {
          if (document.querySelector('[data-qm-button]')) {
            performance.mark('qm:button-injected');
            obs.disconnect();
          }
        });
        obs.observe(document.documentElement, { subtree: true, childList: true });
      });

      await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`, {
        waitUntil: 'domcontentloaded',
      });
      await authedPage.waitForFunction(() => performance.getEntriesByName('qm:button-injected').length > 0, undefined, {
        timeout: 5_000,
      });

      const sample = await authedPage.evaluate(() => {
        const mark = performance.getEntriesByName('qm:button-injected')[0] as PerformanceMark | undefined;
        const navStart = (performance.timing && performance.timing.navigationStart) || 0;
        if (!mark) return -1;
        return mark.startTime;
      });
      samples.push(sample);
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95) - 1] ?? samples[samples.length - 1];
    console.log(`injection-timing samples (ms): ${samples.map((n) => n.toFixed(1)).join(',')}, p95=${p95.toFixed(1)}`);
    expect(p95, `p95 = ${p95.toFixed(1)}ms exceeds ${BUDGET_MS.toFixed(1)}ms budget`).toBeLessThan(BUDGET_MS);
  });
});
