/**
 * Shared E2E Test Fixtures
 *
 * Provides custom test fixtures that handle common setup/teardown tasks.
 * Use these fixtures by importing from this file instead of @playwright/test.
 */

import { test as base, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { join, resolve } from 'path';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'fs';
import { tmpdir, homedir } from 'os';

/**
 * Clear macOS saved application state for Electron apps.
 * This prevents the "unexpectedly quit" dialog from appearing.
 */
export function clearMacOSSavedState(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const savedStateDir = join(homedir(), 'Library', 'Saved Application State');

  if (!existsSync(savedStateDir)) {
    return;
  }

  // Find ALL electron-related saved state directories
  const electronPatterns = [/electron/i, /notecove/i];

  try {
    const entries = readdirSync(savedStateDir);
    for (const entry of entries) {
      const isElectronRelated = electronPatterns.some((pattern) => pattern.test(entry));
      if (isElectronRelated && entry.endsWith('.savedState')) {
        const fullPath = join(savedStateDir, entry);
        try {
          rmSync(fullPath, { recursive: true, force: true });
        } catch {
          // Ignore errors
        }
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Launch Electron with macOS saved state cleared.
 * Use this helper instead of electron.launch() directly to prevent
 * the "unexpectedly quit" dialog.
 */
export async function launchElectronClean(
  options: Parameters<typeof electron.launch>[0]
): Promise<ReturnType<typeof electron.launch>> {
  // Clear saved state before launching
  clearMacOSSavedState();

  return electron.launch(options);
}

/**
 * Extended test fixtures with automatic Electron app management
 */
export interface TestFixtures {
  electronApp: ElectronApplication;
  page: Page;
  testUserDataDir: string;
}

/**
 * Custom test that provides electronApp, page, and testUserDataDir fixtures.
 * Automatically clears macOS saved state before launching to prevent dialogs.
 */
export const test = base.extend<TestFixtures>({
  // eslint-disable-next-line no-empty-pattern
  testUserDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'notecove-e2e-'));
    await use(dir);
    // Cleanup after test
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  },

  electronApp: async ({ testUserDataDir }, use) => {
    // Clear macOS saved state BEFORE launching Electron
    clearMacOSSavedState();

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    const app = await electron.launch({
      args: [mainPath, `--user-data-dir=${testUserDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_HEADLESS: '1', // Don't show windows during E2E tests
      },
      timeout: 60000,
    });

    await use(app);

    // Close app after test
    try {
      await Promise.race([
        app.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
      ]);
    } catch {
      // Ignore close errors
    }

    // Clear saved state again after closing (in case of crash)
    clearMacOSSavedState();
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { _electron as electron } from '@playwright/test';
