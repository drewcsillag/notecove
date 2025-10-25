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

  test('should display the folder panel', async () => {
    // Wait for folder panel content to load
    await page.waitForSelector('text=Folders');

    // Check for folder panel title
    const title = await page.locator('text=Folders').first();
    await expect(title).toBeVisible();
  });

  test('should display the notes list panel', async () => {
    // Check for notes panel title
    const title = await page.locator('text=Notes').first();
    await expect(title).toBeVisible();
  });

  test('should display the editor panel', async () => {
    // Check for editor panel title
    const title = await page.locator('text=Editor').first();
    await expect(title).toBeVisible();
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
