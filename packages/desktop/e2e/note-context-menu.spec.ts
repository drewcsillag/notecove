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

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
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
  await electronApp.close();

  // Clean up the temporary user data directory
  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E Note Menu] Cleaned up test userData directory');
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

  test.skip('should move deleted note to "Recently Deleted" folder', async () => {
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

  test.skip('should not show deleted notes in "All Notes"', async () => {
    // Create a note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Delete the note
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
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

    // Should have no notes in "All Notes"
    const notesListAfter = page.locator('#middle-panel [data-testid="notes-list"]');
    const count = await notesListAfter.locator('li').count();
    expect(count).toBe(0);
  });

  test.skip('should not show deleted notes in search results', async () => {
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
