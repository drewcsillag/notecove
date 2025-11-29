/**
 * E2E tests for window titlebar
 *
 * Tests that the window title correctly displays [DEV] prefix in dev mode
 * and profile name when selected.
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
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-titlebar-'));
  console.log('[E2E] Using fresh userData directory:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await electronApp.firstWindow();
}, 60000);

test.afterEach(async () => {
  try {
    await Promise.race([
      electronApp.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
    ]);
  } catch (err) {
    console.error('[E2E] Error closing app:', err);
  }

  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
  } catch (err) {
    console.error('[E2E] Failed to clean up test userData directory:', err);
  }
});

test.describe('Window Titlebar', () => {
  test('should display [DEV] prefix in dev build', async () => {
    // Wait for app to be ready
    await page.waitForSelector('.ProseMirror', { timeout: 15000 });

    // Get the document title from the renderer
    const documentTitle = await page.title();

    // In dev/test mode, title should start with [DEV]
    expect(documentTitle).toMatch(/^\[DEV\] NoteCove/);
  });

  test('should include NoteCove in title', async () => {
    await page.waitForSelector('.ProseMirror', { timeout: 15000 });

    const documentTitle = await page.title();

    expect(documentTitle).toContain('NoteCove');
  });
});
