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

  test.skip('should open Settings dialog via button', async () => {
    // Find and click Settings button in folder panel
    const settingsButton = window.locator('button[aria-label="Settings"]');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // Settings dialog should open
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible();

    // Should show Storage Directories tab by default
    await expect(window.locator('text=Storage Directories')).toBeVisible();
  });

  test.skip('should list existing Storage Directory', async () => {
    // Open Settings
    const settingsButton = window.locator('button[aria-label="Settings"]');
    await settingsButton.click();

    // Should show the default SD
    await expect(window.locator('text=Default')).toBeVisible();
    await expect(window.locator('text=Active')).toBeVisible();
  });

  test.skip('should disable delete button for last SD', async () => {
    // Open Settings
    const settingsButton = window.locator('button[aria-label="Settings"]');
    await settingsButton.click();

    // Find delete button
    const deleteButton = window.locator('button[aria-label="delete"]');
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

  test.skip('should create new SD with manual path entry', async () => {
    // Create a test SD directory
    const newSdPath = path.join(os.tmpdir(), `test-sd-${Date.now()}`);
    await fs.mkdir(newSdPath, { recursive: true });

    // Open Settings
    const settingsButton = window.locator('button[aria-label="Settings"]');
    await settingsButton.click();

    // Click Add Directory
    await window.locator('button', { hasText: 'Add Directory' }).click();

    // Fill in the form (manual path entry)
    await window.locator('input[label="Name"]').fill('Test SD');
    await window.locator('input[label="Path"]').fill(newSdPath);

    // Click Add button
    await window.locator('button', { hasText: 'Add' }).click();

    // Verify SD appears in list
    await expect(window.locator('text=Test SD')).toBeVisible();
    await expect(window.locator(`text=${newSdPath}`)).toBeVisible();

    // Clean up
    await fs.rm(newSdPath, { recursive: true, force: true });
  });

  test.skip('should delete SD after confirmation', async () => {
    // First, create a second SD so we can delete one
    const newSdPath = path.join(os.tmpdir(), `test-sd-${Date.now()}`);
    await fs.mkdir(newSdPath, { recursive: true });

    // Create SD via API
    await window.evaluate(async (sdPath) => {
      await window.electronAPI.sd.create('Test SD', sdPath);
    }, newSdPath);

    // Open Settings
    const settingsButton = window.locator('button[aria-label="Settings"]');
    await settingsButton.click();

    // Verify we have 2 SDs
    const sdItems = window.locator('[role="listitem"]');
    await expect(sdItems).toHaveCount(2);

    // Find delete button for Test SD
    const testSdItem = window.locator('[role="listitem"]', { hasText: 'Test SD' });
    const deleteButton = testSdItem.locator('button[aria-label="delete"]');
    await deleteButton.click();

    // Confirmation dialog should appear
    await expect(window.locator('text=Remove Storage Directory?')).toBeVisible();

    // Click Remove button
    await window.locator('button', { hasText: 'Remove' }).click();

    // SD should be removed from list
    await expect(window.locator('text=Test SD')).not.toBeVisible();

    // Should only have 1 SD now
    await expect(sdItems).toHaveCount(1);

    // Clean up
    await fs.rm(newSdPath, { recursive: true, force: true });
  });
});
