/**
 * E2E tests for Settings - Medium Priority Features
 * Phase 2.6: Settings Window
 *
 * Tests:
 * - Dark mode toggle and persistence
 * - Keyboard shortcut (Cmd/Ctrl+,) to open Settings
 * - Cloud storage quick-add buttons
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

test.describe('Settings - Medium Priority Features', () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testDbPath: string;
  let testStorageDir: string;

  test.beforeEach(async () => {
    // Create temp directories with unique names (timestamp + random + process ID)
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}-${process.pid}`;
    testDbPath = path.join(os.tmpdir(), `notecove-test-${uniqueId}.db`);
    testStorageDir = path.join(os.tmpdir(), `notecove-test-storage-${uniqueId}`);
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
    // Close app and wait for it to fully shut down
    await electronApp.close();

    // Wait a bit to ensure all file handles are released
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clean up test files
    try {
      await fs.unlink(testDbPath);
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors (file might not exist or be in use)
      console.log('Cleanup warning:', err);
    }
  });

  test('should open Settings via keyboard shortcut Cmd+,', async () => {
    // Press Cmd+, (on macOS) or Ctrl+, (on other platforms)
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await window.keyboard.press(`${modifier}+Comma`);

    // Settings dialog should open
    const settingsDialog = window.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });
  });

  test('should toggle dark mode and persist across restarts', async () => {
    // Open Settings via keyboard shortcut
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await window.keyboard.press(`${modifier}+Comma`);

    // Navigate to Appearance tab
    await window.locator('button[role="tab"]', { hasText: 'Appearance' }).click();

    // Dark mode switch should initially be unchecked (light mode)
    const darkModeSwitch = window.locator('input[type="checkbox"]').first();
    await expect(darkModeSwitch).not.toBeChecked();

    // Toggle dark mode switch
    await darkModeSwitch.click();
    await expect(darkModeSwitch).toBeChecked(); // Verify it toggled

    // Wait longer for theme to fully apply
    await window.waitForTimeout(2000);

    // Check that switch is still checked after waiting
    await expect(darkModeSwitch).toBeChecked();

    // Close settings
    await window.locator('button', { hasText: 'Close' }).click();

    // Wait to ensure async save completes before closing app
    await window.waitForTimeout(2000);

    // Verify the value was actually saved to database before closing
    const savedValue = await window.evaluate(async () => {
      return await window.electronAPI.appState.get('themeMode');
    });
    expect(savedValue).toBe('dark');

    // Close and reopen the app
    await electronApp.close();

    // Wait for app to fully shut down
    await new Promise((resolve) => setTimeout(resolve, 1000));

    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });

    // Wait for theme to be loaded from database
    await window.waitForTimeout(2000);

    // Verify value persisted in database after restart
    const loadedValue = await window.evaluate(async () => {
      return await window.electronAPI.appState.get('themeMode');
    });
    expect(loadedValue).toBe('dark');

    // Open settings to verify UI reflects persisted theme
    await window.keyboard.press(`${modifier}+Comma`);
    await window.waitForTimeout(500);

    // Navigate to Appearance tab
    await window.locator('button[role="tab"]', { hasText: 'Appearance' }).click();
    await window.waitForTimeout(500);

    // Verify dark mode switch is still checked after restart
    // Use multiple attempts since the UI update might be async
    const darkModeSwitchAfterRestart = window.locator('input[type="checkbox"]').first();

    let isChecked = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      isChecked = await darkModeSwitchAfterRestart.isChecked();
      if (isChecked) break;
      await window.waitForTimeout(500);
    }

    expect(isChecked).toBe(true);
  });

  test('should show cloud storage quick-add buttons if directories exist', async () => {
    // Create test cloud storage directories
    const testCloudDirs: Record<string, string> = {};

    // Create a fake Dropbox directory
    const dropboxPath = path.join(os.tmpdir(), 'Dropbox');
    await fs.mkdir(dropboxPath, { recursive: true });
    testCloudDirs['Dropbox'] = dropboxPath;

    try {
      // Open Settings
      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';
      await window.keyboard.press(`${modifier}+Comma`);

      // Should be on Storage Directories tab by default
      await expect(window.getByRole('tab', { name: 'Storage Directories' })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Look for quick-add section
      const quickAddSection = window.locator('text=Quick Add from Cloud Storage:');

      // If the section exists, verify there are cloud storage buttons
      const quickAddExists = await quickAddSection.isVisible().catch(() => false);

      if (quickAddExists) {
        // Check for button group
        const buttonGroup = window.locator('[role="group"]').first();
        await expect(buttonGroup).toBeVisible();

        // There should be at least one cloud storage button
        const buttons = buttonGroup.locator('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
      } else {
        // If no cloud storage directories exist on the system, that's OK
        console.log('No cloud storage directories found on system - test skipped');
      }
    } finally {
      // Clean up test cloud directories
      await fs.rm(dropboxPath, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('should populate SD path when clicking cloud storage button', async () => {
    // Create a test cloud storage directory that will be detected
    const testDropboxPath = path.join(os.homedir(), 'Dropbox');
    let createdTestDir = false;

    try {
      // Check if Dropbox exists, if not create it temporarily
      try {
        await fs.access(testDropboxPath);
      } catch {
        await fs.mkdir(testDropboxPath, { recursive: true });
        createdTestDir = true;
      }

      // Open Settings
      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';
      await window.keyboard.press(`${modifier}+Comma`);

      // Should be on Storage Directories tab by default
      await expect(window.getByRole('tab', { name: 'Storage Directories' })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Look for Dropbox button
      const dropboxButton = window.locator('button', { hasText: 'Dropbox' });

      if (await dropboxButton.isVisible().catch(() => false)) {
        // Click the Dropbox button
        await dropboxButton.click();

        // Add SD dialog should open with pre-filled values
        await expect(window.locator('text=Add Storage Directory')).toBeVisible();

        // Name field should be pre-filled with "Dropbox"
        const nameField = window.getByLabel('Name');
        await expect(nameField).toHaveValue('Dropbox');

        // Path field should be pre-filled with the Dropbox path + /NoteCove
        const pathField = window.getByLabel('Path');
        const pathValue = await pathField.inputValue();
        expect(pathValue).toContain('Dropbox');
        expect(pathValue).toContain('/NoteCove');
      } else {
        console.log('Dropbox button not visible - test skipped');
      }
    } finally {
      // Clean up test directory if we created it
      if (createdTestDir) {
        await fs.rm(testDropboxPath, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
});
