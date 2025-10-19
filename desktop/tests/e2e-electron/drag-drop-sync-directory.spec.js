const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

test.describe('Drag and Drop - Sync Directory', () => {
  let electronApp;
  let window;
  let testDir;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-drag-drop-test-' + Date.now());
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

  test('should allow dragging note to folder within same sync directory', async () => {
    console.log('[Test] Starting drag and drop test');

    // Create a test folder using the folder manager API directly
    const folderId = await window.evaluate(async () => {
      const folderManager = window.app?.noteManager?.folderManager;
      if (folderManager) {
        const folder = await folderManager.createFolder('Project Docs', 'root');
        await window.app?.renderFolderTree();
        return folder.id;
      }
      return null;
    });

    expect(folderId).toBeTruthy();
    await window.waitForTimeout(500);

    console.log('[Test] Created folder "Project Docs" via API');

    // Create a new note
    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Important Document');
    await window.waitForTimeout(1000); // Wait for note to be created

    console.log('[Test] Created note "Important Document"');

    // Verify note appears in All Notes
    const noteItem = window.locator('.note-item').filter({ hasText: 'Important Document' });
    await expect(noteItem).toBeVisible();

    // Verify Project Docs folder shows count of 0
    const projectDocsFolder = window.locator('.folder-item').filter({ hasText: 'Project Docs' });
    await expect(projectDocsFolder).toBeVisible();

    let folderCount = await projectDocsFolder.locator('.folder-count').textContent();
    expect(parseInt(folderCount)).toBe(0);

    console.log('[Test] Project Docs folder shows count of 0');

    // Drag the note to the Project Docs folder
    await noteItem.dragTo(projectDocsFolder);
    await window.waitForTimeout(1000); // Wait for drag operation to complete

    console.log('[Test] Dragged note to Project Docs folder');

    // Verify folder count increased to 1
    folderCount = await projectDocsFolder.locator('.folder-count').textContent();
    expect(parseInt(folderCount)).toBe(1);

    console.log('[Test] Project Docs folder now shows count of 1');

    // Click on Project Docs folder
    await projectDocsFolder.click();
    await window.waitForTimeout(500);

    // Verify note appears in the folder
    await expect(noteItem).toBeVisible();

    console.log('[Test] Note successfully moved to Project Docs folder!');
  });

  test('should allow dragging note to folder within secondary sync directory', async () => {
    console.log('[Test] Starting secondary directory drag test');

    // Wait for app to initialize
    await window.waitForTimeout(1000);

    // Add second sync directory via Settings UI
    await window.click('button[aria-label="Settings"]');
    await window.waitForTimeout(300);
    await window.click('text=Sync Directories');
    await window.waitForTimeout(300);

    // Click Add Directory button
    const addDirBtn = window.locator('button').filter({ hasText: 'Add Directory' });
    await addDirBtn.click();
    await window.waitForTimeout(300);

    // Create and set path for second directory
    const secondDir = path.join(testDir, 'second-sync-dir');
    await fs.mkdir(secondDir, { recursive: true });

    const pathInput = window.locator('input[placeholder*="path" i]').last();
    await pathInput.fill(secondDir);

    const nameInput = window.locator('input[placeholder*="name" i]').last();
    await nameInput.fill('Projects');

    // Save the directory
    const saveBtn = window.locator('button').filter({ hasText: 'Save' });
    await saveBtn.click();
    await window.waitForTimeout(500);

    // Close settings
    const closeBtn = window.locator('button[aria-label="Close settings"]');
    await closeBtn.click();
    await window.waitForTimeout(1000);

    console.log('[Test] Added second sync directory');

    // Select the Projects sync directory
    const projectsAllNotes = window.locator('.sync-directory-group').nth(1)
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await projectsAllNotes.click();
    await window.waitForTimeout(500);

    // Create a folder in Projects directory
    await window.click('button[aria-label="Add folder"]');
    await window.waitForTimeout(300);

    const folderNameInput = window.locator('input[placeholder*="folder name" i]');
    await folderNameInput.fill('Client Files');
    await folderNameInput.press('Enter');
    await window.waitForTimeout(500);

    console.log('[Test] Created folder "Client Files" in Projects directory');

    // Create a note in Projects All Notes
    await projectsAllNotes.click();
    await window.waitForTimeout(300);

    await window.click('#newNoteBtn');
    await window.waitForTimeout(300);
    await window.keyboard.type('Client Proposal');
    await window.waitForTimeout(1000);

    console.log('[Test] Created note "Client Proposal"');

    // Verify note appears
    const noteItem = window.locator('.note-item').filter({ hasText: 'Client Proposal' });
    await expect(noteItem).toBeVisible();

    // Verify Client Files folder shows count of 0
    const clientFilesFolder = window.locator('.folder-item').filter({ hasText: 'Client Files' });
    let folderCount = await clientFilesFolder.locator('.folder-count').textContent();
    expect(parseInt(folderCount)).toBe(0);

    console.log('[Test] Client Files folder shows count of 0');

    // Drag the note to the Client Files folder
    await noteItem.dragTo(clientFilesFolder);
    await window.waitForTimeout(1000);

    console.log('[Test] Dragged note to Client Files folder');

    // Verify folder count increased to 1
    folderCount = await clientFilesFolder.locator('.folder-count').textContent();
    expect(parseInt(folderCount)).toBe(1);

    console.log('[Test] Client Files folder now shows count of 1');

    // Click on Client Files folder
    await clientFilesFolder.click();
    await window.waitForTimeout(500);

    // Verify note appears in the folder
    await expect(noteItem).toBeVisible();

    // Verify note is NOT in primary directory
    const primaryAllNotes = window.locator('.sync-directory-group').first()
      .locator('.folder-item').filter({ hasText: 'All Notes' });
    await primaryAllNotes.click();
    await window.waitForTimeout(500);

    // Note should not be visible in primary directory
    await expect(noteItem).not.toBeVisible();

    console.log('[Test] Note successfully moved within Projects directory!');
  });
});
