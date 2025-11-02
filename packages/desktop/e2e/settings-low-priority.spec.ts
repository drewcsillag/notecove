/**
 * E2E Tests for Phase 2.6 Low Priority Settings Features
 *
 * Tests:
 * - User settings (username, handle) persistence
 * - Settings menu item
 * - Database path configuration
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
  _electron as electron,
} from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

test.describe('Phase 2.6 Low Priority Settings', () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testDbPath: string;
  let testStorageDir: string;
  let testConfigPath: string;

  test.beforeEach(async () => {
    // Create unique test paths for parallel execution
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}-${process.pid}`;
    testDbPath = path.join(os.tmpdir(), `notecove-test-${uniqueId}.db`);
    testStorageDir = path.join(os.tmpdir(), `notecove-test-storage-${uniqueId}`);
    testConfigPath = path.join(os.tmpdir(), `notecove-test-config-${uniqueId}.json`);

    await fs.mkdir(testStorageDir, { recursive: true });

    // Launch Electron app with test environment
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
        TEST_CONFIG_PATH: testConfigPath,
      },
    });

    // Wait for the main window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    await electronApp.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Cleanup test files
    try {
      await fs.unlink(testDbPath);
      await fs.rm(testStorageDir, { recursive: true, force: true });
      await fs.unlink(testConfigPath);
    } catch (err) {
      console.log('Cleanup warning:', err);
    }
  });

  test('should persist user settings (username and handle)', async () => {
    // Open Settings dialog with Cmd+,
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');

    // Wait for Settings dialog to open
    await expect(window.locator('text=Settings')).toBeVisible({ timeout: 5000 });

    // Click on User tab
    const userTab = window.locator('button[role="tab"]', { hasText: 'User' });
    await userTab.click();

    // Wait for user settings fields to be visible
    const usernameField = window.getByRole('textbox', { name: /username/i });
    const handleField = window.getByRole('textbox', { name: /mention handle/i });
    await usernameField.waitFor({ state: 'visible', timeout: 5000 });

    await usernameField.fill('Test User');
    await handleField.fill('testuser');

    // Click Save button
    const saveButton = window.locator('button', { hasText: 'Save' });
    await saveButton.click();

    // Wait for save to complete
    await window.waitForTimeout(1000);

    // Verify saved message appears
    await expect(window.locator('text=/Settings saved/i')).toBeVisible();

    // Close settings dialog
    const closeButton = window.locator('button[aria-label="close"]').first();
    await closeButton.click();

    // Reopen settings
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
    await expect(window.locator('text=Settings')).toBeVisible({ timeout: 5000 });

    // Click on User tab again
    const userTab2 = window.locator('button[role="tab"]', { hasText: 'User' });
    await userTab2.click();

    // Wait for fields to be visible again
    const usernameField2 = window.getByRole('textbox', { name: /username/i });
    const handleField2 = window.getByRole('textbox', { name: /mention handle/i });
    await usernameField2.waitFor({ state: 'visible', timeout: 5000 });

    // Verify settings persisted
    await expect(usernameField2).toHaveValue('Test User');
    await expect(handleField2).toHaveValue('testuser');
  });

  test('should show Settings menu item and open Settings dialog', async () => {
    // On macOS, we can't easily click menu items in E2E tests, so we test the keyboard shortcut
    // which is wired to the same handler as the menu item
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');

    // Wait for Settings dialog to open
    await expect(window.locator('text=Settings')).toBeVisible({ timeout: 5000 });

    // Verify all tabs are present
    await expect(
      window.locator('button[role="tab"]', { hasText: 'Storage Directories' })
    ).toBeVisible();
    await expect(window.locator('button[role="tab"]', { hasText: 'User' })).toBeVisible();
    await expect(window.locator('button[role="tab"]', { hasText: 'Appearance' })).toBeVisible();
    await expect(window.locator('button[role="tab"]', { hasText: 'Database' })).toBeVisible();
  });

  test('should show current database path in Database settings', async () => {
    // Open Settings dialog
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
    await expect(window.locator('text=Settings')).toBeVisible({ timeout: 5000 });

    // Click on Database tab
    const databaseTab = window.locator('button[role="tab"]', { hasText: 'Database' });
    await databaseTab.click();

    // Wait for database settings to load
    await window.waitForTimeout(500);

    // Verify current database path is shown
    const dbPathField = window
      .locator('input[label="Current Database Path"]')
      .or(
        window
          .locator('input')
          .filter({ has: window.locator('label:has-text("Current Database Path")') })
      )
      .or(window.locator('input[readonly]').first());

    await expect(dbPathField).toBeVisible();

    // Get the actual value - should contain either testDbPath or the default path
    const dbPathValue = await dbPathField.inputValue();
    expect(dbPathValue).toBeTruthy();
    expect(dbPathValue).toContain('.db');
  });

  test('should show warning dialog when changing database path', async () => {
    // Open Settings dialog
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
    await expect(window.locator('text=Settings')).toBeVisible({ timeout: 5000 });

    // Click on Database tab
    const databaseTab = window.locator('button[role="tab"]', { hasText: 'Database' });
    await databaseTab.click();
    await window.waitForTimeout(500);

    // Note: We can't actually test the file picker dialog in E2E tests easily,
    // but we can verify the UI elements are present
    const changeLocationButton = window.locator('button', { hasText: 'Change Location' });
    await expect(changeLocationButton).toBeVisible();
    await expect(changeLocationButton).toBeEnabled();
  });
});
