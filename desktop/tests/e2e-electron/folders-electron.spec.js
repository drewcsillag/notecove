import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.describe('Folder Persistence - Electron Mode (CRDT)', () => {
  let electronApp;
  let window;
  let testDir;

  test.beforeEach(async () => {
    // Create a temporary directory for test data
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-folders-test-'));
    console.log('Test directory:', testDir);

    // Launch Electron app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close the app
    if (electronApp) {
      await electronApp.close();
    }

    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should persist folder creation across app restarts', async () => {
    // Create a folder
    await window.locator('#newFolderBtn').click();
    const dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Persistent Folder');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    console.log('Created folder "Persistent Folder"');

    // Verify folder is visible
    const folder = window.locator('.folder-item').filter({ hasText: 'Persistent Folder' });
    await expect(folder).toBeVisible();

    // Close app
    await electronApp.close();

    console.log('Closed app, reopening...');

    // Relaunch app with same data directory
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    console.log('App reopened, checking for folder...');

    // Folder should still exist
    const restoredFolder = window.locator('.folder-item').filter({ hasText: 'Persistent Folder' });
    await expect(restoredFolder).toBeVisible({ timeout: 5000 });

    console.log('Folder successfully persisted!');
  });

  test('should persist folder rename across app restarts', async () => {
    // Create a folder
    await window.locator('#newFolderBtn').click();
    let dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Original Name');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    console.log('Created folder "Original Name"');

    // Rename the folder via context menu
    const folder = window.locator('.folder-item').filter({ hasText: 'Original Name' });
    await folder.dispatchEvent('contextmenu');
    await window.waitForTimeout(300);

    // Mock the prompt to return new name
    await window.evaluate(() => {
      window.prompt = () => 'Renamed Folder';
    });

    const renameOption = window.locator('[data-action="rename"]');
    await renameOption.click();
    await window.waitForTimeout(1000);

    console.log('Renamed folder to "Renamed Folder"');

    // Verify folder has new name
    const renamedFolder = window.locator('.folder-item').filter({ hasText: 'Renamed Folder' });
    await expect(renamedFolder).toBeVisible();

    // Close app
    await electronApp.close();

    console.log('Closed app, reopening...');

    // Relaunch app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    console.log('App reopened, checking for renamed folder...');

    // Folder should have new name
    const restoredFolder = window.locator('.folder-item').filter({ hasText: 'Renamed Folder' });
    await expect(restoredFolder).toBeVisible({ timeout: 5000 });

    // Old name should not exist
    const oldFolder = window.locator('.folder-item').filter({ hasText: 'Original Name' });
    await expect(oldFolder).not.toBeVisible();

    console.log('Folder rename successfully persisted!');
  });

  test('should persist folder deletion across app restarts', async () => {
    // Create a folder
    await window.locator('#newFolderBtn').click();
    const dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Folder to Delete');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    console.log('Created folder "Folder to Delete"');

    // Verify folder exists
    let folder = window.locator('.folder-item').filter({ hasText: 'Folder to Delete' });
    await expect(folder).toBeVisible();

    // Delete the folder via context menu
    await folder.dispatchEvent('contextmenu');
    await window.waitForTimeout(300);

    // Mock confirm to return true
    await window.evaluate(() => {
      window.confirm = () => true;
    });

    const deleteOption = window.locator('[data-action="delete"]');
    await deleteOption.click();
    await window.waitForTimeout(1000);

    console.log('Deleted folder');

    // Verify folder is gone
    await expect(folder).not.toBeVisible();

    // Close app
    await electronApp.close();

    console.log('Closed app, reopening...');

    // Relaunch app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    console.log('App reopened, checking folder is still deleted...');

    // Folder should still be deleted
    folder = window.locator('.folder-item').filter({ hasText: 'Folder to Delete' });
    await expect(folder).not.toBeVisible();

    console.log('Folder deletion successfully persisted!');
  });

  test('should persist nested folder structure across app restarts', async () => {
    // Create a parent folder
    await window.locator('#newFolderBtn').click();
    let dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Parent Folder');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    console.log('Created parent folder');

    // Select the parent folder
    const parentFolder = window.locator('.folder-item').filter({ hasText: 'Parent Folder' });
    await parentFolder.click();
    await window.waitForTimeout(200);

    // Create a child folder
    await window.locator('#newFolderBtn').click();

    // Handle confirm dialog for subfolder creation
    const confirmBtn = window.locator('#dialogConfirm');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await window.waitForTimeout(200);

    // Handle input dialog for folder name
    dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Child Folder');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    console.log('Created child folder');

    // Verify child folder is nested (has more padding)
    const childFolder = window.locator('.folder-item').filter({ hasText: 'Child Folder' });
    await expect(childFolder).toBeVisible();

    const parentPadding = await parentFolder.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });

    const childPaddingBefore = await childFolder.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });

    expect(childPaddingBefore).toBeGreaterThan(parentPadding);

    console.log(`Parent padding: ${parentPadding}px, Child padding: ${childPaddingBefore}px`);

    // Close app
    await electronApp.close();

    console.log('Closed app, reopening...');

    // Relaunch app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    console.log('App reopened, checking nested structure...');

    // Both folders should exist
    const restoredParent = window.locator('.folder-item').filter({ hasText: 'Parent Folder' });
    const restoredChild = window.locator('.folder-item').filter({ hasText: 'Child Folder' });

    await expect(restoredParent).toBeVisible({ timeout: 5000 });
    await expect(restoredChild).toBeVisible({ timeout: 5000 });

    // Child should still be nested
    const restoredParentPadding = await restoredParent.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });

    const restoredChildPadding = await restoredChild.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });

    expect(restoredChildPadding).toBeGreaterThan(restoredParentPadding);

    console.log(`Restored parent padding: ${restoredParentPadding}px, child padding: ${restoredChildPadding}px`);
    console.log('Nested structure successfully persisted!');
  });

  test('should persist folder move operations across app restarts', async () => {
    // Create a parent folder
    await window.locator('#newFolderBtn').click();
    let dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Parent');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    // Select the parent folder
    const parentFolder = window.locator('.folder-item').filter({ hasText: 'Parent' });
    await parentFolder.click();
    await window.waitForTimeout(200);

    // Create a child folder
    await window.locator('#newFolderBtn').click();
    const confirmBtn = window.locator('#dialogConfirm');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await window.waitForTimeout(200);

    dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Nested Child');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    console.log('Created nested child folder');

    // Move child to root level via context menu
    const childFolder = window.locator('.folder-item').filter({ hasText: 'Nested Child' });
    await childFolder.dispatchEvent('contextmenu');
    await window.waitForTimeout(300);

    const moveToRootOption = window.locator('[data-action="move-to-root"]');
    await moveToRootOption.click();
    await window.waitForTimeout(1000);

    console.log('Moved child to root level');

    // Verify child is now at root level (same padding as parent)
    const parentPadding = await parentFolder.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });

    const childPadding = await childFolder.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });

    expect(childPadding).toBe(parentPadding);

    console.log(`After move - Parent padding: ${parentPadding}px, Child padding: ${childPadding}px`);

    // Close app
    await electronApp.close();

    console.log('Closed app, reopening...');

    // Relaunch app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    console.log('App reopened, checking folder positions...');

    // Both folders should exist at root level
    const restoredParent = window.locator('.folder-item').filter({ hasText: 'Parent' });
    const restoredChild = window.locator('.folder-item').filter({ hasText: 'Nested Child' });

    await expect(restoredParent).toBeVisible({ timeout: 5000 });
    await expect(restoredChild).toBeVisible({ timeout: 5000 });

    // Child should still be at root level
    const restoredParentPadding = await restoredParent.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });

    const restoredChildPadding = await restoredChild.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });

    expect(restoredChildPadding).toBe(restoredParentPadding);

    console.log(`Restored - Parent padding: ${restoredParentPadding}px, Child padding: ${restoredChildPadding}px`);
    console.log('Folder move successfully persisted!');
  });
});

test.describe('Folder Multi-Instance Sync - Electron Mode (CRDT)', () => {
  let testDir;
  let electronApp1;
  let window1;
  let electronApp2;
  let window2;

  test.beforeEach(async () => {
    // Create a shared temporary directory for both instances
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-folders-sync-test-'));
    console.log('Test directory:', testDir);

    // Launch first Electron instance
    electronApp1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window1 = await electronApp1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    console.log('Instance 1 launched');

    // Launch second Electron instance
    electronApp2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window2 = await electronApp2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(1000);

    console.log('Instance 2 launched');
  });

  test.afterEach(async () => {
    // Close both apps
    if (electronApp1) {
      await electronApp1.close();
    }
    if (electronApp2) {
      await electronApp2.close();
    }

    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should sync folder creation between instances', async () => {
    // Create a folder in instance 1
    await window1.locator('#newFolderBtn').click();
    const dialogInput = window1.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Synced Folder');
    await window1.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window1.waitForTimeout(1000);

    console.log('Created folder in instance 1');

    // Verify folder appears in instance 1
    const folder1 = window1.locator('.folder-item').filter({ hasText: 'Synced Folder' });
    await expect(folder1).toBeVisible();

    // Trigger sync by switching folders in instance 2
    const allNotes2 = window2.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes2.click();
    await window2.waitForTimeout(2000);

    console.log('Waiting for sync to instance 2...');

    // Folder should appear in instance 2
    const folder2 = window2.locator('.folder-item').filter({ hasText: 'Synced Folder' });
    await expect(folder2).toBeVisible({ timeout: 5000 });

    console.log('Folder synced to instance 2!');
  });

  test('should sync folder rename between instances', async () => {
    // Create a folder in instance 1
    await window1.locator('#newFolderBtn').click();
    let dialogInput = window1.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Original Folder');
    await window1.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window1.waitForTimeout(1000);

    console.log('Created folder in instance 1');

    // Wait for sync
    await window2.waitForTimeout(2000);

    // Verify it appears in instance 2
    let folder2 = window2.locator('.folder-item').filter({ hasText: 'Original Folder' });
    await expect(folder2).toBeVisible({ timeout: 5000 });

    console.log('Folder appeared in instance 2');

    // Rename folder in instance 1
    const folder1 = window1.locator('.folder-item').filter({ hasText: 'Original Folder' });
    await folder1.dispatchEvent('contextmenu');
    await window1.waitForTimeout(300);

    await window1.evaluate(() => {
      window.prompt = () => 'Renamed Folder';
    });

    const renameOption = window1.locator('[data-action="rename"]');
    await renameOption.click();
    await window1.waitForTimeout(1000);

    console.log('Renamed folder in instance 1');

    // Wait for sync
    await window2.waitForTimeout(2000);

    // Folder should have new name in instance 2
    const renamedFolder2 = window2.locator('.folder-item').filter({ hasText: 'Renamed Folder' });
    await expect(renamedFolder2).toBeVisible({ timeout: 5000 });

    // Old name should not exist in instance 2
    const oldFolder2 = window2.locator('.folder-item').filter({ hasText: 'Original Folder' });
    await expect(oldFolder2).not.toBeVisible();

    console.log('Folder rename synced to instance 2!');
  });

  test('should sync folder deletion between instances', async () => {
    // Create a folder in instance 1
    await window1.locator('#newFolderBtn').click();
    const dialogInput = window1.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Folder to Delete');
    await window1.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window1.waitForTimeout(1000);

    console.log('Created folder in instance 1');

    // Wait for sync
    await window2.waitForTimeout(2000);

    // Verify it appears in instance 2
    let folder2 = window2.locator('.folder-item').filter({ hasText: 'Folder to Delete' });
    await expect(folder2).toBeVisible({ timeout: 5000 });

    console.log('Folder appeared in instance 2');

    // Delete folder in instance 1
    const folder1 = window1.locator('.folder-item').filter({ hasText: 'Folder to Delete' });
    await folder1.dispatchEvent('contextmenu');
    await window1.waitForTimeout(300);

    await window1.evaluate(() => {
      window.confirm = () => true;
    });

    const deleteOption = window1.locator('[data-action="delete"]');
    await deleteOption.click();
    await window1.waitForTimeout(1000);

    console.log('Deleted folder in instance 1');

    // Wait for sync
    await window2.waitForTimeout(2000);

    // Folder should be deleted in instance 2
    folder2 = window2.locator('.folder-item').filter({ hasText: 'Folder to Delete' });
    await expect(folder2).not.toBeVisible();

    console.log('Folder deletion synced to instance 2!');
  });

  test('should sync folder unnesting/move operations between instances', async () => {
    // Create a parent folder in instance 1
    await window1.locator('#newFolderBtn').click();
    let dialogInput = window1.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Parent');
    await window1.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window1.waitForTimeout(500);

    // Select the parent folder
    const parentFolder1 = window1.locator('.folder-item').filter({ hasText: 'Parent' });
    await parentFolder1.click();
    await window1.waitForTimeout(200);

    // Create a child folder
    await window1.locator('#newFolderBtn').click();
    const confirmBtn = window1.locator('#dialogConfirm');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await window1.waitForTimeout(200);

    dialogInput = window1.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Nested Child');
    await window1.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window1.waitForTimeout(1000);

    console.log('Created nested structure in instance 1');

    // Wait for sync
    await window2.waitForTimeout(2000);

    // Verify nested structure in instance 2
    const parentFolder2 = window2.locator('.folder-item').filter({ hasText: 'Parent' });
    const childFolder2 = window2.locator('.folder-item').filter({ hasText: 'Nested Child' });
    await expect(parentFolder2).toBeVisible({ timeout: 5000 });
    await expect(childFolder2).toBeVisible({ timeout: 5000 });

    console.log('Nested structure appeared in instance 2');

    // Move child to root level in instance 1
    const childFolder1 = window1.locator('.folder-item').filter({ hasText: 'Nested Child' });
    await childFolder1.dispatchEvent('contextmenu');
    await window1.waitForTimeout(300);

    const moveToRootOption = window1.locator('[data-action="move-to-root"]');
    await moveToRootOption.click();
    await window1.waitForTimeout(1000);

    console.log('Moved child to root in instance 1');

    // Verify move in instance 1
    const parentPadding1 = await parentFolder1.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });
    const childPadding1 = await childFolder1.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });
    expect(childPadding1).toBe(parentPadding1);

    // Wait for sync
    await window2.waitForTimeout(2000);

    // Child should be at root level in instance 2
    const parentPadding2 = await parentFolder2.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });
    const childPadding2 = await childFolder2.evaluate(el => {
      return parseInt(window.getComputedStyle(el).paddingLeft);
    });
    expect(childPadding2).toBe(parentPadding2);

    console.log('Folder move synced to instance 2!');
  });
});

test.describe('Folder Validation - Electron Mode (CRDT)', () => {
  let testDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-folders-validation-'));
    console.log('Test directory:', testDir);

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
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
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should prevent deleting folder with notes and persist validation', async () => {
    // Create a folder
    await window.locator('#newFolderBtn').click();
    let dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Folder with Notes');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    // Select the folder
    const testFolder = window.locator('.folder-item').filter({ hasText: 'Folder with Notes' });
    await testFolder.click();
    await window.waitForTimeout(200);

    // Create a note in the folder
    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Note Title');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Note in folder');
    await window.waitForTimeout(2000); // Wait for save

    console.log('Created note in folder');

    // Try to delete the folder
    let alertMessage = '';
    window.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await testFolder.dispatchEvent('contextmenu');
    await window.waitForTimeout(300);

    const deleteOption = window.locator('[data-action="delete"]');
    await deleteOption.click();
    await window.waitForTimeout(500);

    // Should show alert about folder containing notes
    expect(alertMessage).toContain('Cannot delete folder');
    expect(alertMessage).toContain('contains 1 note');

    // Folder should still exist
    await expect(testFolder).toBeVisible();

    console.log('Delete prevented in instance 1');

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Folder and note should both still exist
    const restoredFolder = window.locator('.folder-item').filter({ hasText: 'Folder with Notes' });
    await expect(restoredFolder).toBeVisible({ timeout: 5000 });

    await restoredFolder.click();
    await window.waitForTimeout(500);

    const noteItem = window.locator('.note-item').filter({ hasText: 'Note Title' });
    await expect(noteItem).toBeVisible();

    console.log('Folder and note both persisted correctly!');
  });

  test('should prevent deleting folder with subfolders and persist validation', async () => {
    // Create a parent folder
    await window.locator('#newFolderBtn').click();
    let dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Parent with Child');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    // Select the parent folder
    const parentFolder = window.locator('.folder-item').filter({ hasText: 'Parent with Child' });
    await parentFolder.click();
    await window.waitForTimeout(200);

    // Create a child folder
    await window.locator('#newFolderBtn').click();
    const confirmBtn = window.locator('#dialogConfirm');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await window.waitForTimeout(200);

    dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Child');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    console.log('Created parent with child folder');

    // Try to delete parent folder
    let alertMessage = '';
    window.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await parentFolder.dispatchEvent('contextmenu');
    await window.waitForTimeout(300);

    const deleteOption = window.locator('[data-action="delete"]');
    await deleteOption.click();
    await window.waitForTimeout(500);

    // Should show alert about subfolders
    expect(alertMessage).toContain('Cannot delete folder');
    expect(alertMessage).toContain('contains subfolders');

    // Parent folder should still exist
    await expect(parentFolder).toBeVisible();

    console.log('Delete prevented');

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Both folders should still exist
    const restoredParent = window.locator('.folder-item').filter({ hasText: 'Parent with Child' });
    // Match Child folder by checking folder-name span with exact text match
    const restoredChild = window.locator('.folder-item .folder-name:text-is("Child")');
    await expect(restoredParent).toBeVisible({ timeout: 5000 });
    await expect(restoredChild).toBeVisible({ timeout: 5000 });

    console.log('Both folders persisted correctly!');
  });
});

test.describe('Folder Notes Association - Electron Mode (CRDT)', () => {
  let testDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-folder-notes-'));
    console.log('Test directory:', testDir);

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
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
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should persist note folder assignment across app restarts', async () => {
    // Create a folder
    await window.locator('#newFolderBtn').click();
    const dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Project Notes');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    // Select the folder
    const projectFolder = window.locator('.folder-item').filter({ hasText: 'Project Notes' });
    await projectFolder.click();
    await window.waitForTimeout(200);

    // Create a note in the folder
    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Project Task');
    await window.keyboard.press('Enter');
    await window.keyboard.type('This is a project task');
    await window.waitForTimeout(2000);

    console.log('Created note in Project Notes folder');

    // Verify note is in folder
    const noteItem = window.locator('.note-item').filter({ hasText: 'Project Task' });
    await expect(noteItem).toBeVisible();

    // Close app
    await electronApp.close();

    console.log('Closed app, reopening...');

    // Relaunch app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Select the folder again
    const restoredFolder = window.locator('.folder-item').filter({ hasText: 'Project Notes' });
    await restoredFolder.click();
    await window.waitForTimeout(500);

    // Note should still be in the folder
    const restoredNote = window.locator('.note-item').filter({ hasText: 'Project Task' });
    await expect(restoredNote).toBeVisible();

    console.log('Note folder assignment persisted!');
  });

  test('should persist note folder changes via drag-and-drop across restarts', async () => {
    // Create two folders
    await window.locator('#newFolderBtn').click();
    let dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Folder A');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    await window.locator('#newFolderBtn').click();
    dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Folder B');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    console.log('Created two folders');

    // Select Folder A and create a note
    const folderA = window.locator('.folder-item').filter({ hasText: 'Folder A' });
    await folderA.click();
    await window.waitForTimeout(200);

    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Note to Move');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Content');
    await window.waitForTimeout(2000);

    console.log('Created note in Folder A');

    // Drag note to Folder B
    const noteItem = window.locator('.note-item').filter({ hasText: 'Note to Move' });
    const folderB = window.locator('.folder-item').filter({ hasText: 'Folder B' });
    await noteItem.dragTo(folderB);
    await window.waitForTimeout(1000);

    console.log('Dragged note to Folder B');

    // Verify note is now in Folder B
    await folderB.click();
    await window.waitForTimeout(500);
    await expect(noteItem).toBeVisible();

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Note should still be in Folder B
    const restoredFolderB = window.locator('.folder-item').filter({ hasText: 'Folder B' });
    await restoredFolderB.click();
    await window.waitForTimeout(500);

    const restoredNote = window.locator('.note-item').filter({ hasText: 'Note to Move' });
    await expect(restoredNote).toBeVisible();

    // Note should NOT be in Folder A
    const restoredFolderA = window.locator('.folder-item').filter({ hasText: 'Folder A' });
    await restoredFolderA.click();
    await window.waitForTimeout(500);
    await expect(restoredNote).not.toBeVisible();

    console.log('Note folder change persisted!');
  });

  test('should filter notes by folder correctly after restart', async () => {
    // Create two folders
    await window.locator('#newFolderBtn').click();
    let dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Work');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    await window.locator('#newFolderBtn').click();
    dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Personal');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    // Create note in Work folder
    const workFolder = window.locator('.folder-item').filter({ hasText: 'Work' });
    await workFolder.click();
    await window.waitForTimeout(200);

    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Work Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Work content');
    await window.waitForTimeout(2000);

    // Create note in Personal folder
    const personalFolder = window.locator('.folder-item').filter({ hasText: 'Personal' });
    await personalFolder.click();
    await window.waitForTimeout(200);

    await window.locator('#newNoteBtn').click();
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Personal Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Personal content');
    await window.waitForTimeout(2000);

    console.log('Created notes in both folders');

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Select Work folder - should only show work note
    const restoredWork = window.locator('.folder-item').filter({ hasText: 'Work' });
    await restoredWork.click();
    await window.waitForTimeout(500);

    const workNote = window.locator('.note-item').filter({ hasText: 'Work Note' });
    const personalNote = window.locator('.note-item').filter({ hasText: 'Personal Note' });

    await expect(workNote).toBeVisible();
    await expect(personalNote).not.toBeVisible();

    // Select Personal folder - should only show personal note
    const restoredPersonal = window.locator('.folder-item').filter({ hasText: 'Personal' });
    await restoredPersonal.click();
    await window.waitForTimeout(500);

    await expect(personalNote).toBeVisible();
    await expect(workNote).not.toBeVisible();

    console.log('Folder filtering persisted correctly!');
  });
});

test.describe('Trash Operations - Electron Mode (CRDT)', () => {
  let testDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-trash-'));
    console.log('Test directory:', testDir);

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
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
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should persist note restore from trash across app restarts', async () => {
    // Create a note
    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Restore Me');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Content to restore');
    await window.waitForTimeout(2000);

    console.log('Created note');

    // Delete the note
    await window.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = window.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await window.waitForTimeout(500);

    console.log('Deleted note');

    // Go to trash and restore
    const trashFolder = window.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await window.waitForTimeout(500);

    const restoreBtn = window.locator('.restore-btn').first();
    await restoreBtn.click();
    await window.waitForTimeout(500);

    console.log('Restored note from trash');

    // Verify note is back in All Notes
    const allNotes = window.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await window.waitForTimeout(500);

    const noteItem = window.locator('.note-item').filter({ hasText: 'Restore Me' });
    await expect(noteItem).toBeVisible();

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Note should still be restored (not in trash)
    const restoredAllNotes = window.locator('.folder-item').filter({ hasText: 'All Notes' });
    await restoredAllNotes.click();
    await window.waitForTimeout(500);

    const restoredNote = window.locator('.note-item').filter({ hasText: 'Restore Me' });
    await expect(restoredNote).toBeVisible();

    // Should not be in trash
    const restoredTrash = window.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await restoredTrash.click();
    await window.waitForTimeout(500);
    await expect(restoredNote).not.toBeVisible();

    console.log('Note restore persisted!');
  });

  test('should persist permanent deletion from trash across app restarts', async () => {
    // Create a note
    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Delete Forever');
    await window.keyboard.press('Enter');
    await window.keyboard.type('This will be gone');
    await window.waitForTimeout(2000);

    console.log('Created note');

    // Delete the note
    await window.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = window.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await window.waitForTimeout(500);

    console.log('Deleted note (moved to trash)');

    // Go to trash and permanently delete
    const trashFolder = window.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await window.waitForTimeout(500);

    const permDeleteBtn = window.locator('.delete-btn').first();
    await permDeleteBtn.click();
    await window.waitForTimeout(500);

    console.log('Permanently deleted note from trash');

    // Note should be gone from trash
    const noteItem = window.locator('.note-item').filter({ hasText: 'Delete Forever' });
    await expect(noteItem).not.toBeVisible();

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Note should still be permanently deleted
    const restoredTrash = window.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await restoredTrash.click();
    await window.waitForTimeout(500);

    const deletedNote = window.locator('.note-item').filter({ hasText: 'Delete Forever' });
    await expect(deletedNote).not.toBeVisible();

    // Also check All Notes
    const restoredAllNotes = window.locator('.folder-item').filter({ hasText: 'All Notes' });
    await restoredAllNotes.click();
    await window.waitForTimeout(500);
    await expect(deletedNote).not.toBeVisible();

    console.log('Permanent deletion persisted!');
  });

  test('should persist note restore via drag-and-drop from trash', async () => {
    // Create a folder
    await window.locator('#newFolderBtn').click();
    const dialogInput = window.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Restore Folder');
    await window.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await window.waitForTimeout(500);

    // Create and delete a note
    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Restore via Drag');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Content');
    await window.waitForTimeout(2000);

    await window.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = window.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await window.waitForTimeout(500);

    console.log('Created and deleted note');

    // Go to trash
    const trashFolder = window.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await window.waitForTimeout(500);

    // Drag note to restore folder
    const noteItem = window.locator('.note-item').filter({ hasText: 'Restore via Drag' });
    const restoreFolder = window.locator('.folder-item').filter({ hasText: 'Restore Folder' });
    await noteItem.dragTo(restoreFolder);
    await window.waitForTimeout(1000);

    console.log('Dragged note from trash to folder');

    // Verify note is in restore folder
    await restoreFolder.click();
    await window.waitForTimeout(500);
    await expect(noteItem).toBeVisible();

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Note should still be in restore folder
    const restoredFolder = window.locator('.folder-item').filter({ hasText: 'Restore Folder' });
    await restoredFolder.click();
    await window.waitForTimeout(500);

    const restoredNote = window.locator('.note-item').filter({ hasText: 'Restore via Drag' });
    await expect(restoredNote).toBeVisible();

    // Should not be in trash
    const restoredTrash = window.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await restoredTrash.click();
    await window.waitForTimeout(500);
    await expect(restoredNote).not.toBeVisible();

    console.log('Drag-and-drop restore persisted!');
  });
});
