/**
 * E2E tests for real-time sync between multiple instances
 * Tests that notes and metadata changes propagate in near real-time
 */

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

test.describe('Real-time Sync E2E', () => {
  let testDir;

  test.beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = path.join(os.tmpdir(), `notecove-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  test.afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
  });

  test('should sync new notes between instances in real-time', async () => {
    console.log('=== TEST: Real-time new note sync ===');

    // Launch first instance
    const electronApp1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance1'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await electronApp1.firstWindow();
    await window1.waitForTimeout(1000);

    console.log('Instance 1 started');

    // Launch second instance BEFORE creating the note
    const electronApp2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance2'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await electronApp2.firstWindow();
    await window2.waitForTimeout(2000); // Wait for initial load

    console.log('Instance 2 started');

    // Check initial note count in instance 2
    const notesList2Initial = await window2.locator('#notesList .note-item');
    const noteCount2Initial = await notesList2Initial.count();
    console.log('Initial notes in instance 2:', noteCount2Initial);

    // NOW create a note in instance 1 (while instance 2 is running)
    await window1.click('#newNoteBtn');
    await window1.waitForTimeout(500);

    // Type content
    await window1.locator('.editor').click();
    await window1.keyboard.type('Sync Test Note Title');
    await window1.keyboard.press('Enter');
    await window1.keyboard.type('This note should appear in instance 2');
    await window1.waitForTimeout(2000); // Wait for save

    console.log('Created note in instance 1');

    // Get the note ID from the notes list
    const notesList1 = await window1.locator('#notesList .note-item');
    const noteCount1 = await notesList1.count();
    expect(noteCount1).toBeGreaterThan(0);

    const firstNote1 = await window1.locator('#notesList .note-item').first().innerText();
    console.log('Note in instance 1:', firstNote1);

    // Wait for sync to discover the new note (sync runs every 2 seconds)
    await window2.waitForTimeout(5000);

    // Check if the new note appears in instance 2
    const notesList2 = await window2.locator('#notesList .note-item');
    const noteCount2 = await notesList2.count();
    console.log('Notes after sync in instance 2:', noteCount2);

    // The note should now be visible
    expect(noteCount2).toBeGreaterThan(noteCount2Initial);

    // Check that the note content is there
    const notes2 = await window2.locator('#notesList .note-item .note-title').allInnerTexts();
    console.log('All notes in instance 2:', notes2);

    const syncTestNote = notes2.find(title => title.includes('Sync Test Note Title'));
    expect(syncTestNote).toBeDefined();
    console.log('✓ New note synced to instance 2');

    // Cleanup
    await electronApp1.close();
    await electronApp2.close();

    console.log('=== TEST COMPLETE ===');
  });

  test('should sync tag changes between instances in real-time', async () => {
    console.log('=== TEST: Real-time tag sync ===');

    // Launch first instance
    const electronApp1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance1'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await electronApp1.firstWindow();
    await window1.waitForTimeout(1000);

    // Create a note in instance 1
    await window1.click('#newNoteBtn');
    await window1.waitForTimeout(500);

    await window1.locator('.editor').click();
    await window1.keyboard.type('Note for tag testing');
    await window1.keyboard.press('Enter');
    await window1.keyboard.type('Content with #important tag');
    await window1.waitForTimeout(1000);

    console.log('Created note with tag in instance 1');

    // Verify tag appears in instance 1
    const tags1 = await window1.locator('#tagsList .tag-item .tag-name').allInnerTexts();
    console.log('Tags in instance 1:', tags1);
    expect(tags1).toContain('#important');

    // Launch second instance
    const electronApp2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance2'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await electronApp2.firstWindow();
    await window2.waitForTimeout(2000);

    console.log('Instance 2 started');

    // Wait for sync to discover the new note
    await window2.waitForTimeout(5000);

    // Check that the tag appears in instance 2
    const tags2 = await window2.locator('#tagsList .tag-item .tag-name').allInnerTexts();
    console.log('Tags in instance 2:', tags2);
    expect(tags2).toContain('#important');
    console.log('✓ Tag synced to instance 2');

    // Now add another tag in instance 1
    await window1.locator('.editor').click();
    await window1.keyboard.press('End'); // Go to end of content
    await window1.keyboard.type(' #urgent');
    await window1.waitForTimeout(1000);

    console.log('Added second tag in instance 1');

    // Verify new tag appears in instance 1
    const tags1Updated = await window1.locator('#tagsList .tag-item .tag-name').allInnerTexts();
    console.log('Updated tags in instance 1:', tags1Updated);
    expect(tags1Updated).toContain('#urgent');

    // Wait for sync in instance 2
    await window2.waitForTimeout(5000);

    // Check that the new tag appears in instance 2
    const tags2Updated = await window2.locator('#tagsList .tag-item .tag-name').allInnerTexts();
    console.log('Updated tags in instance 2:', tags2Updated);
    expect(tags2Updated).toContain('#urgent');
    console.log('✓ New tag synced to instance 2');

    // Cleanup
    await electronApp1.close();
    await electronApp2.close();

    console.log('=== TEST COMPLETE ===');
  });

  test('should sync note deletion between instances', async () => {
    console.log('=== TEST: Note deletion sync ===');

    // Launch first instance
    const electronApp1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance1'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await electronApp1.firstWindow();

    // Capture console logs from instance 1 too
    window1.on('console', msg => {
      const text = msg.text();
      if (text.includes('SyncManager') || text.includes('instanceId')) {
        console.log(`[Instance 1] ${text}`);
      }
    });

    await window1.waitForTimeout(1000);

    // Create a note in instance 1
    await window1.click('#newNoteBtn');
    await window1.waitForTimeout(500);

    await window1.locator('.editor').click();
    await window1.keyboard.type('Note to be deleted');
    await window1.keyboard.press('Enter');
    await window1.keyboard.type('This note will be deleted in instance 1');
    await window1.waitForTimeout(1000);

    console.log('Created note in instance 1');

    // Launch second instance
    const electronApp2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance2'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await electronApp2.firstWindow();

    // Capture console logs from instance 2
    window2.on('console', msg => {
      const text = msg.text();
      if (text.includes('[syncNote]') || text.includes('[renderer]') ||
          text.includes('[performSync]') || text.includes('[readNewUpdates]') ||
          text.includes('SyncManager') || text.includes('instanceId')) {
        console.log(`[Instance 2] ${text}`);
      }
    });

    await window2.waitForTimeout(3000); // Wait for sync

    // Verify note exists in instance 2
    const notes2Before = await window2.locator('#notesList .note-item .note-title').allInnerTexts();
    console.log('Notes in instance 2 before delete:', notes2Before);
    expect(notes2Before.some(title => title.includes('Note to be deleted'))).toBeTruthy();

    // Delete the note in instance 1
    await window1.click('#deleteNoteBtn');
    // Wait for confirmation dialog and confirm
    await window1.waitForSelector('#dialogConfirm', { timeout: 2000 });
    await window1.click('#dialogConfirm');
    await window1.waitForTimeout(1000);

    console.log('Deleted note in instance 1');

    // Wait for sync to propagate (increased to 10s to rule out timing issues)
    await window2.waitForTimeout(10000);

    // Verify note is deleted in instance 2
    const notes2After = await window2.locator('#notesList .note-item .note-title').allInnerTexts();
    console.log('Notes in instance 2 after delete:', notes2After);
    expect(notes2After.some(title => title.includes('Note to be deleted'))).toBeFalsy();
    console.log('✓ Note deletion synced to instance 2');

    // Cleanup
    await electronApp1.close();
    await electronApp2.close();

    console.log('=== TEST COMPLETE ===');
  });

  test('should sync folder creation between instances', async () => {
    console.log('=== TEST: Folder creation sync ===');

    // Launch first instance
    const electronApp1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance1'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await electronApp1.firstWindow();

    // Capture console logs from instance 1
    window1.on('console', msg => {
      const text = msg.text();
      if (text.includes('[FolderManager]') || text.includes('[syncFolders]') ||
          text.includes('[SyncManager]') || text.includes('[UpdateStore]')) {
        console.log(`[Instance 1] ${text}`);
      }
    });

    await window1.waitForTimeout(1000);

    // Launch second instance
    const electronApp2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance2'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await electronApp2.firstWindow();

    // Capture console logs from instance 2
    window2.on('console', msg => {
      const text = msg.text();
      if (text.includes('[FolderManager]') || text.includes('[syncFolders]') ||
          text.includes('[SyncManager]') || text.includes('[UpdateStore]') ||
          text.includes('[renderer]')) {
        console.log(`[Instance 2] ${text}`);
      }
    });

    await window2.waitForTimeout(2000);

    // Get initial folders in instance 2
    const folders2Before = await window2.locator('#folderTree .folder-item .folder-name').allInnerTexts();
    console.log('Folders in instance 2 before:', folders2Before);

    // Create a new folder in instance 1
    await window1.click('#newFolderBtn');
    await window1.waitForTimeout(500);

    // Wait for input dialog and type folder name
    await window1.waitForSelector('#dialogInput', { timeout: 2000 });
    await window1.locator('#dialogInput').fill('Synced Project');
    await window1.click('#dialogOk');
    await window1.waitForTimeout(1000);

    console.log('Created folder in instance 1');

    // Verify folder was created in instance 1
    const folders1After = await window1.locator('#folderTree .folder-item .folder-name').allInnerTexts();
    console.log('Folders in instance 1 after creation:', folders1After);

    // Wait for sync
    await window2.waitForTimeout(5000);

    // Check if folder appears in instance 2
    const folders2After = await window2.locator('#folderTree .folder-item .folder-name').allInnerTexts();
    console.log('Folders in instance 2 after:', folders2After);
    expect(folders2After).toContain('Synced Project');
    console.log('✓ Folder creation synced to instance 2');

    // Cleanup
    await electronApp1.close();
    await electronApp2.close();

    console.log('=== TEST COMPLETE ===');
  });

  test('should sync note move between folders', async () => {
    console.log('=== TEST: Note move between folders sync ===');

    // Launch first instance
    const electronApp1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance1'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await electronApp1.firstWindow();
    await window1.waitForTimeout(1000);

    // Create a folder first
    await window1.click('#newFolderBtn');
    await window1.waitForTimeout(500);
    await window1.keyboard.type('Target Folder');
    await window1.keyboard.press('Enter');
    await window1.waitForTimeout(500);

    // Create a note
    await window1.click('#newNoteBtn');
    await window1.waitForTimeout(500);
    await window1.locator('.editor').click();
    await window1.keyboard.type('Movable Note');
    await window1.keyboard.press('Enter');
    await window1.keyboard.type('This note will be moved to another folder');
    await window1.waitForTimeout(1000);

    console.log('Created folder and note in instance 1');

    // Launch second instance
    const electronApp2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'instance2'),
        '--notes-path=' + testDir
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await electronApp2.firstWindow();
    await window2.waitForTimeout(3000); // Wait for sync

    console.log('Instance 2 started and synced');

    // Move the note to the folder in instance 1 via drag-and-drop
    const noteItem = window1.locator('#notesList .note-item').first();
    const targetFolder = window1.locator('#folderTree .folder-item').filter({ hasText: 'Target Folder' });

    await noteItem.dragTo(targetFolder);
    await window1.waitForTimeout(1000);

    console.log('Moved note to folder in instance 1');

    // Wait for sync
    await window2.waitForTimeout(5000);

    // In instance 2, select the target folder
    await window2.locator('#folderTree .folder-item').filter({ hasText: 'Target Folder' }).click();
    await window2.waitForTimeout(500);

    // Check if the note appears in the target folder in instance 2
    const notesInFolder2 = await window2.locator('#notesList .note-item .note-title').allInnerTexts();
    console.log('Notes in Target Folder in instance 2:', notesInFolder2);
    expect(notesInFolder2.some(title => title.includes('Movable Note'))).toBeTruthy();
    console.log('✓ Note move synced to instance 2');

    // Cleanup
    await electronApp1.close();
    await electronApp2.close();

    console.log('=== TEST COMPLETE ===');
  });
});
