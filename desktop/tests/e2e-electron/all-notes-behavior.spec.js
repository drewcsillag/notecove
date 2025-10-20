const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('All Notes Virtual Folder Behavior', () => {
  let electronApp;
  let window;
  let tempDir;
  let primaryDir;
  let secondaryDir;

  test.beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-all-notes-test-'));
    primaryDir = path.join(tempDir, 'primary');
    secondaryDir = path.join(tempDir, 'secondary');
    await fs.mkdir(primaryDir, { recursive: true });
    await fs.mkdir(secondaryDir, { recursive: true });

    // Launch Electron app with test instance
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        '--instance=all-notes-test'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    // Cleanup temp directories
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should show all notes in All Notes regardless of folder', async () => {
    // Add sync directory
    await window.click('[data-testid="add-sync-directory-btn"]');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create a folder
    await window.click('button:has-text("New Folder")');
    await window.waitForTimeout(300);
    await window.fill('input[placeholder*="folder"]', 'Test Folder');
    await window.press('input[placeholder*="folder"]', 'Enter');
    await window.waitForTimeout(500);

    // Create a note in All Notes (root level)
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Root Note');
    await window.waitForTimeout(500);

    // Create a note in the custom folder
    await window.click('.folder-item:has-text("Test Folder")');
    await window.waitForTimeout(300);
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Folder Note');
    await window.waitForTimeout(500);

    // Click on All Notes - should show BOTH notes
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);

    const noteCount = await window.locator('.note-item').count();
    expect(noteCount).toBe(2);

    // Verify both notes are visible
    const noteTitles = await window.locator('.note-item .note-title').allTextContents();
    expect(noteTitles).toContain('Root Note');
    expect(noteTitles).toContain('Folder Note');
  });

  test('should show correct count in All Notes folder badge', async () => {
    // Add sync directory
    await window.click('[data-testid="add-sync-directory-btn"]');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create a folder
    await window.click('button:has-text("New Folder")');
    await window.waitForTimeout(300);
    await window.fill('input[placeholder*="folder"]', 'Folder A');
    await window.press('input[placeholder*="folder"]', 'Enter');
    await window.waitForTimeout(500);

    // Create 3 notes in root
    for (let i = 1; i <= 3; i++) {
      await window.click('.folder-item:has-text("All Notes")');
      await window.waitForTimeout(300);
      await window.click('button:has-text("New Note")');
      await window.waitForTimeout(500);
      await window.fill('.editor-title', `Root Note ${i}`);
      await window.waitForTimeout(300);
    }

    // Create 2 notes in folder
    for (let i = 1; i <= 2; i++) {
      await window.click('.folder-item:has-text("Folder A")');
      await window.waitForTimeout(300);
      await window.click('button:has-text("New Note")');
      await window.waitForTimeout(500);
      await window.fill('.editor-title', `Folder Note ${i}`);
      await window.waitForTimeout(300);
    }

    // Check All Notes count - should be 5 (all notes regardless of folder)
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);

    const allNotesCount = await window.locator('.folder-item:has-text("All Notes") .folder-count').textContent();
    expect(allNotesCount).toBe('5');

    // Check custom folder count - should be 2
    const folderCount = await window.locator('.folder-item:has-text("Folder A") .folder-count').textContent();
    expect(folderCount).toBe('2');
  });

  test('should scope All Notes to individual sync directories', async () => {
    // Add primary sync directory
    await window.click('[data-testid="add-sync-directory-btn"]');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Add secondary sync directory
    await window.click('[data-testid="add-sync-directory-btn"]');
    await window.fill('input[type="text"]', secondaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create 2 notes in primary directory
    await window.click('.sync-directory-item:has-text("primary")');
    await window.waitForTimeout(300);
    for (let i = 1; i <= 2; i++) {
      await window.click('button:has-text("New Note")');
      await window.waitForTimeout(500);
      await window.fill('.editor-title', `Primary Note ${i}`);
      await window.waitForTimeout(300);
    }

    // Create 3 notes in secondary directory
    await window.click('.sync-directory-item:has-text("secondary")');
    await window.waitForTimeout(300);
    for (let i = 1; i <= 3; i++) {
      await window.click('button:has-text("New Note")');
      await window.waitForTimeout(500);
      await window.fill('.editor-title', `Secondary Note ${i}`);
      await window.waitForTimeout(300);
    }

    // Check primary All Notes - should show 2 notes
    await window.click('.sync-directory-item:has-text("primary")');
    await window.waitForTimeout(300);
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);

    const primaryCount = await window.locator('.note-item').count();
    expect(primaryCount).toBe(2);

    const primaryTitles = await window.locator('.note-item .note-title').allTextContents();
    expect(primaryTitles.every(title => title.includes('Primary'))).toBe(true);

    // Check secondary All Notes - should show 3 notes
    await window.click('.sync-directory-item:has-text("secondary")');
    await window.waitForTimeout(300);
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);

    const secondaryCount = await window.locator('.note-item').count();
    expect(secondaryCount).toBe(3);

    const secondaryTitles = await window.locator('.note-item .note-title').allTextContents();
    expect(secondaryTitles.every(title => title.includes('Secondary'))).toBe(true);
  });

  test('should show notes from custom folders in All Notes after move', async () => {
    // Add sync directory
    await window.click('[data-testid="add-sync-directory-btn"]');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create a folder
    await window.click('button:has-text("New Folder")');
    await window.waitForTimeout(300);
    await window.fill('input[placeholder*="folder"]', 'Projects');
    await window.press('input[placeholder*="folder"]', 'Enter');
    await window.waitForTimeout(500);

    // Create a note in All Notes
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Test Note');
    await window.waitForTimeout(500);

    // Move note to Projects folder
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    const projectsFolder = window.locator('.folder-picker-item:has-text("Projects")');
    await projectsFolder.click();
    await window.waitForTimeout(500);

    // Note should be in Projects folder
    await window.click('.folder-item:has-text("Projects")');
    await window.waitForTimeout(300);
    const notesInProjects = await window.locator('.note-item').count();
    expect(notesInProjects).toBe(1);

    // Click on All Notes - should STILL show the note
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);

    const notesInAllNotes = await window.locator('.note-item').count();
    expect(notesInAllNotes).toBe(1);

    const noteTitle = await window.locator('.note-item .note-title').first().textContent();
    expect(noteTitle).toBe('Test Note');
  });

  test('should allow moving note from custom folder to All Notes (root level)', async () => {
    // Add sync directory
    await window.click('[data-testid="add-sync-directory-btn"]');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create a folder
    await window.click('button:has-text("New Folder")');
    await window.waitForTimeout(300);
    await window.fill('input[placeholder*="folder"]', 'Archive');
    await window.press('input[placeholder*="folder"]', 'Enter');
    await window.waitForTimeout(500);

    // Create a note in Archive folder
    await window.click('.folder-item:has-text("Archive")');
    await window.waitForTimeout(300);
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Archived Note');
    await window.waitForTimeout(500);

    // Move note to All Notes
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    const allNotesFolder = window.locator('.folder-picker-item:has-text("All Notes")').first();
    await allNotesFolder.click();
    await window.waitForTimeout(500);

    // Archive folder should be empty
    await window.click('.folder-item:has-text("Archive")');
    await window.waitForTimeout(300);
    const notesInArchive = await window.locator('.note-item').count();
    expect(notesInArchive).toBe(0);

    // Note should be at root level (All Notes)
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);
    const notesInAllNotes = await window.locator('.note-item').count();
    expect(notesInAllNotes).toBe(1);

    const noteTitle = await window.locator('.note-item .note-title').first().textContent();
    expect(noteTitle).toBe('Archived Note');
  });

  test('should maintain All Notes count when moving notes between folders', async () => {
    // Add sync directory
    await window.click('[data-testid="add-sync-directory-btn"]');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create two folders
    await window.click('button:has-text("New Folder")');
    await window.waitForTimeout(300);
    await window.fill('input[placeholder*="folder"]', 'Folder A');
    await window.press('input[placeholder*="folder"]', 'Enter');
    await window.waitForTimeout(500);

    await window.click('button:has-text("New Folder")');
    await window.waitForTimeout(300);
    await window.fill('input[placeholder*="folder"]', 'Folder B');
    await window.press('input[placeholder*="folder"]', 'Enter');
    await window.waitForTimeout(500);

    // Create a note in Folder A
    await window.click('.folder-item:has-text("Folder A")');
    await window.waitForTimeout(300);
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Mobile Note');
    await window.waitForTimeout(500);

    // Check initial All Notes count
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);
    const initialCount = await window.locator('.note-item').count();
    expect(initialCount).toBe(1);

    // Move note from Folder A to Folder B
    await window.click('.folder-item:has-text("Folder A")');
    await window.waitForTimeout(300);
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    const folderB = window.locator('.folder-picker-item:has-text("Folder B")');
    await folderB.click();
    await window.waitForTimeout(500);

    // All Notes count should still be 1 (note just moved between folders)
    await window.click('.folder-item:has-text("All Notes")');
    await window.waitForTimeout(300);
    const finalCount = await window.locator('.note-item').count();
    expect(finalCount).toBe(1);

    // Note should be visible in All Notes
    const noteTitle = await window.locator('.note-item .note-title').first().textContent();
    expect(noteTitle).toBe('Mobile Note');
  });
});
