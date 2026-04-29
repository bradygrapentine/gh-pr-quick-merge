import { chromium } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Boots a Chromium with the unpacked extension loaded, harvests the
 * service-worker URL to derive `extensionId`, and exposes it via env.
 */
export default async function globalSetup() {
  const extensionRoot = path.resolve(__dirname, '../../..');

  const requiredFiles = ['manifest.json', 'content.js', 'background.js'];
  for (const f of requiredFiles) {
    if (!fs.existsSync(path.join(extensionRoot, f))) {
      throw new Error(
        `globalSetup: ${f} missing at ${extensionRoot}. Build/check the extension before running e2e.`,
      );
    }
  }

  const userDataDir = path.resolve(__dirname, '../../../.playwright-user-data');
  fs.rmSync(userDataDir, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: process.env.PWDEBUG ? false : true,
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  }
  const extensionId = serviceWorker.url().split('/')[2];
  if (!extensionId) {
    throw new Error('globalSetup: could not derive extensionId from service worker URL.');
  }

  process.env.EXTENSION_ID = extensionId;
  process.env.EXTENSION_ROOT = extensionRoot;
  process.env.PLAYWRIGHT_USER_DATA_DIR = userDataDir;

  await context.close();
}
