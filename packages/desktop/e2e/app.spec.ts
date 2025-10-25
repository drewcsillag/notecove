/**
 * E2E tests for NoteCove Desktop App
 *
 * These tests launch the actual Electron application and test it end-to-end
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { join } from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [join(__dirname, '../dist-electron/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Get the first window
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('NoteCove Desktop App', () => {
  test('should launch and display the main window', async () => {
    // Verify window is visible
    expect(await page.isVisible('body')).toBe(true);
  });

  test('should display the app title', async () => {
    // Wait for content to load
    await page.waitForSelector('h1');

    // Check for "NoteCove" title (actual translation in E2E)
    const title = await page.textContent('h1');
    expect(title).toBe('NoteCove');
  });

  test('should display the tagline', async () => {
    // Check for the actual translated tagline
    const tagline = await page.locator('text=Your offline-first note-taking app').first();
    await expect(tagline).toBeVisible();
  });

  test('should display platform information', async () => {
    // Check for platform display
    const platformText = await page.locator('text=/Platform:/').first();
    await expect(platformText).toBeVisible();

    // Verify it shows a valid platform
    const text = await platformText.textContent();
    expect(text).toMatch(/Platform: (darwin|win32|linux)/);
  });

  test('should have Material-UI theme applied', async () => {
    // Check that MUI components are rendered
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Verify some MUI styling is applied (CssBaseline removes margins)
    const bodyMargin = await body.evaluate((el) => {
      return window.getComputedStyle(el).margin;
    });
    expect(bodyMargin).toBe('0px');
  });

  test('should have window title set', async () => {
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('window should have correct dimensions', async () => {
    // For Electron apps, we need to check the window bounds instead of viewport
    const bounds = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.getBounds();
    });

    expect(bounds).toBeTruthy();
    if (bounds) {
      // Default window size from main/index.ts is 1200x800
      expect(bounds.width).toBe(1200);
      expect(bounds.height).toBe(800);
    }
  });
});
