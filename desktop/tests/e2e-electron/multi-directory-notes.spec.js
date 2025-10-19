import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

test.describe('Multi-Directory Note Creation - Electron Mode', () => {
  let testDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-multi-dir-notes-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    // Launch Electron app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();

    // Capture console logs
    window.on('console', msg => {
      if (msg.text().includes('[NoteManager') || msg.text().includes('[createNewNote]') || msg.text().includes('syncDirectoryId')) {
        console.log(`[Browser Console] ${msg.text()}`);
      }
    });

    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close the app
    await electronApp.close();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean up test directory:', err);
    }
  });

  test('should create note in primary sync directory', async () => {
    // Click new note button
    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);

    // Verify editor is visible
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeVisible();

    // Type some content
    await window.keyboard.type('Primary Directory Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('This note is in the primary directory');
    await window.waitForTimeout(2000); // Wait for auto-save

    console.log('[Test] Created note in primary directory');

    // Verify note appears in notes list
    const noteItem = window.locator('.note-item').filter({ hasText: 'Primary Directory Note' });
    await expect(noteItem).toBeVisible();

    console.log('[Test] Note visible in notes list');
  });

  test('should create note in secondary sync directory when folder selected', async () => {
    // Create a second sync directory
    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    // Open settings
    await window.click('.settings-btn');
    await window.waitForTimeout(500);

    // Add second directory
    await window.click('#addSyncDirectoryBtn');
    await window.waitForTimeout(500);

    await window.locator('#syncDirName').fill('Second Workspace');
    await window.evaluate((p) => {
      document.querySelector('#syncDirPath').value = p;
    }, secondDir);
    await window.click('#confirmAddDir');
    await window.waitForTimeout(1000);

    // Close settings
    await window.click('#settingsClose');
    await window.waitForTimeout(500);

    console.log('[Test] Created second sync directory');

    // Click "All Notes" in second directory
    const secondDirGroup = window.locator('.sync-directory-group').nth(1);
    const allNotesFolder = secondDirGroup.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotesFolder.click();
    await window.waitForTimeout(500);

    console.log('[Test] Selected All Notes in second directory');

    // Create new note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);

    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeVisible();

    await window.keyboard.type('Secondary Directory Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('This note is in the secondary directory');
    await window.waitForTimeout(2000);

    console.log('[Test] Created note in secondary directory');

    // Verify note appears in second directory's notes list
    const noteItem = window.locator('.note-item').filter({ hasText: 'Secondary Directory Note' });
    await expect(noteItem).toBeVisible();

    // Switch to primary directory and verify note is NOT there
    const primaryDirGroup = window.locator('.sync-directory-group').first();
    const primaryAllNotes = primaryDirGroup.locator('.folder-item').filter({ hasText: 'All Notes' });
    await primaryAllNotes.click();
    await window.waitForTimeout(500);

    await expect(noteItem).not.toBeVisible();

    console.log('[Test] Note correctly scoped to secondary directory');
  });

  test('should persist notes in correct directory across app restart', async () => {
    // Create a second sync directory
    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    // Add second directory
    await window.click('.settings-btn');
    await window.waitForTimeout(500);
    await window.click('#addSyncDirectoryBtn');
    await window.waitForTimeout(500);
    await window.locator('#syncDirName').fill('Second Workspace');
    await window.evaluate((p) => {
      document.querySelector('#syncDirPath').value = p;
    }, secondDir);
    await window.click('#confirmAddDir');
    await window.waitForTimeout(1000);
    await window.click('#settingsClose');
    await window.waitForTimeout(500);

    // Create note in primary directory
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await primaryAllNotes.click();
    await window.waitForTimeout(500);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);
    await window.keyboard.type('Primary Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Primary content');
    await window.waitForTimeout(2000);

    // Create note in secondary directory
    const secondAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await secondAllNotes.click();
    await window.waitForTimeout(500);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);
    await window.keyboard.type('Secondary Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Secondary content');
    await window.waitForTimeout(2000);

    console.log('[Test] Created notes in both directories');

    // Close app
    await electronApp.close();
    console.log('[Test] Closed app, reopening...');

    // Relaunch app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();

    // Capture console logs for the restarted app BEFORE waiting
    window.on('console', msg => {
      console.log(`[Browser Console RESTART] ${msg.text()}`);
    });

    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(3000); // Wait longer for notes to load

    console.log('[Test] App reopened');

    // Verify primary note is in primary directory
    const restoredPrimaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await restoredPrimaryAllNotes.click();
    await window.waitForTimeout(500);

    const primaryNote = window.locator('.note-item').filter({ hasText: 'Primary Note' });
    await expect(primaryNote).toBeVisible();
    const secondaryNote = window.locator('.note-item').filter({ hasText: 'Secondary Note' });
    await expect(secondaryNote).not.toBeVisible();

    // Verify secondary note is in secondary directory
    const restoredSecondAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await restoredSecondAllNotes.click();
    await window.waitForTimeout(500);

    await expect(secondaryNote).toBeVisible();
    await expect(primaryNote).not.toBeVisible();

    console.log('[Test] Notes correctly persisted in their directories!');
  });

  test('should show notes only in their respective sync directories', async () => {
    // Create a second sync directory
    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    // Add second directory
    await window.click('.settings-btn');
    await window.waitForTimeout(500);
    await window.click('#addSyncDirectoryBtn');
    await window.waitForTimeout(500);
    await window.locator('#syncDirName').fill('Work');
    await window.evaluate((p) => {
      document.querySelector('#syncDirPath').value = p;
    }, secondDir);
    await window.click('#confirmAddDir');
    await window.waitForTimeout(1000);
    await window.click('#settingsClose');
    await window.waitForTimeout(500);

    // Create 2 notes in primary directory
    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);
    await window.keyboard.type('Personal Note 1');
    await window.waitForTimeout(2000);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);
    await window.keyboard.type('Personal Note 2');
    await window.waitForTimeout(2000);

    // Create 2 notes in work directory
    const workAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await workAllNotes.click();
    await window.waitForTimeout(500);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);
    await window.keyboard.type('Work Note 1');
    await window.waitForTimeout(2000);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);
    await window.keyboard.type('Work Note 2');
    await window.waitForTimeout(2000);

    console.log('[Test] Created 2 notes in each directory');

    // Verify count in work directory (should be 2)
    const workNoteItems = window.locator('.note-item');
    expect(await workNoteItems.count()).toBe(2);

    // Switch to personal directory
    const personalAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await personalAllNotes.click();
    await window.waitForTimeout(500);

    // Verify count in personal directory (should be 2)
    expect(await workNoteItems.count()).toBe(2);

    console.log('[Test] Notes correctly isolated by directory!');
  });

  test('should create notes in nested folders within secondary directory', async () => {
    // Create a second sync directory
    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    // Add second directory
    await window.click('.settings-btn');
    await window.waitForTimeout(500);
    await window.click('#addSyncDirectoryBtn');
    await window.waitForTimeout(500);
    await window.locator('#syncDirName').fill('Projects');
    await window.evaluate((p) => {
      document.querySelector('#syncDirPath').value = p;
    }, secondDir);
    await window.click('#confirmAddDir');
    await window.waitForTimeout(1000);
    await window.click('#settingsClose');
    await window.waitForTimeout(500);

    // Click "All Notes" in Projects directory
    const projectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotes.click();
    await window.waitForTimeout(500);

    // Create a folder in Projects directory
    await window.click('#newFolderBtn');
    await window.waitForTimeout(500);

    const dialogInput = window.locator('#dialogInput');
    await dialogInput.fill('Client Work');
    await window.click('#dialogOk');
    await window.waitForTimeout(500);

    console.log('[Test] Created folder in Projects directory');

    // Select the folder
    const clientWorkFolder = window.locator('.folder-item').filter({ hasText: 'Client Work' });
    await clientWorkFolder.click();
    await window.waitForTimeout(500);

    // Create note in the folder
    await window.click('#newNoteBtn');
    await window.waitForTimeout(500);

    await window.keyboard.type('Client Project Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Project details');
    await window.waitForTimeout(2000);

    console.log('[Test] Created note in folder');

    // Verify note is visible
    const noteItem = window.locator('.note-item').filter({ hasText: 'Client Project Note' });
    await expect(noteItem).toBeVisible();

    // Verify note is NOT in primary directory
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await primaryAllNotes.click();
    await window.waitForTimeout(500);

    await expect(noteItem).not.toBeVisible();

    console.log('[Test] Note correctly scoped to folder in secondary directory!');
  });
});
