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

    // Create a note in instance 1
    await window1.click('#newNoteBtn');
    await window1.waitForTimeout(500);

    // Type content
    await window1.locator('.editor').click();
    await window1.keyboard.type('Sync Test Note Title');
    await window1.keyboard.press('Enter');
    await window1.keyboard.type('This note should appear in instance 2');
    await window1.waitForTimeout(1000); // Wait for debounce

    console.log('Created note in instance 1');

    // Get the note ID from the notes list
    const notesList1 = await window1.locator('#notesList .note-item');
    const noteCount1 = await notesList1.count();
    expect(noteCount1).toBeGreaterThan(0);

    const firstNote1 = await window1.locator('#notesList .note-item').first().innerText();
    console.log('Note in instance 1:', firstNote1);

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
    await window2.waitForTimeout(2000); // Wait for initial load

    console.log('Instance 2 started');

    // Check that instance 2 has the sample notes
    const notesList2Initial = await window2.locator('#notesList .note-item');
    const noteCount2Initial = await notesList2Initial.count();
    console.log('Initial notes in instance 2:', noteCount2Initial);

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
});
