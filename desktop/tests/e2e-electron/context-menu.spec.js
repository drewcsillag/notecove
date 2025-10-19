const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

test.describe('Note Context Menu', () => {
  let electronApp;
  let window;
  let testDir;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-context-menu-test-' + Date.now());
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

  test('should show context menu on right-click', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    // Right-click on the note
    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Verify context menu is visible
    const contextMenu = window.locator('#noteContextMenu');
    await expect(contextMenu).toBeVisible();

    // Verify menu has expected options
    const newNoteOption = contextMenu.locator('[data-action="new"]');
    const deleteOption = contextMenu.locator('[data-action="delete"]');

    await expect(newNoteOption).toBeVisible();
    await expect(deleteOption).toBeVisible();
  });

  test('should select note when right-clicking unselected note', async () => {
    // Create two notes
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 1');
    await window.waitForTimeout(1000);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 2');
    await window.waitForTimeout(1000);

    // Select note 1 with Cmd+Click
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    // Verify note 1 is selected
    let hasSelected = await note1.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(true);

    // Right-click on unselected note 2
    const note2 = window.locator('.note-item').filter({ hasText: 'Note 2' });
    await note2.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Verify only note 2 is selected now
    hasSelected = await note1.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(false);

    hasSelected = await note2.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(true);

    // Verify badge shows "1 note selected"
    const badge = window.locator('#selectionBadge');
    const badgeText = await badge.textContent();
    expect(badgeText).toBe('1 note selected');
  });

  test('should keep selection when right-clicking selected note', async () => {
    // Create two notes
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 1');
    await window.waitForTimeout(1000);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 2');
    await window.waitForTimeout(1000);

    // Select both notes with Cmd+Click
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    const note2 = window.locator('.note-item').filter({ hasText: 'Note 2' });
    await note2.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    // Verify both are selected
    let hasSelected1 = await note1.evaluate(el => el.classList.contains('selected'));
    let hasSelected2 = await note2.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected1).toBe(true);
    expect(hasSelected2).toBe(true);

    // Right-click on note 1 (which is already selected)
    await note1.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Verify both notes are still selected
    hasSelected1 = await note1.evaluate(el => el.classList.contains('selected'));
    hasSelected2 = await note2.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected1).toBe(true);
    expect(hasSelected2).toBe(true);

    // Verify badge shows "2 notes selected"
    const badge = window.locator('#selectionBadge');
    const badgeText = await badge.textContent();
    expect(badgeText).toBe('2 notes selected');
  });

  test('should hide menu when clicking outside', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    // Right-click to show menu
    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Verify menu is visible
    const contextMenu = window.locator('#noteContextMenu');
    await expect(contextMenu).toBeVisible();

    // Click on the editor area (outside the menu)
    const editor = window.locator('.ProseMirror');
    await editor.click();
    await window.waitForTimeout(300);

    // Verify menu is hidden
    const menuVisible = await contextMenu.isVisible();
    expect(menuVisible).toBe(false);
  });

  test('should hide menu when pressing Escape', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    // Right-click to show menu
    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Verify menu is visible
    const contextMenu = window.locator('#noteContextMenu');
    await expect(contextMenu).toBeVisible();

    // Press Escape
    await window.keyboard.press('Escape');
    await window.waitForTimeout(300);

    // Verify menu is hidden
    const menuVisible = await contextMenu.isVisible();
    expect(menuVisible).toBe(false);
  });

  test('should create new note via context menu', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Existing Note');
    await window.waitForTimeout(1000);

    // Right-click on the note
    const noteItem = window.locator('.note-item').filter({ hasText: 'Existing Note' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "New Note" in context menu
    const contextMenu = window.locator('#noteContextMenu');
    const newNoteOption = contextMenu.locator('[data-action="new"]');
    await newNoteOption.click();
    await window.waitForTimeout(500);

    // Verify new note was created and is active in editor
    const notesList = window.locator('#notesList .note-item');
    const noteCount = await notesList.count();
    expect(noteCount).toBe(2);

    // Verify the new note has focus in the editor
    const editor = window.locator('.ProseMirror');
    const isFocused = await editor.evaluate(el => document.activeElement === el);
    expect(isFocused).toBe(true);
  });

  test('should delete single note via context menu', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note to Delete');
    await window.waitForTimeout(1000);

    // Verify note exists
    let notesList = window.locator('#notesList .note-item');
    let noteCount = await notesList.count();
    expect(noteCount).toBe(1);

    // Right-click on the note
    const noteItem = window.locator('.note-item').filter({ hasText: 'Note to Delete' });
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Delete" in context menu
    const contextMenu = window.locator('#noteContextMenu');
    const deleteOption = contextMenu.locator('[data-action="delete"]');
    await deleteOption.click();
    await window.waitForTimeout(500);

    // Verify note is moved to trash (count in All Notes should be 0)
    notesList = window.locator('#notesList .note-item');
    noteCount = await notesList.count();
    expect(noteCount).toBe(0);

    // Navigate to Trash folder
    const trashFolder = window.locator('.folder-item').filter({ hasText: 'Trash' });
    await trashFolder.click();
    await window.waitForTimeout(500);

    // Verify note is in trash
    const trashedNote = window.locator('.note-item').filter({ hasText: 'Note to Delete' });
    await expect(trashedNote).toBeVisible();
  });

  test('should delete multiple notes via context menu', async () => {
    // Create three notes
    for (let i = 1; i <= 3; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    // Verify all 3 notes exist
    let notesList = window.locator('#notesList .note-item');
    let noteCount = await notesList.count();
    expect(noteCount).toBe(3);

    // Select notes 1 and 2 with Cmd+Click
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    const note2 = window.locator('.note-item').filter({ hasText: 'Note 2' });
    await note2.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    // Verify badge shows "2 notes selected"
    const badge = window.locator('#selectionBadge');
    let badgeText = await badge.textContent();
    expect(badgeText).toBe('2 notes selected');

    // Right-click on one of the selected notes
    await note1.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Delete" in context menu
    const contextMenu = window.locator('#noteContextMenu');
    const deleteOption = contextMenu.locator('[data-action="delete"]');

    // Verify delete option shows correct text for multiple notes
    const deleteText = await deleteOption.textContent();
    expect(deleteText).toContain('2'); // Should say "Delete 2 notes" or similar

    await deleteOption.click();
    await window.waitForTimeout(500);

    // Verify only 1 note remains in All Notes
    notesList = window.locator('#notesList .note-item');
    noteCount = await notesList.count();
    expect(noteCount).toBe(1);

    // Verify Note 3 is the remaining note
    const note3 = window.locator('.note-item').filter({ hasText: 'Note 3' });
    await expect(note3).toBeVisible();

    // Navigate to Trash
    const trashFolder = window.locator('.folder-item').filter({ hasText: 'Trash' });
    await trashFolder.click();
    await window.waitForTimeout(500);

    // Verify both deleted notes are in trash
    const trashedNote1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    const trashedNote2 = window.locator('.note-item').filter({ hasText: 'Note 2' });
    await expect(trashedNote1).toBeVisible();
    await expect(trashedNote2).toBeVisible();
  });

  test('should show context menu at correct position', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note');
    await window.waitForTimeout(1000);

    // Get note position
    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note' });
    const noteBox = await noteItem.boundingBox();

    // Right-click on the note
    await noteItem.click({ button: 'right', position: { x: 50, y: 10 } });
    await window.waitForTimeout(300);

    // Get context menu position
    const contextMenu = window.locator('#noteContextMenu');
    await expect(contextMenu).toBeVisible();

    const menuBox = await contextMenu.boundingBox();

    // Verify menu appears near the click position
    // Menu should be positioned near the note
    expect(menuBox.y).toBeGreaterThanOrEqual(noteBox.y - 50);
    expect(menuBox.y).toBeLessThanOrEqual(noteBox.y + noteBox.height + 50);
  });

  test('should update delete option text based on selection count', async () => {
    // Create two notes
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 1');
    await window.waitForTimeout(1000);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 2');
    await window.waitForTimeout(1000);

    // Right-click on single note (unselected)
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Verify delete option shows singular text
    let contextMenu = window.locator('#noteContextMenu');
    let deleteOption = contextMenu.locator('[data-action="delete"]');
    let deleteText = await deleteOption.textContent();
    expect(deleteText).toMatch(/Delete( note)?$/i); // "Delete" or "Delete note"

    // Close menu
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Select both notes
    await note1.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);
    const note2 = window.locator('.note-item').filter({ hasText: 'Note 2' });
    await note2.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    // Right-click on selected notes
    await note1.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Verify delete option shows plural text
    contextMenu = window.locator('#noteContextMenu');
    deleteOption = contextMenu.locator('[data-action="delete"]');
    deleteText = await deleteOption.textContent();
    expect(deleteText).toContain('2'); // Should say "Delete 2 notes"
  });
});
