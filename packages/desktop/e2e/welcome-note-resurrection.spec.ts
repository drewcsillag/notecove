/**
 * E2E Test: Welcome Note Resurrection Bug
 *
 * Tests that the welcome note does NOT come back after being permanently deleted
 * and the app is restarted, even if no other notes exist.
 *
 * Bug: The ensureDefaultNote function recreates the welcome note if the database
 * is empty, ignoring that the user explicitly permanently deleted it.
 */

import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import path from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const E2E_LOG_PREFIX = '[E2E Welcome Resurrection]';

test.describe('Welcome Note Resurrection Bug', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let testUserDataDir: string;

  test.beforeEach(async () => {
    // Create unique temp directory for each test
    testUserDataDir = mkdtempSync(path.join(tmpdir(), 'notecove-e2e-welcome-resurrect-'));
    console.log(`${E2E_LOG_PREFIX} Using test userData at: ${testUserDataDir}`);

    // Launch Electron with test userData directory
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../dist-electron/main/index.js'),
        `--user-data-dir=${testUserDataDir}`,
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // Wait for app to be ready
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  });

  test.afterEach(async () => {
    // Clean up
    if (electronApp) {
      await electronApp.close();
    }
    if (testUserDataDir) {
      try {
        rmSync(testUserDataDir, { recursive: true, force: true });
        console.log(`${E2E_LOG_PREFIX} Cleaned up test userData directory`);
      } catch (error) {
        console.error(`${E2E_LOG_PREFIX} Error cleaning up:`, error);
      }
    }
  });

  test.skip('should NOT recreate welcome note after permanent deletion and app restart', async () => {
    console.log(`${E2E_LOG_PREFIX} Step 1: Verify welcome note exists`);

    // Wait for notes list to load
    await page.waitForSelector('[data-testid="notes-list"]', { timeout: 5000 });

    // Find the welcome note
    const welcomeNote = await page
      .locator('[data-testid^="note-item-"]')
      .filter({ hasText: 'Welcome to NoteCove' })
      .first();
    await expect(welcomeNote).toBeVisible();

    console.log(`${E2E_LOG_PREFIX} Step 2: Delete welcome note`);

    // Click on the welcome note to select it
    await welcomeNote.click();
    await page.waitForTimeout(200);

    // Right-click to open context menu
    await welcomeNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Click "Delete" in context menu
    await page.locator('[role="menu"]').locator('text=Delete').first().click();
    await page.waitForTimeout(1000);

    console.log(`${E2E_LOG_PREFIX} Step 3: Verify note moved to Recently Deleted`);

    // Wait for any progress dialogs to close
    await page.waitForTimeout(1000);

    // Open Recently Deleted folder
    const recentlyDeleted = page
      .locator('[data-testid="folder-item-recently-deleted"]')
      .or(page.locator('text=Recently Deleted'))
      .first();
    await recentlyDeleted.click({ force: true });
    await page.waitForTimeout(1000);

    // Welcome note should be in Recently Deleted
    const deletedNote = await page
      .locator('[data-testid^="note-item-"]')
      .filter({ hasText: 'Welcome to NoteCove' })
      .first();
    await expect(deletedNote).toBeVisible();

    console.log(`${E2E_LOG_PREFIX} Step 4: Permanently delete the welcome note`);

    // Right-click to open context menu in Recently Deleted
    await deletedNote.click({ button: 'right' });

    // Wait for context menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Click "Delete Permanently" from the context menu
    const menu = page.locator('[role="menu"]');
    const deletePermenentlyItem = menu.locator('text=Delete Permanently');
    await deletePermenentlyItem.waitFor({ state: 'visible', timeout: 5000 });
    await deletePermenentlyItem.click();
    await page.waitForTimeout(500);

    // Confirm deletion in dialog
    await page.locator('button:has-text("Delete Permanently")').click();
    await page.waitForTimeout(1000);

    // Note should be gone from Recently Deleted
    await expect(deletedNote).not.toBeVisible();

    console.log(`${E2E_LOG_PREFIX} Step 5: Verify no notes remain`);

    // Go back to All Notes
    const allNotes = page.locator('text=All Notes').first();
    await allNotes.click();
    await page.waitForTimeout(500);

    // Should be no notes in the list
    const noteItems = page.locator('[data-testid^="note-item-"]');
    await expect(noteItems).toHaveCount(0);

    console.log(`${E2E_LOG_PREFIX} Step 6: Close and restart app`);

    // Close the app
    await electronApp.close();
    await page.waitForTimeout(1000);

    console.log(`${E2E_LOG_PREFIX} Step 7: Relaunch app with same userData`);

    // Relaunch with same userData directory
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../dist-electron/main/index.js'),
        `--user-data-dir=${testUserDataDir}`,
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    console.log(`${E2E_LOG_PREFIX} Step 8: Verify welcome note has NOT been recreated`);

    // Wait for notes list
    await page.waitForSelector('[data-testid="notes-list"]', { timeout: 5000 });

    // Welcome note should NOT exist
    const resurrectedNote = page
      .locator('[data-testid^="note-item-"]')
      .filter({ hasText: 'Welcome to NoteCove' });
    await expect(resurrectedNote).toHaveCount(0);

    // All Notes folder should show 0 notes
    const noteItemsAfter = page.locator('[data-testid^="note-item-"]');
    await expect(noteItemsAfter).toHaveCount(0);

    console.log(`${E2E_LOG_PREFIX} Test passed - welcome note did NOT resurrect!`);
  });
});
