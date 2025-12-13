/**
 * E2E tests for Note Context Menu & Deletion (Phase 2.5.4)
 *
 * Tests the note context menu functionality and soft-delete behavior.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

// Run tests in this file serially to avoid Electron process conflicts
test.describe.configure({ mode: 'serial' });

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

// Helper to kill any orphaned Electron processes from this test file
function killOrphanedElectronProcesses(): void {
  try {
    // Kill any Electron processes that might be stuck from previous test runs
    // This is aggressive but necessary to prevent cascade failures
    if (process.platform === 'darwin') {
      execSync('pkill -f "notecove-e2e-note-menu" 2>/dev/null || true', { stdio: 'ignore' });
    }
  } catch {
    // Ignore errors - process might not exist
  }
}

test.beforeEach(async () => {
  // Kill any orphaned processes before starting
  killOrphanedElectronProcesses();
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-note-menu-'));
  console.log('[E2E Note Menu] Launching Electron with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await electronApp.firstWindow();

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
        console.error('[E2E Note Menu] Failed to close Electron app:', err);
      });
    }
  } catch (err) {
    console.error('[E2E Note Menu] Error during app cleanup:', err);
  }

  // Clean up the temporary user data directory
  try {
    if (testUserDataDir) {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log('[E2E Note Menu] Cleaned up test userData directory');
    }
  } catch (err) {
    console.error('[E2E Note Menu] Failed to clean up test userData directory:', err);
  }
});

test.describe('Note Context Menu', () => {
  test('should show context menu when right-clicking a note', async () => {
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

    // Context menu should appear
    const contextMenu = page.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible();

    // Close menu by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('should have "New Note" option in context menu', async () => {
    // Create a note first
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Right-click the note
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Look for "New Note" option
    const newNoteOption = page.locator('[role="menuitem"]:has-text("New Note")');
    await expect(newNoteOption).toBeVisible();

    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should have "Delete" option in context menu', async () => {
    // Create a note first
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Right-click the note
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Look for "Delete" option
    const deleteOption = page.locator('[role="menuitem"]:has-text("Delete")');
    await expect(deleteOption).toBeVisible();

    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should create new note from context menu', async () => {
    // Create first note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Count notes before
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const beforeCount = await notesList.locator('li').count();

    // Right-click the note and select "New Note"
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("New Note")').click();
    await page.waitForTimeout(1000);

    // Should have one more note
    const afterCount = await notesList.locator('li').count();
    expect(afterCount).toBe(beforeCount + 1);
  });
});

test.describe('Note Deletion', () => {
  test('should show confirmation dialog when deleting a note', async () => {
    // Create a note first
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Right-click and select Delete
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page.waitForTimeout(500);

    // Confirmation dialog should appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/recently deleted/i);

    // Close dialog without deleting
    await page.keyboard.press('Escape');
  });

  test('should delete note when confirmed', async () => {
    // Create a note first
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Add some content to the note so we can identify it
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Test note to delete');
    await page.waitForTimeout(1000);

    // Count notes before deletion
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const beforeCount = await notesList.locator('li').count();

    // Right-click and select Delete
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page.waitForTimeout(500);

    // Confirm deletion
    const dialog = page.locator('[role="dialog"]');
    const confirmButton = dialog.locator('button:has-text("Delete")');
    await confirmButton.click();
    await page.waitForTimeout(1000);

    // Should have one fewer note in "All Notes"
    const afterCount = await notesList.locator('li').count();
    expect(afterCount).toBe(beforeCount - 1);
  });

  test('should move deleted note to "Recently Deleted" folder', async () => {
    // Create a note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Add content to identify the note
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Note for deletion test');
    await page.waitForTimeout(1500); // Wait for title extraction

    // Get the note title from the list
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    const noteTitle = await firstNote.locator('h6').innerText();
    console.log('[E2E] Note title:', noteTitle);

    // Delete the note
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[role="dialog"]');
    const confirmButton = dialog.locator('button:has-text("Delete")');
    await confirmButton.click();
    await page.waitForTimeout(1000);

    // Click "Recently Deleted" folder
    const recentlyDeleted = page.locator('text=Recently Deleted');
    await recentlyDeleted.click();
    await page.waitForTimeout(1000);

    // Should see the deleted note
    const deletedNotesList = page.locator('#middle-panel [data-testid="notes-list"]');
    await expect(deletedNotesList.locator('li')).toHaveCount(1);
    await expect(deletedNotesList).toContainText(noteTitle);
  });

  test('should not show deleted notes in "All Notes"', async () => {
    // Count notes before creating a new one (should have default note)
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const initialCount = await notesList.locator('li').count();

    // Create a note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Should now have one more note
    const afterCreateCount = await notesList.locator('li').count();
    expect(afterCreateCount).toBe(initialCount + 1);

    // Delete the first note (the newly created one)
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[role="dialog"]');
    const confirmButton = dialog.locator('button:has-text("Delete")');
    await confirmButton.click();
    await page.waitForTimeout(1000);

    // Switch to a different folder first (to ensure a clean refetch)
    const recentlyDeleted = page.locator('text=Recently Deleted').first();
    await recentlyDeleted.click();
    await page.waitForTimeout(500);

    // Now switch back to "All Notes"
    const allNotes = page.locator('text=All Notes').first();
    await allNotes.click();
    await page.waitForTimeout(1000);

    // Should be back to the initial count (deleted note should not show)
    const notesListAfter = page.locator('#middle-panel [data-testid="notes-list"]');
    const finalCount = await notesListAfter.locator('li').count();
    expect(finalCount).toBe(initialCount);
  });

  test('should not show deleted notes in search results', async () => {
    // Create a note with searchable content
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Unique search term XYZ123');
    await page.waitForTimeout(2000); // Wait for indexing

    // Verify note appears in search
    const searchInput = page.locator('#middle-panel input[type="text"]').first();
    await searchInput.fill('XYZ123');
    await page.waitForTimeout(1000);

    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    await expect(notesList.locator('li')).toHaveCount(1);

    // Clear search
    const clearButton = page.locator('#middle-panel button[aria-label*="clear" i]').first();
    await clearButton.click();
    await page.waitForTimeout(500);

    // Delete the note
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[role="dialog"]');
    const confirmButton = dialog.locator('button:has-text("Delete")');
    await confirmButton.click();
    await page.waitForTimeout(1000);

    // Search again
    await searchInput.fill('XYZ123');
    await page.waitForTimeout(1000);

    // Should not find the deleted note
    const searchResults = page.locator('#middle-panel [data-testid="notes-list"]');
    const count = await searchResults.locator('li').count();
    expect(count).toBe(0);
  });

  test('should restore note from Recently Deleted', async () => {
    // Create a note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Add content to identify the note
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Note to restore');
    await page.waitForTimeout(1500); // Wait for title extraction

    // Count notes before deletion
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const beforeCount = await notesList.locator('li').count();

    // Delete the note
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[role="dialog"]');
    const confirmButton = dialog.locator('button:has-text("Delete")');
    await confirmButton.click();
    await page.waitForTimeout(1000);

    // Navigate to Recently Deleted
    const recentlyDeleted = page.locator('text=Recently Deleted').first();
    await recentlyDeleted.click();
    await page.waitForTimeout(1000);

    // Should see the deleted note
    const deletedNotesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const deletedNote = deletedNotesList.locator('li').first();
    await expect(deletedNote).toBeVisible();

    // Restore the note via context menu
    await deletedNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Restore")').click();
    await page.waitForTimeout(1000);

    // Recently Deleted should now be empty
    const afterRestoreCount = await deletedNotesList.locator('li').count();
    expect(afterRestoreCount).toBe(0);

    // Navigate back to All Notes
    const allNotes = page.locator('text=All Notes').first();
    await allNotes.click();
    await page.waitForTimeout(1000);

    // Should see the restored note
    const allNotesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const afterCount = await allNotesList.locator('li').count();
    expect(afterCount).toBe(beforeCount);
    await expect(allNotesList).toContainText('Note to restore');
  });

  test('should cancel deletion when clicking cancel', async () => {
    // Create a note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Count notes before
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const beforeCount = await notesList.locator('li').count();

    // Right-click and select Delete
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page.waitForTimeout(500);

    // Cancel deletion
    const dialog = page.locator('[role="dialog"]');
    const cancelButton = dialog.locator('button:has-text("Cancel")');
    await cancelButton.click();
    await page.waitForTimeout(500);

    // Should still have the same number of notes
    const afterCount = await notesList.locator('li').count();
    expect(afterCount).toBe(beforeCount);
  });
});

test.describe('Note Move to Folder (Phase 2.5.7.1)', () => {
  test('should show "Move to..." option in context menu', async () => {
    // Create a note first
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Right-click the note
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Look for "Move to..." option
    const moveOption = page.locator('[role="menuitem"]:has-text("Move to...")');
    await expect(moveOption).toBeVisible();

    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should show move dialog with folder selection', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create a folder first
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForTimeout(500);

    // Enter folder name in dialog
    const dialog = page.locator('div[role="dialog"]');
    const folderInput = dialog.locator('input[type="text"]');
    await folderInput.fill('Test Folder');
    await folderInput.press('Enter');
    await page.waitForTimeout(1000);

    // Create a note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Right-click the note and select "Move to..."
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Move to...")').click();
    await page.waitForTimeout(500);

    // Move dialog should appear
    const moveDialog = page.locator('[role="dialog"]:has-text("Move Note to Folder")');
    await expect(moveDialog).toBeVisible();

    // Should show "All Notes (No Folder)" option
    await expect(moveDialog).toContainText('All Notes (No Folder)');

    // Should show the folder we created
    await expect(moveDialog).toContainText('Test Folder');

    // Close dialog
    await page.keyboard.press('Escape');
  });

  test('should move note to a folder', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create a note FIRST (in "All Notes" by default)
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Note to move to folder');
    await page.waitForTimeout(1500); // Wait for title extraction

    // Get note title
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    const noteTitle = await firstNote.locator('h6').innerText();
    console.log('[E2E] Note title:', noteTitle);

    // Count notes in All Notes before move
    const beforeCount = await notesList.locator('li').count();

    // NOW create the folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForTimeout(500);

    // Enter folder name in dialog
    const dialog = page.locator('div[role="dialog"]');
    const folderInput = dialog.locator('input[type="text"]');
    await folderInput.fill('Work Notes');
    await folderInput.press('Enter');

    // Wait for dialog to close
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(1000);

    // Wait for folder to appear in tree
    await page.waitForSelector('text=Work Notes', { timeout: 5000 });

    // Click "All Notes" to switch back to view our note
    await page.waitForSelector('text=All Notes', { timeout: 5000 });
    const allNotesItem = page.locator('text=All Notes').first();
    await allNotesItem.click();
    await page.waitForTimeout(1500);

    // Move note to folder
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Move to...")').click();
    await page.waitForTimeout(500);

    // Select the folder in the move dialog
    const moveDialog = page.locator('[role="dialog"]:has-text("Move Note to Folder")');
    const folderRadio = moveDialog.locator('label:has-text("Work Notes")');
    await folderRadio.click();
    await page.waitForTimeout(500);

    // Click Move button
    const moveButton = moveDialog.locator('button:has-text("Move")');
    await moveButton.click();

    // Wait for move dialog to close
    await moveDialog.waitFor({ state: 'hidden', timeout: 5000 });

    // Wait for the note to disappear from "All Notes"
    await page.waitForFunction(
      (expectedCount) => {
        const notesList = document.querySelector('#middle-panel [data-testid="notes-list"]');
        const count = notesList ? notesList.querySelectorAll('li').length : 0;
        return count === expectedCount;
      },
      beforeCount - 1,
      { timeout: 5000 }
    );

    // Note should be removed from All Notes
    const afterCount = await notesList.locator('li').count();
    expect(afterCount).toBe(beforeCount - 1);

    // Click on the folder to see its notes
    await page.waitForSelector('text=Work Notes', { timeout: 5000 });
    const folderItem = page.locator('text=Work Notes').first();
    await folderItem.click();
    await page.waitForTimeout(1000);

    // Note should appear in the folder
    const folderNotesList = page.locator('#middle-panel [data-testid="notes-list"]');
    await page.waitForTimeout(1000); // Wait for notes list to reload
    await expect(folderNotesList.locator('li')).toHaveCount(1);
    await expect(folderNotesList).toContainText(noteTitle);
  });

  test('should move note from folder to "All Notes (No Folder)"', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create a folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForTimeout(500);

    // Enter folder name in dialog
    const folderDialog = page.locator('div[role="dialog"]');
    const folderInput = folderDialog.locator('input[type="text"]');
    await folderInput.fill('Temp Folder');
    await folderInput.press('Enter');
    await page.waitForTimeout(1000);

    // Click on the folder
    const folderItem = page.locator('text=Temp Folder').first();
    await folderItem.click();
    await page.waitForTimeout(1000);

    // Create a note in the folder
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Note in folder');
    await page.waitForTimeout(1500);

    // Get note title
    const folderNotesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = folderNotesList.locator('li').first();
    const noteTitle = await firstNote.locator('h6').innerText();

    // Move note to "All Notes"
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Move to...")').click();
    await page.waitForTimeout(500);

    // Select "All Notes (No Folder)"
    const moveDialog = page.locator('[role="dialog"]:has-text("Move Note to Folder")');
    const noFolderRadio = moveDialog.locator('label:has-text("All Notes (No Folder)")');
    await noFolderRadio.click();
    await page.waitForTimeout(500);

    // Click Move button
    const moveButton = moveDialog.locator('button:has-text("Move")');
    await moveButton.click();
    await page.waitForTimeout(1000);

    // Folder should now be empty
    await expect(folderNotesList.locator('li')).toHaveCount(0);

    // Click "All Notes" to verify note is there
    const allNotes = page.locator('text=All Notes').first();
    await allNotes.click();
    await page.waitForTimeout(1000);

    // Note should appear in All Notes
    const allNotesList = page.locator('#middle-panel [data-testid="notes-list"]');
    await expect(allNotesList).toContainText(noteTitle);
  });

  test('should move note between folders', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create two folders
    const newFolderButton = page.locator('button[title="Create folder"]');

    // Create Folder A
    await newFolderButton.click();
    await page.waitForTimeout(500);
    let dialog = page.locator('div[role="dialog"]');
    let folderInput = dialog.locator('input[type="text"]');
    await folderInput.fill('Folder A');
    await folderInput.press('Enter');
    await page.waitForTimeout(1000);

    // Create Folder B
    await newFolderButton.click();
    await page.waitForTimeout(500);
    dialog = page.locator('div[role="dialog"]');
    folderInput = dialog.locator('input[type="text"]');
    await folderInput.fill('Folder B');
    await folderInput.press('Enter');
    await page.waitForTimeout(1000);

    // Click Folder A
    const folderA = page.locator('text=Folder A').first();
    await folderA.click();
    await page.waitForTimeout(1000);

    // Create note in Folder A
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Note moving between folders');
    await page.waitForTimeout(1500);

    // Get note title
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    const noteTitle = await firstNote.locator('h6').innerText();

    // Move to Folder B
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Move to...")').click();
    await page.waitForTimeout(500);

    const moveDialog = page.locator('[role="dialog"]:has-text("Move Note to Folder")');
    const folderBRadio = moveDialog.locator('label:has-text("Folder B")');
    await folderBRadio.click();
    await page.waitForTimeout(500);

    const moveButton = moveDialog.locator('button:has-text("Move")');
    await moveButton.click();
    await page.waitForTimeout(1000);

    // Folder A should be empty
    await expect(notesList.locator('li')).toHaveCount(0);

    // Click Folder B
    const folderB = page.locator('text=Folder B').first();
    await folderB.click();
    await page.waitForTimeout(1000);

    // Note should be in Folder B
    const folderBNotesList = page.locator('#middle-panel [data-testid="notes-list"]');
    await expect(folderBNotesList.locator('li')).toHaveCount(1);
    await expect(folderBNotesList).toContainText(noteTitle);
  });

  test('should disable Move button when selecting current folder', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create a folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForTimeout(500);

    // Enter folder name in dialog
    const dialog = page.locator('div[role="dialog"]');
    const folderInput = dialog.locator('input[type="text"]');
    await folderInput.fill('Current Folder');
    await folderInput.press('Enter');
    await page.waitForTimeout(1000);

    // Click folder
    const folderItem = page.locator('text=Current Folder').first();
    await folderItem.click();
    await page.waitForTimeout(1000);

    // Create note in folder
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Open move dialog
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Move to...")').click();
    await page.waitForTimeout(500);

    // Current folder radio button should be disabled
    const moveDialog = page.locator('[role="dialog"]:has-text("Move Note to Folder")');
    await moveDialog.waitFor({ state: 'visible', timeout: 5000 });

    // Find the FormControlLabel that contains "Current Folder" text
    const currentFolderLabel = moveDialog.locator(
      'label.MuiFormControlLabel-root:has-text("Current Folder")'
    );
    await expect(currentFolderLabel).toHaveClass(/Mui-disabled/);

    // Move button should be disabled (current folder is pre-selected)
    const moveButton = moveDialog.locator('button:has-text("Move")');
    await expect(moveButton).toBeDisabled();

    // Close dialog
    await page.keyboard.press('Escape');
  });

  test('should cancel move operation', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create a note FIRST (in "All Notes" by default)
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Count notes before
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const beforeCount = await notesList.locator('li').count();

    // NOW create the folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForTimeout(500);

    // Enter folder name in dialog
    const dialog = page.locator('div[role="dialog"]');
    const folderInput = dialog.locator('input[type="text"]');
    await folderInput.fill('Test Folder');
    await folderInput.press('Enter');

    // Wait for dialog to close
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(1000);

    // Wait for folder to appear in tree
    await page.waitForSelector('text=Test Folder', { timeout: 5000 });

    // Click "All Notes" to switch back to view our note
    await page.waitForSelector('text=All Notes', { timeout: 5000 });
    const allNotesItem = page.locator('text=All Notes').first();
    await allNotesItem.click();
    await page.waitForTimeout(1500);

    // Open move dialog
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Move to...")').click();
    await page.waitForTimeout(500);

    // Select a folder but cancel
    const moveDialog = page.locator('[role="dialog"]:has-text("Move Note to Folder")');
    await moveDialog.waitFor({ state: 'visible', timeout: 5000 });
    const folderRadio = moveDialog.locator('label:has-text("Test Folder")');
    await folderRadio.click();
    await page.waitForTimeout(500);

    const cancelButton = moveDialog.locator('button:has-text("Cancel")');
    await cancelButton.click();
    await page.waitForTimeout(500);

    // Note should still be in All Notes
    const afterCount = await notesList.locator('li').count();
    expect(afterCount).toBe(beforeCount);
  });
});
