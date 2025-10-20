const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Cross-Directory Move - Simple Test', () => {
  let electronApp;
  let window;
  let testDir;
  let primaryDir;
  let secondaryDir;

  test.beforeEach(async () => {
    // Create test directories
    testDir = path.join(os.tmpdir(), 'notecove-cross-dir-simple-' + Date.now());
    primaryDir = path.join(testDir, 'primary');
    secondaryDir = path.join(testDir, 'secondary');
    await fs.mkdir(primaryDir, { recursive: true });
    await fs.mkdir(secondaryDir, { recursive: true });

    // Launch app
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        '--instance=cross-dir-simple-' + Date.now()
      ],
      env: {
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  test('should move note across sync directories', async () => {
    // Add second sync directory
    await window.click('.settings-btn');
    await window.waitForTimeout(300);

    const addDirBtn = window.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window.waitForTimeout(300);

    const pathInput = window.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(secondaryDir);

    const nameInput = window.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Secondary');

    const addBtn = window.locator('button#confirmAddDir');
    await addBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button#settingsClose');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Create a note in primary directory
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Test Cross-Directory Note');
    await window.waitForTimeout(1000);

    // Verify note was created (check the count badge in All Notes)
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const count = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(count)).toBe(1);

    // Verify note appears in notes list
    const notesList = window.locator('.note-item');
    expect(await notesList.count()).toBeGreaterThanOrEqual(1);

    // Right-click on note
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Move to..."
    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Verify folder picker is visible
    const modal = window.locator('#folderPickerModal');
    await expect(modal).toBeVisible();

    // Click on "All Notes" in the secondary sync directory
    const secondaryAllNotesPicker = window.locator('.folder-picker-item').filter({ hasText: 'All Notes' }).nth(1);
    await secondaryAllNotesPicker.click();
    await window.waitForTimeout(500);

    // Should show confirmation dialog
    const confirmDialog = window.locator('#crossDirectoryMoveDialog');
    await expect(confirmDialog).toBeVisible();

    // Confirm the move
    await window.click('#crossDirectoryMoveConfirm');
    await window.waitForTimeout(1000);

    // Verify note moved from primary to secondary (check folder counts)
    const primaryAllNotesAfter = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const primaryCountAfter = await primaryAllNotesAfter.locator('.folder-count').textContent();
    expect(parseInt(primaryCountAfter)).toBe(0);

    // NOTE: The deleted version is saved to the source directory's filesystem
    // for other instances to see via CRDT sync, but it won't appear in this
    // instance's UI because this.notes only has one entry per note ID.
    // The deleted state will be visible to other instances that load from
    // the source directory.

    // Verify note appears in secondary directory
    const secondaryAllNotesFolder = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const secondaryCount = await secondaryAllNotesFolder.locator('.folder-count').textContent();
    expect(parseInt(secondaryCount)).toBe(1);

    // Click on secondary directory's All Notes to see the note
    await secondaryAllNotesFolder.click();
    await window.waitForTimeout(300);

    // Verify note title appears in notes list
    const noteTitles = await window.locator('.note-item .note-title').allTextContents();
    expect(noteTitles.some(title => title.includes('Test Cross-Directory Note'))).toBe(true);
  });
});
