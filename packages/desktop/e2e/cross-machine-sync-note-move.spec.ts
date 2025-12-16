/**
 * Cross-Machine Sync E2E Tests - Note Move
 *
 * Step 11: Note Move Sync Test
 *
 * This test validates that:
 * 1. Instance A can create a folder and move a note into it
 * 2. The folder and note metadata sync to Instance B via file sync simulator
 * 3. Instance B sees the note in the correct folder with proper badge count
 *
 * This tests the CRDT-based folder tree sync and note metadata folderId sync.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  FileSyncSimulator,
  SimulatorLogger,
  validateAllSequences,
} from './utils/sync-simulator';
import { getFirstWindow } from './cross-machine-sync-helpers';

test.describe('cross-machine sync - note move', () => {
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
    sd1 = await mkdtemp(join(tmpdir(), `notecove-move-sd1-${testId}-`));
    sd2 = await mkdtemp(join(tmpdir(), `notecove-move-sd2-${testId}-`));
    userDataDir1 = await mkdtemp(join(tmpdir(), `notecove-move-userdata1-${testId}-`));
    userDataDir2 = await mkdtemp(join(tmpdir(), `notecove-move-userdata2-${testId}-`));

    console.log('[NoteMoveSync] Test ID:', testId);
    console.log('[NoteMoveSync] SD1:', sd1);
    console.log('[NoteMoveSync] SD2:', sd2);
  }, 120000);

  test.afterEach(async () => {
    console.log('[NoteMoveSync] Cleaning up...');

    if (simulator) {
      await simulator.stop();
    }

    // Close instances (may already be closed)
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
      console.log('[NoteMoveSync] Cleanup complete');
    } catch (error) {
      console.error('[NoteMoveSync] Cleanup failed:', error);
    }
  });

  test('should sync note move to folder from Instance A to Instance B', async () => {
    // Create simulator with moderate delays
    const logger = new SimulatorLogger({
      enabled: true,
      verbose: false,
      prefix: '[NoteMoveSync]',
    });

    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [1000, 2000], // 1-2 second delay
      partialSyncProbability: 0.0, // No partial sync for this test
      partialSyncRatio: [0.5, 0.9],
      logger,
    });

    // Start the simulator
    await simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Launch Instance 1 on SD1
    console.log('[NoteMoveSync] Launching Instance 1 on SD1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'note-move-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    window1.on('console', (msg) => {
      console.log('[Instance1 Renderer]:', msg.text());
    });

    await window1.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window1.waitForTimeout(1000);

    console.log('[NoteMoveSync] Instance 1 ready');

    // === Step 1: Create a folder in Instance 1 ===
    console.log('[NoteMoveSync] Creating folder in Instance 1...');
    const newFolderButton = window1.locator('button[title="Create folder"]');
    await newFolderButton.click();
    await window1.waitForSelector('text=Create New Folder', { timeout: 5000 });

    // Enter folder name
    const dialog = window1.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    const testFolderName = `Test Folder ${Date.now()}`;
    await folderNameInput.fill(testFolderName);
    await window1.keyboard.press('Enter');
    await window1.waitForTimeout(1000);

    // Verify folder was created
    const folderNode1 = window1
      .locator(`[data-testid^="folder-tree-node-"]`)
      .filter({ hasText: testFolderName });
    await expect(folderNode1).toBeVisible({ timeout: 5000 });
    console.log('[NoteMoveSync] Folder created:', testFolderName);

    // === Step 2: Move the default note to the folder ===
    console.log('[NoteMoveSync] Moving note to folder...');

    // Click on "All Notes" to see the note
    const allNotesNode = window1.locator('[data-testid="folder-tree-node-all-notes:default"]');
    await allNotesNode.click();
    await window1.waitForTimeout(500);

    // Get the first note in the list and right-click to open context menu
    const notesList = window1.locator('[data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await window1.waitForTimeout(300);

    // Click "Move to..." in context menu
    const moveToMenuItem = window1.locator('text=Move to...');
    await moveToMenuItem.click();
    await window1.waitForTimeout(500);

    // Select the test folder in the move dialog
    const moveDialog = window1.locator('div[role="dialog"]').filter({ hasText: 'Move Note' });
    await expect(moveDialog).toBeVisible({ timeout: 5000 });

    // Find and click the radio button for our test folder
    const folderRadio = moveDialog.locator(`text=${testFolderName}`);
    await folderRadio.click();
    await window1.waitForTimeout(300);

    // Click Move button
    const moveButton = moveDialog.locator('button').filter({ hasText: 'Move' });
    await moveButton.click();
    await window1.waitForTimeout(1000);

    console.log('[NoteMoveSync] Note moved to folder');

    // === Step 3: Verify badge count in Instance 1 ===
    // The folder should now have a badge showing "1"
    const badge1 = folderNode1.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(badge1).toBeVisible({ timeout: 5000 });
    console.log('[NoteMoveSync] Instance 1 folder badge shows 1 note');

    // Close Instance 1 to free up resources before launching Instance 2
    console.log('[NoteMoveSync] Closing Instance 1...');
    await instance1.close();

    // Wait for folder CRDT log to sync to SD2
    // The sync simulator uses "largest file wins" for append-only logs,
    // so we just need to wait for the sync to complete
    console.log('[NoteMoveSync] Waiting for folder CRDT to sync to SD2...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // === Step 4: Launch Instance 2 and verify folder/note sync ===
    console.log('[NoteMoveSync] Launching Instance 2 on SD2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'note-move-instance-2',
      },
      timeout: 90000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Renderer]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window2.waitForTimeout(2000);

    console.log('[NoteMoveSync] Instance 2 ready');

    // === Step 5: Verify folder exists in Instance 2 ===
    console.log('[NoteMoveSync] Checking for folder in Instance 2...');
    const folderNode2 = window2
      .locator(`[data-testid^="folder-tree-node-"]`)
      .filter({ hasText: testFolderName });
    await expect(folderNode2).toBeVisible({ timeout: 10000 });
    console.log('[NoteMoveSync] ✅ Folder synced to Instance 2');

    // === Step 6: Verify badge count in Instance 2 ===
    const badge2 = folderNode2.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(badge2).toBeVisible({ timeout: 10000 });
    console.log('[NoteMoveSync] ✅ Instance 2 folder badge shows 1 note');

    // === Step 7: Click folder and verify note is inside ===
    await folderNode2.click();
    await window2.waitForTimeout(1000);

    // The notes list should show the note
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const notesInFolder = notesList2.locator('li');
    await expect(notesInFolder).toHaveCount(1, { timeout: 5000 });
    console.log('[NoteMoveSync] ✅ Note is in the folder in Instance 2');

    // Validate sequence numbers
    console.log('[NoteMoveSync] Validating CRDT log sequence numbers...');
    const sd1Validation = await validateAllSequences(sd1);
    const sd2Validation = await validateAllSequences(sd2);

    if (!sd1Validation.valid) {
      console.error('[NoteMoveSync] SD1 sequence validation failed');
    }
    if (!sd2Validation.valid) {
      console.error('[NoteMoveSync] SD2 sequence validation failed');
    }

    console.log('[NoteMoveSync] ✅ Note move sync test passed!');

    // Checkpoint: Note moves replicate correctly
    // - Folder created in Instance 1 synced to Instance 2
    // - Note moved to folder in Instance 1
    // - Instance 2 sees note in correct folder with badge count "1"
  });
});
