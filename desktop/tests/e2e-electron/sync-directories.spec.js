import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

test.describe('Sync Directory Management - Electron Mode', () => {
  let testDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-sync-dirs-test-' + Date.now());
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

  test('should show default sync directory on first launch', async () => {
    // Open settings
    const settingsBtn = window.locator('.settings-btn');
    await settingsBtn.click();
    await window.waitForTimeout(500);

    // Settings panel should be visible
    const settingsPanel = window.locator('#settingsOverlay');
    await expect(settingsPanel).toBeVisible();

    // Check if sync directories list is visible
    const syncDirsList = window.locator('#syncDirectoriesList');
    await expect(syncDirsList).toBeVisible();

    // Should show at least one sync directory (default)
    const syncDirItems = window.locator('.sync-directory-group');
    const count = await syncDirItems.count();
    console.log('[Test] Found sync directory groups:', count);
    expect(count).toBeGreaterThan(0);
  });

  test('should open and close settings panel', async () => {
    // Open settings
    const settingsBtn = window.locator('.settings-btn');
    await settingsBtn.click();
    await window.waitForTimeout(500);

    // Settings should be visible
    const settingsPanel = window.locator('#settingsOverlay');
    await expect(settingsPanel).toBeVisible();

    // Close settings
    const closeBtn = window.locator('#settingsClose');
    await closeBtn.click();
    await window.waitForTimeout(300);

    // Settings should be hidden
    await expect(settingsPanel).not.toBeVisible();
  });

  test('should add a new sync directory', async () => {
    // Create test sync directory
    const syncPath = path.join(testDir, 'test-sync-dir');
    await fs.mkdir(syncPath, { recursive: true });

    // Open settings
    await window.click('.settings-btn');
    await window.waitForTimeout(500);

    // Click Add Directory button
    await window.click('#addSyncDirectoryBtn');
    await window.waitForTimeout(500);

    // Add directory dialog should be visible
    const addDialog = window.locator('#addSyncDirectoryOverlay');
    await expect(addDialog).toBeVisible();

    // Fill in name
    const nameInput = window.locator('#syncDirName');
    await nameInput.fill('Test Workspace');

    // Fill in path (manually since we can't click file picker in test)
    await window.evaluate((p) => {
      const pathInput = document.querySelector('#syncDirPath');
      pathInput.value = p;
    }, syncPath);

    // Click Add button
    await window.click('#confirmAddDir');
    await window.waitForTimeout(1000);

    // Dialog should be closed
    await expect(addDialog).not.toBeVisible();

    // Check that the directory was added to the list
    const dirNames = await window.locator('.sync-directory-info .sync-directory-name').allTextContents();
    console.log('[Test] Sync directories:', dirNames);
    expect(dirNames).toContain('Test Workspace');
  });

  test('should rename sync directory', async () => {
    // Open settings
    await window.click('.settings-btn');
    await window.waitForTimeout(500);

    // Get first directory's rename button
    const renameBtn = window.locator('button:has-text("Rename")').first();

    // Click rename button
    await renameBtn.click();
    await window.waitForTimeout(500);

    // Fill in the input dialog
    const dialogInput = window.locator('#dialogInput');
    await dialogInput.fill('Renamed Directory');

    // Click OK button
    await window.click('#dialogOk');
    await window.waitForTimeout(1000);

    // Check that the directory was renamed
    const dirNames = await window.locator('.sync-directory-info .sync-directory-name').allTextContents();
    console.log('[Test] After rename:', dirNames);
    expect(dirNames).toContain('Renamed Directory');
  });

  test('should remove sync directory', async () => {
    // First add a directory
    const syncPath = path.join(testDir, 'temp-sync-dir');
    await fs.mkdir(syncPath, { recursive: true });

    await window.click('.settings-btn');
    await window.waitForTimeout(500);
    await window.click('#addSyncDirectoryBtn');
    await window.waitForTimeout(500);

    await window.locator('#syncDirName').fill('Temp Dir');
    await window.evaluate((p) => {
      document.querySelector('#syncDirPath').value = p;
    }, syncPath);
    await window.click('#confirmAddDir');
    await window.waitForTimeout(1000);

    // Now remove it (settings panel is still open)
    const initialCount = await window.locator('.sync-directory-info').count();
    console.log('[Test] Initial directory count:', initialCount);

    // Find and click remove button for "Temp Dir"
    const tempDirRow = window.locator('.sync-directory-info:has-text("Temp Dir")').locator('..');
    const removeBtn = tempDirRow.locator('button:has-text("Remove")');

    // Set up confirmation dialog handler
    let confirmDialogShown = false;
    window.on('dialog', async dialog => {
      console.log('[Test] Confirmation dialog:', dialog.message());
      confirmDialogShown = true;
      await dialog.accept();
    });

    // Note: The remove uses showConfirmDialog which creates a DOM dialog, not browser dialog
    // We need to click the confirm button in the DOM
    await removeBtn.click();
    await window.waitForTimeout(500);

    // Click the DOM confirmation dialog button
    const confirmButton = window.locator('#dialogConfirm');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
      await window.waitForTimeout(1000);
    }

    // Check directory was removed
    const finalCount = await window.locator('.sync-directory-info').count();
    console.log('[Test] Final directory count:', finalCount);
    expect(finalCount).toBe(initialCount - 1);
  });

  test('should show sync directories in folder tree', async () => {
    // Check if folder tree has sync directory groups
    const syncDirGroups = window.locator('.sync-directory-group');
    const count = await syncDirGroups.count();
    console.log('[Test] Sync directory groups in folder tree:', count);
    expect(count).toBeGreaterThan(0);

    // Check for sync directory header
    const syncDirHeaders = window.locator('.sync-directory-header');
    await expect(syncDirHeaders.first()).toBeVisible();

    // Headers should have briefcase icon
    const headerText = await syncDirHeaders.first().textContent();
    console.log('[Test] First sync directory header:', headerText);
    expect(headerText).toContain('💼');
  });

  test('should toggle sync directory expansion', async () => {
    const firstHeader = window.locator('.sync-directory-header').first();
    await expect(firstHeader).toBeVisible();

    // Get initial arrow state
    const initialArrow = await firstHeader.locator('.collapse-arrow').textContent();
    console.log('[Test] Initial arrow:', initialArrow);

    // Click to toggle
    await firstHeader.click();
    await window.waitForTimeout(500);

    // Arrow should have changed
    const newArrow = await firstHeader.locator('.collapse-arrow').textContent();
    console.log('[Test] New arrow:', newArrow);
    expect(newArrow).not.toBe(initialArrow);
  });
});
