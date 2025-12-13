/**
 * E2E tests for Window State Restoration
 *
 * Tests that window positions, sizes, and states are preserved across app restarts.
 *
 * @see plans/retain-note-state/PLAN.md
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { join, resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;
const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

/**
 * Launch the app and wait for it to be ready
 */
async function launchApp(extraArgs: string[] = []): Promise<void> {
  console.log('[E2E] Launching Electron with main process at:', mainPath);
  console.log('[E2E] Using userData directory:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`, ...extraArgs],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  electronApp.on('console', (msg) => {
    console.log('[Electron Console]:', msg.text());
  });

  page = await electronApp.firstWindow();
  // Wait for the app to be fully loaded
  await page.waitForSelector('body', { timeout: 10000 });
}

/**
 * Close the app gracefully, triggering will-quit to save state
 */
async function closeApp(): Promise<void> {
  try {
    // On macOS, closing windows doesn't trigger will-quit - we need to explicitly quit
    // This ensures the shutdown sequence runs and saves window state
    await electronApp.evaluate(async ({ app }) => {
      app.quit();
    });

    // Wait for the app to fully close
    await Promise.race([
      electronApp.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 10000)),
    ]);
  } catch (err) {
    console.error('[E2E] Error closing app:', err);
  }
}

test.describe('Window State Restoration', () => {
  test.beforeEach(async () => {
    // Create a unique temporary directory for this test's userData
    testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-window-state-'));
    console.log('[E2E] Created fresh userData directory:', testUserDataDir);
  });

  test.afterEach(async () => {
    // Close any open apps
    if (electronApp) {
      await closeApp();
    }

    // Clean up the temporary user data directory
    try {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log('[E2E] Cleaned up test userData directory:', testUserDataDir);
    } catch (err) {
      console.error('[E2E] Failed to clean up test userData directory:', err);
    }
  });

  test('should persist window bounds across restarts', async () => {
    // First launch - move and resize window
    await launchApp();

    // Get initial bounds
    const initialBounds = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.getBounds();
    });
    expect(initialBounds).toBeTruthy();
    console.log('[E2E] Initial bounds:', initialBounds);

    // Move and resize the window
    const newBounds = { x: 150, y: 150, width: 1000, height: 700 };
    await electronApp.evaluate(async ({ BrowserWindow }, bounds) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.setBounds(bounds as Electron.Rectangle);
      }
    }, newBounds);

    // Wait for debounce to settle
    await page.waitForTimeout(1000);

    // Close the app (should trigger state save)
    await closeApp();

    // Relaunch the app
    await launchApp();

    // Check that bounds were restored
    const restoredBounds = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.getBounds();
    });

    console.log('[E2E] Restored bounds:', restoredBounds);
    expect(restoredBounds).toBeTruthy();
    if (restoredBounds) {
      expect(restoredBounds.x).toBe(newBounds.x);
      expect(restoredBounds.y).toBe(newBounds.y);
      expect(restoredBounds.width).toBe(newBounds.width);
      expect(restoredBounds.height).toBe(newBounds.height);
    }
  });

  test('should skip restoration with --fresh flag', async () => {
    // First launch - move window to custom position
    await launchApp();

    // Move the window to a custom position
    const customBounds = { x: 200, y: 200, width: 900, height: 600 };
    await electronApp.evaluate(async ({ BrowserWindow }, bounds) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.setBounds(bounds as Electron.Rectangle);
      }
    }, customBounds);

    // Wait for debounce
    await page.waitForTimeout(1000);

    // Close the app
    await closeApp();

    // Wait for app to fully shut down and cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Relaunch with --fresh flag
    await launchApp(['--fresh']);

    // Check that bounds were NOT restored (should be default)
    const bounds = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.getBounds();
    });

    console.log('[E2E] Fresh start bounds:', bounds);
    expect(bounds).toBeTruthy();
    if (bounds) {
      // Should be default size (1200x800) not the custom size we set
      expect(bounds.width).toBe(1200);
      expect(bounds.height).toBe(800);
    }
  });

  test('should restore maximized state', async () => {
    // First launch - maximize window
    await launchApp();

    // Maximize the window
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.maximize();
      }
    });

    // Wait for state to be captured
    await page.waitForTimeout(500);

    // Verify it's maximized
    const isMaximizedBefore = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.isMaximized();
    });
    expect(isMaximizedBefore).toBe(true);

    // Close the app
    await closeApp();

    // Relaunch the app
    await launchApp();

    // Check that maximized state was restored
    const isMaximizedAfter = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.isMaximized();
    });

    console.log('[E2E] Restored maximized state:', isMaximizedAfter);
    expect(isMaximizedAfter).toBe(true);
  });

  test('should quit app on first app.quit() call (macOS quit bug fix)', async () => {
    // This test verifies the fix for the macOS quit bug where:
    // - First Cmd+Q (app.quit()) closes the window but doesn't quit the app
    // - Second Cmd+Q actually quits
    // The fix ensures the app quits on the first app.quit() call.

    await launchApp();

    // Track if the process exits
    const electronProcess = electronApp.process();
    let processExited = false;

    electronProcess.on('exit', () => {
      processExited = true;
      console.log('[E2E] Electron process exited');
    });

    console.log('[E2E] Calling app.quit()...');

    // Call app.quit() - this should cause the app to fully exit
    await electronApp.evaluate(async ({ app }) => {
      app.quit();
    });

    // Wait up to 10 seconds for the process to exit
    // With the bug, the process won't exit (test fails)
    // With the fix, the process exits promptly (test passes)
    const maxWaitMs = 10000;
    const checkIntervalMs = 100;
    let waitedMs = 0;

    while (!processExited && waitedMs < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
      waitedMs += checkIntervalMs;
    }

    console.log(`[E2E] Process exited: ${processExited} (waited ${waitedMs}ms)`);

    // The test passes if the process exited, fails if it timed out
    expect(processExited).toBe(true);
  });
});
