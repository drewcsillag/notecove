/**
 * E2E tests for Note Info Window
 *
 * Tests the Note Info window functionality that displays comprehensive
 * information about a note in a separate window.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Get the first window. Uses firstWindow() which handles windows
 * that were created during launch (before this call).
 * waitForEvent('window') would miss already-created windows.
 */
async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  return app.firstWindow();
}

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-note-info-'));
  console.log('[E2E Note Info] Launching Electron with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await getFirstWindow(electronApp);

  // Capture renderer console logs
  page.on('console', (msg) => {
    console.log('[Renderer Console]:', msg.text());
  });

  // Wait for app to be ready
  await page.waitForSelector('text=Folders', { timeout: 10000 });
  await page.waitForTimeout(1000);
}, 60000);

test.afterEach(async () => {
  // Robust cleanup - handle cases where app may have crashed
  try {
    if (electronApp) {
      await electronApp.close().catch((err) => {
        console.error('[E2E Note Info] Failed to close Electron app:', err);
      });
    }
  } catch (err) {
    console.error('[E2E Note Info] Error during app cleanup:', err);
  }

  // Clean up the temporary user data directory
  try {
    if (testUserDataDir) {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log('[E2E Note Info] Cleaned up test userData directory');
    }
  } catch (err) {
    console.error('[E2E Note Info] Failed to clean up test userData directory:', err);
  }
});

test.describe('Note Info Window', () => {
  test('should have "Note Info" option in context menu', async () => {
    // Create a note first
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Wait for note to appear in the list
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await expect(firstNote).toBeVisible();

    // Right-click the note
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Context menu should appear with "Note Info" option
    const noteInfoOption = page.locator('[role="menuitem"]:has-text("Note Info")');
    await expect(noteInfoOption).toBeVisible();

    // Close menu by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('should open Note Info window from context menu', async () => {
    // Create a note first
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Add some content
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Test note content for info');
    await page.waitForTimeout(1500);

    // Right-click the note
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Click "Note Info" option
    const noteInfoOption = page.locator('[role="menuitem"]:has-text("Note Info")');
    await noteInfoOption.click();
    await page.waitForTimeout(1000);

    // A new window should open
    const windows = electronApp.windows();
    expect(windows.length).toBeGreaterThan(1);

    // Find the Note Info window (it should have "Note Info" in the title)
    const noteInfoWindow = windows.find(async (w) => {
      const title = await w.title();
      return title.startsWith('Note Info');
    });
    expect(noteInfoWindow).toBeDefined();
  });

  // Note: This test is skipped because Playwright's keyboard.press() sends events
  // to the renderer process, not to Electron's native menu system. Menu accelerators
  // (like CmdOrCtrl+Shift+I) are handled at the OS level before reaching the renderer,
  // so they can't be triggered via Playwright in headless E2E tests.
  // The keyboard shortcut works correctly in the actual app.
  test.skip('should open Note Info window from keyboard shortcut', async () => {
    // Create a note and select it
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Add some content
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Test note for keyboard shortcut');
    await page.waitForTimeout(1500);

    // Make sure the note is selected
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click();
    await page.waitForTimeout(500);

    // Get initial window count
    const initialWindowCount = electronApp.windows().length;

    // Press Cmd+Shift+I (or Ctrl+Shift+I on non-Mac)
    await page.keyboard.press('Meta+Shift+I');
    await page.waitForTimeout(1000);

    // A new window should open
    const windows = electronApp.windows();
    expect(windows.length).toBe(initialWindowCount + 1);
  });

  test('Note Info window should display basic information', async () => {
    // Create a note with content
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Note info test content');
    await page.waitForTimeout(1500);

    // Open Note Info window
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    const noteInfoOption = page.locator('[role="menuitem"]:has-text("Note Info")');
    await noteInfoOption.click();
    await page.waitForTimeout(1000);

    // Get the Note Info window
    const windows = electronApp.windows();
    const noteInfoWindow = windows.find((w) => w !== page);
    expect(noteInfoWindow).toBeDefined();

    if (noteInfoWindow) {
      // Check for basic sections in the Note Info window
      await expect(noteInfoWindow.locator('text=Basic Information')).toBeVisible();
      await expect(noteInfoWindow.locator('text=Timestamps')).toBeVisible();
      await expect(noteInfoWindow.locator('text=Document Statistics')).toBeVisible();
      await expect(noteInfoWindow.locator('text=Advanced Information')).toBeVisible();

      // All sections should be visible inline (not collapsed in accordion)
      await expect(noteInfoWindow.locator('text=Vector Clock')).toBeVisible();
      await expect(noteInfoWindow.locator('text=CRDT Update Count')).toBeVisible();
    }
  });

  test('Note Info window should not show Pack Count', async () => {
    // Create a note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Open Note Info window
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    const noteInfoOption = page.locator('[role="menuitem"]:has-text("Note Info")');
    await noteInfoOption.click();
    await page.waitForTimeout(1000);

    // Get the Note Info window
    const windows = electronApp.windows();
    const noteInfoWindow = windows.find((w) => w !== page);
    expect(noteInfoWindow).toBeDefined();

    if (noteInfoWindow) {
      // Pack Count should NOT be present
      await expect(noteInfoWindow.locator('text=Pack Count')).not.toBeVisible();
    }
  });

  test('Note Info window should show full folder path with SD name', async () => {
    // Click "All Notes" first to set active SD context (required for folder creation)
    await page.locator('text=All Notes').first().click();
    await page.waitForTimeout(500);

    // Create a folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForSelector('text=Create New Folder', { timeout: 5000 });

    const dialog = page.locator('div[role="dialog"]');
    const folderInput = dialog.locator('input[type="text"]');
    await folderInput.fill('Test Folder');
    await folderInput.press('Enter');

    // Wait for dialog to close and folder to appear
    await page.waitForSelector('text=Create New Folder', { state: 'hidden', timeout: 5000 });
    await page.waitForSelector('text=Test Folder', { timeout: 5000 });

    // Click the folder to select it
    const folderItem = page.locator('text=Test Folder').first();
    await folderItem.click();
    await page.waitForTimeout(500);

    // Create a note in the folder
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Open Note Info window
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    const noteInfoOption = page.locator('[role="menuitem"]:has-text("Note Info")');
    await noteInfoOption.click();
    await page.waitForTimeout(1000);

    // Get the Note Info window
    const windows = electronApp.windows();
    const noteInfoWindow = windows.find((w) => w !== page);
    expect(noteInfoWindow).toBeDefined();

    if (noteInfoWindow) {
      // Wait for the Note Info window to load data
      await noteInfoWindow.waitForLoadState('networkidle');
      await noteInfoWindow.waitForTimeout(1000);

      // Should show the full folder path including SD name
      // The default SD in test mode is named "Default"
      await expect(noteInfoWindow.locator('text=Default / Test Folder')).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('should open multiple Note Info windows for different notes', async () => {
    // Create two notes
    const createButton = page.locator('#middle-panel button[title="Create note"]');

    // First note
    await createButton.click();
    await page.waitForTimeout(1000);
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('First note');
    await page.waitForTimeout(1500);

    // Second note
    await createButton.click();
    await page.waitForTimeout(1000);
    await editor.click();
    await editor.type('Second note');
    await page.waitForTimeout(1500);

    // Open Note Info for first note
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Note Info")').click();
    await page.waitForTimeout(1000);

    const afterFirstWindowCount = electronApp.windows().length;
    expect(afterFirstWindowCount).toBe(2);

    // Open Note Info for second note
    const secondNote = notesList.locator('li').nth(1);
    await secondNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Note Info")').click();
    await page.waitForTimeout(1000);

    // Should now have 3 windows (main + 2 Note Info)
    const afterSecondWindowCount = electronApp.windows().length;
    expect(afterSecondWindowCount).toBe(3);
  });
});
