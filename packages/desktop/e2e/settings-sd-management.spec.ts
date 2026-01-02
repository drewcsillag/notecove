/**
 * E2E tests for Settings - Storage Directory Management
 * Phase 2.6: Settings Window
 *
 * Tests SD creation with file picker and SD deletion
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

test.describe('Settings - Storage Directory Management', () => {
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

  test('should open Settings dialog via button', async () => {
    // Find and click Settings button in folder panel
    const settingsButton = window.locator('button[title="Settings"]');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // Settings dialog should open
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();

    // Should show Storage Directories tab by default
    await expect(
      settingsDialog.locator('button[role="tab"]', { hasText: 'Storage Directories' })
    ).toBeVisible();
  });

  test('should list existing Storage Directory', async () => {
    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();

    // Should show the default SD in the Storage Directories section
    // In test mode, the SD is named "Test Storage"
    await expect(settingsDialog.locator('h6', { hasText: 'Test Storage' })).toBeVisible();
    await expect(settingsDialog.locator('text=Active')).toBeVisible();
  });

  test('should disable delete button for last SD', async () => {
    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(500);

    // Find delete button in the Settings dialog
    const deleteButton = settingsDialog.locator('button[aria-label="delete"]');
    await expect(deleteButton).toBeDisabled();
  });

  test.skip('MANUAL TEST: should open file picker when clicking Browse', async () => {
    /**
     * MANUAL TEST INSTRUCTIONS:
     * 1. Open Settings via the Settings button
     * 2. Click "Add Directory" button
     * 3. Click the "Browse..." button
     * 4. Verify that native OS folder picker dialog opens
     * 5. Select a folder
     * 6. Verify the path appears in the "Path" text field
     * 7. Cancel the test
     *
     * This test cannot be automated because Playwright cannot interact with
     * native OS dialogs (file pickers). It must be tested manually.
     */
    console.log('⚠️  MANUAL TEST: Please verify file picker works manually');
    console.log('Instructions:');
    console.log('1. Open Settings via the Settings button');
    console.log('2. Click "Add Directory" button');
    console.log('3. Click the "Browse..." button');
    console.log('4. Verify that native OS folder picker dialog opens');
    console.log('5. Select a folder');
    console.log('6. Verify the path appears in the "Path" text field');

    // Keep app open for manual testing
    await window.waitForTimeout(60000); // Wait 60 seconds for manual testing
  });

  test('should create new SD with manual path entry', async () => {
    // Create a test SD directory
    const newSdPath = path.join(os.tmpdir(), `test-sd-${Date.now()}`);
    await fs.mkdir(newSdPath, { recursive: true });

    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Click Add Directory
    await window.locator('button', { hasText: 'Add Directory' }).click();
    await window.waitForTimeout(500);

    // Wait for Add SD dialog
    const addDialog = window.locator('[role="dialog"]', { hasText: 'Add Storage Directory' });
    await expect(addDialog).toBeVisible();

    // Fill in the form (manual path entry)
    await addDialog.getByLabel('Name').fill('Test SD');
    await addDialog.getByLabel('Path').fill(newSdPath);

    // Click Add button (in the add dialog)
    await addDialog.locator('button', { hasText: 'Add' }).click();
    await window.waitForTimeout(1000);

    // Verify SD appears in the Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog.getByText('Test SD')).toBeVisible();
    await expect(settingsDialog.getByText(newSdPath, { exact: true })).toBeVisible();

    // Clean up
    await fs.rm(newSdPath, { recursive: true, force: true });
  });

  test('should delete SD after confirmation', async () => {
    // First, create a second SD so we can delete one
    const newSdPath = path.join(os.tmpdir(), `test-sd-${Date.now()}`);
    await fs.mkdir(newSdPath, { recursive: true });

    // Create SD via API
    await window.evaluate(async (sdPath) => {
      await window.electronAPI.sd.create('Test SD', sdPath);
    }, newSdPath);

    // Open Settings
    const settingsButton = window.locator('button[title="Settings"]');
    await settingsButton.click();

    // Wait for Settings dialog
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await window.waitForTimeout(1000);

    // Verify we have 2 SDs in the list
    // Look for list within the tab panel (MUI uses role="tabpanel")
    const sdList = settingsDialog.locator('[role="tabpanel"] ul');
    const sdItems = sdList.locator('li[class*="MuiListItem"]');
    await expect(sdItems).toHaveCount(2);

    // Find delete button for Test SD
    const testSdItem = sdList.locator('li', { hasText: 'Test SD' });
    const deleteButton = testSdItem.locator('button[aria-label="delete"]');
    await deleteButton.click();

    // Confirmation dialog should appear
    await expect(window.locator('text=Remove Storage Directory?')).toBeVisible();

    // Click Remove button
    await window.locator('button', { hasText: 'Remove' }).click();
    await window.waitForTimeout(500);

    // SD should be removed from list
    await expect(settingsDialog.locator('text=Test SD')).not.toBeVisible();

    // Should only have 1 SD now
    await expect(sdItems).toHaveCount(1);

    // Clean up
    await fs.rm(newSdPath, { recursive: true, force: true });
  });
});
