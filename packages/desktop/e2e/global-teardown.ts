/**
 * Global Teardown for E2E Tests
 *
 * Runs once after all tests complete to clean up the test environment.
 * This ensures any crash state created during tests is cleared before
 * the next test run.
 */

import { rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

/**
 * Clear macOS Saved Application State for Electron
 *
 * This runs after all tests to ensure any crash state is cleaned up
 * for the next test run.
 */
function clearMacOSSavedState(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const savedStateDir = join(homedir(), 'Library', 'Saved Application State');

  if (!existsSync(savedStateDir)) {
    return;
  }

  // Find ALL electron-related saved state directories dynamically
  const electronPatterns = [/electron/i, /notecove/i];

  try {
    const entries = readdirSync(savedStateDir);
    for (const entry of entries) {
      const isElectronRelated = electronPatterns.some((pattern) => pattern.test(entry));
      if (isElectronRelated && entry.endsWith('.savedState')) {
        const fullPath = join(savedStateDir, entry);
        try {
          rmSync(fullPath, { recursive: true, force: true });
          console.log(`[Global Teardown] Cleared saved application state: ${fullPath}`);
        } catch (err) {
          console.warn(`[Global Teardown] Failed to clear saved state: ${fullPath}`, err);
        }
      }
    }
  } catch (err) {
    console.warn('[Global Teardown] Failed to read saved state directory:', err);
  }
}

/**
 * Re-enable window restoration for Electron apps after tests.
 * This removes the NSQuitAlwaysKeepsWindows setting we added in setup.
 */
function restoreWindowRestoration(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  // Bundle identifiers that we modified in setup
  const bundleIds = ['Electron', 'com.github.Electron', 'com.electron.notecove'];

  for (const bundleId of bundleIds) {
    try {
      // Delete the setting to restore default behavior
      execSync(`defaults delete ${bundleId} NSQuitAlwaysKeepsWindows`, {
        stdio: 'ignore',
      });
      console.log(`[Global Teardown] Restored window restoration for ${bundleId}`);
    } catch {
      // Ignore errors - the key might not exist
    }
  }
}

/**
 * Global teardown function called by Playwright after all tests
 */
export default async function globalTeardown(): Promise<void> {
  console.log('[Global Teardown] Cleaning up test environment...');

  // Clear macOS saved application state
  clearMacOSSavedState();

  // Restore window restoration settings (optional - removes our test-time override)
  // Comment this out if you want the setting to persist for debugging
  restoreWindowRestoration();

  console.log('[Global Teardown] Done');
}
