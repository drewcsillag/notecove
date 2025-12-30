/**
 * E2E tests for Onboarding Wizard
 *
 * Tests verify the multi-step wizard flow for creating new profiles
 * with different modes (Local, Cloud, Paranoid, Custom).
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve, join } from 'path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { clearMacOSSavedState } from './fixtures';

let electronApp: ElectronApplication;
let pickerPage: Page;
let testUserDataDir: string;

/**
 * Helper to launch app WITHOUT test mode so profile picker appears
 */
async function launchAppWithProfilePicker(): Promise<void> {
  clearMacOSSavedState();

  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-wizard-e2e-'));
  console.log('[E2E Wizard] Launching Electron with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: undefined, // Explicitly unset so profile picker shows
      E2E_FAST_SHUTDOWN: '1',
      E2E_WIZARD_TEST: '1', // Skip auto-creation of Development profile
    },
    timeout: 60000,
  });

  electronApp.on('console', (msg) => {
    console.log('[Electron Console]:', msg.text());
  });

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
      console.error('[E2E Wizard] Error closing app:', err);
    }
  }

  if (testUserDataDir) {
    try {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log('[E2E Wizard] Cleaned up test userData directory:', testUserDataDir);
    } catch (err) {
      console.error('[E2E Wizard] Failed to clean up test userData directory:', err);
    }
  }

  clearMacOSSavedState();
}

/**
 * Helper to navigate to wizard
 */
async function openWizard(): Promise<void> {
  await pickerPage.waitForSelector('text=Select Profile', { timeout: 15000 });
  const newProfileButton = await pickerPage.locator('button:has-text("+ New Profile")');
  await newProfileButton.click();
  // Wait for wizard to appear
  await pickerPage.waitForSelector('text=Create New Profile', { timeout: 5000 });
}

/**
 * Helper to fill profile name step
 */
async function fillProfileName(name: string): Promise<void> {
  const input = await pickerPage.locator('#profileName');
  await input.fill(name);
  await pickerPage.locator('button:has-text("Next")').click();
}

/**
 * Helper to select mode
 */
async function selectMode(mode: 'Local' | 'Cloud' | 'Paranoid' | 'Custom'): Promise<void> {
  await pickerPage.waitForSelector('text=Choose Profile Mode', { timeout: 5000 });
  // Click on the mode card using data-testid for reliable selection
  const modeId = mode.toLowerCase();
  await pickerPage.locator(`[data-testid="mode-card-${modeId}"]`).click();
  await pickerPage.locator('button:has-text("Next")').click();
}

/**
 * Helper to skip user settings (click Next with empty fields)
 */
async function skipUserSettings(): Promise<void> {
  await pickerPage.waitForSelector('text=Your Identity', { timeout: 5000 });
  await pickerPage.locator('button:has-text("Next")').click();
}

/**
 * Helper to fill user settings
 */
async function fillUserSettings(username: string, handle: string): Promise<void> {
  await pickerPage.waitForSelector('text=Your Identity', { timeout: 5000 });
  if (username) {
    await pickerPage.locator('#username').fill(username);
  }
  if (handle) {
    await pickerPage.locator('#handle').fill(handle);
  }
  await pickerPage.locator('button:has-text("Next")').click();
}

/**
 * Helper to create profile on confirmation step
 */
async function createProfile(): Promise<void> {
  await pickerPage.waitForSelector('text=Review & Create', { timeout: 5000 });
  await pickerPage.locator('button:has-text("Create Profile")').click();
}

test.describe('Onboarding Wizard', () => {
  test.afterEach(async () => {
    await cleanup();
  });

  test('should show wizard when clicking New Profile', async () => {
    await launchAppWithProfilePicker();
    await openWizard();

    // Verify wizard step 1 is shown
    const title = await pickerPage.locator('text=Create New Profile');
    await expect(title).toBeVisible();

    // Verify profile name input exists
    const input = await pickerPage.locator('#profileName');
    await expect(input).toBeVisible();
  }, 60000);

  test('should complete Local mode wizard flow', async () => {
    await launchAppWithProfilePicker();
    await openWizard();

    // Step 1: Profile Name
    await fillProfileName('My Local Profile');

    // Step 2: Mode Selection
    await selectMode('Local');

    // Step 3: Storage Config (should show default path for Local)
    await pickerPage.waitForSelector('text=Local Storage', { timeout: 5000 });
    await pickerPage.locator('button:has-text("Next")').click();

    // Step 4: User Settings
    await fillUserSettings('Test User', '@testuser');

    // Step 5: Confirmation
    await pickerPage.waitForSelector('text=Review & Create', { timeout: 5000 });
    await expect(pickerPage.locator('text=My Local Profile')).toBeVisible();
    await expect(pickerPage.locator('text=Local').last()).toBeVisible();

    // Create the profile
    await createProfile();

    // Verify profile appears in list
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 10000 });
    await expect(pickerPage.locator('text=My Local Profile')).toBeVisible();
  }, 90000);

  test('should complete Paranoid mode wizard flow (skips user settings)', async () => {
    await launchAppWithProfilePicker();
    await openWizard();

    // Step 1: Profile Name
    await fillProfileName('Paranoid Profile');

    // Step 2: Mode Selection
    await selectMode('Paranoid');

    // Step 3: Storage Config (should show Secure Storage and paranoid warning)
    await pickerPage.waitForSelector('text=Secure Storage', { timeout: 5000 });
    await expect(pickerPage.locator('text=Paranoid Mode:')).toBeVisible();
    await pickerPage.locator('button:has-text("Next")').click();

    // Step 4 is SKIPPED for Paranoid mode - should go directly to confirmation

    // Step 5: Confirmation (should show privacy features)
    await pickerPage.waitForSelector('text=Review & Create', { timeout: 5000 });
    await expect(pickerPage.locator('text=Privacy Features Enabled:')).toBeVisible();
    await expect(pickerPage.locator('text=No link previews')).toBeVisible();

    // Create the profile
    await createProfile();

    // Verify profile appears in list
    await pickerPage.waitForSelector('text=Select Profile', { timeout: 10000 });
    await expect(pickerPage.locator('text=Paranoid Profile')).toBeVisible();
  }, 90000);

  test('should complete Custom mode wizard flow', async () => {
    await launchAppWithProfilePicker();
    await openWizard();

    // Step 1: Profile Name
    await fillProfileName('Custom Profile');

    // Step 2: Mode Selection
    await selectMode('Custom');

    // Step 3: Storage Config (should show "No folder selected" initially)
    await pickerPage.waitForSelector('text=Custom Storage', { timeout: 5000 });
    await expect(pickerPage.locator('text=No folder selected')).toBeVisible();

    // Next should be disabled until path is selected
    const nextButton = pickerPage.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();

    // Note: We can't test the actual folder picker dialog in E2E without mocking
    // For now, verify that clicking Choose Folder button is present
    await expect(pickerPage.locator('button:has-text("Choose Folder...")')).toBeVisible();
  }, 60000);

  test('should navigate back through wizard steps', async () => {
    await launchAppWithProfilePicker();
    await openWizard();

    // Step 1: Profile Name
    await fillProfileName('Test Back Navigation');

    // Step 2: Mode Selection
    await pickerPage.waitForSelector('text=Choose Profile Mode', { timeout: 5000 });

    // Go back
    await pickerPage.locator('button:has-text("Back")').click();

    // Should be back at profile name step
    await expect(pickerPage.locator('text=Create New Profile')).toBeVisible();
    // Value should be preserved
    const input = await pickerPage.locator('#profileName');
    await expect(input).toHaveValue('Test Back Navigation');
  }, 60000);

  test('should cancel wizard and return to profile picker', async () => {
    await launchAppWithProfilePicker();
    await openWizard();

    // Click Cancel (use form locator to target wizard's Cancel button, not profile picker's)
    await pickerPage.locator('form button:has-text("Cancel")').click();

    // Should be back at profile picker
    await expect(pickerPage.locator('text=Select Profile')).toBeVisible();
  }, 60000);

  test('should validate profile name is required', async () => {
    await launchAppWithProfilePicker();
    await openWizard();

    // Next should be disabled with empty name
    const nextButton = pickerPage.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();

    // Enter a name
    await pickerPage.locator('#profileName').fill('Valid Name');

    // Next should now be enabled
    await expect(nextButton).not.toBeDisabled();

    // Clear the name
    await pickerPage.locator('#profileName').clear();

    // Next should be disabled again
    await expect(nextButton).toBeDisabled();
  }, 60000);

  test('should validate mode selection is required', async () => {
    await launchAppWithProfilePicker();
    await openWizard();
    await fillProfileName('Test Mode Validation');

    // Should be on mode selection step
    await pickerPage.waitForSelector('text=Choose Profile Mode', { timeout: 5000 });

    // Next should be disabled without selection
    const nextButton = pickerPage.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();

    // Select a mode
    await pickerPage.locator('text=Local').first().click();

    // Next should now be enabled
    await expect(nextButton).not.toBeDisabled();
  }, 60000);
});

test.describe('Onboarding Wizard - Cloud Mode', () => {
  test.afterEach(async () => {
    await cleanup();
  });

  test('should show cloud providers if available', async () => {
    await launchAppWithProfilePicker();
    await openWizard();
    await fillProfileName('Cloud Test');

    // Check if Cloud option is available (it depends on system having cloud storage)
    await pickerPage.waitForSelector('text=Choose Profile Mode', { timeout: 5000 });

    // The Cloud card should exist (use exact match to avoid matching description text)
    const cloudCard = pickerPage.getByText('Cloud', { exact: true });
    await expect(cloudCard).toBeVisible();

    // Note: Whether it's enabled depends on whether cloud storage is detected
    // This test just verifies the UI element exists
  }, 60000);
});
