import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000, // Increase to 90 seconds for Electron app with database initialization
  fullyParallel: true, // Run tests in parallel across files
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4, // Use 4 workers locally, 2 in CI for stability
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
