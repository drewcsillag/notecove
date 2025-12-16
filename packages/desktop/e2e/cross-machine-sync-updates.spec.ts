/**
 * Cross-Machine Sync E2E Tests - Note Updates
 *
 * This test suite validates live sync of note updates between running instances.
 * Tests include:
 * 1. Title change sync
 * 2. Pin status sync
 * 3. Title change on unopened note sync
 * 4. Unpin status sync
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileSyncSimulator, SimulatorLogger } from './utils/sync-simulator';
import { getFirstWindow } from './cross-machine-sync-helpers';

test.describe('cross-machine sync - note updates', () => {
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
    sd1 = await mkdtemp(join(tmpdir(), `notecove-updates-sd1-${testId}-`));
    sd2 = await mkdtemp(join(tmpdir(), `notecove-updates-sd2-${testId}-`));
    userDataDir1 = await mkdtemp(join(tmpdir(), `notecove-updates-userdata1-${testId}-`));
    userDataDir2 = await mkdtemp(join(tmpdir(), `notecove-updates-userdata2-${testId}-`));

    console.log('[Updates] Test ID:', testId);
    console.log('[Updates] SD1:', sd1);
    console.log('[Updates] SD2:', sd2);
  }, 120000);

  test.afterEach(async () => {
    console.log('[Updates] Cleaning up...');

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
      console.log('[Updates] Cleanup complete');
    } catch (error) {
      console.error('[Updates] Cleanup failed:', error);
    }
  });

  /**
   * Test that when a note's title changes in Instance 1, the title updates
   * in Instance 2's note list WHILE Instance 2 is already running (live sync).
   *
   * This tests title sync via activity watcher.
   */
  test('should sync note title change to RUNNING Instance 2 note list', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator with fast sync
    console.log('[LiveTitleSync] Starting file sync simulator...');
    const logger = new SimulatorLogger({
      prefix: '[LiveTitleSync]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [500, 1000], // Fast sync
      partialSyncProbability: 0.0,
      partialSyncRatio: [0.5, 0.9],
      logger,
    });
    await simulator.start();

    // === Launch both instances ===
    console.log('[LiveTitleSync] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'livetitle-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[LiveTitleSync] Instance 1 ready');

    // Wait for initial files to sync
    console.log('[LiveTitleSync] Waiting for initial sync...');
    await window1.waitForTimeout(5000);

    // Launch Instance 2
    console.log('[LiveTitleSync] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'livetitle-instance-2',
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

    await window2.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window2.waitForTimeout(2000);
    console.log('[LiveTitleSync] Instance 2 ready');

    // Verify Instance 2 sees the welcome note with original title
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const welcomeNote2 = notesList2.locator('li:has-text("Welcome to NoteCove")');
    const hasWelcomeNote = await welcomeNote2.isVisible();
    console.log(`[LiveTitleSync] Instance 2 has welcome note: ${hasWelcomeNote}`);
    expect(hasWelcomeNote).toBe(true);

    // === Change the title in Instance 1 ===
    console.log('[LiveTitleSync] Changing note title in Instance 1...');
    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();

    // Select all and delete to clear the content
    await window1.keyboard.press('Meta+a');
    await window1.waitForTimeout(100);
    await window1.keyboard.press('Delete');
    await window1.waitForTimeout(200);

    // Type new title
    const newTitle = `Updated Title ${Date.now()}`;
    await window1.keyboard.type(newTitle);
    await window1.waitForTimeout(2000); // Wait for save
    console.log(`[LiveTitleSync] New title: ${newTitle}`);

    // Verify title changed in Instance 1's note list
    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const updatedNote1 = notesList1.locator(`li:has-text("${newTitle}")`);
    const titleUpdatedIn1 = await updatedNote1.isVisible();
    console.log(`[LiveTitleSync] Instance 1 note list updated: ${titleUpdatedIn1}`);
    expect(titleUpdatedIn1).toBe(true);

    // === Wait for sync to Instance 2 ===
    console.log('[LiveTitleSync] Waiting for title sync to Instance 2...');
    await window1.waitForTimeout(15000);

    // === THE KEY TEST: Does Instance 2's note list show the new title? ===
    const updatedNote2 = notesList2.locator(`li:has-text("${newTitle}")`);
    const titleUpdatedIn2 = await updatedNote2.isVisible();
    console.log(`[LiveTitleSync] Instance 2 note list updated: ${titleUpdatedIn2}`);

    // This is the key assertion
    expect(titleUpdatedIn2).toBe(true);

    // Also verify the old title is gone
    const oldTitleStillVisible = await welcomeNote2.isVisible();
    console.log(`[LiveTitleSync] Old title still visible: ${oldTitleStillVisible}`);
    expect(oldTitleStillVisible).toBe(false);

    console.log('[LiveTitleSync] ✅ Live title sync test passed!');
  });

  /**
   * Test that when a note is pinned in Instance 1, the pin status syncs
   * to Instance 2's note list WHILE Instance 2 is already running (live sync).
   *
   * This tests pin sync via activity watcher and CRDT metadata.
   */
  test('should sync note pin status to RUNNING Instance 2 note list', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator with fast sync
    console.log('[LivePinSync] Starting file sync simulator...');
    const logger = new SimulatorLogger({
      prefix: '[LivePinSync]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [500, 1000], // Fast sync
      partialSyncProbability: 0.0,
      partialSyncRatio: [0.5, 0.9],
      logger,
    });
    await simulator.start();

    // === Launch both instances ===
    console.log('[LivePinSync] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'livepin-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[LivePinSync] Instance 1 ready');

    // Wait for initial files to sync
    console.log('[LivePinSync] Waiting for initial sync...');
    await window1.waitForTimeout(5000);

    // Launch Instance 2
    console.log('[LivePinSync] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'livepin-instance-2',
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

    await window2.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window2.waitForTimeout(2000);
    console.log('[LivePinSync] Instance 2 ready');

    // Verify Instance 2 sees the welcome note (unpinned)
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const welcomeNote2 = notesList2.locator('li:has-text("Welcome to NoteCove")');
    const hasWelcomeNote = await welcomeNote2.isVisible();
    console.log(`[LivePinSync] Instance 2 has welcome note: ${hasWelcomeNote}`);
    expect(hasWelcomeNote).toBe(true);

    // Verify not pinned initially (no pin icon)
    const pinIcon2Before = welcomeNote2.locator('[data-testid="PushPinIcon"]');
    const isPinnedBefore = await pinIcon2Before.isVisible().catch(() => false);
    console.log(`[LivePinSync] Instance 2 note pinned before: ${isPinnedBefore}`);
    expect(isPinnedBefore).toBe(false);

    // === Pin the note in Instance 1 ===
    console.log('[LivePinSync] Pinning note in Instance 1...');
    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const welcomeNote1 = notesList1.locator('li:has-text("Welcome to NoteCove")');

    // Right-click to open context menu
    await welcomeNote1.click({ button: 'right' });
    await window1.waitForTimeout(500);

    // Click Pin in context menu
    const pinMenuItem = window1.getByRole('menuitem', { name: 'Pin' });
    await pinMenuItem.click();
    await window1.waitForTimeout(1000);

    // Verify pin icon appears in Instance 1
    const pinIcon1 = welcomeNote1.locator('[data-testid="PushPinIcon"]');
    const isPinned1 = await pinIcon1.isVisible().catch(() => false);
    console.log(`[LivePinSync] Instance 1 note pinned: ${isPinned1}`);
    expect(isPinned1).toBe(true);

    // === Wait for sync to Instance 2 ===
    console.log('[LivePinSync] Waiting for pin status sync to Instance 2...');
    await window1.waitForTimeout(15000);

    // === THE KEY TEST: Does Instance 2 show the pin icon? ===
    // Re-query the note list to get fresh DOM
    const welcomeNote2After = notesList2.locator('li:has-text("Welcome to NoteCove")');
    const pinIcon2After = welcomeNote2After.locator('[data-testid="PushPinIcon"]');
    const isPinnedAfter = await pinIcon2After.isVisible().catch(() => false);
    console.log(`[LivePinSync] Instance 2 note pinned after sync: ${isPinnedAfter}`);

    // This is the key assertion
    expect(isPinnedAfter).toBe(true);

    console.log('[LivePinSync] ✅ Live pin sync test passed!');
  });

  /**
   * BUG TEST: Title changes on an UNOPENED note should still sync to note list.
   *
   * Current behavior: If Instance B hasn't opened a note, title changes from
   * Instance A don't update Instance B's note list until B opens the note.
   *
   * Expected behavior: Title should update in the note list even without opening.
   */
  test('should sync title change to note list even when note is NOT open in Instance 2', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator with fast sync
    console.log('[TitleSyncUnopened] Starting file sync simulator...');
    const logger = new SimulatorLogger({
      prefix: '[TitleSyncUnopened]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [500, 1000],
      partialSyncProbability: 0.0,
      partialSyncRatio: [0.5, 0.9],
      logger,
    });
    await simulator.start();

    // === Launch Instance 1 first ===
    console.log('[TitleSyncUnopened] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'titleunopened-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[TitleSyncUnopened] Instance 1 ready');

    // Wait for initial files to sync
    console.log('[TitleSyncUnopened] Waiting for initial sync...');
    await window1.waitForTimeout(5000);

    // Launch Instance 2
    console.log('[TitleSyncUnopened] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'titleunopened-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    await window2.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window2.waitForTimeout(2000);
    console.log('[TitleSyncUnopened] Instance 2 ready');

    // Create a NEW note in Instance 1 (not the default welcome note)
    console.log('[TitleSyncUnopened] Creating new note in Instance 1...');
    const createButton1 = window1.locator('button[title="Create note"]');
    await createButton1.click();
    await window1.waitForTimeout(1000);

    // Type initial content
    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();
    await window1.keyboard.type('Initial Title For Test');
    await window1.waitForTimeout(2000);

    // Wait for sync to Instance 2 - use retrying assertion with 60s timeout (matches other live sync tests)
    console.log('[TitleSyncUnopened] Waiting for new note to sync to Instance 2...');
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const initialNote2 = notesList2.locator('li:has-text("Initial Title For Test")');
    await expect(initialNote2).toBeVisible({ timeout: 60000 });
    console.log('[TitleSyncUnopened] Instance 2 has initial note: true');

    // KEY: Switch Instance 2 back to welcome note so the new note is NOT open
    console.log('[TitleSyncUnopened] Switching Instance 2 to welcome note (closing test note)...');
    const welcomeNote2 = notesList2.locator('li:has-text("Welcome to NoteCove")');
    await welcomeNote2.click();
    await window2.waitForTimeout(1000);

    // Now change the title in Instance 1
    console.log('[TitleSyncUnopened] Changing title in Instance 1...');
    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const testNote1 = notesList1.locator('li:has-text("Initial Title For Test")');
    await testNote1.click();
    await window1.waitForTimeout(500);

    // Click in the editor to ensure focus
    const editor1Edit = window1.locator('.ProseMirror');
    await editor1Edit.click();
    await window1.waitForTimeout(200);

    // Select all and replace
    await window1.keyboard.press('Meta+a');
    await window1.waitForTimeout(100);
    await window1.keyboard.press('Backspace');
    await window1.waitForTimeout(200);

    const newTitle = `Changed Title ${Date.now()}`;
    await window1.keyboard.type(newTitle);
    await window1.waitForTimeout(2000);
    console.log(`[TitleSyncUnopened] New title: ${newTitle}`);

    // Wait for sync to Instance 2
    console.log('[TitleSyncUnopened] Waiting for title sync to Instance 2...');
    await window1.waitForTimeout(15000);

    // THE KEY TEST: Does Instance 2's note list show the new title?
    // (Note is NOT open in Instance 2 - it's viewing the welcome note)
    const updatedNote2 = notesList2.locator(`li:has-text("${newTitle}")`);
    const titleUpdated = await updatedNote2.isVisible();
    console.log(`[TitleSyncUnopened] Instance 2 note list shows new title: ${titleUpdated}`);

    // This should pass - title should sync even when note is not open
    expect(titleUpdated).toBe(true);

    console.log('[TitleSyncUnopened] ✅ Title sync on unopened note test passed!');
  });

  /**
   * BUG TEST: Unpinning a note should sync to Instance B.
   *
   * This is the reverse of the pin test - ensures unpin also syncs.
   */
  test('should sync note UNPIN to RUNNING Instance 2 note list', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator
    console.log('[UnpinSync] Starting file sync simulator...');
    const logger = new SimulatorLogger({
      prefix: '[UnpinSync]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [500, 1000],
      partialSyncProbability: 0.0,
      partialSyncRatio: [0.5, 0.9],
      logger,
    });
    await simulator.start();

    // Launch Instance 1
    console.log('[UnpinSync] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'unpin-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[UnpinSync] Instance 1 ready');

    // Pin the note in Instance 1 first
    console.log('[UnpinSync] Pinning note in Instance 1...');
    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const welcomeNote1 = notesList1.locator('li:has-text("Welcome to NoteCove")');
    await welcomeNote1.click({ button: 'right' });
    await window1.waitForTimeout(500);
    const pinMenuItem = window1.getByRole('menuitem', { name: 'Pin' });
    await pinMenuItem.click();
    await window1.waitForTimeout(1000);

    // Verify pinned in Instance 1
    const pinIcon1 = welcomeNote1.locator('[data-testid="PushPinIcon"]');
    const isPinned1 = await pinIcon1.isVisible().catch(() => false);
    console.log(`[UnpinSync] Instance 1 note pinned: ${isPinned1}`);
    expect(isPinned1).toBe(true);

    // Wait for initial sync
    await window1.waitForTimeout(5000);

    // Launch Instance 2
    console.log('[UnpinSync] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'unpin-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    await window2.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window2.waitForTimeout(2000);
    console.log('[UnpinSync] Instance 2 ready');

    // Verify Instance 2 sees the note as pinned
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const welcomeNote2 = notesList2.locator('li:has-text("Welcome to NoteCove")');
    const pinIcon2Before = welcomeNote2.locator('[data-testid="PushPinIcon"]');
    const isPinnedBefore = await pinIcon2Before.isVisible().catch(() => false);
    console.log(`[UnpinSync] Instance 2 note pinned before: ${isPinnedBefore}`);
    expect(isPinnedBefore).toBe(true);

    // Now UNPIN in Instance 1
    console.log('[UnpinSync] Unpinning note in Instance 1...');
    await welcomeNote1.click({ button: 'right' });
    await window1.waitForTimeout(500);
    const unpinMenuItem = window1.getByRole('menuitem', { name: 'Unpin' });
    await unpinMenuItem.click();
    await window1.waitForTimeout(1000);

    // Verify unpinned in Instance 1
    const isPinned1After = await pinIcon1.isVisible().catch(() => false);
    console.log(`[UnpinSync] Instance 1 note pinned after unpin: ${isPinned1After}`);
    expect(isPinned1After).toBe(false);

    // Wait for sync to Instance 2
    console.log('[UnpinSync] Waiting for unpin sync to Instance 2...');
    await window1.waitForTimeout(15000);

    // THE KEY TEST: Is the pin icon gone from Instance 2?
    const isPinnedAfter = await pinIcon2Before.isVisible().catch(() => false);
    console.log(`[UnpinSync] Instance 2 note pinned after sync: ${isPinnedAfter}`);

    expect(isPinnedAfter).toBe(false);

    console.log('[UnpinSync] ✅ Unpin sync test passed!');
  });
});
