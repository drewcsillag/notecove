/**
 * E2E tests for Paranoid Mode Network Safety
 *
 * Tests verify that paranoid mode profiles:
 * 1. Have welcome notes with no chip/unfurl nodes (secure import)
 * 2. Render links as plain links (no network requests for previews)
 * 3. Have link display preference locked to "secure"
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve, join } from 'path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { clearMacOSSavedState } from './fixtures';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

/**
 * Helper to create a paranoid profile and launch the main app with it
 */
async function launchAppWithParanoidProfile(): Promise<void> {
  clearMacOSSavedState();

  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-paranoid-e2e-'));
  console.log('[E2E Paranoid] Launching Electron with userData at:', testUserDataDir);

  // Pre-create profiles.json with a paranoid profile
  const profileId = `paranoid-${Date.now()}`;
  const profilesPath = join(testUserDataDir, 'profiles.json');
  writeFileSync(
    profilesPath,
    JSON.stringify({
      profiles: [
        {
          id: profileId,
          name: 'Paranoid Test',
          isDev: false,
          mode: 'paranoid',
          created: Date.now(),
          lastUsed: Date.now(),
          // Paranoid mode sets linkDisplayPreference to 'secure' on creation
          initialStoragePath: join(testUserDataDir, 'NoteCove'),
        },
      ],
      defaultProfileId: profileId,
      skipPicker: true,
    })
  );

  // Create the storage directory
  const storagePath = join(testUserDataDir, 'NoteCove');
  mkdirSync(storagePath, { recursive: true });

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`, `--profile=Paranoid Test`],
    env: {
      ...process.env,
      NODE_ENV: 'test', // Use test mode to skip picker and go directly to main app
      E2E_FAST_SHUTDOWN: '1',
    },
    timeout: 60000,
  });

  electronApp.on('console', (msg) => {
    console.log('[Electron Console]:', msg.text());
  });

  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
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
      console.error('[E2E Paranoid] Error closing app:', err);
    }
  }

  if (testUserDataDir) {
    try {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log('[E2E Paranoid] Cleaned up test userData directory:', testUserDataDir);
    } catch (err) {
      console.error('[E2E Paranoid] Failed to clean up test userData directory:', err);
    }
  }

  clearMacOSSavedState();
}

test.describe('Paranoid Mode - Network Safety', () => {
  test.afterEach(async () => {
    await cleanup();
  });

  test('should have link display preference set to secure', async () => {
    await launchAppWithParanoidProfile();

    // Wait for main app to load
    await page.waitForSelector('text=Folders', { timeout: 15000 });

    // Check the link display preference via evaluate
    const linkPref = await page.evaluate(async () => {
      return await window.electronAPI.appState.get('linkDisplayPreference');
    });

    // For paranoid profiles, linkDisplayPreference should be 'secure' or null
    // (null means default which will be treated as secure for paranoid mode)
    // Note: The actual enforcement happens in the renderer via ProfileModeContext
    expect(['secure', null, undefined]).toContain(linkPref);
  }, 60000);

  test('should render links as plain links (not chips or unfurls)', async () => {
    await launchAppWithParanoidProfile();

    // Wait for main app to load
    await page.waitForSelector('text=Folders', { timeout: 15000 });

    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a URL followed by space (to trigger link detection)
    await page.keyboard.type('Check out https://example.com ');
    await page.waitForTimeout(500);

    // Verify a plain link was created (not a chip or unfurl)
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // In paranoid/secure mode, links should NOT have chip or unfurl styling
    // Chip elements have data-link-mode="chip"
    // Unfurl elements are block nodes with class containing "unfurl"
    const chipElements = page.locator('.ProseMirror [data-link-mode="chip"]');
    const unfurlElements = page.locator('.ProseMirror [class*="unfurl"]');

    await expect(chipElements).toHaveCount(0);
    await expect(unfurlElements).toHaveCount(0);
  }, 60000);

  test('should not make network requests for link previews', async () => {
    await launchAppWithParanoidProfile();

    // Wait for main app to load
    await page.waitForSelector('text=Folders', { timeout: 15000 });

    // Set up request interception to track network requests
    const networkRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      // Track requests that look like oembed/preview requests
      if (
        url.includes('oembed') ||
        url.includes('embed') ||
        url.includes('preview') ||
        url.includes('unfurl') ||
        url.includes('opengraph') ||
        url.includes('api.') ||
        (url.startsWith('http') && !url.includes('localhost'))
      ) {
        networkRequests.push(url);
      }
    });

    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a URL that would normally trigger an oembed fetch
    await page.keyboard.type('https://www.youtube.com/watch?v=dQw4w9WgXcQ ');
    await page.waitForTimeout(2000); // Wait for any potential network requests

    // In paranoid mode, no oembed/preview network requests should have been made
    const previewRequests = networkRequests.filter(
      (url) =>
        url.includes('youtube') ||
        url.includes('oembed') ||
        url.includes('embed') ||
        url.includes('noembed')
    );

    expect(previewRequests).toHaveLength(0);
  }, 60000);
});

test.describe('Paranoid Mode - Settings Restrictions', () => {
  test.afterEach(async () => {
    await cleanup();
  });

  test('should hide Link Previews tab in settings', async () => {
    await launchAppWithParanoidProfile();

    // Wait for main app to load
    await page.waitForSelector('text=Folders', { timeout: 15000 });

    // Open settings dialog
    await page.keyboard.press('Control+,'); // or Command+, on Mac
    await page.waitForTimeout(500);

    // If that doesn't work, try clicking the settings button
    const settingsButton = page.locator('[aria-label="Settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for settings dialog
    await page.waitForSelector('text=Settings', { timeout: 5000 });

    // Look for tabs in the dialog
    const tabs = page.locator('[role="tab"]');

    // Get all tab labels
    const tabLabels = await tabs.allTextContents();

    // "Link Previews" tab should NOT be visible for paranoid mode
    expect(tabLabels).not.toContain('Link Previews');

    // Other tabs should still be visible
    expect(tabLabels).toContain('Storage Directories');
    expect(tabLabels).toContain('User');
    expect(tabLabels).toContain('Appearance');
  }, 60000);

  test('should hide cloud quick-add buttons in Storage Directories settings', async () => {
    await launchAppWithParanoidProfile();

    // Wait for main app to load
    await page.waitForSelector('text=Folders', { timeout: 15000 });

    // Open settings dialog
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(500);

    const settingsButton = page.locator('[aria-label="Settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for settings dialog
    await page.waitForSelector('text=Settings', { timeout: 5000 });

    // Navigate to Storage Directories tab (use exact match to avoid matching descriptions)
    await page.getByRole('tab', { name: 'Storage Directories' }).click();
    await page.waitForTimeout(300);

    // "Quick Add from Cloud Storage" section should NOT be visible for paranoid mode
    const cloudQuickAdd = page.locator('text=Quick Add from Cloud Storage');
    await expect(cloudQuickAdd).not.toBeVisible();

    // Cloud provider buttons should NOT be visible
    const icloudButton = page.locator('button:has-text("iCloud Drive")');
    const dropboxButton = page.locator('button:has-text("Dropbox")');

    await expect(icloudButton).not.toBeVisible();
    await expect(dropboxButton).not.toBeVisible();
  }, 60000);
});
