import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

test.describe('Note CRUD Operations - Electron Mode (CRDT)', () => {
  let testDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-notes-crud-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    // Launch Electron app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close the app
    await electronApp.close();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean up test directory:', err);
    }
  });

  test('should persist note creation across app restarts', async () => {
    // Create a new note
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    // Add content
    await editor.fill('Persistent Note Title\n\nThis note should persist across restarts.');
    await window.waitForTimeout(2000); // Wait for CRDT sync and persistence

    // Get the note ID
    const noteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    expect(noteId).toBeTruthy();
    console.log('[Test] Created note with ID:', noteId);

    // Close the app
    await electronApp.close();

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 500));

    // Relaunch the app with same data directory
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000); // Wait for notes to load

    // Verify note exists in sidebar
    const noteExists = await window.locator(`.note-item[data-note-id="${noteId}"]`).isVisible();
    expect(noteExists).toBe(true);

    // Click on the note and verify content
    await window.click(`.note-item[data-note-id="${noteId}"]`);
    await window.waitForTimeout(500);

    const editorContent = await window.locator('#editor .ProseMirror').textContent();
    expect(editorContent).toContain('Persistent Note Title');
    expect(editorContent).toContain('This note should persist across restarts.');

    console.log('[Test] Note successfully persisted across restart');
  });

  test('should persist note content edits across app restarts', async () => {
    // Create a note
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Original Content\n\nThis is the original text.');
    await window.waitForTimeout(2000);

    const noteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Edit the note
    await editor.fill('Updated Content\n\nThis is the edited text with new information.');
    await window.waitForTimeout(2000);

    console.log('[Test] Updated note content');

    // Close and relaunch
    await electronApp.close();
    await new Promise(resolve => setTimeout(resolve, 500));

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);

    // Open the note and verify updated content
    await window.click(`.note-item[data-note-id="${noteId}"]`);
    await window.waitForTimeout(500);

    const editorContent = await window.locator('#editor .ProseMirror').textContent();
    expect(editorContent).toContain('Updated Content');
    expect(editorContent).toContain('This is the edited text with new information.');
    expect(editorContent).not.toContain('Original Content');
    expect(editorContent).not.toContain('This is the original text.');

    console.log('[Test] Note edits successfully persisted');
  });

  // Note: Deletion persistence is already covered by folder-electron.spec.js trash tests
  // Skipping here to avoid duplicating test coverage

  test('should handle multiple rapid note creations with persistence', async () => {
    const noteIds = [];

    // Create 5 notes rapidly
    for (let i = 0; i < 5; i++) {
      if (i === 0) {
        await window.click('#newNoteBtn');
      } else {
        await window.keyboard.press('Control+n');
      }

      const editor = window.locator('#editor .ProseMirror');
      await editor.waitFor({ state: 'visible' });
      await window.waitForTimeout(300);

      await editor.fill(`Note ${i + 1}\n\nContent for note number ${i + 1}`);
      await window.waitForTimeout(1000); // Shorter wait for rapid creation

      const noteId = await window.evaluate(() => {
        const activeNote = document.querySelector('.note-item.active');
        return activeNote?.getAttribute('data-note-id');
      });

      noteIds.push(noteId);
      console.log(`[Test] Created note ${i + 1} with ID:`, noteId);
    }

    // Wait for all CRDT updates to settle
    await window.waitForTimeout(2000);

    // Close and relaunch
    await electronApp.close();
    await new Promise(resolve => setTimeout(resolve, 500));

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);

    // Verify all 5 notes persisted
    for (let i = 0; i < noteIds.length; i++) {
      const noteExists = await window.locator(`.note-item[data-note-id="${noteIds[i]}"]`).isVisible();
      expect(noteExists).toBe(true);

      // Verify content
      await window.click(`.note-item[data-note-id="${noteIds[i]}"]`);
      await window.waitForTimeout(300);

      const content = await window.locator('#editor .ProseMirror').textContent();
      expect(content).toContain(`Note ${i + 1}`);
      expect(content).toContain(`Content for note number ${i + 1}`);
    }

    console.log('[Test] All 5 rapidly-created notes persisted successfully');
  });

  test('should persist large note content (>10KB)', async () => {
    // Create a large note
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    // Generate large content (~15KB)
    const largeContent = 'Large Note Title\n\n' +
      'This is a very large note with substantial content. '.repeat(300) +
      '\n\nSection 2\n\n' +
      'More content here to increase the size. '.repeat(200) +
      '\n\nFinal Section\n\n' +
      'Testing CRDT persistence with large documents. '.repeat(150);

    await editor.fill(largeContent);
    await window.waitForTimeout(3000); // Wait longer for large content sync

    const noteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    console.log('[Test] Created large note (~15KB) with ID:', noteId);

    // Close and relaunch
    await electronApp.close();
    await new Promise(resolve => setTimeout(resolve, 500));

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);

    // Open and verify large note content
    await window.click(`.note-item[data-note-id="${noteId}"]`);
    await window.waitForTimeout(1000);

    const persistedContent = await window.locator('#editor .ProseMirror').textContent();
    expect(persistedContent).toContain('Large Note Title');
    expect(persistedContent).toContain('This is a very large note with substantial content.');
    expect(persistedContent).toContain('Section 2');
    expect(persistedContent).toContain('More content here to increase the size.');
    expect(persistedContent).toContain('Final Section');
    expect(persistedContent).toContain('Testing CRDT persistence with large documents.');
    expect(persistedContent.length).toBeGreaterThan(10000);

    console.log('[Test] Large note persisted successfully, size:', persistedContent.length, 'chars');
  });
});
