/**
 * Welcome Note Deletion Bug Test
 *
 * Bug: Notes are winding up in the deleted folder without being explicitly deleted.
 * Repro steps:
 * 1. Start app fresh with new storage
 * 2. See welcome note
 * 3. Click Personal folder - welcome note still showing (wrong!)
 * 4. Click another folder - welcome note no longer in list (correct)
 * 5. Click "All Notes" - can't find welcome note anymore
 * 6. Click "Recently Deleted" - welcome note is there! (wrong!)
 */

import { test, expect, Page, ElectronApplication } from '@playwright/test';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { _electron as electron } from 'playwright';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  // Create unique temp directory for this test
  userDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-welcome-note-bug-'));
  console.log('[E2E Welcome Note Bug] Launching Electron with userData at:', userDataDir);

  // Launch Electron app
  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Get the first window
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('text=Folders', { timeout: 10000 });
});

test.afterAll(async () => {
  // Close the Electron app
  await electronApp.close();

  // Clean up temp directory
  console.log('[E2E Welcome Note Bug] Cleaning up test userData directory');
  rmSync(userDataDir, { recursive: true, force: true });
  console.log('[E2E Welcome Note Bug] Cleaned up test userData directory');
});

test('should not move welcome note to Recently Deleted when switching folders', async () => {
  // Wait for app to load
  await page.waitForSelector('text=Folders', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Step 1: Verify welcome note is visible in "All Notes" (default view)
  console.log('[E2E] Step 1: Check welcome note in All Notes');
  const allNotesList = page.locator('#middle-panel [data-testid="notes-list"]');
  await expect(allNotesList).toContainText('Welcome to NoteCove');

  // Step 2: Click "Personal" folder
  console.log('[E2E] Step 2: Click Personal folder');
  const personalFolder = page.locator('text=Personal').first();
  await personalFolder.click();
  await page.waitForTimeout(1000);

  // Check if the middle panel shows empty state (Personal folder has no notes)
  const middlePanel = page.locator('#middle-panel');
  await expect(middlePanel).toContainText('No notes in this folder');

  // NEW BEHAVIOR: Editor panel SHOULD still show welcome note content
  // because we intentionally don't clear the editor when changing folders
  // This allows users to browse folders while keeping their current note open
  const editorPanel = page.locator('#right-panel');
  await expect(editorPanel).toContainText('Welcome to NoteCove');

  // Step 3: Click "Work" folder
  console.log('[E2E] Step 3: Click Work folder');
  const workFolder = page.locator('text=Work').first();
  await workFolder.click();
  await page.waitForTimeout(1000);

  // Work folder should also be empty (but editor still shows welcome note)
  await expect(middlePanel).toContainText('No notes in this folder');
  await expect(editorPanel).toContainText('Welcome to NoteCove');

  // Step 4: Click "All Notes" - welcome note should still be there
  console.log('[E2E] Step 4: Click All Notes - should find welcome note');
  const allNotesNode = page.locator('text=All Notes').first();
  await allNotesNode.click();
  await page.waitForTimeout(1000);

  // Welcome note should still be in "All Notes"
  const allNotesListAfter = page.locator('#middle-panel [data-testid="notes-list"]');
  await expect(allNotesListAfter).toContainText('Welcome to NoteCove');

  // Step 5: Click "Recently Deleted" - welcome note should NOT be there
  console.log('[E2E] Step 5: Click Recently Deleted - should NOT find welcome note');
  const recentlyDeleted = page.locator('text=Recently Deleted').first();
  await recentlyDeleted.click();
  await page.waitForTimeout(1000);

  // BUG CHECK: Welcome note should NOT be in "Recently Deleted" notes list
  await expect(middlePanel).toContainText('No notes in this folder');
  // But editor still shows welcome note (from previous selection)
  await expect(editorPanel).toContainText('Welcome to NoteCove');

  console.log(
    '[E2E] Test passed - welcome note stays in All Notes and does not appear in Recently Deleted'
  );
});
