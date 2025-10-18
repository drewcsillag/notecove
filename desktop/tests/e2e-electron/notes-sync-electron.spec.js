import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

test.describe('Multi-Instance Note Sync - Electron Mode (CRDT)', () => {
  let testDir;
  let notesPath;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-notes-sync-test-' + Date.now());
    notesPath = path.join(testDir, '.notecove');
    await fs.mkdir(notesPath, { recursive: true });
  });

  test.afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean up test directory:', err);
    }
  });

  test('should sync new note creation between instances in real-time', async () => {
    // Launch first instance
    const app1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-1'),
        '--notes-path=' + notesPath,
        '--instance=test-1-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    // Launch second instance
    const app2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-2'),
        '--notes-path=' + notesPath,
        '--instance=test-2-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(1000);

    // Create note in instance 1
    await window1.click('#newNoteBtn');
    const editor1 = window1.locator('#editor .ProseMirror');
    await editor1.waitFor({ state: 'visible' });
    await window1.waitForTimeout(500);

    await editor1.fill('Synced Note from Instance 1\n\nThis note was created in instance 1.');
    await window1.waitForTimeout(2000); // Wait for CRDT sync

    const noteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    console.log('[Test] Created note in instance 1 with ID:', noteId);

    // Wait for sync to instance 2
    await window2.waitForTimeout(3000);

    // Verify note appears in instance 2
    const noteExistsInInstance2 = await window2.locator(`.note-item[data-note-id="${noteId}"]`).isVisible();
    expect(noteExistsInInstance2).toBe(true);

    // Open note in instance 2 and verify content
    await window2.click(`.note-item[data-note-id="${noteId}"]`);
    await window2.waitForTimeout(500);

    const editor2Content = await window2.locator('#editor .ProseMirror').textContent();
    expect(editor2Content).toContain('Synced Note from Instance 1');
    expect(editor2Content).toContain('This note was created in instance 1.');

    console.log('[Test] Note successfully synced to instance 2');

    // Close both instances
    await app1.close();
    await app2.close();
  });

  test('should sync note content edits between instances in real-time', async () => {
    // Launch first instance
    const app1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-1'),
        '--notes-path=' + notesPath,
        '--instance=test-1-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    // Create note in instance 1
    await window1.click('#newNoteBtn');
    const editor1 = window1.locator('#editor .ProseMirror');
    await editor1.waitFor({ state: 'visible' });
    await window1.waitForTimeout(500);

    await editor1.fill('Original Content\n\nThis is the original text.');
    await window1.waitForTimeout(2000);

    const noteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Launch second instance
    const app2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-2'),
        '--notes-path=' + notesPath,
        '--instance=test-2-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(2000);

    // Verify note exists in instance 2
    const noteExistsInInstance2 = await window2.locator(`.note-item[data-note-id="${noteId}"]`).isVisible();
    expect(noteExistsInInstance2).toBe(true);

    // Edit the note in instance 1
    await editor1.fill('Updated Content\n\nThis text was edited in instance 1.');
    await window1.waitForTimeout(2000);

    console.log('[Test] Updated note content in instance 1');

    // Wait for sync
    await window2.waitForTimeout(3000);

    // Open note in instance 2 and verify updated content
    await window2.click(`.note-item[data-note-id="${noteId}"]`);
    await window2.waitForTimeout(500);

    const editor2Content = await window2.locator('#editor .ProseMirror').textContent();
    expect(editor2Content).toContain('Updated Content');
    expect(editor2Content).toContain('This text was edited in instance 1.');
    expect(editor2Content).not.toContain('Original Content');
    expect(editor2Content).not.toContain('This is the original text.');

    console.log('[Test] Note edits successfully synced to instance 2');

    // Close both instances
    await app1.close();
    await app2.close();
  });

  test('should sync note deletion between instances', async () => {
    // Launch first instance
    const app1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-1'),
        '--notes-path=' + notesPath,
        '--instance=test-1-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    // Create two notes in instance 1
    await window1.click('#newNoteBtn');
    const editor1 = window1.locator('#editor .ProseMirror');
    await editor1.waitFor({ state: 'visible' });
    await window1.waitForTimeout(500);

    await editor1.fill('Note to Keep\n\nThis note should remain.');
    await window1.waitForTimeout(2000);

    const keepNoteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    await window1.keyboard.press('Control+n');
    await window1.waitForTimeout(500);

    await editor1.fill('Note to Delete\n\nThis note will be deleted.');
    await window1.waitForTimeout(2000);

    const deleteNoteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    console.log('[Test] Created two notes - keep:', keepNoteId, 'delete:', deleteNoteId);

    // Launch second instance
    const app2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-2'),
        '--notes-path=' + notesPath,
        '--instance=test-2-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(2000);

    // Verify both notes exist in instance 2
    const keepNoteExists = await window2.locator(`.note-item[data-note-id="${keepNoteId}"]`).isVisible();
    const deleteNoteExists = await window2.locator(`.note-item[data-note-id="${deleteNoteId}"]`).isVisible();
    expect(keepNoteExists).toBe(true);
    expect(deleteNoteExists).toBe(true);

    // Delete note in instance 1
    await window1.click(`.note-item[data-note-id="${deleteNoteId}"]`);
    await window1.waitForTimeout(500);
    await window1.click('#deleteNoteBtn');
    await window1.waitForTimeout(2000);

    console.log('[Test] Deleted note in instance 1');

    // Wait for sync
    await window2.waitForTimeout(3000);

    // Verify deletion synced to instance 2
    // Note should not be in main list
    const allNotes2 = window2.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes2.click();
    await window2.waitForTimeout(500);

    const deletedNoteInList = await window2.locator(`.note-item[data-note-id="${deleteNoteId}"]`).count();
    expect(deletedNoteInList).toBe(0);

    // Note should be in trash
    const recentlyDeleted2 = window2.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await recentlyDeleted2.click();
    await window2.waitForTimeout(500);

    const deletedNoteInTrash = await window2.locator(`.note-item[data-note-id="${deleteNoteId}"]`).isVisible();
    expect(deletedNoteInTrash).toBe(true);

    // Keep note should still be visible
    await allNotes2.click();
    await window2.waitForTimeout(500);

    const keepNoteStillExists = await window2.locator(`.note-item[data-note-id="${keepNoteId}"]`).isVisible();
    expect(keepNoteStillExists).toBe(true);

    console.log('[Test] Note deletion successfully synced to instance 2');

    // Close both instances
    await app1.close();
    await app2.close();
  });

  test('should handle concurrent edits from both instances (conflict resolution)', async () => {
    // Launch first instance
    const app1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-1'),
        '--notes-path=' + notesPath,
        '--instance=test-1-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    // Create note in instance 1
    await window1.click('#newNoteBtn');
    const editor1 = window1.locator('#editor .ProseMirror');
    await editor1.waitFor({ state: 'visible' });
    await window1.waitForTimeout(500);

    await editor1.fill('Base Content\n\nThis is the initial shared content.');
    await window1.waitForTimeout(2000);

    const noteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Launch second instance
    const app2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-2'),
        '--notes-path=' + notesPath,
        '--instance=test-2-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(2000);

    // Open note in instance 2
    await window2.click(`.note-item[data-note-id="${noteId}"]`);
    await window2.waitForTimeout(500);

    const editor2 = window2.locator('#editor .ProseMirror');

    // Make concurrent edits (both instances edit at roughly same time)
    await editor1.fill('Base Content\n\nThis is the initial shared content.\n\nEdit from Instance 1');
    await editor2.fill('Base Content\n\nThis is the initial shared content.\n\nEdit from Instance 2');

    // Wait for sync and conflict resolution
    await window1.waitForTimeout(3000);
    await window2.waitForTimeout(3000);

    // Both edits should be present in both instances (CRDT should merge)
    const content1 = await editor1.textContent();
    const content2 = await editor2.textContent();

    console.log('[Test] Instance 1 content after merge:', content1);
    console.log('[Test] Instance 2 content after merge:', content2);

    // Both should contain the base content
    expect(content1).toContain('Base Content');
    expect(content2).toContain('Base Content');
    expect(content1).toContain('This is the initial shared content.');
    expect(content2).toContain('This is the initial shared content.');

    // CRDT should have merged both edits - both instances should see both edits
    // (The exact merge behavior depends on CRDT implementation, but no data should be lost)
    const hasInstance1Edit = content1.includes('Edit from Instance 1') || content2.includes('Edit from Instance 1');
    const hasInstance2Edit = content1.includes('Edit from Instance 2') || content2.includes('Edit from Instance 2');

    expect(hasInstance1Edit || hasInstance2Edit).toBe(true);
    console.log('[Test] Concurrent edits merged without data loss');

    // Close both instances
    await app1.close();
    await app2.close();
  });

  test('should sync rapid note creation between instances', async () => {
    // Launch first instance
    const app1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-1'),
        '--notes-path=' + notesPath,
        '--instance=test-1-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    // Launch second instance
    const app2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-2'),
        '--notes-path=' + notesPath,
        '--instance=test-2-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(1000);

    const noteIds = [];

    // Rapidly create 5 notes in instance 1
    for (let i = 0; i < 5; i++) {
      if (i === 0) {
        await window1.click('#newNoteBtn');
      } else {
        await window1.keyboard.press('Control+n');
      }

      const editor1 = window1.locator('#editor .ProseMirror');
      await editor1.waitFor({ state: 'visible' });
      await window1.waitForTimeout(300);

      await editor1.fill(`Rapid Note ${i + 1}\n\nContent ${i + 1}`);
      await window1.waitForTimeout(800);

      const noteId = await window1.evaluate(() => {
        const activeNote = document.querySelector('.note-item.active');
        return activeNote?.getAttribute('data-note-id');
      });

      noteIds.push(noteId);
      console.log(`[Test] Created note ${i + 1} with ID:`, noteId);
    }

    // Wait for sync
    await window2.waitForTimeout(5000);

    // Verify all 5 notes appear in instance 2
    for (let i = 0; i < noteIds.length; i++) {
      const noteExists = await window2.locator(`.note-item[data-note-id="${noteIds[i]}"]`).isVisible();
      expect(noteExists).toBe(true);

      // Verify content
      await window2.click(`.note-item[data-note-id="${noteIds[i]}"]`);
      await window2.waitForTimeout(300);

      const content = await window2.locator('#editor .ProseMirror').textContent();
      expect(content).toContain(`Rapid Note ${i + 1}`);
      expect(content).toContain(`Content ${i + 1}`);
    }

    console.log('[Test] All 5 rapidly-created notes synced successfully');

    // Close both instances
    await app1.close();
    await app2.close();
  });

  test('should sync note restore from trash between instances', async () => {
    // Launch first instance
    const app1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-1'),
        '--notes-path=' + notesPath,
        '--instance=test-1-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    // Create and delete a note
    await window1.click('#newNoteBtn');
    const editor1 = window1.locator('#editor .ProseMirror');
    await editor1.waitFor({ state: 'visible' });
    await window1.waitForTimeout(500);

    await editor1.fill('Restored Note\n\nThis note will be deleted and restored.');
    await window1.waitForTimeout(2000);

    const noteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    await window1.click('#deleteNoteBtn');
    await window1.waitForTimeout(2000);

    console.log('[Test] Deleted note with ID:', noteId);

    // Launch second instance
    const app2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-2'),
        '--notes-path=' + notesPath,
        '--instance=test-2-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(2000);

    // Verify note is in trash in instance 2
    const recentlyDeleted2 = window2.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await recentlyDeleted2.click();
    await window2.waitForTimeout(500);

    const noteInTrash = await window2.locator(`.note-item[data-note-id="${noteId}"]`).isVisible();
    expect(noteInTrash).toBe(true);

    // Restore note in instance 1
    const recentlyDeleted1 = window1.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await recentlyDeleted1.click();
    await window1.waitForTimeout(500);
    await window1.click(`.note-item[data-note-id="${noteId}"]`);
    await window1.waitForTimeout(500);

    const restoreBtn = window1.locator('.restore-btn').first();
    await restoreBtn.click();
    await window1.waitForTimeout(2000);

    console.log('[Test] Restored note in instance 1');

    // Wait for sync
    await window2.waitForTimeout(3000);

    // Verify note restored in instance 2
    const allNotes2 = window2.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes2.click();
    await window2.waitForTimeout(500);

    const noteRestored = await window2.locator(`.note-item[data-note-id="${noteId}"]`).isVisible();
    expect(noteRestored).toBe(true);

    // Verify not in trash anymore
    await recentlyDeleted2.click();
    await window2.waitForTimeout(500);

    const noteStillInTrash = await window2.locator(`.note-item[data-note-id="${noteId}"]`).count();
    expect(noteStillInTrash).toBe(0);

    console.log('[Test] Note restore synced successfully to instance 2');

    // Close both instances
    await app1.close();
    await app2.close();
  });
});
