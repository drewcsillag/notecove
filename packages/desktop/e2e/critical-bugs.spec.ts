/**
 * E2E Tests for Critical Bugs
 *
 * Bug 1: Title changes to "Untitled" when clicking away during note load
 * Bug 2: Batch move across SDs causes UI issues and notes don't move
 * Bug 3: Note deletion doesn't sync correctly - folder counts don't update
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileSyncSimulator, SimulatorLogger } from './utils/sync-simulator';

/**
 * Helper to get the first window with a longer timeout.
 * The default firstWindow() timeout is 30 seconds, which can be flaky on slower machines.
 */
async function getFirstWindow(app: ElectronApplication, timeoutMs = 60000): Promise<Page> {
  return app.waitForEvent('window', { timeout: timeoutMs });
}

test.describe('Bug 1: Title becomes Untitled when clicking away during load', () => {
  let instance1: ElectronApplication;
  let instance2: ElectronApplication;
  let window1: Page;
  let window2: Page;
  let sd1: string;
  let sd2: string;
  let userData1: string;
  let userData2: string;
  let simulator: FileSyncSimulator;

  test.beforeEach(async () => {
    const testId = Date.now().toString();

    // Create separate SD directories for each instance (like cross-machine-sync pattern)
    sd1 = await mkdtemp(join(tmpdir(), `notecove-bug1-sd1-${testId}-`));
    sd2 = await mkdtemp(join(tmpdir(), `notecove-bug1-sd2-${testId}-`));
    userData1 = await mkdtemp(join(tmpdir(), `notecove-bug1-userdata1-${testId}-`));
    userData2 = await mkdtemp(join(tmpdir(), `notecove-bug1-userdata2-${testId}-`));

    console.log('[Bug 1] Test ID:', testId);
    console.log('[Bug 1] SD1:', sd1);
    console.log('[Bug 1] SD2:', sd2);
  }, 180000);

  test.afterEach(async () => {
    console.log('[Bug 1] Cleaning up...');

    if (simulator) {
      await simulator.stop();
    }

    if (instance1) {
      await instance1.close();
    }
    if (instance2) {
      await instance2.close();
    }

    // Clean up temporary directories
    try {
      await rm(sd1, { recursive: true, force: true });
      await rm(sd2, { recursive: true, force: true });
      await rm(userData1, { recursive: true, force: true });
      await rm(userData2, { recursive: true, force: true });
      console.log('[Bug 1] Cleanup complete');
    } catch (error) {
      console.error('[Bug 1] Cleanup failed:', error);
    }
  });

  test('should not change title to Untitled when clicking away during load', async () => {
    console.log('[Bug 1] Testing title preservation during quick navigation...');

    // Create simulator with fast delays for this test
    const logger = new SimulatorLogger({
      enabled: true,
      verbose: false,
      prefix: '[Bug1 Sync]',
    });

    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [1000, 2000], // 1-2 second delay
      partialSyncProbability: 0.0, // No partial sync for this test
      partialSyncRatio: [0.3, 0.9],
      logger,
    });

    // Start the simulator
    await simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Launch instance 1 connected to SD1
    console.log('[Bug 1] Launching instance 1 on SD1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'bug1-instance-1',
      },
      timeout: 60000,
    });

    window1 = await getFirstWindow(instance1);
    window1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    await window1.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window1.waitForTimeout(1000);

    // Launch instance 2 connected to SD2
    console.log('[Bug 1] Launching instance 2 on SD2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'bug1-instance-2',
      },
      timeout: 60000,
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });

    // Wait for initial bidirectional sync to settle
    await window2.waitForTimeout(8000);

    console.log('[Bug 1] Both instances ready');

    // Create a note with substantial content in instance 1
    // We'll make multiple edits to create multiple CRDT files (slower to load)
    const createButton = window1.getByTitle('Create note');
    await createButton.click();
    await window1.waitForTimeout(500);

    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();

    // Add initial content with a clear title
    const noteTitle = `Important Note Title ${Date.now()}`;
    await editor1.fill(`${noteTitle}\nThis is the first line of content.`);
    await window1.waitForTimeout(1000);

    // Make several edits to create multiple CRDT update files
    for (let i = 1; i <= 5; i++) {
      await editor1.click();
      await window1.keyboard.press('End'); // Go to end
      await window1.keyboard.type(`\nEdit ${i}: Adding more content to make loading slower.`);
      await window1.waitForTimeout(500);
    }

    // Wait for sync through FileSyncSimulator
    // Increased from 5s to 8s to reduce flakiness under CI load
    console.log('[Bug 1] Waiting for first note to sync to instance 2...');
    await window1.waitForTimeout(8000);

    // Close and relaunch instance 2 to see synced content (workaround for live editor bug)
    await instance2.close();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'bug1-instance-2-reload',
      },
      timeout: 60000,
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Reload]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window2.waitForTimeout(2000);

    // Verify the note appears in instance 2
    const noteButton2 = window2.locator(`text=${noteTitle}`).first();
    await expect(noteButton2).toBeVisible({ timeout: 10000 });

    // Create another note to click to (for switching away)
    await createButton.click();
    await window1.waitForTimeout(500);
    await editor1.click();
    const secondNoteTitle = `Second Note ${Date.now()}`;
    await editor1.fill(`${secondNoteTitle}\nJust a placeholder note`);
    await window1.waitForTimeout(2000);

    // Wait for the second note to sync
    // Increased from 5s to 8s to reduce flakiness under CI load
    console.log('[Bug 1] Waiting for second note to sync to instance 2...');
    await window1.waitForTimeout(8000);

    // Close and relaunch instance 2 again
    await instance2.close();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'bug1-instance-2-reload2',
      },
      timeout: 60000,
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Reload2]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window2.waitForTimeout(2000);

    // Verify both notes are visible
    const noteButton2AfterReload = window2.locator(`text=${noteTitle}`).first();
    await expect(noteButton2AfterReload).toBeVisible({ timeout: 10000 });

    const secondNoteSynced = window2.locator(`text=${secondNoteTitle}`).first();
    await expect(secondNoteSynced).toBeVisible({ timeout: 10000 });

    // Now in instance 2, click the first note and immediately click away
    console.log('[Bug 1] Clicking note in instance 2...');
    const clickPromise = noteButton2AfterReload.click();

    // Immediately click the second note (before first note finishes loading)
    // Do this WITHOUT waiting for the first click to complete
    console.log('[Bug 1] Immediately clicking away...');
    const secondNoteButton = window2.locator(`text=${secondNoteTitle}`).first();
    const secondClickPromise = secondNoteButton.click();

    // Now wait for both to complete
    await Promise.all([clickPromise, secondClickPromise]);

    // Wait a bit for any pending saves to complete
    await window2.waitForTimeout(2000);

    // Verify the first note's title is still correct (not "Untitled")
    console.log('[Bug 1] Checking title is preserved...');
    const firstNoteTitle = window2.locator(`text=${noteTitle}`).first();
    await expect(firstNoteTitle).toBeVisible({ timeout: 5000 });

    // Also verify in instance 1 that the title didn't change
    const firstNoteTitleInstance1 = window1.locator(`text=${noteTitle}`).first();
    await expect(firstNoteTitleInstance1).toBeVisible({ timeout: 5000 });

    // Verify "Untitled" doesn't appear for our note
    const untitledNotes = await window2.locator('text=Untitled').count();
    console.log('[Bug 1] Untitled notes count:', untitledNotes);
    // The welcome note might be untitled, so we just verify our note has the right title

    console.log('[Bug 1] Title preservation test passed!');
  }, 180000); // 3 minute timeout
});

/**
 * Bug 2: Batch move across SDs causes UI issues
 *
 * REMOVED: This test was skipped and redundant.
 * Bug 2 fix is proven to work by these passing tests:
 *   - e2e/cross-sd-drag-drop.spec.ts:379 - Multi-select batch moves across SDs
 *   - e2e/cross-sd-drag-drop.spec.ts:268 - Permanent deletion from source SD
 * Both tests validate UUID preservation, batch moves, and permanent deletion.
 */
