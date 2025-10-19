const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

test.describe('Folder Picker and Move Operations', () => {
  let electronApp;
  let window;
  let testDir;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-folder-picker-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    // Launch Electron app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--instance=test-' + Date.now()
      ],
      env: {
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000); // Wait for app to fully initialize
  });

  test.afterEach(async () => {
    // Close the app
    if (electronApp) {
      await electronApp.close();
    }

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  test('should show folder picker when clicking "Move to..." in context menu', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    // Right-click on the note
    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Move to..." in context menu
    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Verify folder picker modal is visible
    const modal = window.locator('#folderPickerModal');
    await expect(modal).toBeVisible();

    // Verify title says "Move to Folder"
    const title = window.locator('#folderPickerTitle');
    const titleText = await title.textContent();
    expect(titleText).toBe('Move to Folder');
  });

  test('should show folder picker when clicking "Duplicate to..." in context menu', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    // Right-click on the note
    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Duplicate to..." in context menu
    const contextMenu = window.locator('#noteContextMenu');
    const duplicateOption = contextMenu.locator('[data-action="duplicate"]');
    await duplicateOption.click();
    await window.waitForTimeout(300);

    // Verify folder picker modal is visible
    const modal = window.locator('#folderPickerModal');
    await expect(modal).toBeVisible();

    // Verify title says "Duplicate to Folder"
    const title = window.locator('#folderPickerTitle');
    const titleText = await title.textContent();
    expect(titleText).toBe('Duplicate to Folder');
  });

  test('should update title based on number of selected notes', async () => {
    // Create three notes
    for (let i = 1; i <= 3; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    // Select all three notes
    const notesList = window.locator('#notesList');
    await notesList.click();
    await window.keyboard.press('Meta+a');
    await window.waitForTimeout(300);

    // Right-click on one of the notes
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Move to..." in context menu
    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Verify title shows "Move 3 Notes to Folder"
    const title = window.locator('#folderPickerTitle');
    const titleText = await title.textContent();
    expect(titleText).toBe('Move 3 Notes to Folder');
  });

  test('should close folder picker when clicking X button', async () => {
    // Create a note and open folder picker
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Verify modal is visible
    const modal = window.locator('#folderPickerModal');
    await expect(modal).toBeVisible();

    // Click X button
    const closeBtn = window.locator('#folderPickerClose');
    await closeBtn.click();
    await window.waitForTimeout(300);

    // Verify modal is hidden
    const modalVisible = await modal.isVisible();
    expect(modalVisible).toBe(false);
  });

  test('should close folder picker when clicking Cancel button', async () => {
    // Create a note and open folder picker
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Verify modal is visible
    const modal = window.locator('#folderPickerModal');
    await expect(modal).toBeVisible();

    // Click Cancel button
    const cancelBtn = window.locator('#folderPickerCancel');
    await cancelBtn.click();
    await window.waitForTimeout(300);

    // Verify modal is hidden
    const modalVisible = await modal.isVisible();
    expect(modalVisible).toBe(false);
  });

  test('should close folder picker when pressing Escape', async () => {
    // Create a note and open folder picker
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Verify modal is visible
    const modal = window.locator('#folderPickerModal');
    await expect(modal).toBeVisible();

    // Press Escape
    await window.keyboard.press('Escape');
    await window.waitForTimeout(300);

    // Verify modal is hidden
    const modalVisible = await modal.isVisible();
    expect(modalVisible).toBe(false);
  });

  test('should display folders in picker tree', async () => {
    // Create a folder
    const folderId = await window.evaluate(async () => {
      const folderManager = window.app?.noteManager?.folderManager;
      if (folderManager) {
        const folder = await folderManager.createFolder('Test Folder', 'root');
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
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    // Open folder picker
    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Verify Test Folder appears in picker
    const pickerTree = window.locator('#folderPickerTree');
    const folderItem = pickerTree.locator('.folder-picker-item').filter({ hasText: 'Test Folder' });
    await expect(folderItem).toBeVisible();
  });

  test('should move note to selected folder (same directory)', async () => {
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

    // Create a note in All Notes (root)
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note to Move');
    await window.waitForTimeout(1000);

    // Verify note is in All Notes initially
    let notesList = window.locator('#notesList .note-item');
    let noteCount = await notesList.count();
    expect(noteCount).toBe(1);

    // Open folder picker
    const noteItem = window.locator('.note-item').filter({ hasText: 'Note to Move' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Click on Target Folder
    const pickerTree = window.locator('#folderPickerTree');
    const folderItem = pickerTree.locator('.folder-picker-item').filter({ hasText: 'Target Folder' });
    await folderItem.click();
    await window.waitForTimeout(500);

    // Verify note is no longer in All Notes
    notesList = window.locator('#notesList .note-item');
    noteCount = await notesList.count();
    expect(noteCount).toBe(0);

    // Navigate to Target Folder
    const targetFolder = window.locator('.folder-item').filter({ hasText: 'Target Folder' });
    await targetFolder.click();
    await window.waitForTimeout(500);

    // Verify note is now in Target Folder
    const movedNote = window.locator('.note-item').filter({ hasText: 'Note to Move' });
    await expect(movedNote).toBeVisible();
  });

  test('should move multiple notes to selected folder', async () => {
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

    // Create three notes
    for (let i = 1; i <= 3; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    // Select all three notes
    const notesList = window.locator('#notesList');
    await notesList.click();
    await window.keyboard.press('Meta+a');
    await window.waitForTimeout(300);

    // Open folder picker
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Click on Target Folder
    const pickerTree = window.locator('#folderPickerTree');
    const folderItem = pickerTree.locator('.folder-picker-item').filter({ hasText: 'Target Folder' });
    await folderItem.click();
    await window.waitForTimeout(500);

    // Verify no notes in All Notes
    let notesListItems = window.locator('#notesList .note-item');
    let noteCount = await notesListItems.count();
    expect(noteCount).toBe(0);

    // Navigate to Target Folder
    const targetFolder = window.locator('.folder-item').filter({ hasText: 'Target Folder' });
    await targetFolder.click();
    await window.waitForTimeout(500);

    // Verify all three notes are in Target Folder
    notesListItems = window.locator('#notesList .note-item');
    noteCount = await notesListItems.count();
    expect(noteCount).toBe(3);

    const note1Moved = window.locator('.note-item').filter({ hasText: 'Note 1' });
    const note2Moved = window.locator('.note-item').filter({ hasText: 'Note 2' });
    const note3Moved = window.locator('.note-item').filter({ hasText: 'Note 3' });

    await expect(note1Moved).toBeVisible();
    await expect(note2Moved).toBeVisible();
    await expect(note3Moved).toBeVisible();
  });

  test('should disable current folder for move operations', async () => {
    // Create a folder
    const folderId = await window.evaluate(async () => {
      const folderManager = window.app?.noteManager?.folderManager;
      if (folderManager) {
        const folder = await folderManager.createFolder('Current Folder', 'root');
        await window.app?.renderFolderTree();
        return folder.id;
      }
      return null;
    });

    expect(folderId).toBeTruthy();
    await window.waitForTimeout(500);

    // Navigate to Current Folder
    const currentFolder = window.locator('.folder-item').filter({ hasText: 'Current Folder' });
    await currentFolder.click();
    await window.waitForTimeout(500);

    // Create a note in Current Folder
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note in Current Folder');
    await window.waitForTimeout(1000);

    // Open folder picker
    const noteItem = window.locator('.note-item').filter({ hasText: 'Note in Current Folder' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const moveOption = contextMenu.locator('[data-action="move"]');
    await moveOption.click();
    await window.waitForTimeout(300);

    // Verify Current Folder is disabled and marked as current
    const pickerTree = window.locator('#folderPickerTree');
    const folderItem = pickerTree.locator('.folder-picker-item').filter({ hasText: 'Current Folder' });

    const hasDisabledClass = await folderItem.evaluate(el => el.classList.contains('disabled'));
    const hasCurrentClass = await folderItem.evaluate(el => el.classList.contains('current'));

    expect(hasDisabledClass).toBe(true);
    expect(hasCurrentClass).toBe(true);
  });

  test('should allow current folder for duplicate operations', async () => {
    // Create a folder
    const folderId = await window.evaluate(async () => {
      const folderManager = window.app?.noteManager?.folderManager;
      if (folderManager) {
        const folder = await folderManager.createFolder('Current Folder', 'root');
        await window.app?.renderFolderTree();
        return folder.id;
      }
      return null;
    });

    expect(folderId).toBeTruthy();
    await window.waitForTimeout(500);

    // Navigate to Current Folder
    const currentFolder = window.locator('.folder-item').filter({ hasText: 'Current Folder' });
    await currentFolder.click();
    await window.waitForTimeout(500);

    // Create a note in Current Folder
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note in Current Folder');
    await window.waitForTimeout(1000);

    // Open folder picker for duplicate
    const noteItem = window.locator('.note-item').filter({ hasText: 'Note in Current Folder' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    const contextMenu = window.locator('#noteContextMenu');
    const duplicateOption = contextMenu.locator('[data-action="duplicate"]');
    await duplicateOption.click();
    await window.waitForTimeout(300);

    // Verify Current Folder is NOT disabled (just marked as current)
    const pickerTree = window.locator('#folderPickerTree');
    const folderItem = pickerTree.locator('.folder-picker-item').filter({ hasText: 'Current Folder' });

    const hasDisabledClass = await folderItem.evaluate(el => el.classList.contains('disabled'));
    const hasCurrentClass = await folderItem.evaluate(el => el.classList.contains('current'));

    expect(hasDisabledClass).toBe(false);
    expect(hasCurrentClass).toBe(true);
  });
});
