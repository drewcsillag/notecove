import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.describe('Backlinks Panel - Electron Mode', () => {
  let electronApp;
  let window;
  let testDir;

  test.beforeEach(async () => {
    // Create a temporary directory for test data
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-backlinks-test-'));
    console.log('Test directory:', testDir);

    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(process.cwd(), 'dist/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        NOTECOVE_TEST_MODE: 'true',
        NOTECOVE_DATA_PATH: testDir
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close the app
    if (electronApp) {
      await electronApp.close();
    }

    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should show backlinks panel when note is linked from another note', async () => {
    // Create target note
    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Target Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('This is the target note content');
    await window.waitForTimeout(1500);

    console.log('Created target note');

    // Create source note with link to target
    await window.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Source Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('This note links to ');
    await window.keyboard.type('[[Target Note]]');
    await window.waitForTimeout(2000); // Wait for save

    console.log('Created source note with link');

    // Verify the link was created
    const link = window.locator('#editor span[data-note-link]');
    await expect(link).toBeVisible();
    console.log('Link is visible');

    // Click on the target note in the notes list
    const targetNoteItem = window.locator('.note-item').filter({ has: window.locator('.note-title:has-text("Target Note")') }).first();
    await targetNoteItem.click();
    await window.waitForTimeout(1000);

    console.log('Switched to target note');

    // Take a screenshot before checking backlinks panel
    await window.screenshot({ path: 'test-results/backlinks-electron-before-check.png' });

    // Debug: Check if backlinks panel exists in DOM
    const panelExists = await window.locator('#backlinksPanel').count();
    console.log('Backlinks panel exists in DOM:', panelExists > 0);

    // Debug: Get panel display style
    const panelStyle = await window.locator('#backlinksPanel').evaluate(el => {
      return {
        display: window.getComputedStyle(el).display,
        innerHTML: el.innerHTML.substring(0, 200)
      };
    });
    console.log('Backlinks panel style:', panelStyle);

    // Debug: Check console logs
    const logs = [];
    window.on('console', msg => {
      const text = msg.text();
      if (text.includes('getBacklinks') || text.includes('backlinks')) {
        logs.push(text);
        console.log('Browser console:', text);
      }
    });

    // Wait a bit to collect logs
    await window.waitForTimeout(500);

    // Check if backlinks panel is visible
    const backlinksPanel = window.locator('#backlinksPanel');

    // This should pass if the panel is working correctly
    await expect(backlinksPanel).toBeVisible({ timeout: 2000 });

    // Check backlinks count
    const backlinksCount = window.locator('#backlinksCount');
    await expect(backlinksCount).toHaveText('1');

    // Check backlink item exists
    const backlinkItem = window.locator('.backlink-item');
    await expect(backlinkItem).toBeVisible();

    // Check backlink shows source note title
    const backlinkTitle = backlinkItem.locator('.backlink-item-title');
    await expect(backlinkTitle).toHaveText('Source Note');

    // Take a final screenshot
    await window.screenshot({ path: 'test-results/backlinks-electron-final.png' });
  });

  test('should hide backlinks panel when note has no backlinks', async () => {
    // Create a note without any backlinks
    await window.locator('#newNoteBtn').click();
    const editor = window.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await window.waitForTimeout(500);

    await window.keyboard.type('Standalone Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('This note has no backlinks');
    await window.waitForTimeout(1500);

    // Check that backlinks panel is hidden
    const backlinksPanel = window.locator('#backlinksPanel');
    await expect(backlinksPanel).toBeHidden();
  });
});
