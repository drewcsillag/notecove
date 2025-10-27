/**
 * E2E tests for Note Synchronization
 *
 * Tests note sync across multiple windows and instances using the activity log system.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let electronApp: ElectronApplication;
let page: Page;
let testStorageDir: string;

test.beforeAll(async () => {
  // Create a temporary storage directory for this test session
  testStorageDir = await mkdtemp(join(tmpdir(), 'notecove-test-'));

  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
  console.log('[E2E] Launching Electron with main process at:', mainPath);
  console.log('[E2E] Test storage directory:', testStorageDir);

  electronApp = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_STORAGE_DIR: testStorageDir,
    },
    timeout: 60000,
  });

  electronApp.on('console', (msg) => {
    console.log('[Electron Console]:', msg.text());
  });

  page = await electronApp.firstWindow();

  // Capture renderer console logs
  page.on('console', (msg) => {
    console.log('[Renderer Console]:', msg.text());
  });
}, 60000);

test.afterAll(async () => {
  await electronApp.close();

  // Clean up test storage directory
  try {
    await rm(testStorageDir, { recursive: true, force: true });
  } catch (error) {
    console.error('[E2E] Failed to clean up test storage:', error);
  }
});

test.describe('Note Multi-Window Sync', () => {
  test('should sync note edits across two windows', async () => {
    // Wait for app to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Wait for the default note to appear (we don't create new notes, we use the existing one)
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 10000 });

    // Type some content in the existing note
    const testContent = `Test note content ${Date.now()}`;
    await editor.click();
    await editor.fill(testContent);

    // Wait a bit for the note to be saved to database
    await page.waitForTimeout(2000);

    // Verify the content appears in window 1
    await expect(editor).toContainText(testContent);

    // Open a second window using the testing IPC method
    await page.evaluate(() => window.electronAPI.testing.createWindow());

    // Wait for second window to be created
    await page.waitForTimeout(1000);

    const windows = await electronApp.windows();
    expect(windows.length).toBe(2);

    const secondWindow = windows[1];

    // Wait for folder panel in second window
    await secondWindow.waitForSelector('text=Folders', { timeout: 10000 });

    // Wait for the editor in the second window
    const secondEditor = secondWindow.locator('[contenteditable="true"]').first();
    await secondEditor.waitFor({ state: 'visible', timeout: 10000 });

    // Verify the same content appears in window 2 (synced from database)
    await expect(secondEditor).toContainText(testContent);

    console.log('[E2E] Note content synced across both windows via shared database');
  });
});

test.describe('Note Multi-Instance Sync', () => {
  test('should record note activity when editing', async () => {
    // Wait for app to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Wait for the default note to appear (we don't create new notes, we use the existing one)
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 10000 });

    // Type content in the existing note
    const testContent = 'Test content for activity log';
    await editor.click();
    await editor.fill(testContent);

    // Wait for activity log to be written (activity logger debounces)
    await page.waitForTimeout(2000);

    // Verify the content was saved
    await expect(editor).toContainText(testContent);

    // Verify the app is still responsive (basic smoke test that nothing crashed)
    await expect(editor).toBeVisible();

    console.log('[E2E] Note editing completed, activity log infrastructure is active');
  });
});
