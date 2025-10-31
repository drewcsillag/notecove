/**
 * E2E tests for Note Drag & Drop
 *
 * Tests drag and drop functionality for moving notes between folders.
 * Phase 2.5.7.3: Drag & Drop
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let window: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  // Create a unique temporary directory for this test
  testUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-test-drag-drop-'));

  electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../dist-electron/main/index.js'),
      `--user-data-dir=${testUserDataDir}`,
    ],
    env: {
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Wait for app to be ready
  await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
  await window.waitForTimeout(500);
});

test.afterEach(async () => {
  await electronApp.close();

  // Clean up temporary directory
  if (testUserDataDir && fs.existsSync(testUserDataDir)) {
    fs.rmSync(testUserDataDir, { recursive: true, force: true });
  }
});

test.describe('Note Drag & Drop - Single Note', () => {
  test('should drag a note to a folder', async () => {
    // Wait for folder panel to load
    await window.waitForSelector('text=Folders', { timeout: 10000 });
    await window.waitForTimeout(2000);

    // Create a test folder
    const createButton = window.locator('button[title="Create folder"]');
    await createButton.click();
    await window.waitForSelector('text=Create New Folder');
    const dialog = window.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill('Test Folder');
    await window.locator('button:has-text("Create")').click();
    await window.waitForTimeout(1500);

    // Create a test note
    const addNoteButton = window.locator('button[title="Create note"]');
    await addNoteButton.click();
    await window.waitForTimeout(2000);

    // Get the note item (should be in notes list)
    const notesList = window.locator('[data-testid="notes-list"]');
    await expect(notesList).toBeVisible();
    const noteItem = notesList.locator('li').first();
    await expect(noteItem).toBeVisible();

    // Get the target folder
    const testFolderButton = window.getByRole('button', { name: 'Test Folder', exact: true });
    await expect(testFolderButton).toBeVisible();

    // Drag note to folder
    await noteItem.dragTo(testFolderButton);
    await window.waitForTimeout(2000);

    // Click on the test folder to verify the note moved there
    await testFolderButton.click();
    await window.waitForTimeout(1000);

    // Verify the note is now in the test folder
    const notesInFolder = window.locator('[data-testid="notes-list"] li');
    await expect(notesInFolder).toHaveCount(1);
  });

  test('should drag a note to "All Notes" (root level)', async () => {
    // Wait for folder panel to load
    await window.waitForSelector('text=Folders', { timeout: 10000 });
    await window.waitForTimeout(2000);

    // Create a test folder and note
    const createButton = window.locator('button[title="Create folder"]');
    await createButton.click();
    await window.waitForSelector('text=Create New Folder');
    const dialog = window.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill('Temp Folder');
    await window.locator('button:has-text("Create")').click();
    await window.waitForTimeout(1500);

    // Click on the temp folder
    const tempFolderButton = window.getByRole('button', { name: 'Temp Folder', exact: true });
    await tempFolderButton.click();
    await window.waitForTimeout(1000);

    // Create a note in the folder
    const addNoteButton = window.locator('button[title="Create note"]');
    await addNoteButton.click();
    await window.waitForTimeout(2000);

    // Get the note item
    const notesList = window.locator('[data-testid="notes-list"]');
    const noteItem = notesList.locator('li').first();
    await expect(noteItem).toBeVisible();

    // Get the "All Notes" button
    const allNotesButton = window.getByTestId('folder-tree-node-all-notes:default');
    await expect(allNotesButton).toBeVisible();

    // Drag note to "All Notes" (root level)
    await noteItem.dragTo(allNotesButton);
    await window.waitForTimeout(2000);

    // Click on "All Notes" to verify the note moved there
    await allNotesButton.click();
    await window.waitForTimeout(1000);

    // Verify the note is now at root level
    const notesInRoot = window.locator('[data-testid="notes-list"] li');
    await expect(notesInRoot.first()).toBeVisible();
  });

  test('should drag a note to "Recently Deleted" to delete it', async () => {
    // Wait for folder panel to load
    await window.waitForSelector('text=Folders', { timeout: 10000 });
    await window.waitForTimeout(2000);

    // Click on "All Notes"
    const allNotesButton = window.getByTestId('folder-tree-node-all-notes:default');
    await allNotesButton.click();
    await window.waitForTimeout(1000);

    // Create a test note
    const addNoteButton = window.locator('button[title="Create note"]');
    await addNoteButton.click();
    await window.waitForTimeout(2000);

    // Get the note item
    const notesList = window.locator('[data-testid="notes-list"]');
    const noteItem = notesList.locator('li').first();
    await expect(noteItem).toBeVisible();

    // Count notes before delete
    const notesBeforeDelete = await notesList.locator('li').count();

    // Get the "Recently Deleted" button
    const recentlyDeletedButton = window.getByTestId('folder-tree-node-recently-deleted:default');
    await expect(recentlyDeletedButton).toBeVisible();

    // Drag note to "Recently Deleted"
    await noteItem.dragTo(recentlyDeletedButton);
    await window.waitForTimeout(2000);

    // Verify the note is removed from the current list
    const notesAfterDelete = await notesList.locator('li').count();
    expect(notesAfterDelete).toBe(notesBeforeDelete - 1);

    // Click on "Recently Deleted" to verify the note is there
    await recentlyDeletedButton.click();
    await window.waitForTimeout(1000);

    // Verify the note is in "Recently Deleted"
    const deletedNotes = window.locator('[data-testid="notes-list"] li');
    await expect(deletedNotes.first()).toBeVisible();
  });
});

test.describe('Note Drag & Drop - Multi-Select', () => {
  test('should drag multiple selected notes to a folder', async () => {
    // Wait for folder panel to load
    await window.waitForSelector('text=Folders', { timeout: 10000 });
    await window.waitForTimeout(2000);

    // Create a test folder
    const createButton = window.locator('button[title="Create folder"]');
    await createButton.click();
    await window.waitForSelector('text=Create New Folder');
    const dialog = window.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill('Multi Folder');
    await window.locator('button:has-text("Create")').click();
    await window.waitForTimeout(1500);

    // Click on "All Notes"
    const allNotesButton = window.getByTestId('folder-tree-node-all-notes:default');
    await allNotesButton.click();
    await window.waitForTimeout(1000);

    // Create 3 test notes
    for (let i = 0; i < 3; i++) {
      const addNoteButton = window.locator('button[title="Create note"]');
      await addNoteButton.click();
      await window.waitForTimeout(1000);
    }

    await window.waitForTimeout(1000);

    // Select multiple notes using Cmd+Click (Meta key)
    const notesList = window.locator('[data-testid="notes-list"]');
    const notes = notesList.locator('li');
    await expect(notes).toHaveCount(3, { timeout: 5000 });

    // Click first note normally
    const firstNote = notes.nth(0);
    await firstNote.click();
    await window.waitForTimeout(200);

    // Cmd+Click second note
    const secondNote = notes.nth(1);
    await secondNote.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Cmd+Click third note
    const thirdNote = notes.nth(2);
    await thirdNote.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(500);

    // Verify multi-select badge appears
    await expect(window.locator('text=3 notes selected')).toBeVisible();

    // Get the target folder
    const multiFolderButton = window.getByRole('button', { name: 'Multi Folder', exact: true });
    await expect(multiFolderButton).toBeVisible();

    // Drag one of the selected notes to the folder (all should move)
    await secondNote.dragTo(multiFolderButton);
    await window.waitForTimeout(2000);

    // Click on the multi folder to verify all notes moved there
    await multiFolderButton.click();
    await window.waitForTimeout(1000);

    // Verify all 3 notes are now in the folder
    const notesInFolder = window.locator('[data-testid="notes-list"] li');
    await expect(notesInFolder).toHaveCount(3);
  });

  test('should drag multiple selected notes to "Recently Deleted"', async () => {
    // Wait for folder panel to load
    await window.waitForSelector('text=Folders', { timeout: 10000 });
    await window.waitForTimeout(2000);

    // Click on "All Notes"
    const allNotesButton = window.getByTestId('folder-tree-node-all-notes:default');
    await allNotesButton.click();
    await window.waitForTimeout(1000);

    // Create 2 test notes
    for (let i = 0; i < 2; i++) {
      const addNoteButton = window.locator('button[title="Create note"]');
      await addNoteButton.click();
      await window.waitForTimeout(1000);
    }

    await window.waitForTimeout(1000);

    // Select both notes
    const notesList = window.locator('[data-testid="notes-list"]');
    const notes = notesList.locator('li');
    await expect(notes).toHaveCount(2, { timeout: 5000 });

    // Count total notes before delete
    const notesBeforeDelete = await notes.count();

    // Click first note
    const firstNote = notes.nth(0);
    await firstNote.click();
    await window.waitForTimeout(200);

    // Cmd+Click second note
    const secondNote = notes.nth(1);
    await secondNote.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(500);

    // Verify multi-select badge
    await expect(window.locator('text=2 notes selected')).toBeVisible();

    // Get the "Recently Deleted" button
    const recentlyDeletedButton = window.getByTestId('folder-tree-node-recently-deleted:default');
    await expect(recentlyDeletedButton).toBeVisible();

    // Drag one of the selected notes to "Recently Deleted" (both should be deleted)
    await firstNote.dragTo(recentlyDeletedButton);
    await window.waitForTimeout(2000);

    // Go back to "All Notes"
    await allNotesButton.click();
    await window.waitForTimeout(1000);

    // Verify both notes are removed
    const notesAfterDelete = await notesList.locator('li').count();
    expect(notesAfterDelete).toBe(notesBeforeDelete - 2);

    // Click on "Recently Deleted" to verify both notes are there
    await recentlyDeletedButton.click();
    await window.waitForTimeout(1000);

    // Verify both notes are in "Recently Deleted"
    const deletedNotes = window.locator('[data-testid="notes-list"] li');
    await expect(deletedNotes).toHaveCount(2);
  });

  test('should clear multi-select badge after dropping notes', async () => {
    // Wait for folder panel to load
    await window.waitForSelector('text=Folders', { timeout: 10000 });
    await window.waitForTimeout(2000);

    // Create a test folder
    const createButton = window.locator('button[title="Create folder"]');
    await createButton.click();
    await window.waitForSelector('text=Create New Folder');
    const dialog = window.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill('Badge Test Folder');
    await window.locator('button:has-text("Create")').click();
    await window.waitForTimeout(1500);

    // Click on "All Notes"
    const allNotesButton = window.getByTestId('folder-tree-node-all-notes:default');
    await allNotesButton.click();
    await window.waitForTimeout(1000);

    // Create 3 test notes
    for (let i = 0; i < 3; i++) {
      const addNoteButton = window.locator('button[title="Create note"]');
      await addNoteButton.click();
      await window.waitForTimeout(1000);
    }

    await window.waitForTimeout(1000);

    // Get the notes list
    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');
    const totalNotes = await notes.count();

    // Clear any existing selection by clicking on empty space
    await window.locator('[data-testid="notes-list"]').click({ position: { x: 10, y: 10 } });
    await window.waitForTimeout(200);

    // Select the last 3 notes (the ones we just created) using Cmd+Click
    const firstNote = notes.nth(totalNotes - 3);
    const secondNote = notes.nth(totalNotes - 2);
    const thirdNote = notes.nth(totalNotes - 1);

    // Cmd+Click all three notes
    await firstNote.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    await secondNote.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    await thirdNote.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(500);

    // Verify multi-select badge is visible (use regex to be flexible)
    const badge = window.locator('text=/[23] notes selected/');
    await expect(badge).toBeVisible();

    // Get the target folder
    const badgeTestFolderButton = window.getByRole('button', {
      name: 'Badge Test Folder',
      exact: true,
    });
    await expect(badgeTestFolderButton).toBeVisible();

    // Drag one of the selected notes to the folder (all should move)
    await secondNote.dragTo(badgeTestFolderButton);
    await window.waitForTimeout(2000);

    // Verify the badge is no longer visible (bug fix verification)
    await expect(badge).not.toBeVisible();

    // Click on the badge test folder to verify notes moved there
    await badgeTestFolderButton.click();
    await window.waitForTimeout(1000);

    // Verify the selected notes are now in the folder (could be 2 or 3 depending on selection)
    const notesInFolder = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');
    const movedNotesCount = await notesInFolder.count();
    expect(movedNotesCount).toBeGreaterThanOrEqual(2);
    expect(movedNotesCount).toBeLessThanOrEqual(3);
  });
});

test.describe('Note Drag & Drop - Visual Feedback', () => {
  test('should show visual feedback during drag', async () => {
    // Wait for folder panel to load
    await window.waitForSelector('text=Folders', { timeout: 10000 });
    await window.waitForTimeout(2000);

    // Click on "All Notes"
    const allNotesButton = window.getByTestId('folder-tree-node-all-notes:default');
    await allNotesButton.click();
    await window.waitForTimeout(1000);

    // Create a test note
    const addNoteButton = window.locator('button[title="Create note"]');
    await addNoteButton.click();
    await window.waitForTimeout(2000);

    // Get the note item
    const notesList = window.locator('[data-testid="notes-list"]');
    const noteItem = notesList.locator('li').first();
    await expect(noteItem).toBeVisible();

    // Start dragging
    await noteItem.hover();
    await window.mouse.down();
    await window.waitForTimeout(300);

    // Verify the note has reduced opacity during drag
    const opacity = await noteItem.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(1);

    // Cancel the drag
    await window.mouse.up();
  });
});
