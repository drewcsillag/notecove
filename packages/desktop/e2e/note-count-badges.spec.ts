/**
 * E2E tests for note count badges in folder tree
 * Phase 2.5.8: Notes List Polish
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { getFirstSdId, getAllNotesTestId, getRecentlyDeletedTestId } from './utils/sd-helpers';

/**
 * Get the first window. Uses firstWindow() which handles windows
 * that were created during launch (before this call).
 * waitForEvent('window') would miss already-created windows.
 */
async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  return app.firstWindow();
}

// Helper function to create a test note
async function createTestNote(window: Page, content: string) {
  const createButton = window.locator('button[title="Create note"]');
  await createButton.click();
  await window.waitForTimeout(1000);

  // Wait for editor to load
  const editor = window.locator('.ProseMirror');
  await editor.waitFor({ state: 'visible', timeout: 5000 });

  // Type content
  await editor.click();
  await window.keyboard.type(content);
  await window.waitForTimeout(1000);

  // Wait for note to appear in list
  const notesList = window.locator('[data-testid="notes-list"]');
  const noteItems = notesList.locator('li');
  await expect(noteItems.first()).toBeVisible();
}

// Helper to get folder tree nodes
function getFolderTreeNodes(window: Page) {
  return window.locator('[data-testid^="folder-tree-node-"]');
}

/**
 * E2E tests for note count badges
 */
test.describe.configure({ mode: 'serial' });

test.describe('Note count badges in folder tree', () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testDbPath: string;
  let testStorageDir: string;
  let sdId: string;

  test.beforeEach(async () => {
    // Create temp directories
    testDbPath = path.join(os.tmpdir(), `notecove-test-${Date.now()}.db`);
    testStorageDir = path.join(os.tmpdir(), `notecove-test-storage-${Date.now()}`);
    await fs.mkdir(testStorageDir, { recursive: true });

    const mainPath = path.resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Launch Electron app with test database
    electronApp = await electron.launch({
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
      timeout: 60000,
    });

    // Wait for the first window with explicit timeout
    window = await getFirstWindow(electronApp);
    await window.waitForLoadState('domcontentloaded');

    // Wait for app to be ready
    await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
    await window.waitForTimeout(1000);

    // Get the SD ID for use in tests
    sdId = await getFirstSdId(window);
  }, 60000);

  test.afterEach(async () => {
    // Robust cleanup - handle cases where app may have crashed
    try {
      if (electronApp) {
        await electronApp.close().catch((err) => {
          console.error('[E2E Note Badges] Failed to close Electron app:', err);
        });
      }
    } catch (err) {
      console.error('[E2E Note Badges] Error during app cleanup:', err);
    }

    // Clean up test files
    try {
      await fs.unlink(testDbPath).catch(() => {});
      await fs.rm(testStorageDir, { recursive: true, force: true }).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should show note count badge on "All Notes" folder', async () => {
    // Initially there's 1 welcome note, so "All Notes" should show badge with "1"
    const allNotesNode = window.locator(`[data-testid="${getAllNotesTestId(sdId)}"]`);
    await expect(allNotesNode).toBeVisible();

    // Check for badge with count "1"
    const badge = allNotesNode.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(badge).toBeVisible();

    // Create another note
    await createTestNote(window, 'Second test note');
    await window.waitForTimeout(1500); // Wait for badge refresh (500ms delay + time for DB update)

    // Badge should now show "2"
    const updatedBadge = allNotesNode.locator('.MuiChip-root').filter({ hasText: '2' });
    await expect(updatedBadge).toBeVisible({ timeout: 10000 });
  });

  test('should show note count badge on user folders', async () => {
    // Click "All Notes" first to set active SD context (required for folder creation)
    await window.locator('text=All Notes').first().click();
    await window.waitForTimeout(500);

    // Create a folder
    const newFolderButton = window.locator('button[title="Create folder"]');
    await newFolderButton.click();
    await window.waitForSelector('text=Create New Folder');

    // Enter folder name
    const dialog = window.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill('Test Folder');
    await window.keyboard.press('Enter');

    // Wait for dialog to close
    await window.waitForSelector('text=Create New Folder', { state: 'hidden', timeout: 5000 });

    // Wait for folder to appear in tree and be visible
    const folderNodes = getFolderTreeNodes(window);
    const testFolderNode = folderNodes.filter({ hasText: 'Test Folder' });
    await expect(testFolderNode).toBeVisible({ timeout: 10000 });

    // No badge should be visible for empty folder
    const emptyBadge = testFolderNode.locator('.MuiChip-root');
    await expect(emptyBadge).toHaveCount(0);

    // Create a note in the folder
    await testFolderNode.click();
    await window.waitForTimeout(500);
    await createTestNote(window, 'Note in test folder');
    await window.waitForTimeout(1500); // Give time for badge to update

    // Badge should now show "1"
    const badge = testFolderNode.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(badge).toBeVisible({ timeout: 10000 });

    // Create another note in the folder
    await createTestNote(window, 'Second note in test folder');
    await window.waitForTimeout(1500);

    // Badge should now show "2"
    const updatedBadge = testFolderNode.locator('.MuiChip-root').filter({ hasText: '2' });
    await expect(updatedBadge).toBeVisible();
  });

  test('should show note count badge on "Recently Deleted" folder', async () => {
    // Create a note
    await createTestNote(window, 'Note to be deleted');
    await window.waitForTimeout(1000);

    // Initially "Recently Deleted" should have no badge (0 notes)
    const recentlyDeletedNode = window.locator(`[data-testid="${getRecentlyDeletedTestId(sdId)}"]`);
    await expect(recentlyDeletedNode).toBeVisible();

    // No badge initially
    let badge = recentlyDeletedNode.locator('.MuiChip-root');
    await expect(badge).toHaveCount(0);

    // Delete the note
    const notesList = window.locator('[data-testid="notes-list"]');
    const noteItems = notesList.locator('li');
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menu = window.locator('[role="menu"]');
    await menu.locator('text=Delete').click();
    await window.waitForTimeout(300);
    await window.locator('button:has-text("Delete")').click();
    await window.waitForTimeout(1000);

    // "Recently Deleted" should now show badge with "1"
    badge = recentlyDeletedNode.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(badge).toBeVisible();

    // Delete another note
    const allNotesNode = window.locator(`[data-testid="${getAllNotesTestId(sdId)}"]`);
    await allNotesNode.click();
    await window.waitForTimeout(500);

    await createTestNote(window, 'Another note to delete');
    await window.waitForTimeout(1000);

    const noteItems2 = notesList.locator('li');
    await noteItems2.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menu2 = window.locator('[role="menu"]');
    await menu2.locator('text=Delete').click();
    await window.waitForTimeout(300);
    await window.locator('button:has-text("Delete")').click();
    await window.waitForTimeout(1000);

    // Badge should now show "2"
    const updatedBadge = recentlyDeletedNode.locator('.MuiChip-root').filter({ hasText: '2' });
    await expect(updatedBadge).toBeVisible();
  });

  test('should update badge count when note is moved between folders', async () => {
    // Select "All Notes" first to ensure we create root-level folders
    await window.locator('text=All Notes').first().click();
    await window.waitForTimeout(500);

    // Create two folders
    const newFolderButton = window.locator('button[title="Create folder"]');

    // Create Folder A
    await newFolderButton.click();
    await window.waitForSelector('text=Create New Folder');
    let dialog = window.locator('div[role="dialog"]');
    let folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill('Folder A');
    await dialog.locator('button:has-text("Create")').click();
    await window.waitForSelector('text=Create New Folder', { state: 'hidden' });
    await window.waitForSelector('text=Folder A', { timeout: 5000 });

    // Create Folder B
    await newFolderButton.click();
    await window.waitForSelector('text=Create New Folder');
    dialog = window.locator('div[role="dialog"]');
    folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill('Folder B');
    await dialog.locator('button:has-text("Create")').click();
    await window.waitForSelector('text=Create New Folder', { state: 'hidden' });
    await window.waitForSelector('text=Folder B', { timeout: 5000 });

    // Select Folder A and create a note
    const folderNodes = getFolderTreeNodes(window);
    const folderANode = folderNodes.filter({ hasText: 'Folder A' });
    await folderANode.click();
    await window.waitForTimeout(500);
    await createTestNote(window, 'Note in Folder A');
    await window.waitForTimeout(1000);

    // Folder A should show badge "1", Folder B should have no badge
    let folderABadge = folderANode.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(folderABadge).toBeVisible();

    const folderBNode = folderNodes.filter({ hasText: 'Folder B' });
    let folderBBadge = folderBNode.locator('.MuiChip-root');
    await expect(folderBBadge).toHaveCount(0);

    // Move note from Folder A to Folder B
    const notesList = window.locator('[data-testid="notes-list"]');
    const noteItems = notesList.locator('li');
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menu = window.locator('[role="menu"]');
    await menu.locator('text=Move to...').click();
    await window.waitForTimeout(500);

    // Wait for move dialog to appear and select Folder B
    const moveDialog = window.locator('[role="dialog"]', { hasText: 'Move Note to Folder' });
    await expect(moveDialog).toBeVisible();
    await moveDialog.locator('text=Folder B').click();

    // Click the Move button to confirm
    await moveDialog.locator('button', { hasText: 'Move' }).click();
    await window.waitForTimeout(1500); // Wait for badge update (500ms delay + time for DB update)

    // Folder A should now have no badge (0 notes)
    folderABadge = folderANode.locator('.MuiChip-root');
    await expect(folderABadge).toHaveCount(0, { timeout: 10000 });

    // Folder B should show badge "1"
    folderBBadge = folderBNode.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(folderBBadge).toBeVisible();
  });

  test('should update badge count when note is restored from Recently Deleted', async () => {
    // Create and delete a note
    await createTestNote(window, 'Note to restore');
    await window.waitForTimeout(1000);

    const notesList = window.locator('[data-testid="notes-list"]');
    const noteItems = notesList.locator('li');
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menu = window.locator('[role="menu"]');
    await menu.locator('text=Delete').click();
    await window.waitForTimeout(300);
    await window.locator('button:has-text("Delete")').click();
    await window.waitForTimeout(1000);

    // Go to Recently Deleted
    const recentlyDeletedNode = window.locator(`[data-testid="${getRecentlyDeletedTestId(sdId)}"]`);
    await recentlyDeletedNode.click();
    await window.waitForTimeout(500);

    // Badge should show "1"
    let badge = recentlyDeletedNode.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(badge).toBeVisible();

    // Restore the note
    const deletedNoteItems = notesList.locator('li');
    await deletedNoteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    const restoreMenu = window.locator('[role="menu"]');
    await restoreMenu.locator('text=Restore').click();
    await window.waitForTimeout(1000);

    // Badge should now be gone (0 notes)
    badge = recentlyDeletedNode.locator('.MuiChip-root');
    await expect(badge).toHaveCount(0);

    // "All Notes" should show badge with "2" (welcome note + restored note)
    const allNotesNode = window.locator(`[data-testid="${getAllNotesTestId(sdId)}"]`);
    const allNotesBadge = allNotesNode.locator('.MuiChip-root').filter({ hasText: '2' });
    await expect(allNotesBadge).toBeVisible();
  });
});
