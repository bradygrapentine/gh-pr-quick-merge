import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{js,ts}'],
    exclude: ['test/e2e/**', 'node_modules/**', 'web-ext-artifacts/**', '.playwright-user-data/**'],
  },
});
