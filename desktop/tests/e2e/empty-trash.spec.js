import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

test.describe('Empty Trash Feature - Electron Mode', () => {
  let testDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-empty-trash-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    // Launch Electron app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close the app
    if (electronApp) {
      await electronApp.close();
    }

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean up test directory:', err);
    }
  });

  test('should show Empty Trash button when viewing trash folder with deleted notes', async () => {
    // Create a new note
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    // Add content
    await editor.fill('Test note to delete');
    await window.waitForTimeout(1000);

    // Delete the note
    await window.click('#deleteNoteBtn');
    await window.waitForTimeout(500);

    // Confirm the delete dialog
    const deleteConfirmButton = window.locator('button:has-text("Move to Trash")');
    await deleteConfirmButton.click();
    await window.waitForTimeout(1000);

    // Click on "Recently Deleted" folder
    console.log('Clicking on Recently Deleted folder...');
    await window.click('.folder-item:has-text("Recently Deleted")');
    await window.waitForTimeout(1000);

    // Check if Empty Trash button is visible
    console.log('Checking for Empty Trash button...');
    const emptyTrashButton = window.locator('button.empty-trash-btn');

    // Log the button count
    const count = await emptyTrashButton.count();
    console.log(`Found ${count} empty trash buttons`);

    // Log the entire notes list HTML for debugging
    const notesList = await window.locator('.notes-list').innerHTML();
    console.log('Notes list HTML (first 500 chars):', notesList.substring(0, 500));

    // Expect button to be visible
    await expect(emptyTrashButton).toBeVisible();
    await expect(emptyTrashButton).toContainText('Empty Trash');
  });

  test('should empty trash when button is clicked and update folder count', async () => {
    // Create two notes and delete them
    for (let i = 1; i <= 2; i++) {
      await window.click('#newNoteBtn');
      const editor = window.locator('#editor .ProseMirror');
      await editor.waitFor({ state: 'visible' });
      await window.waitForTimeout(500);
      await editor.fill(`Test note ${i}`);
      await window.waitForTimeout(1000);
      await window.click('#deleteNoteBtn');
      await window.waitForTimeout(500);
      // Confirm the delete dialog
      const deleteConfirmButton = window.locator('button:has-text("Move to Trash")');
      await deleteConfirmButton.click();
      await window.waitForTimeout(1000);
    }

    // Go to trash
    await window.click('.folder-item:has-text("Recently Deleted")');
    await window.waitForTimeout(1000);

    // Verify we have 2 notes in trash
    const notesInTrash = await window.locator('.note-item').count();
    console.log(`Notes in trash: ${notesInTrash}`);
    expect(notesInTrash).toBe(2);

    // Verify trash folder shows count of 2
    const trashFolderBefore = window.locator('.folder-item:has-text("Recently Deleted")');
    await expect(trashFolderBefore).toContainText('2');
    console.log('Trash folder shows count of 2');

    // Click Empty Trash button
    const emptyTrashButton = window.locator('button.empty-trash-btn');
    await expect(emptyTrashButton).toBeVisible();
    await expect(emptyTrashButton).toContainText('Empty Trash (2)');
    await emptyTrashButton.click();
    await window.waitForTimeout(500);

    // Confirm the dialog
    const dialogConfirmButton = window.locator('#dialogConfirm');
    await expect(dialogConfirmButton).toBeVisible();
    await expect(dialogConfirmButton).toContainText('Empty Trash');
    await dialogConfirmButton.click();
    await window.waitForTimeout(1500);

    // Verify trash is now empty
    const notesAfterEmpty = await window.locator('.note-item').count();
    console.log(`Notes after empty: ${notesAfterEmpty}`);
    expect(notesAfterEmpty).toBe(0);

    // Verify button is no longer visible (no notes in trash)
    await expect(emptyTrashButton).not.toBeVisible();

    // Verify trash folder count updated to 0 immediately
    const trashFolderAfter = window.locator('.folder-item:has-text("Recently Deleted")');
    await expect(trashFolderAfter).toContainText('0');
    console.log('Trash folder count updated to 0 immediately');
  });

  test('should empty trash via context menu and update folder count immediately', async () => {
    // Create and delete two notes
    for (let i = 1; i <= 2; i++) {
      await window.click('#newNoteBtn');
      const editor = window.locator('#editor .ProseMirror');
      await editor.waitFor({ state: 'visible' });
      await window.waitForTimeout(500);
      await editor.fill(`Test note ${i} for context menu`);
      await window.waitForTimeout(1000);
      await window.click('#deleteNoteBtn');
      await window.waitForTimeout(500);
      // Confirm the delete dialog
      const deleteConfirmButton = window.locator('button:has-text("Move to Trash")');
      await deleteConfirmButton.click();
      await window.waitForTimeout(1000);
    }

    // Verify notes are in trash by checking trash count
    const trashFolderBefore = window.locator('.folder-item:has-text("Recently Deleted")');
    await expect(trashFolderBefore).toContainText('2');
    console.log('2 notes confirmed in trash');

    // Right-click on "Recently Deleted" folder
    const trashFolder = window.locator('.folder-item:has-text("Recently Deleted")');
    await trashFolder.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Verify context menu appeared and Empty Trash option is visible
    const contextMenu = window.locator('#folderContextMenu');
    await expect(contextMenu).toBeVisible();
    console.log('Context menu appeared');

    const emptyTrashMenuItem = window.locator('.context-menu-item[data-action="empty-trash"]');
    await expect(emptyTrashMenuItem).toBeVisible();
    console.log('Empty Trash menu item is visible');

    // Click Empty Trash menu item
    await emptyTrashMenuItem.click();
    await window.waitForTimeout(500);

    // Confirm the dialog
    const dialogConfirmButton = window.locator('#dialogConfirm');
    await expect(dialogConfirmButton).toBeVisible();
    await expect(dialogConfirmButton).toContainText('Empty Trash');
    await dialogConfirmButton.click();
    await window.waitForTimeout(1500);

    // Verify trash folder count updated to 0 immediately (without clicking on folder)
    const trashFolderAfter = window.locator('.folder-item:has-text("Recently Deleted")');
    await expect(trashFolderAfter).toContainText('0');
    console.log('Trash folder count updated to 0 immediately after context menu action');

    // Click on trash to view it and verify it's empty
    await window.click('.folder-item:has-text("Recently Deleted")');
    await window.waitForTimeout(500);
    const notesCount = await window.locator('.note-item').count();
    console.log(`Notes in trash after context menu delete: ${notesCount}`);
    expect(notesCount).toBe(0);

    // Verify Empty Trash button is not visible (no notes)
    const emptyTrashButton = window.locator('button.empty-trash-btn');
    await expect(emptyTrashButton).not.toBeVisible();
  });
});
