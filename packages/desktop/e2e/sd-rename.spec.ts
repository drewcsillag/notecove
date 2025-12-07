/**
 * E2E tests for Storage Directory Rename
 *
 * Tests the SD rename functionality via right-click context menu.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

test.describe('Storage Directory Rename', () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testDbPath: string;
  let testStorageDir: string;

  test.beforeEach(async () => {
    // Create temp directories
    testDbPath = path.join(os.tmpdir(), `notecove-test-${Date.now()}.db`);
    testStorageDir = path.join(os.tmpdir(), `notecove-test-storage-${Date.now()}`);
    await fs.mkdir(testStorageDir, { recursive: true });

    // Launch Electron app with test database
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
    });

    // Wait for the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for app to be ready
    await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close app
    await electronApp.close();

    // Clean up test files
    try {
      await fs.unlink(testDbPath);
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('should show context menu when right-clicking an SD item', async () => {
    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(500);

    // Find the SD list item (the Default SD)
    const sdList = settingsDialog.locator('[role="tabpanel"] ul');
    const sdItem = sdList.locator('li[class*="MuiListItem"]').first();
    await expect(sdItem).toBeVisible();

    // Right-click the SD item
    await sdItem.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Context menu should appear with "Rename" option
    const contextMenu = window.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible();

    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await expect(renameOption).toBeVisible();

    // Close menu by pressing Escape
    await window.keyboard.press('Escape');
  });

  test('should open rename dialog when clicking Rename in context menu', async () => {
    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(500);

    // Find and right-click the SD item
    const sdList = settingsDialog.locator('[role="tabpanel"] ul');
    const sdItem = sdList.locator('li[class*="MuiListItem"]').first();
    await sdItem.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click Rename in context menu
    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await renameOption.click();
    await window.waitForTimeout(500);

    // Rename dialog should appear
    const renameDialog = window.locator('[role="dialog"]:has-text("Rename Storage Directory")');
    await expect(renameDialog).toBeVisible();

    // Should have a text field with the current name
    const nameInput = renameDialog.locator('input[type="text"]');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('Default');

    // Close dialog
    await window.keyboard.press('Escape');
  });

  test('should rename SD successfully', async () => {
    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(500);

    // Find and right-click the SD item
    const sdList = settingsDialog.locator('[role="tabpanel"] ul');
    const sdItem = sdList.locator('li[class*="MuiListItem"]').first();
    await sdItem.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click Rename in context menu
    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await renameOption.click();
    await window.waitForTimeout(500);

    // Rename dialog should appear
    const renameDialog = window.locator('[role="dialog"]:has-text("Rename Storage Directory")');
    await expect(renameDialog).toBeVisible();

    // Clear and enter new name
    const nameInput = renameDialog.locator('input[type="text"]');
    await nameInput.clear();
    await nameInput.fill('My Notes');

    // Click OK button
    const okButton = renameDialog.locator('button:has-text("OK")');
    await okButton.click();
    await window.waitForTimeout(1000);

    // Verify the SD name has changed in the list
    await expect(settingsDialog.locator('h6', { hasText: 'My Notes' })).toBeVisible();
    await expect(settingsDialog.locator('h6', { hasText: 'Default' })).not.toBeVisible();
  });

  test('should show error for duplicate name', async () => {
    // First, create a second SD
    const newSdPath = path.join(os.tmpdir(), `test-sd-${Date.now()}`);
    await fs.mkdir(newSdPath, { recursive: true });

    await window.evaluate(async (sdPath) => {
      await window.electronAPI.sd.create('Work Notes', sdPath);
    }, newSdPath);

    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(1000);

    // Find and right-click the first SD item (Default)
    const sdList = settingsDialog.locator('[role="tabpanel"] ul');
    const sdItem = sdList.locator('li[class*="MuiListItem"]').first();
    await sdItem.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click Rename in context menu
    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await renameOption.click();
    await window.waitForTimeout(500);

    // Rename dialog should appear
    const renameDialog = window.locator('[role="dialog"]:has-text("Rename Storage Directory")');
    await expect(renameDialog).toBeVisible();

    // Try to rename to existing name "Work Notes"
    const nameInput = renameDialog.locator('input[type="text"]');
    await nameInput.clear();
    await nameInput.fill('Work Notes');

    // Click OK button
    const okButton = renameDialog.locator('button:has-text("OK")');
    await okButton.click();
    await window.waitForTimeout(1000);

    // Should show error snackbar
    const snackbar = window.locator('.MuiSnackbar-root');
    await expect(snackbar).toBeVisible();
    await expect(snackbar).toContainText('already exists');

    // Clean up
    await fs.rm(newSdPath, { recursive: true, force: true });
  });

  test('should rename via Enter key', async () => {
    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(500);

    // Find and right-click the SD item
    const sdList = settingsDialog.locator('[role="tabpanel"] ul');
    const sdItem = sdList.locator('li[class*="MuiListItem"]').first();
    await sdItem.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click Rename in context menu
    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await renameOption.click();
    await window.waitForTimeout(500);

    // Rename dialog should appear
    const renameDialog = window.locator('[role="dialog"]:has-text("Rename Storage Directory")');
    await expect(renameDialog).toBeVisible();

    // Clear and enter new name, then press Enter
    const nameInput = renameDialog.locator('input[type="text"]');
    await nameInput.clear();
    await nameInput.fill('Personal Notes');
    await nameInput.press('Enter');
    await window.waitForTimeout(1000);

    // Verify the SD name has changed in the list
    await expect(settingsDialog.locator('h6', { hasText: 'Personal Notes' })).toBeVisible();
  });

  test('should cancel rename via Escape key', async () => {
    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(500);

    // Find and right-click the SD item
    const sdList = settingsDialog.locator('[role="tabpanel"] ul');
    const sdItem = sdList.locator('li[class*="MuiListItem"]').first();
    await sdItem.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click Rename in context menu
    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await renameOption.click();
    await window.waitForTimeout(500);

    // Rename dialog should appear
    const renameDialog = window.locator('[role="dialog"]:has-text("Rename Storage Directory")');
    await expect(renameDialog).toBeVisible();

    // Start typing new name but cancel with Escape
    const nameInput = renameDialog.locator('input[type="text"]');
    await nameInput.clear();
    await nameInput.fill('Should Not Change');
    await nameInput.press('Escape');
    await window.waitForTimeout(500);

    // Dialog should be closed
    await expect(renameDialog).not.toBeVisible();

    // Original name should still be visible
    await expect(settingsDialog.locator('h6', { hasText: 'Default' })).toBeVisible();
  });

  test('should disable OK button when name is empty', async () => {
    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(500);

    // Find and right-click the SD item
    const sdList = settingsDialog.locator('[role="tabpanel"] ul');
    const sdItem = sdList.locator('li[class*="MuiListItem"]').first();
    await sdItem.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click Rename in context menu
    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await renameOption.click();
    await window.waitForTimeout(500);

    // Rename dialog should appear
    const renameDialog = window.locator('[role="dialog"]:has-text("Rename Storage Directory")');
    await expect(renameDialog).toBeVisible();

    // Clear the name
    const nameInput = renameDialog.locator('input[type="text"]');
    await nameInput.clear();

    // OK button should be disabled
    const okButton = renameDialog.locator('button:has-text("OK")');
    await expect(okButton).toBeDisabled();

    // Close dialog
    await window.keyboard.press('Escape');
  });
});

test.describe('Storage Directory Rename - Folder Panel', () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testDbPath: string;
  let testStorageDir: string;

  test.beforeEach(async () => {
    // Create temp directories
    testDbPath = path.join(os.tmpdir(), `notecove-test-${Date.now()}.db`);
    testStorageDir = path.join(os.tmpdir(), `notecove-test-storage-${Date.now()}`);
    await fs.mkdir(testStorageDir, { recursive: true });

    // Launch Electron app with test database
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
    });

    // Wait for the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for app to be ready
    await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close app
    await electronApp.close();

    // Clean up test files
    try {
      await fs.unlink(testDbPath);
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('should show context menu with Rename option when right-clicking SD in folder panel', async () => {
    // Find the SD node in the folder tree (it has a storage icon and shows "Default")
    // The SD node has data-testid="folder-tree-node-sd:default" pattern
    const sdNode = window.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await expect(sdNode).toBeVisible();

    // Right-click the SD node
    await sdNode.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Context menu should appear with "Rename" option
    const contextMenu = window.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible();

    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await expect(renameOption).toBeVisible();

    // Close menu by pressing Escape
    await window.keyboard.press('Escape');
  });

  test('should open rename dialog when clicking Rename from SD context menu in folder panel', async () => {
    // Find and right-click the SD node
    const sdNode = window.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await sdNode.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click Rename in context menu
    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await renameOption.click();
    await window.waitForTimeout(500);

    // Rename dialog should appear
    const renameDialog = window.locator('[role="dialog"]:has-text("Rename Storage Directory")');
    await expect(renameDialog).toBeVisible();

    // Should have a text field with the current name
    const nameInput = renameDialog.locator('input[type="text"]');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('Default');

    // Close dialog
    await window.keyboard.press('Escape');
  });

  test('should rename SD from folder panel context menu', async () => {
    // Find and right-click the SD node
    const sdNode = window.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await sdNode.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click Rename in context menu
    const renameOption = window.locator('[role="menuitem"]:has-text("Rename")');
    await renameOption.click();
    await window.waitForTimeout(500);

    // Rename dialog should appear
    const renameDialog = window.locator('[role="dialog"]:has-text("Rename Storage Directory")');
    await expect(renameDialog).toBeVisible();

    // Clear and enter new name
    const nameInput = renameDialog.locator('input[type="text"]');
    await nameInput.clear();
    await nameInput.fill('My Personal Notes');

    // Click OK button
    const okButton = renameDialog.locator('button:has-text("OK")');
    await okButton.click();
    await window.waitForTimeout(1000);

    // Verify the SD name has changed in the folder panel
    // The SD node text should now show "My Personal Notes"
    await expect(window.locator('[data-testid^="folder-tree-node-sd:"]').first()).toContainText(
      'My Personal Notes'
    );
  });
});
