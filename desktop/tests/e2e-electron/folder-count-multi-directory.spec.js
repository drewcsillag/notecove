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
    const primaryNotesPath = path.join(testDir, 'primary-notes');
    await fs.mkdir(primaryNotesPath, { recursive: true });

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--instance=test-' + Date.now(),
        '--notes-path=' + primaryNotesPath  // Explicitly set notes path to unique test directory
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

    // Kill any lingering Electron processes
    const { exec } = require('child_process');
    await new Promise((resolve) => {
      exec('pkill -9 Electron', (error) => {
        // Ignore errors - process might not exist
        resolve();
      });
    });

    // Wait for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }

    // Wait after cleanup before next test starts
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('new sync directory should show 0 note count in All Notes', async () => {
    // Wait for app to fully initialize and any welcome notes to be created
    await window.waitForTimeout(1000);

    // Get initial count in primary directory
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const initialCount = parseInt(await primaryAllNotes.locator('.folder-count').textContent());

    // Create a note in primary directory
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    // Wait for editor to be focused and ready
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Primary Note');
    await window.waitForTimeout(1000); // Wait for note to be created and UI to update

    // Verify primary directory count increased by 1
    const primaryCount = parseInt(await primaryAllNotes.locator('.folder-count').textContent());
    expect(primaryCount).toBe(initialCount + 1);

    // Add second sync directory
    await window.click('.settings-btn');
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

    // Add the directory
    const addBtn = window.locator('button#confirmAddDir');
    await addBtn.click();
    await window.waitForTimeout(500);

    // Close settings
    const closeBtn = window.locator('button#settingsClose');
    await closeBtn.click();
    await window.waitForTimeout(500);


    // Verify second directory shows count of 0
    const secondAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const secondCount = await secondAllNotes.locator('.folder-count').textContent();
    expect(parseInt(secondCount)).toBe(0);


    // Verify primary directory still shows same count as before
    const primaryCountAfter = parseInt(await primaryAllNotes.locator('.folder-count').textContent());
    expect(primaryCountAfter).toBe(primaryCount);

  });

  test('folder counts should be scoped per sync directory', async () => {
    // Listen to console logs
    window.on('console', msg => console.log('BROWSER:', msg.text()));

    // Wait a bit for renderer to initialize
    await window.waitForTimeout(500);

    // DEBUG: Log initial state at start of test
    const initialState = await window.evaluate(() => {
      const renderer = window.renderer;
      const noteManager = renderer?.noteManager;
      if (!noteManager) return { error: 'No noteManager found' };

      const allNotes = Array.from(noteManager.notes.values());
      const notesDir = noteManager.syncManagers.values().next().value?.notesPath;
      return {
        testStartTotalNotes: allNotes.length,
        testStartNotes: allNotes.map(n => ({
          id: n.id.substring(0, 8),
          title: n.title,
          syncDirectoryId: n.syncDirectoryId
        })),
        syncManagerKeys: Array.from(noteManager.syncManagers.keys()),
        primaryNotesPath: notesDir
      };
    });
    console.log('=== TEST #2 START STATE ===', JSON.stringify(initialState, null, 2));

    // Create a note in primary directory
    await window.click('#newNoteBtn');
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Primary Note');
    await window.waitForTimeout(1500); // Wait for title extraction to complete

    // Add second sync directory
    await window.click('.settings-btn');
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

    const addBtn = window.locator('button#confirmAddDir');
    await addBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button#settingsClose');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Select second directory's All Notes
    const secondAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await secondAllNotes.click();
    await window.waitForTimeout(500);

    // Create a note in second directory
    await window.click('#newNoteBtn');
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Secondary Note');
    await window.waitForTimeout(1500); // Wait for note to be created and title extracted

    // Verify primary directory shows count of 1
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCount)).toBe(1);

    // Verify second directory shows count of 1
    const secondCount = await secondAllNotes.locator('.folder-count').textContent();

    // Debug: Check what notes are actually in the list
    if (parseInt(secondCount) !== 1) {
      const notesList = await window.locator('#notesList .note-item .note-title').allTextContents();
      console.log(`ERROR: Second directory count is ${secondCount}, expected 1`);
      console.log('Notes in list:', notesList);
      console.log('Test directory path:', testDir);
      console.log('Second sync dir path:', secondDir);

      // Log sync directory info from the browser console
      const syncDirsInfo = await window.evaluate(() => {
        const renderer = window.renderer;
        const noteManager = renderer?.noteManager;
        if (!noteManager) return { error: 'No noteManager found' };

        const allNotes = Array.from(noteManager.notes.values());
        return {
          totalNotes: allNotes.length,
          notes: allNotes.map(n => ({
            id: n.id,
            title: n.title,
            syncDirectoryId: n.syncDirectoryId
          })),
          currentSyncDirId: renderer.currentSyncDirectoryId,
          syncManagerKeys: Array.from(noteManager.syncManagers.keys())
        };
      });
      console.log('Browser state:', JSON.stringify(syncDirsInfo, null, 2));

      // Take a screenshot for debugging
      await window.screenshot({ path: 'debug-test2-notes.png' });
    }

    expect(parseInt(secondCount)).toBe(1);

  });

  test('folder counts should remain correct after removing and re-adding sync directory', async () => {
    // Add second sync directory
    await window.click('.settings-btn');
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

    const addBtn = window.locator('button#confirmAddDir');
    await addBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button#settingsClose');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Select second directory
    const projectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotes.click();
    await window.waitForTimeout(500);

    // Create a folder in second directory
    await window.click('#newFolderBtn');
    await window.waitForTimeout(300);

    const folderNameInput = window.locator('#dialogInput');
    await folderNameInput.fill('Client Work');
    await folderNameInput.press('Enter');
    await window.waitForTimeout(500);

    // Select the new folder
    const clientWorkFolder = window.locator('.folder-item').filter({ hasText: 'Client Work' });
    await clientWorkFolder.click();
    await window.waitForTimeout(500);

    // Create a note in the folder
    await window.click('#newNoteBtn');
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Project Note');
    await window.waitForTimeout(1500); // Wait for title extraction to complete

    // Verify folder shows count of 1
    let folderCount = await clientWorkFolder.locator('.folder-count').textContent();
    expect(parseInt(folderCount)).toBe(1);

    // Remove the Projects sync directory
    await window.click('.settings-btn');
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


    // Re-add the Projects sync directory
    await window.click('.settings-btn');
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


    // Click on the folder
    await clientWorkFolderAgain.click();
    await window.waitForTimeout(500);

    // Verify the note appears in the notes list
    const noteItem = window.locator('.note-item').filter({ hasText: 'Project Note' });
    await expect(noteItem).toBeVisible();

  });

  test('notes should stay in correct sync directory across app restart', async () => {
    // Add second sync directory
    await window.click('.settings-btn');
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

    const addBtn = window.locator('button#confirmAddDir');
    await addBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button#settingsClose');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Select Projects directory
    const projectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotes.click();
    await window.waitForTimeout(500);

    // Create a folder in Projects directory
    await window.click('#newFolderBtn');
    await window.waitForTimeout(300);

    const folderNameInput = window.locator('#dialogInput');
    await folderNameInput.fill('Design');
    await folderNameInput.press('Enter');
    await window.waitForTimeout(500);

    // Select the new folder
    const designFolder = window.locator('.folder-item').filter({ hasText: 'Design' });
    await designFolder.click();
    await window.waitForTimeout(500);

    // Create a note in the folder
    await window.click('#newNoteBtn');
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Design Note');
    await window.waitForTimeout(1500); // Wait for title extraction to complete

    // Restart the app
    await electronApp.close();
    await new Promise(resolve => setTimeout(resolve, 1000));

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

  });

  test('removed sync directory notes should not show in UI', async () => {
    // Add second sync directory
    await window.click('.settings-btn');
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

    const addBtn = window.locator('button#confirmAddDir');
    await addBtn.click();
    await window.waitForTimeout(500);

    const closeBtn = window.locator('button#settingsClose');
    await closeBtn.click();
    await window.waitForTimeout(500);

    // Create a note in Projects directory
    const projectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotes.click();
    await window.waitForTimeout(500);

    await window.click('#newNoteBtn');
    await window.locator('.ProseMirror').click();
    await window.waitForTimeout(100);
    await window.keyboard.type('Project Doc');
    await window.waitForTimeout(1500); // Wait for title extraction to complete

    // Verify Projects shows count of 1
    let projectsCount = await projectsAllNotes.locator('.folder-count').textContent();
    expect(parseInt(projectsCount)).toBe(1);

    // Remove Projects directory
    await window.click('.settings-btn');
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


    // Verify primary directory shows count of 0
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const primaryCount = await primaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(primaryCount)).toBe(0);

    // Verify editor is cleared
    const editorTitle = await window.locator('.editor-note-title').textContent();
    expect(editorTitle).toBe('');


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


    // Verify primary directory STILL shows count of 0
    const restoredPrimaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    const restoredPrimaryCount = await restoredPrimaryAllNotes.locator('.folder-count').textContent();
    expect(parseInt(restoredPrimaryCount)).toBe(0);

  });
});
