import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{js,ts}'],
    exclude: ['test/e2e/**', 'node_modules/**', 'web-ext-artifacts/**', '.playwright-user-data/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['lib/**/*.js', 'auth.js'],
      // sentry-init.js is a wiring stub that only runs in a real SW; vendor
      // is third-party. test-utils.js is consumed by tests, not shipped.
      exclude: ['lib/vendor/**', 'lib/sentry-init.js', 'lib/test-utils.js'],
      reportsDirectory: 'coverage',
      // Targets: lines/functions ≥ 95% per v1.0 quality gate. Branch coverage
      // bar is intentionally lower because many lib branches are
      // defensive-checks (network errors, missing globals) that aren't worth
      // the test surface to enumerate exhaustively.
      thresholds: {
        lines: 95,
        functions: 90,
        statements: 90,
        branches: 70,
      },
    },
  },
});
