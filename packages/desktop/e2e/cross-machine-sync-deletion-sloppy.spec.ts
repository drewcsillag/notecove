/**
 * Cross-Machine Sync E2E Tests - Deletion and Sloppy Sync
 *
 * This test suite validates deletion sync and partial/slow sync handling.
 * Tests include:
 * 1. Note deletion sync
 * 2. Partial/slow sync handling
 * 3. Folder move with sloppy sync
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileSyncSimulator, SimulatorLogger } from './utils/sync-simulator';
import { getFirstWindow } from './cross-machine-sync-helpers';

test.describe('cross-machine sync - deletion and sloppy sync', () => {
  let instance1: ElectronApplication;
  let instance2: ElectronApplication;
  let window1: Page;
  let window2: Page;
  let sd1: string;
  let sd2: string;
  let userDataDir1: string;
  let userDataDir2: string;
  let simulator: FileSyncSimulator;

  test.beforeEach(async () => {
    const testId = Date.now().toString();

    // Create separate SD directories
    sd1 = await mkdtemp(join(tmpdir(), `notecove-delsloppy-sd1-${testId}-`));
    sd2 = await mkdtemp(join(tmpdir(), `notecove-delsloppy-sd2-${testId}-`));
    userDataDir1 = await mkdtemp(join(tmpdir(), `notecove-delsloppy-userdata1-${testId}-`));
    userDataDir2 = await mkdtemp(join(tmpdir(), `notecove-delsloppy-userdata2-${testId}-`));

    console.log('[DelSloppy] Test ID:', testId);
    console.log('[DelSloppy] SD1:', sd1);
    console.log('[DelSloppy] SD2:', sd2);
  }, 120000);

  test.afterEach(async () => {
    console.log('[DelSloppy] Cleaning up...');

    if (simulator) {
      await simulator.stop();
    }

    try {
      if (instance1) {
        await instance1.close();
      }
    } catch {
      // Instance may already be closed
    }
    try {
      if (instance2) {
        await instance2.close();
      }
    } catch {
      // Instance may already be closed
    }

    // Clean up temporary directories
    try {
      await rm(sd1, { recursive: true, force: true });
      await rm(sd2, { recursive: true, force: true });
      await rm(userDataDir1, { recursive: true, force: true });
      await rm(userDataDir2, { recursive: true, force: true });
      console.log('[DelSloppy] Cleanup complete');
    } catch (error) {
      console.error('[DelSloppy] Cleanup failed:', error);
    }
  });

  /**
   * BUG TEST: Note deletion should sync to Instance B and remove from note list.
   *
   * Current behavior: Deleting a note on Instance A doesn't remove it from
   * Instance B's note list.
   *
   * Expected behavior: Note should be removed from the list (or marked deleted).
   */
  test('should sync note deletion to Instance 2 note list', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator
    console.log('[DeletionSync] Starting file sync simulator...');
    const logger = new SimulatorLogger({
      prefix: '[DeletionSync]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [500, 1000],
      partialSyncProbability: 0.0,
      partialSyncRatio: [0.5, 0.9],
      logger,
    });
    await simulator.start();

    // Launch both instances
    console.log('[DeletionSync] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'deletion-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[DeletionSync] Instance 1 ready');

    // Wait for initial sync
    await window1.waitForTimeout(5000);

    console.log('[DeletionSync] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'deletion-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    await window2.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window2.waitForTimeout(2000);
    console.log('[DeletionSync] Instance 2 ready');

    // Verify Instance 2 starts with 1 note (welcome note)
    const notesList2Items = window2.locator('[data-testid="notes-list"] li');
    const initialNoteCount2 = await notesList2Items.count();
    console.log(`[DeletionSync] Instance 2 initial note count: ${initialNoteCount2}`);
    expect(initialNoteCount2).toBe(1); // Just the welcome note

    // Create a new note in Instance 1 using button click (like passing test)
    console.log('[DeletionSync] Creating new note in Instance 1...');
    const createButton = window1.getByTitle('Create note');
    await createButton.click();
    await window1.waitForTimeout(1000);

    // Type content to give it a unique title
    const noteTitle = `Delete Me ${Date.now()}`;
    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();
    await window1.keyboard.type(noteTitle);
    await window1.waitForTimeout(2000);

    // Verify note was created in Instance 1
    const notesList1Items = window1.locator('[data-testid="notes-list"] li');
    const noteCount1 = await notesList1Items.count();
    console.log(`[DeletionSync] Instance 1 note count after create: ${noteCount1}`);
    expect(noteCount1).toBe(2);

    // Wait for sync to Instance 2 - use toHaveCount like the passing test
    console.log('[DeletionSync] Waiting for new note to sync...');
    await expect(notesList2Items).toHaveCount(2, { timeout: 60000 });
    console.log('[DeletionSync] Instance 2 has 2 notes');

    // Now verify the specific note is there
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const noteToDelete2 = notesList2.locator(`li:has-text("${noteTitle}")`);
    await expect(noteToDelete2).toBeVisible({ timeout: 5000 });
    console.log('[DeletionSync] Instance 2 has note before delete: true');

    // Delete the note in Instance 1 via context menu
    console.log('[DeletionSync] Deleting note in Instance 1...');
    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const noteToDelete1 = notesList1.locator(`li:has-text("${noteTitle}")`);

    // Right-click and delete
    await noteToDelete1.click({ button: 'right' });
    await window1.waitForTimeout(500);

    await window1.locator('[role="menuitem"]:has-text("Delete")').click();
    await window1.waitForTimeout(500);

    // Confirm deletion in dialog
    const dialog = window1.locator('[role="dialog"]');
    const deleteButton = dialog.locator('button:has-text("Delete")');
    await deleteButton.click();
    await window1.waitForTimeout(1000);

    // The note should no longer be in the All Notes list (soft deleted)
    // It goes to Recently Deleted, so it disappears from the active list
    await expect(noteToDelete1).not.toBeVisible({ timeout: 5000 });
    console.log('[DeletionSync] Note removed from Instance 1 list: true');

    // Wait for deletion to sync to Instance 2 using retrying assertion
    // This is more reliable than fixed waits since sync timing varies
    console.log('[DeletionSync] Waiting for deletion to sync to Instance 2...');
    await expect(noteToDelete2).not.toBeVisible({ timeout: 60000 });
    console.log('[DeletionSync] Note removed from Instance 2: true');

    console.log('[DeletionSync] ✅ Deletion sync test passed!');
  });

  /**
   * TEST: Partial/slow sync should not cause missed updates.
   *
   * Uses "sloppy sync" (partialSyncProbability > 0) to simulate real-world
   * cloud sync conditions where files sync incrementally.
   *
   * This verifies that even with slow/partial sync (like iCloud, Dropbox, Google Drive),
   * all updates eventually sync correctly.
   */
  test('should handle partial/slow sync without missing updates', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator with SLOPPY SYNC - partial and slow
    console.log('[SloppySync] Starting file sync simulator with sloppy settings...');
    const logger = new SimulatorLogger({
      prefix: '[SloppySync]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [2000, 5000], // Slow sync (2-5 seconds)
      partialSyncProbability: 0.5, // 50% chance of partial sync
      partialSyncRatio: [0.3, 0.7], // When partial, sync 30-70% of file
      logger,
    });
    await simulator.start();

    // Launch Instance 1
    console.log('[SloppySync] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'sloppy-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[SloppySync] Instance 1 ready');

    // Wait for initial sync
    await window1.waitForTimeout(8000);

    // Launch Instance 2
    console.log('[SloppySync] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'sloppy-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    await window2.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window2.waitForTimeout(2000);
    console.log('[SloppySync] Instance 2 ready');

    // Make several rapid changes in Instance 1
    console.log('[SloppySync] Making multiple rapid changes in Instance 1...');

    // Change 1: Type some content
    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();
    await window1.keyboard.press('Meta+a');
    await window1.waitForTimeout(100);
    await window1.keyboard.press('Delete');
    await window1.waitForTimeout(200);

    const finalTitle = `Final Title After Sloppy Sync ${Date.now()}`;
    await window1.keyboard.type(finalTitle);
    await window1.waitForTimeout(500);

    // Change 2: Add more content on next line
    await window1.keyboard.press('Enter');
    await window1.keyboard.type('Second line of content');
    await window1.waitForTimeout(500);

    // Change 3: Add even more
    await window1.keyboard.press('Enter');
    await window1.keyboard.type('Third line should also sync');
    await window1.waitForTimeout(2000);

    console.log('[SloppySync] Waiting for sloppy sync to complete...');
    // Give extra time for slow/partial sync to complete
    await window1.waitForTimeout(30000);

    // THE KEY TEST: Does Instance 2 show the FINAL state?
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const finalNote = notesList2.locator(`li:has-text("${finalTitle}")`);
    const hasTitle = await finalNote.isVisible();
    console.log(`[SloppySync] Instance 2 has final title: ${hasTitle}`);

    // Also check if the note is open and has all content
    await finalNote.click().catch(() => {});
    await window2.waitForTimeout(1000);

    const editor2 = window2.locator('.ProseMirror');
    const content2 = await editor2.textContent();
    console.log(`[SloppySync] Instance 2 content: ${content2}`);

    const hasAllContent =
      content2?.includes(finalTitle) &&
      content2?.includes('Second line') &&
      content2?.includes('Third line');
    console.log(`[SloppySync] Instance 2 has all content: ${hasAllContent}`);

    // Both checks should pass
    expect(hasTitle).toBe(true);
    expect(hasAllContent).toBe(true);

    console.log('[SloppySync] ✅ Sloppy sync test passed!');
  });

  /**
   * TEST: Folder move should update note list and badges even with sloppy sync.
   *
   * Uses partial sync to simulate real-world conditions (iCloud, Dropbox, etc.).
   * Verifies that folder moves sync correctly even with slow/partial file syncing.
   */
  test('should sync folder move to Instance 2 even with sloppy sync', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator with SLOPPY SYNC
    console.log('[SloppyFolderMove] Starting file sync simulator with sloppy settings...');
    const logger = new SimulatorLogger({
      prefix: '[SloppyFolderMove]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [1500, 3000], // Moderate delay
      partialSyncProbability: 0.4, // 40% chance of partial sync
      partialSyncRatio: [0.4, 0.8],
      logger,
    });
    await simulator.start();

    // Launch Instance 1
    console.log('[SloppyFolderMove] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'sloppyfolder-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[SloppyFolderMove] Instance 1 ready');

    // Wait for initial sync
    await window1.waitForTimeout(8000);

    // Launch Instance 2
    console.log('[SloppyFolderMove] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'sloppyfolder-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    await window2.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window2.waitForTimeout(2000);
    console.log('[SloppyFolderMove] Instance 2 ready');

    // Move welcome note to Work folder in Instance 1
    console.log('[SloppyFolderMove] Moving note to folder in Instance 1...');
    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const welcomeNote1 = notesList1.locator('li:has-text("Welcome to NoteCove")');
    await welcomeNote1.click({ button: 'right' });
    await window1.waitForTimeout(500);

    const moveToMenuItem = window1.locator('text=Move to...');
    await moveToMenuItem.click();
    await window1.waitForTimeout(500);

    // Wait for dialog to appear
    const moveDialog = window1.locator('div[role="dialog"]').filter({ hasText: 'Move Note' });
    await expect(moveDialog).toBeVisible({ timeout: 5000 });

    // Find the Work folder in the dialog and click it
    // Use label since folders are radio options
    // Filter to exclude subfolders (which contain "/") - e.g., "Work / Projects"
    const folderRadio = moveDialog
      .locator('label:has-text("Work")')
      .filter({ hasNotText: '/' })
      .first();
    await folderRadio.click();
    await window1.waitForTimeout(500);

    // Click Move button
    const moveButton = moveDialog.locator('button:has-text("Move")');
    await moveButton.click();
    await window1.waitForTimeout(2000);

    // Verify moved in Instance 1 by checking the folder badge updates
    // Click on Work folder to see the note
    const workNode1 = window1.getByRole('button', { name: /^Work/ }).first();
    await workNode1.click();
    await window1.waitForTimeout(1000);

    // Check that the note is in the folder
    const noteCount1 = await notesList1.locator('li').count();
    console.log(`[SloppyFolderMove] Instance 1 notes in Work folder: ${noteCount1}`);
    expect(noteCount1).toBe(1);

    // Wait for sloppy sync
    console.log('[SloppyFolderMove] Waiting for sloppy sync...');
    await window1.waitForTimeout(25000);

    // THE KEY TEST: Does Instance 2 see the note in Work folder?
    const workNode2 = window2.getByRole('button', { name: /^Work/ }).first();

    // Click on Work folder in Instance 2
    await workNode2.click();
    await window2.waitForTimeout(1000);

    // Check that the note is in the folder
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const noteCount2 = await notesList2.locator('li').count();
    console.log(`[SloppyFolderMove] Instance 2 notes in Work folder: ${noteCount2}`);

    expect(noteCount2).toBe(1);

    console.log('[SloppyFolderMove] ✅ Sloppy folder move sync test passed!');
  });
});
