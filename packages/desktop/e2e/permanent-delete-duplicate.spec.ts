/**
 * E2E tests for Permanent Delete and Duplicate Note features
 * Phase 2.5.8: Notes List Polish
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

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

// Helper to get notes list
function getNotesList(window: Page) {
  return window.locator('[data-testid="notes-list"]').locator('li');
}

test.describe.configure({ mode: 'serial' });

test.describe('Permanent Delete and Duplicate Note', () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testDbPath: string;
  let testStorageDir: string;

  test.beforeEach(async () => {
    // Create temp directories
    testDbPath = path.join(os.tmpdir(), `notecove-test-${Date.now()}.db`);
    testStorageDir = path.join(os.tmpdir(), `notecove-test-storage-${Date.now()}`);
    await fs.mkdir(testStorageDir, { recursive: true });

    // Launch Electron app with test database
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
    });

    // Wait for the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for app to be ready
    await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
  });

  test.afterEach(async () => {
    // Close app
    await electronApp.close();

    // Clean up test files
    try {
      await fs.unlink(testDbPath);
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('should permanently delete a note from Recently Deleted', async () => {
    // Create a note
    await createTestNote(window, 'Note to be permanently deleted');

    // Verify note appears in notes list (welcome note + new note)
    let noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(2);

    // Delete the note (soft delete)
    await noteItems.last().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menu = window.locator('[role="menu"]');
    await menu.locator('text=Delete').click();
    await window.waitForTimeout(300);
    await window.locator('button:has-text("Delete")').click(); // Confirm delete
    await window.waitForTimeout(1000);

    // Navigate to Recently Deleted
    await window.click('text=Recently Deleted');
    await window.waitForTimeout(1000);

    // Verify note is in Recently Deleted
    noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(1);

    // Right-click and select "Delete Permanently"
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.locator('[role="menu"]').locator('text=Delete Permanently').click();
    await window.waitForTimeout(300);
    // Confirm permanent delete in dialog
    await window.locator('button:has-text("Delete Permanently")').click();
    await window.waitForTimeout(1000);

    // Verify note is gone from Recently Deleted
    noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(0);

    // Verify note is also gone from All Notes
    await window.click('text=All Notes');
    await window.waitForTimeout(1000);
    noteItems = getNotesList(window);
    // Should only have the welcome note
    await expect(noteItems).toHaveCount(1);
  });

  test('should duplicate a note with "Copy of" prefix', async () => {
    // Create a note with specific content
    await createTestNote(window, 'Original Note Content');

    // Right-click the note and select "Duplicate"
    let noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(2); // welcome + new note

    // The newly created note should be first (most recently modified)
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.locator('[role="menu"]').locator('text=Duplicate').click();
    await window.waitForTimeout(1000);

    // Verify we now have 3 notes
    noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(3); // welcome + original + duplicate

    // Wait for title to update (title extraction happens with debounce)
    await window.waitForTimeout(2000);

    // Verify the duplicate has "Copy of" prefix in its title
    // The duplicate should be first (most recently modified)
    const duplicateNote = noteItems.first();
    const titleElement = duplicateNote.locator('.MuiTypography-subtitle1');
    const titleText = await titleElement.textContent();
    expect(titleText).toContain('Copy of');
    expect(titleText).toContain('Original Note Content');

    // Click on the duplicate to view its content
    await duplicateNote.click();
    await window.waitForTimeout(1000);

    // Verify the editor shows the duplicated content with "Copy of" prefix
    const editor = window.locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: 5000 });
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Copy of Original Note Content');
  });

  test('should duplicate a note that already has "Copy of" prefix without adding another', async () => {
    // Create a note
    await createTestNote(window, 'Test Note');

    // Duplicate it once (the newly created note should be first)
    let noteItems = getNotesList(window);
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.locator('[role="menu"]').locator('text=Duplicate').click();
    await window.waitForTimeout(1000);

    // Wait for title to update
    await window.waitForTimeout(2000);

    // Duplicate the copy (which should be first now)
    noteItems = getNotesList(window);
    const copyNote = noteItems.first(); // "Copy of Test Note"
    await copyNote.click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.locator('[role="menu"]').locator('text=Duplicate').click();
    await window.waitForTimeout(1000);

    // Wait for title to update
    await window.waitForTimeout(2000);

    // Verify we have 4 notes total (welcome + original + copy + copy-of-copy)
    noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(4);

    // Verify the second duplicate still has only one "Copy of" prefix
    // The newest duplicate should be first
    const secondCopy = noteItems.first();
    const titleElement = secondCopy.locator('.MuiTypography-subtitle1');
    const titleText = await titleElement.textContent();
    const copyOfCount = (titleText?.match(/Copy of/g) || []).length;
    expect(copyOfCount).toBe(1); // Should not be "Copy of Copy of..."
  });

  test('should place duplicated note in the same folder as original', async () => {
    // Create a folder
    await window.click('button[title="Create folder"]');
    const folderDialog = window.locator('div[role="dialog"]');
    await folderDialog.locator('input[type="text"]').fill('Test Folder');
    await folderDialog.locator('button:has-text("Create")').click();
    await window.waitForTimeout(1000);

    // Select the folder
    await window.click('text=Test Folder');
    await window.waitForTimeout(1000);

    // Create a note in the folder
    await createTestNote(window, 'Note in folder');

    // Duplicate the note
    let noteItems = getNotesList(window);
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.locator('[role="menu"]').locator('text=Duplicate').click();
    await window.waitForTimeout(1000);

    // Verify both notes are in the folder
    noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(2);

    // Navigate away and back to verify they're really in the folder
    await window.click('text=All Notes');
    await window.waitForTimeout(1000);
    await window.click('text=Test Folder');
    await window.waitForTimeout(1000);

    noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(2);
  });

  test('should not show "Duplicate" option in Recently Deleted', async () => {
    // Create and delete a note
    await createTestNote(window, 'Note to delete');

    let noteItems = getNotesList(window);
    await noteItems.last().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menuDelete = window.locator('[role="menu"]');
    await menuDelete.locator('text=Delete').click();
    await window.waitForTimeout(300);
    await window.locator('button:has-text("Delete")').click();
    await window.waitForTimeout(1000);

    // Navigate to Recently Deleted
    await window.click('text=Recently Deleted');
    await window.waitForTimeout(1000);

    // Right-click the deleted note
    noteItems = getNotesList(window);
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);

    // Verify "Duplicate" option is NOT present, but "Delete Permanently" IS present
    const menu = window.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    const duplicateOption = menu.locator('text=Duplicate');
    await expect(duplicateOption).toHaveCount(0);

    const permanentDeleteOption = menu.locator('text=Delete Permanently');
    await expect(permanentDeleteOption).toBeVisible();
  });
});
