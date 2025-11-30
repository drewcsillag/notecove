/**
 * E2E tests for new note editor focus behavior
 *
 * When a new note is created, the editor should automatically be focused
 * so the user can immediately start typing.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve, join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.describe('New Note Focus', () => {
  test.beforeAll(async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Create a unique temporary directory for this test's userData
    testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-'));
    console.log('[New Note Focus E2E] Launching Electron with main process at:', mainPath);
    console.log('[New Note Focus E2E] Using fresh userData directory:', testUserDataDir);

    electronApp = await electron.launch({
      args: [mainPath, `--user-data-dir=${testUserDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
      timeout: 60000,
    });

    // Get the first window
    page = await electronApp.firstWindow();

    // Listen to console messages
    page.on('console', (msg) => {
      console.log('[Page]:', msg.text());
    });

    await page.waitForSelector('body', { timeout: 10000 });
    console.log('[New Note Focus E2E] Window loaded');

    // Wait for app to be ready
    await page.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    console.log('[New Note Focus E2E] Closing Electron app');
    await electronApp.close();

    // Clean up the temporary user data directory
    try {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log('[New Note Focus E2E] Cleaned up test userData directory:', testUserDataDir);
    } catch (err) {
      console.error('[New Note Focus E2E] Failed to clean up test userData directory:', err);
    }
  });

  test('should focus editor when creating new note via button', async () => {
    console.log('[Test] Starting new note focus test (button)');

    // Wait for the app to be fully loaded
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });

    // Click the create note button
    const createButton = page.getByTitle('Create note');
    await createButton.click();

    // Wait for the note to be created and editor to initialize and focus
    // (focus is set with a 100ms delay after note loads)
    await page.waitForTimeout(1000);

    // The editor should be focused - verify by checking we can type immediately
    // Type some text without clicking the editor first
    const testText = 'Focus Test Title';
    await page.keyboard.type(testText);

    // Wait for the text to appear
    await page.waitForTimeout(300);

    // Verify the text was typed into the editor
    const editor = page.locator('.ProseMirror');
    const editorContent = await editor.textContent();
    expect(editorContent).toContain(testText);

    console.log('[Test] New note focus test (button) passed');
  });

  // Note: Menu keyboard shortcuts (Cmd+N) don't work reliably in Playwright with Electron
  // because menu shortcuts are handled by the main process, not the renderer.
  // The button test above covers the same focus functionality.
  test.skip('should focus editor when creating new note via keyboard shortcut', async () => {
    console.log('[Test] Starting new note focus test (keyboard shortcut)');

    // Wait for the app to be fully loaded
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });

    // Use Cmd+N (or Ctrl+N on Windows/Linux) to create a new note
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+n');
    } else {
      await page.keyboard.press('Control+n');
    }

    // Wait for the note to be created and editor to initialize and focus
    // (focus is set with a 100ms delay after note loads)
    await page.waitForTimeout(1000);

    // The editor should be focused - verify by checking we can type immediately
    // Type some text without clicking the editor first
    const testText = 'Keyboard Shortcut Focus Test';
    await page.keyboard.type(testText);

    // Wait for the text to appear
    await page.waitForTimeout(300);

    // Verify the text was typed into the editor
    const editor = page.locator('.ProseMirror');
    const editorContent = await editor.textContent();
    expect(editorContent).toContain(testText);

    console.log('[Test] New note focus test (keyboard shortcut) passed');
  });

  test('should have cursor at beginning of H1 heading', async () => {
    console.log('[Test] Starting cursor position test');

    // Wait for the app to be fully loaded
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });

    // Click the create note button
    const createButton = page.getByTitle('Create note');
    await createButton.click();

    // Wait for the note to be created and editor to initialize and focus
    // (focus is set with a 100ms delay after note loads)
    await page.waitForTimeout(1000);

    // Type a title - it should go into the H1 heading
    const testTitle = 'My Test Note Title';
    await page.keyboard.type(testTitle);
    await page.waitForTimeout(300);

    // Verify the text is in an H1 element
    const h1 = page.locator('.ProseMirror h1');
    await expect(h1).toBeVisible();
    const h1Content = await h1.textContent();
    expect(h1Content).toContain(testTitle);

    console.log('[Test] Cursor position test passed');
  });
});
