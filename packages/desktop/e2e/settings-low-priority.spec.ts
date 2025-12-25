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

    // Enable all feature flags so Telemetry and Web Server tabs are visible
    await fs.writeFile(
      testConfigPath,
      JSON.stringify(
        { featureFlags: { telemetry: true, viewHistory: true, webServer: true } },
        null,
        2
      )
    );

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

    // Wait for app to be fully ready (editor visible)
    await window.waitForSelector('.ProseMirror', { timeout: 10000 });
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
    await window.waitForTimeout(1000); // Wait for tab transition

    // Wait for user settings fields to be visible
    const usernameField = window.locator('input[id="username"]');
    const handleField = window.locator('input[id="user-handle"]');
    await usernameField.waitFor({ state: 'visible', timeout: 10000 });

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
    await window.waitForTimeout(1000); // Wait for tab transition

    // Wait for fields to be visible again
    const usernameField2 = window.locator('input[id="username"]');
    const handleField2 = window.locator('input[id="user-handle"]');
    await usernameField2.waitFor({ state: 'visible', timeout: 10000 });

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
    await expect(window.locator('button[role="tab"]', { hasText: 'Telemetry' })).toBeVisible();
    await expect(window.locator('button[role="tab"]', { hasText: 'Web Server' })).toBeVisible();
    await expect(window.locator('button[role="tab"]', { hasText: 'Recovery' })).toBeVisible();
  });
});
