const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Cross-Directory Drag and Drop', () => {
  let electronApp;
  let window;
  let testDir;
  let primaryDir;
  let secondaryDir;

  test.beforeEach(async () => {
    // Create test directories
    testDir = path.join(os.tmpdir(), 'notecove-cross-dir-drag-' + Date.now());
    primaryDir = path.join(testDir, 'primary');
    secondaryDir = path.join(testDir, 'secondary');
    await fs.mkdir(primaryDir, { recursive: true });
    await fs.mkdir(secondaryDir, { recursive: true });

    // Launch app
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        '--instance=cross-dir-drag-' + Date.now()
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

  test('should drag note across sync directories', async () => {
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
    await window.keyboard.type('Test Cross-Directory Drag');
    await window.waitForTimeout(1000);

    // Verify note was created in primary
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const count = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(count)).toBe(1);

    // Drag the note to secondary directory's All Notes
    const noteItem = window.locator('.note-item').first();
    const secondaryAllNotesFolder = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });

    // Perform drag and drop
    await noteItem.dragTo(secondaryAllNotesFolder);
    await window.waitForTimeout(500);

    // Should show confirmation dialog
    const confirmDialog = window.locator('#crossDirectoryMoveDialog');
    const isVisible = await confirmDialog.isVisible().catch(() => false);

    if (isVisible) {
      console.log('Confirmation dialog is visible');
      // Confirm the move
      await window.click('#crossDirectoryMoveConfirm');
      await window.waitForTimeout(1000);
    } else {
      console.log('Confirmation dialog NOT visible - checking if move happened anyway');
    }

    // Verify note moved from primary to secondary
    const primaryCountAfter = await primaryAllNotes.locator('.folder-count').textContent();
    console.log(`Primary count after: ${primaryCountAfter}`);
    expect(parseInt(primaryCountAfter)).toBe(0);

    // Verify note appears in secondary directory
    const secondaryCount = await secondaryAllNotesFolder.locator('.folder-count').textContent();
    console.log(`Secondary count: ${secondaryCount}`);
    expect(parseInt(secondaryCount)).toBe(1);

    // Click on secondary directory's All Notes to see the note
    await secondaryAllNotesFolder.click();
    await window.waitForTimeout(300);

    // Verify note title appears in notes list
    const noteTitles = await window.locator('.note-item .note-title').allTextContents();
    expect(noteTitles.some(title => title.includes('Test Cross-Directory Drag'))).toBe(true);
  });

  test('should drag multiple notes across sync directories', async () => {
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

    // Drag one of the selected notes to secondary directory
    const noteItem = window.locator('.note-item').first();
    const secondaryAllNotesFolder = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });

    await noteItem.dragTo(secondaryAllNotesFolder);
    await window.waitForTimeout(500);

    // Should show confirmation dialog
    const confirmDialog = window.locator('#crossDirectoryMoveDialog');
    const isVisible = await confirmDialog.isVisible().catch(() => false);

    if (isVisible) {
      await window.click('#crossDirectoryMoveConfirm');
      await window.waitForTimeout(1000);
    }

    // Verify both notes moved from primary to secondary
    primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    console.log(`Primary count after move: ${primaryCount}`);
    expect(parseInt(primaryCount)).toBe(0);

    // Click on secondary directory to refresh view
    await secondaryAllNotesFolder.click();
    await window.waitForTimeout(500);

    // Verify both notes appear in secondary directory
    const secondaryCount = await secondaryAllNotesFolder.locator('.folder-count').textContent();
    console.log(`Secondary count: ${secondaryCount}`);

    // Also check actual notes list
    const notesInSecondary = await window.locator('.note-item').count();
    console.log(`Actual notes in list: ${notesInSecondary}`);

    expect(parseInt(secondaryCount)).toBe(2);
  });
});
