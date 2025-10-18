import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Use separate storage state for each test to avoid localStorage conflicts
    storageState: undefined,
    // Add some default timeouts
    actionTimeout: 10000,
    navigationTimeout: 10000,
    // Enable code coverage collection
    ...(process.env.COVERAGE && {
      contextOptions: {
        // Collect coverage for both web and Electron contexts
        recordVideo: undefined,
      },
    }),
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'electron',
      testDir: './tests/e2e-electron',
      // Electron tests don't need a web server
      use: {
        // Electron-specific settings
        viewport: null, // Electron manages its own window
      },
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    // Only start web server for chromium tests, not electron
    timeout: 120 * 1000,
  },
});