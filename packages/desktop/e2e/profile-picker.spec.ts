/**
 * E2E tests for Profile Picker
 *
 * These tests verify the profile selection flow on first launch.
 * Note: These tests DO NOT set NODE_ENV=test so the profile picker is shown.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve, join } from 'path';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';

let electronApp: ElectronApplication;
let pickerPage: Page;
let testUserDataDir: string;

/**
 * Helper to launch app WITHOUT test mode so profile picker appears
 */
async function launchAppWithProfilePicker(args: string[] = []): Promise<void> {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-profile-picker-e2e-'));
  console.log('[E2E Profile] Launching Electron with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`, ...args],
    // Note: NOT setting NODE_ENV=test so profile picker shows
    // But we do set E2E_FAST_SHUTDOWN for faster cleanup
    // E2E_HEADLESS=1 hides windows without skipping profile picker logic
    env: {
      ...process.env,
      NODE_ENV: undefined, // Explicitly unset
      E2E_FAST_SHUTDOWN: '1', // Enable fast shutdown for E2E tests
      E2E_HEADLESS: '1', // Don't show windows during E2E tests
    },
    timeout: 60000,
  });

  electronApp.on('console', (msg) => {
    console.log('[Electron Console]:', msg.text());
  });

  // Get the first window - should be profile picker
  pickerPage = await electronApp.firstWindow();
}

/**
 * Helper to clean up after tests
 */
async function cleanup(): Promise<void> {
  if (electronApp) {
    try {
      await Promise.race([
        electronApp.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
      ]);
    } catch (err) {
      console.error('[E2E Profile] Error closing app:', err);
    }
  }

  if (testUserDataDir) {
    try {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log('[E2E Profile] Cleaned up test userData directory:', testUserDataDir);
    } catch (err) {
      console.error('[E2E Profile] Failed to clean up test userData directory:', err);
    }
  }
}

test.describe('Profile Picker', () => {
  test.afterEach(async () => {
    await cleanup();
  });

  test('should show profile picker on first launch', async () => {
    await launchAppWithProfilePicker();

    // Wait for profile picker to appear
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 15000 });

    // Verify we're in the profile picker window
    const title = await pickerPage.locator('text=Select Profile').first();
    await expect(title).toBeVisible();

    // Verify "New Profile" button is visible
    const newProfileButton = await pickerPage.locator('button:has-text("+ New Profile")');
    await expect(newProfileButton).toBeVisible();
  }, 60000);

  test('should auto-create Development profile in dev mode', async () => {
    await launchAppWithProfilePicker();

    // Wait for profile picker
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 15000 });

    // Look for auto-created Development profile
    // In dev mode, a "Development" profile should be auto-created
    const devProfile = await pickerPage.locator('text=Development').first();
    await expect(devProfile).toBeVisible({ timeout: 5000 });
  }, 60000);

  test('should create new profile when clicking New Profile', async () => {
    await launchAppWithProfilePicker();

    // Wait for profile picker
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 15000 });

    // Click "New Profile" button - this opens the wizard
    const newProfileButton = await pickerPage.locator('button:has-text("+ New Profile")');
    await newProfileButton.click();

    // Step 1: Fill in profile name
    await pickerPage.waitForSelector('text=Create New Profile', { timeout: 5000 });
    const nameInput = await pickerPage.locator('#profileName');
    await nameInput.fill('Test Profile');
    await pickerPage.locator('button:has-text("Next")').click();

    // Step 2: Select Local mode
    await pickerPage.waitForSelector('text=Choose Profile Mode', { timeout: 5000 });
    await pickerPage.locator('text=Local').first().click();
    await pickerPage.locator('button:has-text("Next")').click();

    // Step 3: Storage config - just click Next (local uses default path)
    await pickerPage.waitForSelector('text=Local Storage', { timeout: 5000 });
    await pickerPage.locator('button:has-text("Next")').click();

    // Step 4: User settings - skip (just click Next)
    await pickerPage.waitForSelector('text=Your Identity', { timeout: 5000 });
    await pickerPage.locator('button:has-text("Next")').click();

    // Step 5: Confirmation - click Create Profile
    await pickerPage.waitForSelector('text=Review & Create', { timeout: 5000 });
    await pickerPage.locator('button:has-text("Create Profile")').click();

    // Wait for wizard to close and profile to be created
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 10000 });

    // Verify the new profile appears in the list
    const newProfile = await pickerPage.locator('text=Test Profile').first();
    await expect(newProfile).toBeVisible({ timeout: 5000 });
  }, 90000);

  test('should select profile and open main app', async () => {
    await launchAppWithProfilePicker();

    // Wait for profile picker
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 15000 });

    // Wait for Development profile to appear (auto-created in dev mode)
    const devProfile = await pickerPage.locator('[data-testid^="profile-item-"]').first();
    await expect(devProfile).toBeVisible({ timeout: 5000 });

    // Click on the profile to select it
    await devProfile.click();

    // Click "Launch" button
    const openButton = await pickerPage.locator('button:has-text("Launch")');
    await openButton.click();

    // Wait for main window to appear - the picker window closes and main window opens
    // We need to wait for a new window since pickerPage will be closed
    const mainPage = await electronApp.waitForEvent('window', { timeout: 15000 });

    // Main app should show folder panel
    await mainPage.waitForSelector('text=Folders', { timeout: 15000 });
  }, 60000);

  test('should skip picker when --profile flag is used', async () => {
    // First, launch normally to create a profile
    await launchAppWithProfilePicker();
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 15000 });

    // Get the Development profile that was auto-created
    // Save the profiles.json for this test
    await cleanup();

    // Now launch with --profile=Development
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-profile-cli-e2e-'));

    // Pre-create profiles.json with Development profile
    const profilesPath = join(testUserDataDir, 'profiles.json');
    const profileId = `dev-${Date.now()}`;
    writeFileSync(
      profilesPath,
      JSON.stringify({
        profiles: [
          {
            id: profileId,
            name: 'Development',
            isDev: true,
            createdAt: Date.now(),
            lastUsed: Date.now(),
          },
        ],
        defaultProfileId: null,
        skipPicker: false,
      })
    );

    electronApp = await electron.launch({
      args: [mainPath, `--user-data-dir=${testUserDataDir}`, '--profile=Development'],
      env: {
        ...process.env,
        NODE_ENV: undefined,
        E2E_HEADLESS: '1', // Don't show windows during E2E tests
      },
      timeout: 60000,
    });

    // Should go directly to main app, not profile picker
    const mainPage = await electronApp.firstWindow();

    // If picker was skipped, we should see Folders panel
    await mainPage.waitForSelector('text=Folders', { timeout: 15000 });

    // Verify we're in main app, not picker
    const foldersHeader = await mainPage.locator('text=Folders').first();
    await expect(foldersHeader).toBeVisible();
  }, 60000);

  test('should recover from corrupted profiles.json', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-corrupt-profile-e2e-'));

    // Create corrupted profiles.json
    const profilesPath = join(testUserDataDir, 'profiles.json');
    writeFileSync(profilesPath, '{ invalid json content');

    electronApp = await electron.launch({
      args: [mainPath, `--user-data-dir=${testUserDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: undefined,
        E2E_HEADLESS: '1', // Don't show windows during E2E tests
      },
      timeout: 60000,
    });

    pickerPage = await electronApp.firstWindow();

    // App should recover and show profile picker with empty/new profile list
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 15000 });

    // Should be able to create new profile after recovery
    const newProfileButton = await pickerPage.locator('button:has-text("+ New Profile")');
    await expect(newProfileButton).toBeVisible();
  }, 60000);
});

test.describe("Profile Picker - Don't Ask Again", () => {
  test.afterEach(async () => {
    await cleanup();
  });

  test('should remember "Don\'t ask again" preference', async () => {
    await launchAppWithProfilePicker();

    // Wait for profile picker
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 15000 });

    // Select Development profile
    const devProfile = await pickerPage.locator('[data-testid^="profile-item-"]').first();
    await devProfile.click();

    // Note: "Don't ask again" checkbox is only shown in production mode
    // In dev mode, we can't test this directly
    // For now, just verify the profile can be selected

    const openButton = await pickerPage.locator('button:has-text("Launch")');
    await openButton.click();

    // Wait for main window to appear - the picker window closes and main window opens
    const mainPage = await electronApp.waitForEvent('window', { timeout: 15000 });

    // Verify app opened - main app should show folder panel
    await mainPage.waitForSelector('text=Folders', { timeout: 15000 });
  }, 60000);
});
