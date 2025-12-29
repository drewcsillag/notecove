import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts', // Only match .spec.ts files, not __tests__/*.test.ts
  timeout: 90000, // Increase to 90 seconds for Electron app with database initialization
  fullyParallel: true, // Run tests in parallel across files
  forbidOnly: !!process.env.CI,
  // Retry flaky tests - 2 retries in CI, 1 locally for stability tracking
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4, // Use 4 workers locally, 2 in CI for stability
  // Use multiple reporters: list for console output, stability for metrics
  reporter: [['list'], ['./e2e/utils/stability-reporter.ts']],
  use: {
    // Capture trace on first retry for debugging
    trace: 'on-first-retry',
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    // Capture video on retry for debugging flaky tests
    video: 'on-first-retry',
  },
  // Output directory for test artifacts
  outputDir: 'test-results',
  // Clear macOS saved application state before/after tests to prevent crash dialogs
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),
});
