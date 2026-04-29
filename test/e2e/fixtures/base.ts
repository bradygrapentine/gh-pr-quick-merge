import { test as baseTest, chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  authedPage: Page;
};

export const test = baseTest.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const extensionRoot = process.env.EXTENSION_ROOT
      ?? path.resolve(__dirname, '../../..');
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qm-pw-'));

    const ctx = await chromium.launchPersistentContext(userDataDir, {
      headless: process.env.PWDEBUG ? false : true,
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionRoot}`,
        `--load-extension=${extensionRoot}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    await use(ctx);
    await ctx.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    const id = sw.url().split('/')[2];
    if (!id) throw new Error('extensionId fixture: could not derive id from SW url');
    await use(id);
  },

  authedPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    const token = process.env.E2E_GH_TOKEN;
    if (token) {
      await page.goto(`chrome-extension://${extensionId}/options.html`);
      await page.evaluate(async (t) => {
        await chrome.storage.local.set({ token: t });
      }, token);
    }
    await use(page);
    await page.close();
  },
});

export { expect };
