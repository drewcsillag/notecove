const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Cross-Directory Duplicate Operations', () => {
  let electronApp;
  let window;
  let testDir;
  let primaryDir;
  let secondaryDir;

  test.beforeEach(async () => {
    // Create test directories
    testDir = path.join(os.tmpdir(), 'notecove-cross-dir-duplicate-' + Date.now());
    primaryDir = path.join(testDir, 'primary');
    secondaryDir = path.join(testDir, 'secondary');
    await fs.mkdir(primaryDir, { recursive: true });
    await fs.mkdir(secondaryDir, { recursive: true });

    // Launch app
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        '--instance=cross-dir-duplicate-' + Date.now()
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

  test('should duplicate note within same directory', async () => {
    // Create a folder
    const folderId = await window.evaluate(async () => {
      const folderManager = window.app?.noteManager?.folderManager;
      if (folderManager) {
        const folder = await folderManager.createFolder('Target Folder', 'root');
        await window.app?.renderFolderTree();
        return folder.id;
      }
      return null;
    });

    expect(folderId).toBeTruthy();
    await window.waitForTimeout(500);

    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Original Note Content');
    await window.waitForTimeout(1000);

    // Verify note exists in All Notes
    const allNotesFolder = window.locator('.folder-item').filter({ hasText: 'All Notes' }).first();
    await allNotesFolder.click();
    await window.waitForTimeout(300);

    let notesList = window.locator('.note-item');
    expect(await notesList.count()).toBe(1);

    // Right-click on note and select "Duplicate to..."
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const duplicateOption = contextMenu.locator('[data-action="duplicate"]');
    await duplicateOption.click();
    await window.waitForTimeout(300);

    // Select Target Folder in folder picker
    const pickerTree = window.locator('#folderPickerTree');
    const folderItem = pickerTree.locator('.folder-picker-item').filter({ hasText: 'Target Folder' });
    await folderItem.click();
    await window.waitForTimeout(1000);

    // Verify original note still exists in All Notes
    // Note: Both the original and duplicate will show in All Notes since they're in the same sync directory
    await allNotesFolder.click();
    await window.waitForTimeout(300);
    notesList = window.locator('.note-item');
    expect(await notesList.count()).toBe(2); // Original + duplicate both in same directory

    // Navigate to Target Folder and verify duplicate exists
    const targetFolder = window.locator('.folder-item').filter({ hasText: 'Target Folder' });
    await targetFolder.click();
    await window.waitForTimeout(500);

    const duplicateNote = window.locator('.note-item').first();
    await expect(duplicateNote).toBeVisible();

    // Verify content was duplicated
    await duplicateNote.click();
    await window.waitForTimeout(300);
    const content = await window.locator('.ProseMirror').textContent();
    expect(content).toContain('Original Note Content');
  });

  test('should duplicate note across sync directories', async () => {
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
    await window.keyboard.type('Test Cross-Directory Duplicate');
    await window.waitForTimeout(1000);

    // Verify note was created in primary (check count)
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCount)).toBe(1);

    // Right-click on note
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Duplicate to..."
    const contextMenu = window.locator('#noteContextMenu');
    const duplicateOption = contextMenu.locator('[data-action="duplicate"]');
    await duplicateOption.click();
    await window.waitForTimeout(300);

    // Verify folder picker is visible
    const modal = window.locator('#folderPickerModal');
    await expect(modal).toBeVisible();

    // Click on "All Notes" in the secondary sync directory (second instance)
    const secondaryAllNotesPicker = window.locator('.folder-picker-item').filter({ hasText: 'All Notes' }).nth(1);
    await secondaryAllNotesPicker.click();
    await window.waitForTimeout(1000);

    // Verify original note still exists in primary directory
    const primaryCountAfter = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCountAfter)).toBe(1);

    // Verify duplicate appears in secondary directory
    const secondaryAllNotesFolder = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const secondaryCount = await secondaryAllNotesFolder.locator('.folder-count').textContent();
    expect(parseInt(secondaryCount)).toBe(1);

    // Click on secondary directory's All Notes to see the duplicate
    await secondaryAllNotesFolder.click();
    await window.waitForTimeout(300);

    // Verify duplicate title appears in notes list
    const noteTitles = await window.locator('.note-item .note-title').allTextContents();
    expect(noteTitles.some(title => title.includes('Test Cross-Directory Duplicate'))).toBe(true);
  });

  test('should duplicate multiple notes to same directory', async () => {
    // Create a target folder
    const folderId = await window.evaluate(async () => {
      const folderManager = window.app?.noteManager?.folderManager;
      if (folderManager) {
        const folder = await folderManager.createFolder('Target Folder', 'root');
        await window.app?.renderFolderTree();
        return folder.id;
      }
      return null;
    });

    expect(folderId).toBeTruthy();
    await window.waitForTimeout(500);

    // Create three notes
    for (let i = 1; i <= 3; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.locator('.ProseMirror').click();
      await window.waitForTimeout(100);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    // Select all three notes
    const notesList = window.locator('#notesList');
    await notesList.click();
    await window.keyboard.press('Meta+a');
    await window.waitForTimeout(300);

    // Verify 3 notes selected
    const selectionBadge = window.locator('.selection-badge');
    const badgeText = await selectionBadge.textContent();
    expect(badgeText).toContain('3 notes');

    // Right-click on one of the notes
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Duplicate to..."
    const contextMenu = window.locator('#noteContextMenu');
    const duplicateOption = contextMenu.locator('[data-action="duplicate"]');
    await duplicateOption.click();
    await window.waitForTimeout(300);

    // Click on Target Folder
    const pickerTree = window.locator('#folderPickerTree');
    const folderItem = pickerTree.locator('.folder-picker-item').filter({ hasText: 'Target Folder' });
    await folderItem.click();
    await window.waitForTimeout(1000);

    // Verify all 6 notes in All Notes (3 originals + 3 duplicates in same directory)
    const allNotesFolder = window.locator('.folder-item').filter({ hasText: 'All Notes' }).first();
    await allNotesFolder.click();
    await window.waitForTimeout(300);
    let notesListItems = window.locator('#notesList .note-item');
    let noteCount = await notesListItems.count();
    expect(noteCount).toBe(6); // 3 originals + 3 duplicates

    // Navigate to Target Folder
    const targetFolder = window.locator('.folder-item').filter({ hasText: 'Target Folder' });
    await targetFolder.click();
    await window.waitForTimeout(500);

    // Verify all three duplicates are in Target Folder
    notesListItems = window.locator('#notesList .note-item');
    noteCount = await notesListItems.count();
    expect(noteCount).toBe(3);

    // Verify all note titles exist
    const noteTitles = await window.locator('.note-item .note-title').allTextContents();
    expect(noteTitles.some(title => title.includes('Note 1'))).toBe(true);
    expect(noteTitles.some(title => title.includes('Note 2'))).toBe(true);
    expect(noteTitles.some(title => title.includes('Note 3'))).toBe(true);
  });

  test('should duplicate multiple notes across sync directories', async () => {
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

    // Create two notes in primary directory
    for (let i = 1; i <= 2; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.locator('.ProseMirror').click();
      await window.waitForTimeout(100);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    // Verify 2 notes in primary
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    let primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCount)).toBe(2);

    // Select both notes
    const notesList = window.locator('#notesList');
    await notesList.click();
    await window.keyboard.press('Meta+a');
    await window.waitForTimeout(300);

    // Right-click on one of the notes
    const note1 = window.locator('.note-item').first();
    await note1.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Duplicate to..."
    const contextMenu = window.locator('#noteContextMenu');
    const duplicateOption = contextMenu.locator('[data-action="duplicate"]');
    await duplicateOption.click();
    await window.waitForTimeout(300);

    // Click on "All Notes" in secondary directory
    const secondaryAllNotesPicker = window.locator('.folder-picker-item').filter({ hasText: 'All Notes' }).nth(1);
    await secondaryAllNotesPicker.click();
    await window.waitForTimeout(1000);

    // Verify original 2 notes still in primary directory
    primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCount)).toBe(2);

    // Verify 2 duplicates in secondary directory
    const secondaryAllNotesFolder = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const secondaryCount = await secondaryAllNotesFolder.locator('.folder-count').textContent();
    expect(parseInt(secondaryCount)).toBe(2);
  });

  test('should generate new UUIDs for duplicated notes', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Original Note');
    await window.waitForTimeout(1000);

    // Get original note ID
    const originalId = await window.evaluate(() => {
      const note = Array.from(window.app?.noteManager?.notes.values())[0];
      return note?.id;
    });

    expect(originalId).toBeTruthy();

    // Duplicate note to All Notes (same folder)
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const duplicateOption = contextMenu.locator('[data-action="duplicate"]');
    await duplicateOption.click();
    await window.waitForTimeout(300);

    const pickerTree = window.locator('#folderPickerTree');
    const allNotesItem = pickerTree.locator('.folder-picker-item').filter({ hasText: 'All Notes' }).first();
    await allNotesItem.click();
    await window.waitForTimeout(1000);

    // Get all note IDs
    const noteIds = await window.evaluate(() => {
      return Array.from(window.app?.noteManager?.notes.values()).map(note => note.id);
    });

    expect(noteIds.length).toBe(2);
    expect(noteIds).toContain(originalId);

    // Verify duplicate has different UUID
    const duplicateId = noteIds.find(id => id !== originalId);
    expect(duplicateId).toBeTruthy();
    expect(duplicateId).not.toBe(originalId);
  });
});
