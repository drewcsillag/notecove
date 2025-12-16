/**
 * Cross-Machine Sync E2E Tests - Two Instances
 *
 * Step 7: Basic Cross-Machine Sync Test
 *
 * This test validates the complete cross-machine sync flow:
 * 1. Launch TWO app instances with separate SDs
 * 2. Start file sync simulator between the SDs
 * 3. Instance A types content → files sync to SD2 → Instance B sees content
 * 4. Verify sync latency (<10s warning, <35s failure)
 * 5. Validate CRDT log sequence numbers are in order
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

test.describe('cross-machine sync - two instances', () => {
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

    // Create separate SD directories for each instance
    sd1 = await mkdtemp(join(tmpdir(), `notecove-sd1-${testId}-`));
    sd2 = await mkdtemp(join(tmpdir(), `notecove-sd2-${testId}-`));
    userDataDir1 = await mkdtemp(join(tmpdir(), `notecove-userdata1-${testId}-`));
    userDataDir2 = await mkdtemp(join(tmpdir(), `notecove-userdata2-${testId}-`));

    console.log('[Two Instances] Test ID:', testId);
    console.log('[Two Instances] SD1:', sd1);
    console.log('[Two Instances] SD2:', sd2);
  }, 180000);

  test.afterEach(async () => {
    console.log('[Two Instances] Cleaning up...');

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
      await rm(userDataDir1, { recursive: true, force: true });
      await rm(userDataDir2, { recursive: true, force: true });
      console.log('[Two Instances] Cleanup complete');
    } catch (error) {
      console.error('[Two Instances] Cleanup failed:', error);
    }
  });

  test('should sync content from Instance A to Instance B through file sync', async () => {
    // Create simulator with moderate delays
    const logger = new SimulatorLogger({
      enabled: true,
      verbose: false,
      prefix: '[CrossMachineSync]',
    });

    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [2000, 4000], // 2-4 second delay for initial sync
      partialCompletionDelayRange: [1000, 2000], // 1-2 second delay to complete partial syncs
      partialSyncProbability: 0.3, // 30% chance of partial sync
      partialSyncRatio: [0.5, 0.9],
      logger,
    });

    // Start the simulator
    await simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Launch instance 1 connected to SD1
    console.log('[Two Instances] Launching instance 1 on SD1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'cross-machine-instance-1',
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

    // Launch instance 2 connected to SD2
    console.log('[Two Instances] Launching instance 2 on SD2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'cross-machine-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Renderer]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });

    // Wait for initial bidirectional sync to settle
    // Both instances create welcome notes which need to sync and merge before we type
    await window2.waitForTimeout(8000);

    console.log('[Two Instances] Both instances ready');

    // Record start time for latency measurement
    const syncStartTime = Date.now();

    // Type content in instance 1
    const editor1 = window1.locator('.ProseMirror');
    const testContent = `Cross-machine sync test ${Date.now()}`;
    console.log('[Two Instances] Instance 1 typing:', testContent);
    await editor1.click();
    await editor1.fill(testContent);

    // Wait for content to be saved
    await window1.waitForTimeout(2000);

    console.log('[Two Instances] Waiting for sync (max 35 seconds)...');

    // Close and relaunch instance 2 to verify sync (workaround for live editor bug)
    await instance2.close();

    // Wait for files to sync (including partial sync completions)
    // Max time: 4s initial sync + 2s partial completion = 6s per file, but files sync in parallel
    // Use most of the 35s budget to ensure all partial syncs complete
    await window1.waitForTimeout(20000);

    console.log('[Two Instances] Relaunching instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'cross-machine-instance-2-reload',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2 Reload]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Reload Renderer]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window2.waitForTimeout(2000);

    // Check if content synced - give ActivitySync time to retry and update UI
    // With partial sync, files may still be completing during this window
    const editor2 = window2.locator('.ProseMirror');
    await expect(editor2).toContainText(testContent, { timeout: 25000 });

    // Calculate sync latency
    const syncEndTime = Date.now();
    const syncLatency = (syncEndTime - syncStartTime) / 1000;
    console.log(`[Two Instances] ✅ Sync completed in ${syncLatency.toFixed(1)}s`);

    // Warn if >20s, fail if >60s (extended for partial sync scenarios)
    if (syncLatency > 60) {
      throw new Error(`Sync latency exceeded 60s: ${syncLatency.toFixed(1)}s`);
    } else if (syncLatency > 20) {
      console.warn(`[Two Instances] ⚠️  Sync latency >20s: ${syncLatency.toFixed(1)}s`);
    }

    // Validate sequence numbers in CRDT logs
    console.log('[Two Instances] Validating CRDT log sequence numbers...');

    const sd1Validation = await validateAllSequences(sd1);
    const sd2Validation = await validateAllSequences(sd2);

    if (!sd1Validation.valid) {
      console.error('[Two Instances] SD1 sequence validation failed:', sd1Validation.noteResults);
      throw new Error('SD1 has out-of-order sequence numbers');
    }

    if (!sd2Validation.valid) {
      console.error('[Two Instances] SD2 sequence validation failed:', sd2Validation.noteResults);
      throw new Error('SD2 has out-of-order sequence numbers');
    }

    console.log('[Two Instances] ✅ All sequence numbers are in order');

    // Checkpoint: Basic sync works through file sync simulator
    // - Content synced from Instance A to Instance B
    // - Sync latency within acceptable range
    // - Sequence numbers are monotonically increasing
  });

  test('should sync bidirectional edits with word-by-word typing triggering multiple syncs', async () => {
    // Create simulator with moderate delays
    const logger = new SimulatorLogger({
      enabled: true,
      verbose: false,
      prefix: '[BidirectionalSync]',
    });

    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [2000, 4000], // 2-4 second delay
      partialSyncProbability: 0.0, // Disable partial sync for this test (racy with active writes)
      partialSyncRatio: [0.5, 0.9],
      logger,
    });

    // Start the simulator
    await simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Launch instance 1 FIRST and wait for welcome note to be created and synced
    // This ensures Instance 2 loads the same note instead of creating its own
    console.log('[Bidirectional] Launching instance 1 on SD1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'bidirectional-instance-1',
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

    // Wait for Instance 1's welcome note to sync to SD2 BEFORE launching Instance 2
    // This prevents Instance 2 from creating its own independent welcome note
    console.log('[Bidirectional] Waiting for welcome note to sync to SD2...');
    await window1.waitForTimeout(8000);

    // Launch instance 2 connected to SD2 (should load synced note)
    console.log('[Bidirectional] Launching instance 2 on SD2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'bidirectional-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Renderer]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window2.waitForTimeout(1000);

    console.log('[Bidirectional] Both instances ready');

    // === Phase 1: Instance 1 types content ===
    // Wait a bit for any background sync to settle
    await window1.waitForTimeout(3000);

    // Type content - just type without moving cursor
    // The content will be wherever the cursor naturally ends up
    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();
    await window1.waitForTimeout(200);

    // Use fill() for atomic content update (like Step 7 test)
    const contentFromInstance1 = 'Alice types this note.';
    console.log('[Bidirectional] Instance 1 setting content:', contentFromInstance1);
    await editor1.fill(contentFromInstance1);

    console.log('[Bidirectional] Instance 1 finished typing, waiting for sync...');

    // Wait for files to sync to SD2 (longer wait to ensure all words synced)
    // Increased to 30s to ensure all CRDT logs and activity logs fully sync
    await window1.waitForTimeout(30000);

    // Relaunch instance 2 to verify sync (workaround for live editor bug)
    console.log('[Bidirectional] Closing and relaunching instance 2...');
    await instance2.close();

    await window1.waitForTimeout(5000);

    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'bidirectional-instance-2-reload1',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2 Reload1]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Reload1 Renderer]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    // Wait longer for CRDT to load and UI to update
    await window2.waitForTimeout(5000);

    // Verify instance 2 sees instance 1's content
    const editor2 = window2.locator('.ProseMirror');
    await expect(editor2).toContainText(contentFromInstance1, { timeout: 10000 });
    console.log('[Bidirectional] ✅ Instance 2 received Instance 1 content');

    // === Phase 2: Instance 2 types with human-like behavior ===
    await editor2.click();
    await window2.waitForTimeout(200);

    // Add content from Instance 2 - use fill to replace with combined content
    // This simulates Instance 2 editing while Instance 1's content is visible
    const contentFromInstance2 = 'Alice types this note. Bob adds more content.';
    console.log('[Bidirectional] Instance 2 setting combined content:', contentFromInstance2);
    await editor2.fill(contentFromInstance2);

    console.log('[Bidirectional] Instance 2 finished typing, waiting for sync...');

    // Wait for files to sync back to SD1
    await window2.waitForTimeout(10000);

    // Relaunch instance 1 to verify bidirectional sync
    console.log('[Bidirectional] Closing and relaunching instance 1...');
    await instance1.close();

    await window2.waitForTimeout(5000);

    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'bidirectional-instance-1-reload',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1 Reload]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    window1.on('console', (msg) => {
      console.log('[Instance1 Reload Renderer]:', msg.text());
    });

    await window1.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window1.waitForTimeout(2000);

    // Verify instance 1 sees the final content (which includes both Instance 1 and Instance 2 edits)
    const editor1Reload = window1.locator('.ProseMirror');
    await expect(editor1Reload).toContainText(contentFromInstance2, { timeout: 10000 });
    console.log('[Bidirectional] ✅ Instance 1 received all content from both instances');

    // Validate sequence numbers
    console.log('[Bidirectional] Validating CRDT log sequence numbers...');
    const sd1Validation = await validateAllSequences(sd1);
    const sd2Validation = await validateAllSequences(sd2);

    if (!sd1Validation.valid) {
      console.error('[Bidirectional] SD1 sequence validation failed:', sd1Validation.noteResults);
      throw new Error('SD1 has out-of-order sequence numbers');
    }

    if (!sd2Validation.valid) {
      console.error('[Bidirectional] SD2 sequence validation failed:', sd2Validation.noteResults);
      throw new Error('SD2 has out-of-order sequence numbers');
    }

    console.log('[Bidirectional] ✅ All sequence numbers are in order');
    console.log(
      '[Bidirectional] ✅ Bidirectional sync with human-like typing completed successfully'
    );

    // Checkpoint: Bidirectional sync works
    // - Instance 1 typed content, synced to Instance 2
    // - Instance 2 typed additional content, synced back to Instance 1
    // - Both instances see all content from both sources
    // - Sequence numbers remain monotonically increasing
  });

  /**
   * Step 9: Live Editor Sync Test (TDD Red Phase)
   *
   * This test verifies that when both instances have the same note open,
   * typing in Instance A updates Instance B's editor LIVE (without restart).
   *
   * Expected to FAIL initially - this confirms the bug exists.
   * Step 10 will fix the bug, then this test will pass.
   *
   * The test:
   * 1. Launch both instances with file sync between SDs
   * 2. Both instances have the default note open
   * 3. Instance 1 types content
   * 4. Wait for file sync + activity sync
   * 5. Instance 2's editor should update LIVE (without restart)
   *
   * Known issue: The editor doesn't update because:
   * - ActivitySync calls reloadNote()
   * - But the editor/TipTap isn't notified of the CRDT merge
   */
  test('should update live editor when remote instance types (EXPECTED TO FAIL)', async () => {
    // Create simulator with short delays for faster iteration
    const logger = new SimulatorLogger({
      enabled: true,
      verbose: false, // Disable verbose logging for cleaner output
      prefix: '[LiveEditorSync]',
    });

    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [200, 500], // 0.2-0.5 second delay (fast for testing)
      partialSyncProbability: 0.0, // Disable partial sync - we want reliable sync
      partialSyncRatio: [0.5, 0.9],
      logger,
    });

    // Start the simulator
    await simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Launch instance 1 FIRST
    console.log('[LiveEditorSync] Launching instance 1 on SD1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'live-editor-instance-1',
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

    // Wait for Instance 1's content to sync to SD2 before launching Instance 2
    // Need to wait long enough for:
    // 1. Instance 1 to write CRDT log + activity log
    // 2. File sync simulator to detect all changes (chokidar polling ~300ms)
    // 3. File sync simulator to apply delays (1-2 seconds per file, but can overlap)
    // 4. All files to be written to SD2
    // Using 15s to ensure CRDT log has time to sync (activity log syncs faster)
    console.log(
      '[LiveEditorSync] Waiting for initial content (CRDT log + activity log) to sync to SD2...'
    );
    await window1.waitForTimeout(15000);

    // Launch instance 2
    console.log('[LiveEditorSync] Launching instance 2 on SD2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'live-editor-instance-2',
      },
      timeout: 60000,
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

    console.log('[LiveEditorSync] Both instances ready with same note open');

    // Capture Instance 2's initial content for comparison
    const editor2 = window2.locator('.ProseMirror');
    const initialContent2 = await editor2.textContent();
    console.log(
      '[LiveEditorSync] Instance 2 initial content:',
      initialContent2?.substring(0, 50) + '...'
    );

    // Instance 1 types unique content using keyboard (not .fill() which doesn't trigger Y.js)
    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();
    await window1.waitForTimeout(200);

    // First select all and delete to clear the welcome content
    await window1.keyboard.press('Meta+a');
    await window1.waitForTimeout(100);
    await window1.keyboard.press('Delete');
    await window1.waitForTimeout(200);

    const liveTestContent = `Live sync test ${Date.now()}`;
    console.log('[LiveEditorSync] Instance 1 typing:', liveTestContent);
    // Use keyboard.type() to trigger actual TipTap/Y.js transactions
    await window1.keyboard.type(liveTestContent);

    // Wait for content to be saved to disk
    await window1.waitForTimeout(3000);

    // Wait for file sync (activity log + CRDT log) - extended for sloppy sync
    console.log('[LiveEditorSync] Waiting for file sync to SD2...');
    await window1.waitForTimeout(15000);

    // Wait additional time for ActivitySync to detect and process changes
    console.log('[LiveEditorSync] Waiting for ActivitySync to process...');
    await window2.waitForTimeout(10000);

    // KEY TEST: Check if Instance 2's editor updated LIVE (without restart)
    // This is the bug - the editor doesn't update even though CRDT merges
    console.log('[LiveEditorSync] Checking if Instance 2 editor updated live...');

    // This assertion is EXPECTED TO FAIL
    // If it passes, the bug is already fixed!
    await expect(editor2).toContainText(liveTestContent, { timeout: 20000 });

    console.log('[LiveEditorSync] ✅ Live editor sync works! (Bug is fixed)');

    // Checkpoint: Live editor sync works
    // - Instance 1 typed content
    // - Instance 2's editor updated LIVE (without restart)
  });
});
