import { defineConfig } from '@playwright/test';
import * as path from 'node:path';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'test/e2e',
  testIgnore: ['**/__snapshots__/**'],

  globalSetup: path.resolve(__dirname, 'test/e2e/setup/global-setup.ts'),

  fullyParallel: false,
  workers: 1,

  reporter: isCI
    ? [['list'], ['json', { outputFile: 'playwright-report/results.json' }], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    headless: !!process.env.PWDEBUG ? false : true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'e2e',
      testMatch: /flows\/.*\.spec\.ts$/,
      use: {},
    },
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts$/,
      use: {},
    },
    {
      name: 'perf',
      testMatch: /perf\/.*\.spec\.ts$/,
      use: {},
    },
  ],

  retries: isCI ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixels: 5 },
  },
});
