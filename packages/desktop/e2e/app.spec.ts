/**
 * E2E tests for NoteCove Desktop App
 *
 * These tests launch the actual Electron application and test it end-to-end
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { join, resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  // Use absolute path to ensure correct resolution
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-'));
  console.log('[E2E] Launching Electron with main process at:', mainPath);
  console.log('[E2E] Using fresh userData directory:', testUserDataDir);

  // Launch Electron app with extended timeout
  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000, // Increase timeout to 60 seconds for database initialization
  });

  // Log console output from the app
  electronApp.on('console', (msg) => {
    console.log('[Electron Console]:', msg.text());
  });

  // Get the first window
  page = await electronApp.firstWindow();
}, 60000); // Also increase beforeEach timeout

test.afterEach(async () => {
  // Close with a shorter timeout to prevent hanging
  try {
    await Promise.race([
      electronApp.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
    ]);
  } catch (err) {
    console.error('[E2E] Error closing app:', err);
  }

  // Clean up the temporary user data directory
  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E] Cleaned up test userData directory:', testUserDataDir);
  } catch (err) {
    console.error('[E2E] Failed to clean up test userData directory:', err);
  }
});

test.describe('NoteCove Desktop App', () => {
  test('should launch and display the main window', async () => {
    // Wait for app to be ready
    await page.waitForSelector('body', { timeout: 10000 });
    // Verify window is visible
    expect(await page.isVisible('body')).toBe(true);
  });

  test('should display the folder panel', async () => {
    // Wait for folder panel content to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Check for folder panel title
    const title = await page.locator('text=Folders').first();
    await expect(title).toBeVisible();
  });

  test('should display the notes list panel', async () => {
    // Check for notes panel title
    const title = await page.locator('text=Notes').first();
    await expect(title).toBeVisible();
  });

  test('should display the editor panel', async () => {
    // Wait for React to render and TipTap to initialize
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });

    // Check for TipTap editor (look for ProseMirror container)
    const editor = await page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible();
  });

  test('should have Material-UI theme applied', async () => {
    // Check that MUI components are rendered
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Verify some MUI styling is applied (CssBaseline removes margins)
    const bodyMargin = await body.evaluate((el) => {
      return window.getComputedStyle(el).margin;
    });
    expect(bodyMargin).toBe('0px');
  });

  test('should have window title set', async () => {
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('window should have correct dimensions', async () => {
    // For Electron apps, we need to check the window bounds instead of viewport
    const bounds = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.getBounds();
    });

    expect(bounds).toBeTruthy();
    if (bounds) {
      // Default window size from main/index.ts is 1200x800
      expect(bounds.width).toBe(1200);
      expect(bounds.height).toBe(800);
    }
  });
});
