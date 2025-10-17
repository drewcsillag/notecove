import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Test directory for isolated test instances
const TEST_DIR = path.join(os.tmpdir(), 'notecove-electron-test-' + Date.now());

test.describe('Note Links - Electron Mode (CRDT)', () => {
  test.beforeAll(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean up test directory:', err);
    }
  });

  test('should update link text when note title changes via CRDT', async () => {
    // Launch Electron app
    const electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(TEST_DIR, 'user-data'),
        '--notes-path=' + path.join(TEST_DIR, 'notes'),
        '--instance=test'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    const window = await electronApp.firstWindow();

    // Wait for app to be ready
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);

    // Create target note
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    // Type target note content
    await editor.fill('Original Title\n\nTarget content here');
    await window.waitForTimeout(1500); // Wait for CRDT sync

    // Get the target note ID from the active note in the sidebar
    const targetNoteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Create source note with link
    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    // Type the content to trigger input rules (fill() doesn't trigger them)
    await editor.type('Source Note');
    await window.keyboard.press('Enter');
    await window.keyboard.press('Enter');
    await editor.type('Check out [[Original Title]]');
    await window.waitForTimeout(1500); // Wait for link creation and CRDT sync

    // Debug: Check what's actually in the editor
    const editorHTML = await window.evaluate(() => {
      return document.querySelector('#editor .ProseMirror')?.innerHTML;
    });
    console.log('[Test] Editor HTML after link creation:', editorHTML);

    // Verify link was created with correct noteId
    const linkData = await window.evaluate(() => {
      const link = document.querySelector('#editor span[data-note-link]');
      return link ? {
        text: link.textContent,
        title: link.getAttribute('data-note-title'),
        noteId: link.getAttribute('data-note-id')
      } : null;
    });

    console.log('[Test] Link data:', linkData);
    expect(linkData).not.toBeNull();
    expect(linkData.text).toBe('Original Title');
    expect(linkData.title).toBe('Original Title');
    expect(linkData.noteId).toBe(targetNoteId);

    console.log('[Test] Link created with noteId:', targetNoteId);

    // Get source note ID
    const sourceNoteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Switch to target note and rename it
    await window.click(`.note-item[data-note-id="${targetNoteId}"]`);
    await window.waitForTimeout(500);

    // Rename the target note
    await editor.fill('New Title\n\nTarget content here');
    await window.waitForTimeout(2000); // Wait for CRDT update and link text updates

    console.log('[Test] Target note renamed to "New Title"');

    // Switch back to source note
    await window.click(`.note-item[data-note-id="${sourceNoteId}"]`);
    await window.waitForTimeout(500);

    // Verify the link text has been updated via CRDT
    const updatedLinkData = await window.evaluate(() => {
      const link = document.querySelector('#editor span[data-note-link]');
      return link ? {
        text: link.textContent,
        title: link.getAttribute('data-note-title'),
        noteId: link.getAttribute('data-note-id')
      } : null;
    });

    console.log('[Test] Updated link data:', updatedLinkData);

    // Assertions
    expect(updatedLinkData).not.toBeNull();
    expect(updatedLinkData.text).toBe('New Title');
    expect(updatedLinkData.title).toBe('New Title');
    expect(updatedLinkData.noteId).toBe(targetNoteId); // ID should not change

    // Verify old title is gone
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('New Title');
    expect(editorContent).not.toContain('Original Title');

    // Close the app
    await electronApp.close();
  });

  test('should sync link text updates between two instances', async () => {
    const notesPath = path.join(TEST_DIR, 'sync-test-notes');
    await fs.mkdir(notesPath, { recursive: true });

    // Launch first instance
    const app1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(TEST_DIR, 'user-data-1'),
        '--notes-path=' + notesPath,
        '--instance=test1'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    // Create target note in instance 1
    await window1.click('#newNoteBtn');
    const editor1 = window1.locator('#editor .ProseMirror');
    await editor1.waitFor({ state: 'visible' });
    await window1.waitForTimeout(500);

    await editor1.fill('Target Note\n\nTarget content');
    await window1.waitForTimeout(2000); // Wait for CRDT persistence

    // Get target note ID
    const targetNoteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Launch second instance
    const app2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(TEST_DIR, 'user-data-2'),
        '--notes-path=' + notesPath,
        '--instance=test2'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(2000); // Wait for sync to load notes

    // Create source note with link in instance 2
    await window2.click('#newNoteBtn');
    const editor2 = window2.locator('#editor .ProseMirror');
    await editor2.waitFor({ state: 'visible' });
    await window2.waitForTimeout(500);

    // Type to trigger input rules
    await editor2.type('Source Note');
    await window2.keyboard.press('Enter');
    await window2.keyboard.press('Enter');
    await editor2.type('Link: [[Target Note]]');
    await window2.waitForTimeout(2000); // Wait for link creation and sync

    // Get source note ID from instance 2
    const sourceNoteId = await window2.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    console.log('[Test] Created notes - target:', targetNoteId, 'source:', sourceNoteId);

    // In instance 1, rename the target note
    await window1.click(`.note-item[data-note-id="${targetNoteId}"]`);
    await window1.waitForTimeout(500);

    await editor1.fill('Renamed Target\n\nTarget content');
    await window1.waitForTimeout(2000); // Wait for CRDT updates and sync

    console.log('[Test] Instance 1 renamed target note to "Renamed Target"');

    // In instance 2, check if the link text updated via sync
    await window2.waitForTimeout(2000); // Wait for sync cycle

    // Switch to source note in instance 2 to trigger re-render
    await window2.click(`.note-item[data-note-id="${sourceNoteId}"]`);
    await window2.waitForTimeout(500);

    // Verify the link text updated
    const linkData = await window2.evaluate(() => {
      const link = document.querySelector('#editor span[data-note-link]');
      return link ? {
        text: link.textContent,
        title: link.getAttribute('data-note-title')
      } : null;
    });

    console.log('[Test] Instance 2 link data after sync:', linkData);

    expect(linkData).not.toBeNull();
    expect(linkData.text).toBe('Renamed Target');
    expect(linkData.title).toBe('Renamed Target');

    // Close both instances
    await app1.close();
    await app2.close();
  });
});
