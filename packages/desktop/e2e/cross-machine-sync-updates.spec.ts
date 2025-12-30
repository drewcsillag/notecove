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

    // Close instances with timeout to prevent hanging
    const closeWithTimeout = async (
      instance: ElectronApplication | undefined,
      name: string
    ): Promise<void> => {
      if (!instance) return;
      try {
        await Promise.race([
          instance.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
        ]);
      } catch (err) {
        console.error(`[Updates] Error closing ${name}:`, err);
      }
    };

    await closeWithTimeout(instance1, 'instance1');
    await closeWithTimeout(instance2, 'instance2');

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
    await expect(welcomeNote2).toBeVisible({ timeout: 30000 });
    console.log('[LiveTitleSync] Instance 2 has welcome note');

    // === Change the title in Instance 1 ===
    console.log('[LiveTitleSync] Changing note title in Instance 1...');
    const editor1 = window1.locator('.ProseMirror');

    // Use a unique title with timestamp
    const newTitle = `Updated${Date.now().toString().slice(-4)}`;
    console.log(`[LiveTitleSync] Will set new title: "${newTitle}"`);

    // Wait for editor to stabilize
    await window1.waitForTimeout(2000);

    // Replace the heading content directly using JavaScript
    // Note: For replacing existing content, using evaluate() is more reliable than
    // keyboard selection. The CRDT sequence violation fix is demonstrated by the
    // creation tests which use keyboard.type() on new notes.
    await editor1.evaluate((el, title) => {
      const h1 = el.querySelector('h1');
      if (h1) {
        h1.innerHTML = title;
        const event = new InputEvent('input', { bubbles: true });
        el.dispatchEvent(event);
      }
    }, newTitle);

    // Wait for content to be processed by the CRDT system
    await window1.waitForTimeout(3000);
    console.log(`[LiveTitleSync] New title: ${newTitle}`);

    // Verify title changed in Instance 1's note list using retrying assertion
    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const updatedNote1 = notesList1.locator(`li:has-text("${newTitle}")`);
    await expect(updatedNote1).toBeVisible({ timeout: 30000 });
    console.log('[LiveTitleSync] Instance 1 note list updated');

    // === Wait for sync to Instance 2 using retrying assertion ===
    console.log('[LiveTitleSync] Waiting for title sync to Instance 2...');
    const updatedNote2 = notesList2.locator(`li:has-text("${newTitle}")`);
    // Use retrying assertion instead of fixed wait + one-shot check
    await expect(updatedNote2).toBeVisible({ timeout: 60000 });
    console.log('[LiveTitleSync] Instance 2 note list updated');

    // Also verify the old title is gone
    await expect(welcomeNote2).not.toBeVisible({ timeout: 30000 });
    console.log('[LiveTitleSync] Old title no longer visible');

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
    await expect(welcomeNote2).toBeVisible({ timeout: 30000 });
    console.log('[LivePinSync] Instance 2 has welcome note');

    // Verify not pinned initially (no pin icon)
    const pinIcon2Before = welcomeNote2.locator('[data-testid="PushPinIcon"]');
    await expect(pinIcon2Before).not.toBeVisible({ timeout: 5000 });
    console.log('[LivePinSync] Instance 2 note not pinned initially');

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

    // Verify pin icon appears in Instance 1 using retrying assertion
    const pinIcon1 = welcomeNote1.locator('[data-testid="PushPinIcon"]');
    await expect(pinIcon1).toBeVisible({ timeout: 30000 });
    console.log('[LivePinSync] Instance 1 note pinned');

    // === Wait for sync to Instance 2 using retrying assertion ===
    console.log('[LivePinSync] Waiting for pin status sync to Instance 2...');
    // Re-query the note list to get fresh DOM
    const welcomeNote2After = notesList2.locator('li:has-text("Welcome to NoteCove")');
    const pinIcon2After = welcomeNote2After.locator('[data-testid="PushPinIcon"]');
    // Use retrying assertion instead of fixed wait + one-shot check
    await expect(pinIcon2After).toBeVisible({ timeout: 60000 });
    console.log('[LivePinSync] Instance 2 note pinned after sync');

    console.log('[LivePinSync] ✅ Live pin sync test passed!');
  });

  /**
   * BUG TEST: Title changes on an UNOPENED note should still sync to note list.
   *
   * Current behavior: If Instance B hasn't opened a note, title changes from
   * Instance A don't update Instance B's note list until B opens the note.
   *
   * Expected behavior: Title should update in the note list even without opening.
   *
   * FLAKY: This test has timing issues with cross-instance sync detection.
   * The note appears but locators sometimes fail to find it during rapid list updates.
   * Fixed to use expect.poll() pattern but may still be flaky in CI environments.
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
    await window1.waitForTimeout(2000);

    // Use JavaScript to set the heading content directly to avoid CRDT sequence violations
    const editor1 = window1.locator('.ProseMirror');
    const initialTitle = `Init${Date.now().toString().slice(-4)}`;
    console.log(`[TitleSyncUnopened] Setting initial title: ${initialTitle}`);
    await editor1.evaluate((el, title) => {
      const h1 = el.querySelector('h1');
      if (h1) {
        h1.innerHTML = title;
        const event = new InputEvent('input', { bubbles: true });
        el.dispatchEvent(event);
      }
    }, initialTitle);
    await window1.waitForTimeout(3000);

    // Wait for sync to Instance 2 - use retrying assertion
    console.log('[TitleSyncUnopened] Waiting for new note to sync to Instance 2...');
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const initialNoteLocator = notesList2.locator(`li:has-text("${initialTitle}")`);
    await expect(initialNoteLocator).toBeVisible({ timeout: 60000 });
    console.log('[TitleSyncUnopened] Instance 2 has initial note');

    // KEY: Switch Instance 2 back to welcome note so the new note is NOT open
    console.log('[TitleSyncUnopened] Switching Instance 2 to welcome note (closing test note)...');
    const welcomeNote2 = notesList2.locator('li:has-text("Welcome to NoteCove")');
    await welcomeNote2.click();
    await window2.waitForTimeout(1000);

    // Now change the title in Instance 1
    console.log('[TitleSyncUnopened] Changing title in Instance 1...');
    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const testNote1 = notesList1.locator(`li:has-text("${initialTitle}")`);
    await testNote1.click();
    await window1.waitForTimeout(2000);

    // Use JavaScript to set the new heading content directly
    const newTitle = `Changed${Date.now().toString().slice(-4)}`;
    console.log(`[TitleSyncUnopened] Setting new title: ${newTitle}`);
    await editor1.evaluate((el, title) => {
      const h1 = el.querySelector('h1');
      if (h1) {
        h1.innerHTML = title;
        const event = new InputEvent('input', { bubbles: true });
        el.dispatchEvent(event);
      }
    }, newTitle);
    await window1.waitForTimeout(3000);

    // THE KEY TEST: Does Instance 2's note list show the new title?
    // (Note is NOT open in Instance 2 - it's viewing the welcome note)
    console.log('[TitleSyncUnopened] Waiting for title sync to Instance 2...');
    const updatedNote2 = notesList2.locator(`li:has-text("${newTitle}")`);
    // Use retrying assertion instead of fixed wait + one-shot check
    await expect(updatedNote2).toBeVisible({ timeout: 60000 });
    console.log('[TitleSyncUnopened] Instance 2 note list shows new title');

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

    // Verify pinned in Instance 1 using retrying assertion
    const pinIcon1 = welcomeNote1.locator('[data-testid="PushPinIcon"]');
    await expect(pinIcon1).toBeVisible({ timeout: 30000 });
    console.log('[UnpinSync] Instance 1 note pinned');

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

    // Verify Instance 2 sees the note as pinned using retrying assertion
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const welcomeNote2 = notesList2.locator('li:has-text("Welcome to NoteCove")');
    const pinIcon2Before = welcomeNote2.locator('[data-testid="PushPinIcon"]');
    await expect(pinIcon2Before).toBeVisible({ timeout: 30000 });
    console.log('[UnpinSync] Instance 2 note pinned before');

    // Now UNPIN in Instance 1
    console.log('[UnpinSync] Unpinning note in Instance 1...');
    await welcomeNote1.click({ button: 'right' });
    await window1.waitForTimeout(500);
    const unpinMenuItem = window1.getByRole('menuitem', { name: 'Unpin' });
    await unpinMenuItem.click();
    await window1.waitForTimeout(1000);

    // Verify unpinned in Instance 1 using retrying assertion
    await expect(pinIcon1).not.toBeVisible({ timeout: 30000 });
    console.log('[UnpinSync] Instance 1 note unpinned');

    // THE KEY TEST: Is the pin icon gone from Instance 2?
    // Use retrying assertion instead of fixed wait + one-shot check
    console.log('[UnpinSync] Waiting for unpin sync to Instance 2...');
    await expect(pinIcon2Before).not.toBeVisible({ timeout: 60000 });
    console.log('[UnpinSync] Instance 2 note unpinned after sync');

    console.log('[UnpinSync] ✅ Unpin sync test passed!');
  });
});
