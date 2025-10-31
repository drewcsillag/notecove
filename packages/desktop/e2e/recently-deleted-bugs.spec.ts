/**
 * E2E tests for Recently Deleted folder bugs
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { resolve, join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-recently-deleted-'));
  console.log('[E2E Recently Deleted] Launching Electron with userData at:', testUserDataDir);

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
  } catch (err) {
    console.error('Failed to clean up test directory:', err);
  }
});

test.describe.skip('Recently Deleted Folder Bugs', () => {
  async function createTestNote(page: Page, content: string) {
    const createButton = page.locator('button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Wait for note to appear in list
    const notesList = page.locator('[data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await expect(firstNote).toBeVisible();

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially(content);
    await page.waitForTimeout(1000);
  }

  test('Bug 1: + button should not create notes when Recently Deleted is selected', async () => {
    // Create a test note first
    await createTestNote(page, 'Test Note for Recently Deleted');

    // Delete the note we just created
    const notesList = page.locator('[data-testid="notes-list"]');
    const noteItem = notesList.locator('li').first();
    await noteItem.click({ button: 'right' });
    await page.waitForTimeout(300);

    const deleteMenuItem = page.locator('text="Delete"').first();
    await deleteMenuItem.click();
    await page.waitForTimeout(500);

    // Navigate to Recently Deleted
    const recentlyDeletedFolder = page.locator('text="Recently Deleted"').first();
    await recentlyDeletedFolder.click();
    await page.waitForTimeout(500);

    // Verify the note is in Recently Deleted
    const recentlyDeletedList = page.locator('[data-testid="notes-list"]');
    const notesInRecentlyDeleted = recentlyDeletedList.locator('li');
    await expect(notesInRecentlyDeleted).toHaveCount(1);

    // Try to click the + button
    const createButton = page.locator('button[title="Create note"]');

    // The button should be disabled or clicking should do nothing
    const countBefore = await notesInRecentlyDeleted.count();
    await createButton.click();
    await page.waitForTimeout(500);

    // Count should remain the same
    const countAfter = await notesInRecentlyDeleted.count();
    expect(countAfter).toBe(countBefore);

    // Switch to All Notes to verify no blank note was created there
    const allNotesFolder = page.locator('text="All Notes"').first();
    await allNotesFolder.click();
    await page.waitForTimeout(500);

    // Should only have the original note (which is deleted)
    // Actually, deleted notes don't show in All Notes, so we should have 0 notes
    const allNotesList = page.locator('[data-testid="notes-list"]');
    const notesInAllNotes = allNotesList.locator('li');
    const allNotesCount = await notesInAllNotes.count();

    // We should have 0 notes (the one we created is deleted)
    expect(allNotesCount).toBe(0);
  });

  test('Bug 2: Dragging note from Recently Deleted should restore to target folder', async () => {
    // Create a test note first
    await createTestNote(page, 'Test Note for Drag Restore');

    // Create a test folder
    const folderPanel = page.locator('[data-testid="folder-panel"]');
    await folderPanel.click({ button: 'right' });
    await page.waitForTimeout(300);

    const newFolderMenuItem = page.locator('text="New Folder"');
    await newFolderMenuItem.click();
    await page.waitForTimeout(300);

    // Enter folder name
    const folderInput = page.locator('input[placeholder="Folder name"]');
    await folderInput.fill('Restore Target');
    await folderInput.press('Enter');
    await page.waitForTimeout(500);

    // Delete the note we created
    const allNotesFolder = page.locator('text="All Notes"').first();
    await allNotesFolder.click();
    await page.waitForTimeout(500);

    const notesList = page.locator('[data-testid="notes-list"]');
    const noteItem = notesList.locator('li').first();
    await noteItem.click({ button: 'right' });
    await page.waitForTimeout(300);

    const deleteMenuItem = page.locator('text="Delete"').first();
    await deleteMenuItem.click();
    await page.waitForTimeout(500);

    // Navigate to Recently Deleted
    const recentlyDeletedFolder = page.locator('text="Recently Deleted"').first();
    await recentlyDeletedFolder.click();
    await page.waitForTimeout(500);

    // Get the note in Recently Deleted
    const recentlyDeletedList = page.locator('[data-testid="notes-list"]');
    const deletedNote = recentlyDeletedList.locator('li').first();
    const noteTitle = await deletedNote.locator('.MuiListItemText-primary').textContent();

    // Try to drag the note to the Restore Target folder
    const targetFolder = page
      .locator('[data-testid="folder-item-"]')
      .filter({ hasText: 'Restore Target' });

    // Get bounding boxes
    const noteBox = await deletedNote.boundingBox();
    const folderBox = await targetFolder.boundingBox();

    if (noteBox && folderBox) {
      // Perform drag and drop
      await page.mouse.move(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2);
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    // Navigate to the Restore Target folder
    await targetFolder.click();
    await page.waitForTimeout(500);

    // Verify the note is now in the Restore Target folder and not deleted
    const targetNotesList = page.locator('[data-testid="notes-list"]');
    const restoredNote = targetNotesList.locator('li').filter({ hasText: noteTitle! });
    await expect(restoredNote).toBeVisible();

    // Navigate to Recently Deleted to verify it's no longer there
    await recentlyDeletedFolder.click();
    await page.waitForTimeout(500);

    const recentlyDeletedListAfter = page.locator('[data-testid="notes-list"]');
    const notesInRecentlyDeleted = recentlyDeletedListAfter.locator('li');
    await expect(notesInRecentlyDeleted).toHaveCount(0);
  });

  test('Bug 3: Note title should not change to "Untitled" when selected in Recently Deleted', async () => {
    // Create a test note first
    await createTestNote(page, 'Test Note for Title Check');

    // Delete the note we created
    const notesList = page.locator('[data-testid="notes-list"]');
    const noteItem = notesList.locator('li').first();

    // Get the original title
    const originalTitle = await noteItem.locator('.MuiListItemText-primary').textContent();

    await noteItem.click({ button: 'right' });
    await page.waitForTimeout(300);

    const deleteMenuItem = page.locator('text="Delete"').first();
    await deleteMenuItem.click();
    await page.waitForTimeout(500);

    // Navigate to Recently Deleted
    const recentlyDeletedFolder = page.locator('text="Recently Deleted"').first();
    await recentlyDeletedFolder.click();
    await page.waitForTimeout(500);

    // Click on the note to select it
    const recentlyDeletedList = page.locator('[data-testid="notes-list"]');
    const deletedNote = recentlyDeletedList.locator('li').first();
    await deletedNote.click();
    await page.waitForTimeout(500);

    // Verify the title in the list hasn't changed
    const currentTitle = await deletedNote.locator('.MuiListItemText-primary').textContent();
    expect(currentTitle).toBe(originalTitle);
    expect(currentTitle).not.toBe('Untitled Note');
    expect(currentTitle).not.toBe('Untitled');

    // Verify the editor shows the content (but is read-only)
    const editor = page.locator('.ProseMirror');
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Test Note for Title Check');
  });

  test('Bug 4: Changing folders should not change editor pane content', async () => {
    // Create first test note
    await createTestNote(page, 'First Test Note');

    // Create another note in a different folder
    // First create a folder
    const folderPanel = page.locator('[data-testid="folder-panel"]');
    await folderPanel.click({ button: 'right' });
    await page.waitForTimeout(300);

    const newFolderMenuItem = page.locator('text="New Folder"');
    await newFolderMenuItem.click();
    await page.waitForTimeout(300);

    const folderInput = page.locator('input[placeholder="Folder name"]');
    await folderInput.fill('Another Folder');
    await folderInput.press('Enter');
    await page.waitForTimeout(500);

    // Click on the new folder
    const newFolder = page
      .locator('[data-testid="folder-item-"]')
      .filter({ hasText: 'Another Folder' });
    await newFolder.click();
    await page.waitForTimeout(500);

    // Create a note in this folder
    const createButton = page.locator('button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    const anotherFolderNotesList = page.locator('[data-testid="notes-list"]');
    await expect(anotherFolderNotesList.locator('li').first()).toBeVisible();

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially('Note in Another Folder');
    await page.waitForTimeout(1000);

    // Go back to All Notes
    const allNotesFolder = page.locator('text="All Notes"').first();
    await allNotesFolder.click();
    await page.waitForTimeout(500);

    // Select the first note (from beforeEach)
    const allNotesList = page.locator('[data-testid="notes-list"]');
    const firstNote = allNotesList.locator('li').first();
    await firstNote.click();
    await page.waitForTimeout(500);

    // Verify we're showing the first note
    const editorContent1 = await editor.textContent();
    expect(editorContent1).toContain('First Test Note');

    // Now switch to the Another Folder
    await newFolder.click();
    await page.waitForTimeout(500);

    // Editor content should NOT have changed yet (no note is selected in the new folder)
    const editorContent2 = await editor.textContent();
    expect(editorContent2).toContain('First Test Note');

    // Notes list should show only the note in Another Folder
    const anotherFolderList = page.locator('[data-testid="notes-list"]');
    const notesInFolder = anotherFolderList.locator('li');
    await expect(notesInFolder).toHaveCount(1);

    const noteInFolderTitle = await notesInFolder
      .first()
      .locator('.MuiListItemText-primary')
      .textContent();
    expect(noteInFolderTitle).toContain('Note in Another Folder');
  });
});
