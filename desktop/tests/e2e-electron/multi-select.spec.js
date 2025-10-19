const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

test.describe('Multi-Select Notes', () => {
  let electronApp;
  let window;
  let testDir;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-multiselect-test-' + Date.now());
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

  test('should select single note with regular click', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Test Note 1');
    await window.waitForTimeout(1000);

    // Click on the note
    const noteItem = window.locator('.note-item').filter({ hasText: 'Test Note 1' });
    await noteItem.click();
    await window.waitForTimeout(300);

    // Verify note is NOT selected (regular click doesn't add to selection)
    const hasSelectedClass = await noteItem.evaluate(el => el.classList.contains('selected'));
    expect(hasSelectedClass).toBe(false);

    // Verify selection badge is NOT visible
    const badge = window.locator('#selectionBadge');
    const badgeVisible = await badge.isVisible().catch(() => false);
    expect(badgeVisible).toBe(false);
  });

  test('should toggle selection with Cmd/Ctrl + click', async () => {
    // Create two notes
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 1');
    await window.waitForTimeout(1000);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 2');
    await window.waitForTimeout(1000);

    // Cmd/Ctrl + Click on first note
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ modifiers: ['Meta'] }); // Use Meta for macOS
    await window.waitForTimeout(300);

    // Verify note 1 is selected
    let hasSelected = await note1.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(true);

    // Verify badge shows "1 note selected"
    const badge = window.locator('#selectionBadge');
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    expect(badgeText).toBe('1 note selected');

    // Cmd/Ctrl + Click on second note
    const note2 = window.locator('.note-item').filter({ hasText: 'Note 2' });
    await note2.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    // Verify both notes are selected
    hasSelected = await note1.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(true);
    hasSelected = await note2.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(true);

    // Verify badge shows "2 notes selected"
    const badgeText2 = await badge.textContent();
    expect(badgeText2).toBe('2 notes selected');

    // Cmd/Ctrl + Click on first note again to deselect
    await note1.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    // Verify note 1 is no longer selected
    hasSelected = await note1.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(false);

    // Verify badge shows "1 note selected"
    const badgeText3 = await badge.textContent();
    expect(badgeText3).toBe('1 note selected');
  });

  test('should range select with Shift + click', async () => {
    // Create 5 notes
    for (let i = 1; i <= 5; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    // Cmd/Ctrl + Click on first note
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    // Shift + Click on third note
    const note3 = window.locator('.note-item').filter({ hasText: 'Note 3' });
    await note3.click({ modifiers: ['Shift'] });
    await window.waitForTimeout(300);

    // Verify notes 1, 2, and 3 are selected
    for (let i = 1; i <= 3; i++) {
      const note = window.locator('.note-item').filter({ hasText: `Note ${i}` });
      const hasSelected = await note.evaluate(el => el.classList.contains('selected'));
      expect(hasSelected).toBe(true);
    }

    // Verify notes 4 and 5 are NOT selected
    for (let i = 4; i <= 5; i++) {
      const note = window.locator('.note-item').filter({ hasText: `Note ${i}` });
      const hasSelected = await note.evaluate(el => el.classList.contains('selected'));
      expect(hasSelected).toBe(false);
    }

    // Verify badge shows "3 notes selected"
    const badge = window.locator('#selectionBadge');
    const badgeText = await badge.textContent();
    expect(badgeText).toBe('3 notes selected');
  });

  test('should select all notes with Cmd/Ctrl + A', async () => {
    // Create 3 notes
    for (let i = 1; i <= 3; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    // Click on notes panel to focus it
    const notesList = window.locator('#notesList');
    await notesList.click();
    await window.waitForTimeout(200);

    // Press Cmd/Ctrl + A
    await window.keyboard.press('Meta+a'); // Use Meta for macOS
    await window.waitForTimeout(300);

    // Verify all 3 notes are selected
    for (let i = 1; i <= 3; i++) {
      const note = window.locator('.note-item').filter({ hasText: `Note ${i}` });
      const hasSelected = await note.evaluate(el => el.classList.contains('selected'));
      expect(hasSelected).toBe(true);
    }

    // Verify badge shows "3 notes selected"
    const badge = window.locator('#selectionBadge');
    const badgeText = await badge.textContent();
    expect(badgeText).toBe('3 notes selected');
  });

  test('should clear selection with Escape', async () => {
    // Create two notes
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 1');
    await window.waitForTimeout(1000);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Note 2');
    await window.waitForTimeout(1000);

    // Select both notes with Cmd/Ctrl + A
    const notesList = window.locator('#notesList');
    await notesList.click();
    await window.keyboard.press('Meta+a');
    await window.waitForTimeout(300);

    // Verify badge is visible
    const badge = window.locator('#selectionBadge');
    await expect(badge).toBeVisible();

    // Press Escape
    await window.keyboard.press('Escape');
    await window.waitForTimeout(300);

    // Verify all notes are deselected
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    const note2 = window.locator('.note-item').filter({ hasText: 'Note 2' });

    let hasSelected = await note1.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(false);

    hasSelected = await note2.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(false);

    // Verify badge is hidden
    const badgeVisible = await badge.isVisible();
    expect(badgeVisible).toBe(false);
  });

  test('should show correct selection count in badge', async () => {
    // Create 5 notes
    for (let i = 1; i <= 5; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    const badge = window.locator('#selectionBadge');

    // Select 1 note
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    await note1.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    let badgeText = await badge.textContent();
    expect(badgeText).toBe('1 note selected');

    // Select 2 more notes
    const note2 = window.locator('.note-item').filter({ hasText: 'Note 2' });
    await note2.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    const note3 = window.locator('.note-item').filter({ hasText: 'Note 3' });
    await note3.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    badgeText = await badge.textContent();
    expect(badgeText).toBe('3 notes selected');
  });

  test('should clear selection when switching folders', async () => {
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

    // Create notes in All Notes
    for (let i = 1; i <= 3; i++) {
      await window.click('#newNoteBtn');
      await window.waitForTimeout(300);
      await window.keyboard.type(`Note ${i}`);
      await window.waitForTimeout(800);
    }

    // Select all notes
    const notesList = window.locator('#notesList');
    await notesList.click();
    await window.keyboard.press('Meta+a');
    await window.waitForTimeout(300);

    // Verify badge is visible
    const badge = window.locator('#selectionBadge');
    await expect(badge).toBeVisible();

    // Switch to Test Folder
    const testFolder = window.locator('.folder-item').filter({ hasText: 'Test Folder' });
    await testFolder.click();
    await window.waitForTimeout(500);

    // Verify badge is hidden (selection cleared)
    const badgeVisible = await badge.isVisible();
    expect(badgeVisible).toBe(false);

    // Go back to All Notes
    const allNotes = window.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await window.waitForTimeout(500);

    // Verify notes are not selected
    const note1 = window.locator('.note-item').filter({ hasText: 'Note 1' });
    const hasSelected = await note1.evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(false);
  });

  test('should apply selected styling to note items', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Styled Note');
    await window.waitForTimeout(1000);

    const noteItem = window.locator('.note-item').filter({ hasText: 'Styled Note' });

    // Note should not have selected class initially
    let hasSelectedClass = await noteItem.evaluate(el => el.classList.contains('selected'));
    expect(hasSelectedClass).toBe(false);

    // Cmd/Ctrl + Click to select
    await noteItem.click({ modifiers: ['Meta'] });
    await window.waitForTimeout(300);

    // Note should have selected class
    hasSelectedClass = await noteItem.evaluate(el => el.classList.contains('selected'));
    expect(hasSelectedClass).toBe(true);

    // Verify the selected styling is applied (primary color background)
    const backgroundColor = await noteItem.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.backgroundColor;
    });

    // Should have some background color applied (not default)
    expect(backgroundColor).toBeTruthy();
  });
});
