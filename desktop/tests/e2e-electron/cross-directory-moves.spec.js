const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Cross-Directory Note Moves', () => {
  let electronApp;
  let window;
  let tempDir;
  let primaryDir;
  let secondaryDir;

  // Helper function to add a sync directory
  async function addSyncDirectory(dirPath, dirName) {
    // Open settings
    await window.click('.settings-btn');
    await window.waitForTimeout(300);

    // Click Add Directory button
    const addDirBtn = window.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window.waitForTimeout(300);

    // Fill in path and name
    const pathInput = window.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(dirPath);

    const nameInput = window.locator('input[placeholder*="name" i]').last();
    await nameInput.fill(dirName);

    // Confirm
    const addBtn = window.locator('button#confirmAddDir');
    await addBtn.click();
    await window.waitForTimeout(500);

    // Close settings
    const closeBtn = window.locator('button#settingsClose');
    await closeBtn.click();
    await window.waitForTimeout(500);
  }

  test.beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-cross-dir-test-'));
    primaryDir = path.join(tempDir, 'primary');
    secondaryDir = path.join(tempDir, 'secondary');
    await fs.mkdir(primaryDir, { recursive: true });
    await fs.mkdir(secondaryDir, { recursive: true });

    // Launch Electron app with test instance
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        '--instance=cross-dir-test'
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

  test('should show confirmation dialog for cross-directory move', async () => {
    // Add primary sync directory
    await addSyncDirectory(primaryDir, 'primary');

    // Add secondary sync directory
    await addSyncDirectory(secondaryDir, 'secondary');

    // Create a note in primary directory
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Test Cross-Directory Note');
    await window.waitForTimeout(500);

    // Select the note
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Move to..." in context menu
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    // Folder picker should be visible
    const folderPicker = window.locator('#folderPickerModal');
    await expect(folderPicker).toBeVisible();

    // Click on "All Notes" in the secondary sync directory
    // (This should trigger cross-directory move confirmation)
    const secondaryAllNotes = window.locator('.folder-picker-item:has-text("All Notes")').nth(1);
    await secondaryAllNotes.click();
    await window.waitForTimeout(500);

    // Confirmation dialog should appear
    const confirmDialog = window.locator('#crossDirectoryMoveDialog');
    await expect(confirmDialog).toBeVisible();

    // Check dialog message
    const message = await window.locator('#crossDirectoryMoveMessage').textContent();
    expect(message).toContain('Are you sure you want to move');
    expect(message).toContain('secondary');

    // Click cancel to test cancellation
    await window.click('#crossDirectoryMoveCancel');
    await window.waitForTimeout(300);

    // Dialog should be hidden
    await expect(confirmDialog).not.toBeVisible();

    // Note should still be in primary directory
    await window.click('.sync-directory-item:has-text("primary")');
    await window.waitForTimeout(300);
    const notesInPrimary = await window.locator('.note-item').count();
    expect(notesInPrimary).toBe(1);
  });

  test('should move note to All Notes in another sync directory', async () => {
    // Add primary sync directory
    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Add secondary sync directory
    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', secondaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create a note in primary directory
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Cross-Dir Test Note');
    await window.waitForTimeout(500);

    // Select the note
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Move to..." in context menu
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    // Click on "All Notes" in the secondary sync directory
    const secondaryAllNotes = window.locator('.folder-picker-item:has-text("All Notes")').nth(1);
    await secondaryAllNotes.click();
    await window.waitForTimeout(500);

    // Confirm the move
    await window.click('#crossDirectoryMoveConfirm');
    await window.waitForTimeout(1000);

    // Note should disappear from primary directory
    await window.click('.sync-directory-item:has-text("primary")');
    await window.waitForTimeout(300);
    const notesInPrimary = await window.locator('.note-item').count();
    expect(notesInPrimary).toBe(0);

    // Note should appear in secondary directory
    await window.click('.sync-directory-item:has-text("secondary")');
    await window.waitForTimeout(300);
    const notesInSecondary = await window.locator('.note-item').count();
    expect(notesInSecondary).toBe(1);

    // Verify note title
    const noteTitle = await window.locator('.note-item .note-title').first().textContent();
    expect(noteTitle).toBe('Cross-Dir Test Note');
  });

  test('should move note to custom folder in another sync directory', async () => {
    // Add primary sync directory
    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Add secondary sync directory
    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', secondaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create a folder in secondary directory
    await window.click('.sync-directory-item:has-text("secondary")');
    await window.waitForTimeout(300);
    await window.click('button:has-text("New Folder")');
    await window.waitForTimeout(300);
    await window.fill('input[placeholder*="folder"]', 'Target Folder');
    await window.press('input[placeholder*="folder"]', 'Enter');
    await window.waitForTimeout(500);

    // Switch back to primary directory and create a note
    await window.click('.sync-directory-item:has-text("primary")');
    await window.waitForTimeout(300);
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Note to Move');
    await window.waitForTimeout(500);

    // Select the note and open folder picker
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    // Click on "Target Folder" in the secondary sync directory
    const targetFolder = window.locator('.folder-picker-item:has-text("Target Folder")');
    await targetFolder.click();
    await window.waitForTimeout(500);

    // Confirm the move
    await window.click('#crossDirectoryMoveConfirm');
    await window.waitForTimeout(1000);

    // Verify note moved to secondary directory's target folder
    await window.click('.sync-directory-item:has-text("secondary")');
    await window.waitForTimeout(300);
    await window.click('.folder-item:has-text("Target Folder")');
    await window.waitForTimeout(300);

    const notesInFolder = await window.locator('.note-item').count();
    expect(notesInFolder).toBe(1);

    const noteTitle = await window.locator('.note-item .note-title').first().textContent();
    expect(noteTitle).toBe('Note to Move');
  });

  test('should move multiple notes across directories', async () => {
    // Add primary sync directory
    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Add secondary sync directory
    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', secondaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create 3 notes in primary directory
    for (let i = 1; i <= 3; i++) {
      await window.click('button:has-text("New Note")');
      await window.waitForTimeout(500);
      await window.fill('.editor-title', `Test Note ${i}`);
      await window.waitForTimeout(300);
    }

    // Select all notes (Cmd/Ctrl + A)
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
    await window.waitForTimeout(300);

    // Right-click on a selected note
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);

    // Click "Move to..."
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    // Verify title says "Move 3 Notes"
    const title = await window.locator('#folderPickerTitle').textContent();
    expect(title).toContain('3');

    // Move to secondary directory's All Notes
    const secondaryAllNotes = window.locator('.folder-picker-item:has-text("All Notes")').nth(1);
    await secondaryAllNotes.click();
    await window.waitForTimeout(500);

    // Verify confirmation message mentions "3 notes"
    const message = await window.locator('#crossDirectoryMoveMessage').textContent();
    expect(message).toContain('3 notes');

    // Confirm
    await window.click('#crossDirectoryMoveConfirm');
    await window.waitForTimeout(1000);

    // Verify all notes moved
    await window.click('.sync-directory-item:has-text("primary")');
    await window.waitForTimeout(300);
    const notesInPrimary = await window.locator('.note-item').count();
    expect(notesInPrimary).toBe(0);

    await window.click('.sync-directory-item:has-text("secondary")');
    await window.waitForTimeout(300);
    const notesInSecondary = await window.locator('.note-item').count();
    expect(notesInSecondary).toBe(3);
  });

  test('should respect "dont ask again" preference', async () => {
    // Add primary and secondary directories
    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', secondaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create a note
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Test Note 1');
    await window.waitForTimeout(500);

    // Move to secondary with "don't ask again" checked
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    const secondaryAllNotes = window.locator('.folder-picker-item:has-text("All Notes")').nth(1);
    await secondaryAllNotes.click();
    await window.waitForTimeout(500);

    // Check "don't ask again"
    await window.check('#dontAskAgainCheckbox');
    await window.click('#crossDirectoryMoveConfirm');
    await window.waitForTimeout(1000);

    // Create another note in primary
    await window.click('.sync-directory-item:has-text("primary")');
    await window.waitForTimeout(300);
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Test Note 2');
    await window.waitForTimeout(500);

    // Try to move again - should NOT show confirmation dialog
    const noteItem2 = window.locator('.note-item').first();
    await noteItem2.click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    await secondaryAllNotes.click();
    await window.waitForTimeout(1000);

    // Confirmation dialog should NOT appear (move should happen immediately)
    const confirmDialog = window.locator('#crossDirectoryMoveDialog');
    await expect(confirmDialog).not.toBeVisible();

    // Note should be moved
    await window.click('.sync-directory-item:has-text("secondary")');
    await window.waitForTimeout(300);
    const notesInSecondary = await window.locator('.note-item').count();
    expect(notesInSecondary).toBe(2);
  });

  test('should not show confirmation for same-directory moves', async () => {
    // Add primary sync directory
    await window.click('#addSyncDirectoryBtn');
    await window.fill('input[type="text"]', primaryDir);
    await window.click('button:has-text("Add Directory")');
    await window.waitForTimeout(500);

    // Create a folder
    await window.click('button:has-text("New Folder")');
    await window.waitForTimeout(300);
    await window.fill('input[placeholder*="folder"]', 'Test Folder');
    await window.press('input[placeholder*="folder"]', 'Enter');
    await window.waitForTimeout(500);

    // Create a note
    await window.click('button:has-text("New Note")');
    await window.waitForTimeout(500);
    await window.fill('.editor-title', 'Test Note');
    await window.waitForTimeout(500);

    // Move to folder in same directory
    const noteItem = window.locator('.note-item').first();
    await noteItem.click({ button: 'right' });
    await window.waitForTimeout(300);
    await window.click('.context-menu-item:has-text("Move to...")');
    await window.waitForTimeout(500);

    const testFolder = window.locator('.folder-picker-item:has-text("Test Folder")');
    await testFolder.click();
    await window.waitForTimeout(500);

    // Confirmation dialog should NOT appear
    const confirmDialog = window.locator('#crossDirectoryMoveDialog');
    await expect(confirmDialog).not.toBeVisible();

    // Note should be moved immediately
    await window.click('.folder-item:has-text("Test Folder")');
    await window.waitForTimeout(300);
    const notesInFolder = await window.locator('.note-item').count();
    expect(notesInFolder).toBe(1);
  });
});
