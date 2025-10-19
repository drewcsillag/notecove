const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

test.describe('Folder Counts - Multi-Directory', () => {
  let electronApp;
  let window;
  let testDir;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-folder-counts-test-' + Date.now());
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
    await window.waitForTimeout(1500);
  });

  test.afterEach(async () => {
    // Close the app
    await electronApp.close();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  test('new sync directory should show 0 note count in All Notes', async () => {
    // Create a note in primary directory
    await window.click('#newNoteBtn');
    await window.keyboard.type('Primary Note');
    await window.waitForTimeout(500);

    // Verify primary directory shows count of 1
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCount)).toBe(1);

    console.log('[Test] Primary directory has count of 1');

    // Add second sync directory
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    // Click Add Directory button
    const addDirBtn = window.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window.waitForTimeout(300);

    // Set path and name for second directory
    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    const pathInput = window.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(secondDir);

    const nameInput = window.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Second Workspace');

    // Save the directory
    const saveBtn = window.locator('button').filter({ hasText: 'Save' });
    await saveBtn.click();
    await window.waitForTimeout(500);

    // Close settings
    const closeBtn = window.locator('button[aria-label="Close settings"]');
    await closeBtn.click();
    await window.waitForTimeout(500);

    console.log('[Test] Added second sync directory');

    // Verify second directory shows count of 0
    const secondAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const secondCount = await secondAllNotes.locator('.folder-count').textContent();
    expect(parseInt(secondCount)).toBe(0);

    console.log('[Test] Second directory correctly shows count of 0');

    // Verify primary directory still shows count of 1
    const primaryCountAfter = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCountAfter)).toBe(1);

    console.log('[Test] Primary directory still shows count of 1');
  });

  test('folder counts should be scoped per sync directory', async () => {
    // Create a note in primary directory
    await window.click('#newNoteBtn');
    await window.keyboard.type('Primary Note');
    await window.waitForTimeout(500);

    // Add second sync directory
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    const addDirBtn = window.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window.waitForTimeout(300);

    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    const pathInput = window.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(secondDir);

    const nameInput = window.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Second Workspace');

    const saveBtn = window.locator('button').filter({ hasText: 'Save' });
    await saveBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button[aria-label="Close settings"]');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Select second directory's All Notes
    const secondAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await secondAllNotes.click();
    await window.waitForTimeout(500);

    // Create a note in second directory
    await window.click('#newNoteBtn');
    await window.keyboard.type('Secondary Note');
    await window.waitForTimeout(500);

    console.log('[Test] Created notes in both directories');

    // Verify primary directory shows count of 1
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCount)).toBe(1);

    // Verify second directory shows count of 1
    const secondCount = await secondAllNotes.locator('.folder-count').textContent();
    expect(parseInt(secondCount)).toBe(1);

    console.log('[Test] Each directory correctly shows count of 1');
  });

  test('folder counts should remain correct after removing and re-adding sync directory', async () => {
    // Add second sync directory
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    const addDirBtn = window.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window.waitForTimeout(300);

    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    const pathInput = window.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(secondDir);

    const nameInput = window.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Projects');

    const saveBtn = window.locator('button').filter({ hasText: 'Save' });
    await saveBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button[aria-label="Close settings"]');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Select second directory
    const projectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotes.click();
    await window.waitForTimeout(500);

    // Create a folder in second directory
    await window.click('button[aria-label="Add folder"]');
    await window.waitForTimeout(300);

    const folderNameInput = window.locator('input[placeholder*="folder name" i]');
    await folderNameInput.fill('Client Work');
    await folderNameInput.press('Enter');
    await window.waitForTimeout(500);

    // Select the new folder
    const clientWorkFolder = window.locator('.folder-item').filter({ hasText: 'Client Work' });
    await clientWorkFolder.click();
    await window.waitForTimeout(500);

    // Create a note in the folder
    await window.click('#newNoteBtn');
    await window.keyboard.type('Project Note');
    await window.waitForTimeout(500);

    console.log('[Test] Created folder with note in Projects directory');

    // Verify folder shows count of 1
    let folderCount = await clientWorkFolder.locator('.folder-count').textContent();
    expect(parseInt(folderCount)).toBe(1);

    // Remove the Projects sync directory
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    // Find and click remove button for Projects directory
    const projectsRow = window.locator('.sync-directory-item').filter({ hasText: 'Projects' });
    const removeBtn = projectsRow.locator('button[aria-label*="Remove" i]');
    await removeBtn.click();
    await window.waitForTimeout(300);

    // Confirm removal
    await window.click('button').filter({ hasText: 'Remove' });
    await window.waitForTimeout(500);

    await closeBtn.click();
    await window.waitForTimeout(500);

    console.log('[Test] Removed Projects directory');

    // Close and reopen the app
    await electronApp.close();
    await window.waitForTimeout(1000);

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
    await window.waitForTimeout(1500);

    console.log('[Test] App restarted');

    // Re-add the Projects sync directory
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    await addDirBtn.click();
    await window.waitForTimeout(300);

    const pathInputAgain = window.locator('input[placeholder*="path" i]').last();
    await pathInputAgain.fill(secondDir);

    const nameInputAgain = window.locator('input[placeholder*="name" i]').last();
    await nameInputAgain.fill('Projects');

    await saveBtn.click();
    await window.waitForTimeout(500);

    await closeBtn.click();
    await window.waitForTimeout(500);

    console.log('[Test] Re-added Projects directory');

    // Select the Projects directory
    const projectsAllNotesAgain = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotesAgain.click();
    await window.waitForTimeout(500);

    // Verify folder still exists and shows count of 1
    const clientWorkFolderAgain = window.locator('.folder-item').filter({ hasText: 'Client Work' });
    await expect(clientWorkFolderAgain).toBeVisible();

    let folderCountAgain = await clientWorkFolderAgain.locator('.folder-count').textContent();
    expect(parseInt(folderCountAgain)).toBe(1);

    console.log('[Test] Folder shows correct count of 1');

    // Click on the folder
    await clientWorkFolderAgain.click();
    await window.waitForTimeout(500);

    // Verify the note appears in the notes list
    const noteItem = window.locator('.note-item').filter({ hasText: 'Project Note' });
    await expect(noteItem).toBeVisible();

    console.log('[Test] Note correctly appears in folder after re-adding directory!');
  });

  test('notes should stay in correct sync directory across app restart', async () => {
    // Add second sync directory
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    const addDirBtn = window.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window.waitForTimeout(300);

    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    const pathInput = window.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(secondDir);

    const nameInput = window.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Projects');

    const saveBtn = window.locator('button').filter({ hasText: 'Save' });
    await saveBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button[aria-label="Close settings"]');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Select Projects directory
    const projectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotes.click();
    await window.waitForTimeout(500);

    // Create a folder in Projects directory
    await window.click('button[aria-label="Add folder"]');
    await window.waitForTimeout(300);

    const folderNameInput = window.locator('input[placeholder*="folder name" i]');
    await folderNameInput.fill('Design');
    await folderNameInput.press('Enter');
    await window.waitForTimeout(500);

    // Select the new folder
    const designFolder = window.locator('.folder-item').filter({ hasText: 'Design' });
    await designFolder.click();
    await window.waitForTimeout(500);

    // Create a note in the folder
    await window.click('#newNoteBtn');
    await window.keyboard.type('Design Note');
    await window.waitForTimeout(500);

    console.log('[Test] Created note in Projects/Design folder');

    // Restart the app
    await electronApp.close();
    await window.waitForTimeout(1000);

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
    await window.waitForTimeout(1500);

    console.log('[Test] App restarted');

    // Verify note is still in Projects directory
    const restoredProjectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await restoredProjectsAllNotes.click();
    await window.waitForTimeout(500);

    // Check folder count
    const restoredDesignFolder = window.locator('.folder-item').filter({ hasText: 'Design' });
    const folderCount = await restoredDesignFolder.locator('.folder-count').textContent();
    expect(parseInt(folderCount)).toBe(1);

    // Click folder and verify note appears
    await restoredDesignFolder.click();
    await window.waitForTimeout(500);

    const noteItem = window.locator('.note-item').filter({ hasText: 'Design Note' });
    await expect(noteItem).toBeVisible();

    // Verify note is NOT in primary directory
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await primaryAllNotes.click();
    await window.waitForTimeout(500);

    const primaryNoteCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryNoteCount)).toBe(0);

    console.log('[Test] Note correctly stayed in Projects directory after restart!');
  });

  test('removed sync directory notes should not show in UI', async () => {
    // Add second sync directory
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    const addDirBtn = window.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window.waitForTimeout(300);

    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    const pathInput = window.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(secondDir);

    const nameInput = window.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Projects');

    const saveBtn = window.locator('button').filter({ hasText: 'Save' });
    await saveBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button[aria-label="Close settings"]');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Create a note in Projects directory
    const projectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotes.click();
    await window.waitForTimeout(500);

    await window.click('#newNoteBtn');
    await window.keyboard.type('Project Doc');
    await window.waitForTimeout(500);

    console.log('[Test] Created note in Projects directory');

    // Verify Projects shows count of 1
    let projectsCount = await projectsAllNotes.locator('.folder-count').textContent();
    expect(parseInt(projectsCount)).toBe(1);

    // Remove Projects directory
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    const projectsRow = window.locator('.sync-directory-group').filter({ hasText: 'Projects' });
    const removeBtn = projectsRow.locator('button').filter({ hasText: 'Remove' });
    await removeBtn.click();
    await window.waitForTimeout(300);

    // Confirm removal in dialog
    await window.locator('button').filter({ hasText: 'Remove' }).last().click();
    await window.waitForTimeout(500);

    await closeBtn.click();
    await window.waitForTimeout(500);

    console.log('[Test] Removed Projects directory');

    // Verify primary directory shows count of 0
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCount)).toBe(0);

    // Verify editor is cleared
    const editorTitle = await window.locator('.editor-note-title').textContent();
    expect(editorTitle).toBe('');

    console.log('[Test] Notes from removed directory correctly hidden from UI!');

    // Restart app and verify count is still 0
    await electronApp.close();
    await window.waitForTimeout(1000);

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
    await window.waitForTimeout(1500);

    console.log('[Test] App restarted');

    // Verify primary directory STILL shows count of 0
    const restoredPrimaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const restoredPrimaryCount = await restoredPrimaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(restoredPrimaryCount)).toBe(0);

    console.log('[Test] Count remains 0 after restart - notes correctly filtered!');
  });
});
