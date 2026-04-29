import { test, expect } from '../fixtures/base';
import { createFixtureRepo, teardownFixtureRepo, type FixtureRepo } from '../helpers/fixture-repo';

const skipReason = process.env.E2E_GH_TOKEN ? '' : 'Set E2E_GH_TOKEN to run perf specs';
test.skip(!process.env.E2E_GH_TOKEN, skipReason);

test.describe('perf: mutation observer + heap', () => {
  let fixture: FixtureRepo;

  test.beforeAll(async () => {
    fixture = await createFixtureRepo({ prCount: 5 });
  });

  test.afterAll(async () => {
    if (fixture) await teardownFixtureRepo(fixture);
  });

  test('observer callback count <= 200 over 3-page navigation', async ({ authedPage }) => {
    await authedPage.addInitScript(() => {
      const Original = window.MutationObserver;
      let counter = 0;
      class Counted extends Original {
        constructor(cb: MutationCallback) {
          super((records, obs) => {
            counter++;
            cb(records, obs);
          });
        }
      }
      (window as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver = Counted as unknown as typeof MutationObserver;
      (window as unknown as { __qmObserverCount: () => number }).__qmObserverCount = () => counter;
    });

    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`);
    await authedPage.waitForLoadState('networkidle');
    if (fixture.prs[0]) {
      await authedPage.goto(fixture.prs[0].url);
      await authedPage.waitForLoadState('networkidle');
    }
    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`);
    await authedPage.waitForLoadState('networkidle');

    const total = await authedPage.evaluate(() => (window as unknown as { __qmObserverCount: () => number }).__qmObserverCount());
    console.log(`mutation-observer total callbacks: ${total}`);
    expect(total).toBeLessThanOrEqual(200);
  });

  test('heap delta < 15MB after extension active vs cold baseline', async ({ context, extensionId, authedPage }) => {
    const session = await context.newCDPSession(authedPage);

    const cold = await context.newPage();
    await cold.goto('about:blank');
    const coldSession = await context.newCDPSession(cold);
    await coldSession.send('HeapProfiler.enable');
    const coldMetrics = await cold.evaluate(() => ({ used: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0 }));
    await cold.close();

    await authedPage.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls`);
    await authedPage.waitForLoadState('networkidle');
    await session.send('HeapProfiler.enable');
    await authedPage.evaluate(() => (window as unknown as { gc?: () => void }).gc?.());
    const hotMetrics = await authedPage.evaluate(() => ({ used: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0 }));

    const deltaMb = (hotMetrics.used - coldMetrics.used) / (1024 * 1024);
    console.log(`heap delta: ${deltaMb.toFixed(2)} MB`);
    expect(deltaMb).toBeLessThan(15);
  });
});
