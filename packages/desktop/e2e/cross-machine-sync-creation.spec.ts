/**
 * Cross-Machine Sync E2E Tests - New Note Creation
 *
 * This test suite validates note creation and folder move sync between instances.
 * Tests include:
 * 1. New note creation when Instance 2 launches after sync
 * 2. Live new note creation sync to running Instance 2
 * 3. Folder move sync to running Instance 2
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
  inspectSDContents,
} from './utils/sync-simulator';
import { getFirstWindow } from './cross-machine-sync-helpers';

test.describe('cross-machine sync - new note creation', () => {
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
    sd1 = await mkdtemp(join(tmpdir(), `notecove-newnote-sd1-${testId}-`));
    sd2 = await mkdtemp(join(tmpdir(), `notecove-newnote-sd2-${testId}-`));
    userDataDir1 = await mkdtemp(join(tmpdir(), `notecove-newnote-userdata1-${testId}-`));
    userDataDir2 = await mkdtemp(join(tmpdir(), `notecove-newnote-userdata2-${testId}-`));

    console.log('[NewNoteSync] Test ID:', testId);
    console.log('[NewNoteSync] SD1:', sd1);
    console.log('[NewNoteSync] SD2:', sd2);
  }, 120000);

  test.afterEach(async () => {
    console.log('[NewNoteSync] Cleaning up...');

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
      console.log('[NewNoteSync] Cleanup complete');
    } catch (error) {
      console.error('[NewNoteSync] Cleanup failed:', error);
    }
  });

  test('should sync newly created note when Instance 2 launches after sync', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator FIRST (so SD2 gets files as they're created)
    console.log('[NewNoteSync] Starting file sync simulator...');
    const logger = new SimulatorLogger({
      prefix: '[NewNoteSync]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [1000, 2000], // 1-2 second delay
      partialSyncProbability: 0.0, // No partial sync for this test
      partialSyncRatio: [0.5, 0.9],
      logger,
    });
    await simulator.start();
    console.log('[NewNoteSync] File sync simulator started');

    // === Launch Instance 1 ===
    console.log('[NewNoteSync] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'newnote-instance-1',
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

    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[NewNoteSync] Instance 1 ready');

    // Get the initial note count via UI (should be 1 - the welcome note)
    const notesList1 = window1.locator('[data-testid="notes-list"] li');
    const initialNoteCount1 = await notesList1.count();
    console.log(`[NewNoteSync] Instance 1 initial note count: ${initialNoteCount1}`);
    expect(initialNoteCount1).toBe(1); // Welcome note

    // === Create a new note in Instance 1 ===
    console.log('[NewNoteSync] Creating new note in Instance 1...');
    const createButton = window1.getByTitle('Create note');
    await createButton.click();
    await window1.waitForTimeout(1000);

    // Type some content to give the note a title
    const testTitle = 'New Note Created By Instance 1';
    const editor = window1.locator('.ProseMirror');
    await editor.click();
    await window1.keyboard.type(testTitle);
    await window1.waitForTimeout(2000); // Wait for save

    // Verify note was created in Instance 1 via UI
    const noteCountAfterCreate = await notesList1.count();
    console.log(`[NewNoteSync] Instance 1 note count after create: ${noteCountAfterCreate}`);
    expect(noteCountAfterCreate).toBe(2); // Welcome note + new note

    // === Wait for file sync to complete ===
    console.log('[NewNoteSync] Waiting for file sync to SD2...');
    await window1.waitForTimeout(8000);

    // Check SD contents
    const sd1Contents = await inspectSDContents(sd1);
    const sd2Contents = await inspectSDContents(sd2);
    console.log('[NewNoteSync] SD1 notes:', sd1Contents.notes.map((n) => n.id).join(', '));
    console.log('[NewNoteSync] SD2 notes:', sd2Contents.notes.map((n) => n.id).join(', '));

    // Verify SD2 has the new note files
    expect(sd2Contents.notes.length).toBe(sd1Contents.notes.length);
    expect(sd2Contents.notes.map((n) => n.id).sort()).toEqual(
      sd1Contents.notes.map((n) => n.id).sort()
    );

    // === Launch Instance 2 ===
    console.log('[NewNoteSync] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'newnote-instance-2',
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
    console.log('[NewNoteSync] Instance 2 ready');

    // === Verify Instance 2 sees the new note ===
    const notesList2 = window2.locator('[data-testid="notes-list"] li');
    const noteCountInstance2 = await notesList2.count();
    console.log(`[NewNoteSync] Instance 2 note count: ${noteCountInstance2}`);

    // This is the key assertion - Instance 2 should see the new note
    expect(noteCountInstance2).toBe(2); // Welcome note + synced new note

    // Verify Instance 2 can see the new note title in the list
    const noteWithTitle = window2.locator(`[data-testid="notes-list"] li:has-text("${testTitle}")`);
    const hasNewNote = await noteWithTitle.count();
    console.log(`[NewNoteSync] Instance 2 has note with title "${testTitle}": ${hasNewNote > 0}`);
    expect(hasNewNote).toBeGreaterThan(0);

    console.log('[NewNoteSync] ✅ New note creation sync test passed!');
  });

  /**
   * Test that a NEW note created in Instance 1 appears in Instance 2's note list
   * WHILE Instance 2 is already running (live sync via activity watcher).
   *
   * This is the key test for the reported bug: "new notes don't appear in other instances"
   */
  test('should sync newly created note to RUNNING Instance 2 via activity watcher', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator
    console.log('[LiveNewNote] Starting file sync simulator...');
    const logger = new SimulatorLogger({
      prefix: '[LiveNewNote]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [500, 1000], // Fast sync for this test
      partialSyncProbability: 0.0,
      partialSyncRatio: [0.5, 0.9],
      logger,
    });
    await simulator.start();

    // === Launch BOTH instances first ===
    console.log('[LiveNewNote] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'livenew-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[LiveNewNote] Instance 1 ready');

    // Wait for initial files to sync to SD2
    console.log('[LiveNewNote] Waiting for initial sync...');
    await window1.waitForTimeout(5000);

    // Now launch Instance 2 (it will see the welcome note)
    console.log('[LiveNewNote] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'livenew-instance-2',
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
    console.log('[LiveNewNote] Instance 2 ready');

    // Get initial note count in Instance 2
    const notesList2 = window2.locator('[data-testid="notes-list"] li');
    const initialNoteCount2 = await notesList2.count();
    console.log(`[LiveNewNote] Instance 2 initial note count: ${initialNoteCount2}`);
    expect(initialNoteCount2).toBe(1); // Just the welcome note

    // === NOW create a new note in Instance 1 ===
    console.log('[LiveNewNote] Creating new note in Instance 1...');
    const createButton = window1.getByTitle('Create note');
    await createButton.click();
    await window1.waitForTimeout(1000);

    // Type content to give it a unique title
    const testTitle = `Live New Note ${Date.now()}`;
    const editor = window1.locator('.ProseMirror');
    await editor.click();
    await window1.keyboard.type(testTitle);
    await window1.waitForTimeout(2000); // Wait for save

    // Verify note was created in Instance 1
    const notesList1 = window1.locator('[data-testid="notes-list"] li');
    const noteCount1 = await notesList1.count();
    console.log(`[LiveNewNote] Instance 1 note count after create: ${noteCount1}`);
    expect(noteCount1).toBe(2);

    // === Wait for file sync + activity detection ===
    console.log('[LiveNewNote] Waiting for file sync and activity detection...');
    // Use retrying assertions instead of fixed wait + one-shot check
    // This handles timing variability in file sync and activity watcher

    // This is THE KEY ASSERTION - does the new note appear without restart?
    // Use toHaveCount which retries until condition is met or timeout
    // 60s timeout to handle resource contention during parallel test execution
    await expect(notesList2).toHaveCount(2, { timeout: 60000 });
    console.log('[LiveNewNote] Instance 2 note count after sync: 2');

    // Also verify the title is correct
    const noteWithTitle = window2.locator(`[data-testid="notes-list"] li:has-text("${testTitle}")`);
    await expect(noteWithTitle).toHaveCount(1, { timeout: 5000 });
    console.log('[LiveNewNote] Instance 2 has note with title: true');

    console.log('[LiveNewNote] ✅ Live new note sync test passed!');
  });

  /**
   * Test that a note moved to a folder in Instance 1 shows up in the folder
   * in Instance 2 WHILE Instance 2 is already running (live sync).
   *
   * This tests folder metadata sync via activity watcher.
   */
  test('should sync note folder move to RUNNING Instance 2 via activity watcher', async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Start file sync simulator with fast sync
    console.log('[LiveFolderMove] Starting file sync simulator...');
    const logger = new SimulatorLogger({
      prefix: '[LiveFolderMove]',
    });
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [500, 1000], // Fast sync
      partialSyncProbability: 0.0,
      partialSyncRatio: [0.5, 0.9],
      logger,
    });
    await simulator.start();

    // === Launch both instances ===
    console.log('[LiveFolderMove] Launching Instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'livemove-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 20000 });
    await window1.waitForTimeout(2000);
    console.log('[LiveFolderMove] Instance 1 ready');

    // Wait for initial files to sync
    console.log('[LiveFolderMove] Waiting for initial sync...');
    await window1.waitForTimeout(5000);

    // Launch Instance 2
    console.log('[LiveFolderMove] Launching Instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'livemove-instance-2',
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
    console.log('[LiveFolderMove] Instance 2 ready');

    // Create a folder in Instance 1
    console.log('[LiveFolderMove] Creating folder in Instance 1...');
    const newFolderButton = window1.locator('button[title="Create folder"]');
    await newFolderButton.click();
    await window1.waitForSelector('text=Create New Folder', { timeout: 5000 });

    const dialog = window1.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    const testFolderName = `Live Move Folder ${Date.now()}`;
    await folderNameInput.fill(testFolderName);
    await window1.keyboard.press('Enter');
    await window1.waitForTimeout(1000);

    // Verify folder was created in Instance 1
    const folderNode1 = window1
      .locator(`[data-testid^="folder-tree-node-"]`)
      .filter({ hasText: testFolderName });
    await expect(folderNode1).toBeVisible({ timeout: 5000 });
    console.log('[LiveFolderMove] Folder created in Instance 1:', testFolderName);

    // Wait for folder to sync to Instance 2
    console.log('[LiveFolderMove] Waiting for folder to sync to Instance 2...');
    await window1.waitForTimeout(10000);

    // Check if folder exists in Instance 2
    const folderNode2 = window2
      .locator(`[data-testid^="folder-tree-node-"]`)
      .filter({ hasText: testFolderName });
    const folderExists = await folderNode2.count();
    console.log(`[LiveFolderMove] Folder exists in Instance 2: ${folderExists > 0}`);
    expect(folderExists).toBeGreaterThan(0);

    // Move the note to the folder in Instance 1
    console.log('[LiveFolderMove] Moving note to folder in Instance 1...');
    const allNotesNode = window1.locator('[data-testid="folder-tree-node-all-notes:default"]');
    await allNotesNode.click();
    await window1.waitForTimeout(500);

    const notesList1 = window1.locator('[data-testid="notes-list"]');
    const firstNote = notesList1.locator('li').first();
    await firstNote.click({ button: 'right' });
    await window1.waitForTimeout(300);

    const moveToMenuItem = window1.locator('text=Move to...');
    await moveToMenuItem.click();
    await window1.waitForTimeout(500);

    const moveDialog = window1.locator('div[role="dialog"]').filter({ hasText: 'Move Note' });
    await expect(moveDialog).toBeVisible({ timeout: 5000 });

    const folderRadio = moveDialog.locator(`text=${testFolderName}`);
    await folderRadio.click();
    await window1.waitForTimeout(300);

    const moveButton = moveDialog.locator('button').filter({ hasText: 'Move' });
    await moveButton.click();
    await window1.waitForTimeout(1000);
    console.log('[LiveFolderMove] Note moved to folder in Instance 1');

    // Verify badge shows in Instance 1
    const badge1 = folderNode1.locator('.MuiChip-root').filter({ hasText: '1' });
    await expect(badge1).toBeVisible({ timeout: 5000 });
    console.log('[LiveFolderMove] Instance 1 folder badge shows 1 note');

    // Wait for note metadata to sync to Instance 2
    console.log('[LiveFolderMove] Waiting for note metadata to sync to Instance 2...');
    await window1.waitForTimeout(15000);

    // THE KEY TEST: Does Instance 2's folder badge update?
    const badge2 = folderNode2.locator('.MuiChip-root').filter({ hasText: '1' });
    const badgeVisible = await badge2.isVisible();
    console.log(`[LiveFolderMove] Instance 2 folder badge visible: ${badgeVisible}`);

    // This is the key assertion - does the folder badge update in Instance 2?
    expect(badgeVisible).toBe(true);

    // === ADDITIONAL TEST: Click on folder and verify note appears in list ===
    console.log('[LiveFolderMove] Clicking on folder in Instance 2...');
    await folderNode2.click();
    await window2.waitForTimeout(1000);

    // Verify the note appears in the notes list
    const notesList2 = window2.locator('[data-testid="notes-list"]');
    const noteCount2 = await notesList2.locator('li').count();
    console.log(`[LiveFolderMove] Notes in folder in Instance 2: ${noteCount2}`);
    expect(noteCount2).toBe(1);

    // Verify it's the correct note (welcome note was moved)
    const welcomeNoteInFolder = notesList2.locator('li:has-text("Welcome to NoteCove")');
    const welcomeNoteVisible = await welcomeNoteInFolder.isVisible();
    console.log(`[LiveFolderMove] Welcome note visible in folder: ${welcomeNoteVisible}`);
    expect(welcomeNoteVisible).toBe(true);

    console.log('[LiveFolderMove] ✅ Live folder move sync test passed!');
  });
});
