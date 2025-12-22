/**
 * E2E tests for auto-cleanup of Recently Deleted notes
 * Phase 2.5.8: Notes List Polish
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Helper function to create a test note
async function createTestNote(window: Page, content: string) {
  const createButton = window.locator('button[title="Create note"]');
  await createButton.click();
  await window.waitForTimeout(1000);

  // Wait for editor to load
  const editor = window.locator('.ProseMirror');
  await editor.waitFor({ state: 'visible', timeout: 5000 });

  // Type content
  await editor.click();
  await window.keyboard.type(content);
  await window.waitForTimeout(1000);

  // Wait for note to appear in list
  const notesList = window.locator('[data-testid="notes-list"]');
  const noteItems = notesList.locator('li');
  await expect(noteItems.first()).toBeVisible();
}

// Helper to get notes list
function getNotesList(window: Page) {
  return window.locator('[data-testid="notes-list"]').locator('li');
}

/**
 * E2E tests for auto-cleanup of Recently Deleted notes
 * Uses test:setNoteTimestamp IPC handler to manipulate timestamps
 */
test.describe.configure({ mode: 'serial' });

test.describe('Auto-cleanup of Recently Deleted notes', () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testDbPath: string;
  let testStorageDir: string;

  test.beforeEach(async () => {
    // Create temp directories
    testDbPath = path.join(os.tmpdir(), `notecove-test-${Date.now()}.db`);
    testStorageDir = path.join(os.tmpdir(), `notecove-test-storage-${Date.now()}`);
    await fs.mkdir(testStorageDir, { recursive: true });

    // Launch Electron app with test database
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
    });

    // Wait for the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for app to be ready
    await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
  });

  test.afterEach(async () => {
    // Close app
    await electronApp.close();

    // Clean up test files
    try {
      await fs.unlink(testDbPath);
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('should automatically delete notes older than 30 days from Recently Deleted on app start', async () => {
    // Create a note
    await createTestNote(window, 'Old note that should be auto-cleaned');

    // Verify note appears in notes list (welcome + new note)
    let noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(2);

    // Delete the note (soft delete) - the newly created note is first
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menu = window.locator('[role="menu"]');
    await menu.locator('text=Delete').click();
    await window.waitForTimeout(300);
    await window.locator('button:has-text("Delete")').click(); // Confirm delete
    await window.waitForTimeout(1000);

    // Navigate to Recently Deleted
    await window.click('text=Recently Deleted');
    await window.waitForTimeout(1000);

    // Verify note is in Recently Deleted
    noteItems = getNotesList(window);
    await expect(noteItems).toHaveCount(1);

    // Get the note ID
    const noteId = await window.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default', 'recently-deleted:default');
      return notes[0]?.id;
    });

    expect(noteId).toBeTruthy();

    // Set the note's modified timestamp to 31 days ago using test helper
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await window.evaluate(
      async ({ noteId, timestamp }) => {
        await window.electronAPI.testing.setNoteTimestamp(noteId, timestamp);
      },
      { noteId, timestamp: thirtyOneDaysAgo }
    );

    // The test helper now properly awaits the CRDT write to disk, no need for additional wait

    // Restart the app to trigger auto-cleanup
    await electronApp.close();

    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000); // Give app time to fully initialize

    // Check what notes are in Recently Deleted (via API, not UI)
    const remainingNotes = await window.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default', 'recently-deleted:default');
      return notes.map((n) => ({
        id: n.id,
        title: n.title,
        modified: n.modified,
        deleted: n.deleted,
      }));
    });
    console.log('[Test] Notes remaining in Recently Deleted after restart:', remainingNotes);

    // Verify the old note has been permanently deleted
    expect(remainingNotes).toHaveLength(0);
  });

  test('should not delete notes younger than 30 days from Recently Deleted', async () => {
    // Create a note
    await createTestNote(window, 'Recent note that should NOT be auto-cleaned');

    // Delete the note (soft delete) - the newly created note is first
    let noteItems = getNotesList(window);
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menu = window.locator('[role="menu"]');
    await menu.locator('text=Delete').click();
    await window.waitForTimeout(300);
    await window.locator('button:has-text("Delete")').click();

    // Wait for the note to actually be removed from the list (soft delete moves it to Recently Deleted)
    await expect(getNotesList(window)).toHaveCount(1, { timeout: 5000 });

    // Debug: Check what notes are in the database before restart
    const notesBeforeRestart = await window.evaluate(async () => {
      // Get all notes (including deleted) from the default SD
      const allNotes = await window.electronAPI.note.list('default', null);
      const deletedNotes = await window.electronAPI.note.list(
        'default',
        'recently-deleted:default'
      );
      return {
        all: allNotes.map((n) => ({
          id: n.id,
          title: n.title,
          deleted: n.deleted,
          modified: n.modified,
        })),
        deleted: deletedNotes.map((n) => ({
          id: n.id,
          title: n.title,
          deleted: n.deleted,
          modified: n.modified,
        })),
      };
    });
    console.log('[Test] Notes before restart - all:', notesBeforeRestart.all);
    console.log('[Test] Notes before restart - deleted:', notesBeforeRestart.deleted);

    // Query database directly using sqlite3 before restart
    const { execSync } = await import('child_process');
    const dbContentBefore = execSync(
      `sqlite3 "${testDbPath}" "SELECT id, title, deleted, modified FROM notes"`,
      {
        encoding: 'utf-8',
      }
    );
    console.log('[Test] Database contents before restart:\n', dbContentBefore);

    // Restart the app to trigger auto-cleanup
    await electronApp.close();

    // Query database after close but before restart
    const dbContentAfterClose = execSync(
      `sqlite3 "${testDbPath}" "SELECT id, title, deleted, modified FROM notes"`,
      {
        encoding: 'utf-8',
      }
    );
    console.log('[Test] Database contents after close (before restart):\n', dbContentAfterClose);

    // Also check the storage directory for CRDT files
    const notesDirContent = execSync(
      `ls -la "${testStorageDir}/notes/" 2>/dev/null || echo "no notes dir"`,
      {
        encoding: 'utf-8',
      }
    );
    console.log('[Test] Notes directory after close:\n', notesDirContent);

    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });

    // Debug: Check what notes are in the database after restart (before navigating to Recently Deleted)
    const notesAfterRestart = await window.evaluate(async () => {
      const allNotes = await window.electronAPI.note.list('default', null);
      const deletedNotes = await window.electronAPI.note.list(
        'default',
        'recently-deleted:default'
      );
      return {
        all: allNotes.map((n) => ({
          id: n.id,
          title: n.title,
          deleted: n.deleted,
          modified: n.modified,
        })),
        deleted: deletedNotes.map((n) => ({
          id: n.id,
          title: n.title,
          deleted: n.deleted,
          modified: n.modified,
        })),
      };
    });
    console.log('[Test] Notes after restart - all:', notesAfterRestart.all);
    console.log('[Test] Notes after restart - deleted:', notesAfterRestart.deleted);

    // Query database directly after restart
    const dbContentAfterRestart = execSync(
      `sqlite3 "${testDbPath}" "SELECT id, title, deleted, modified FROM notes"`,
      {
        encoding: 'utf-8',
      }
    );
    console.log('[Test] Database contents after restart (via sqlite3):\n', dbContentAfterRestart);

    // Check auto-cleanup log
    try {
      const fs = await import('fs/promises');
      const logContent = await fs.readFile('/var/tmp/auto-cleanup.log', 'utf-8');
      console.log('[Test] Auto-cleanup log:', logContent || '(empty)');
    } catch {
      console.log('[Test] Auto-cleanup log: (file not found)');
    }

    // Navigate to Recently Deleted
    await window.click('text=Recently Deleted');
    await window.waitForTimeout(1000);

    // Verify the recent note is still there
    const remainingItems = getNotesList(window);
    await expect(remainingItems).toHaveCount(1);
  });

  test('should log auto-cleanup activity', async () => {
    // This test verifies that auto-cleanup logs what it does
    // We'll check the log file for cleanup messages

    // Create and delete a note
    await createTestNote(window, 'Note to be cleaned');

    // Delete the note (soft delete) - the newly created note is first
    let noteItems = getNotesList(window);
    await noteItems.first().click({ button: 'right' });
    await window.waitForTimeout(300);
    const menu = window.locator('[role="menu"]');
    await menu.locator('text=Delete').click();
    await window.waitForTimeout(300);
    await window.locator('button:has-text("Delete")').click();
    await window.waitForTimeout(1000);

    // Set note's timestamp to 31 days ago
    const noteId = await window.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default', 'recently-deleted:default');
      return notes[0]?.id;
    });

    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await window.evaluate(
      async ({ noteId, timestamp }) => {
        await window.electronAPI.testing.setNoteTimestamp(noteId, timestamp);
      },
      { noteId, timestamp: thirtyOneDaysAgo }
    );

    // Clear log file before restart
    await fs.writeFile('/var/tmp/auto-cleanup.log', '');

    // Restart to trigger auto-cleanup
    await electronApp.close();

    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);

    // Check that cleanup was logged to file
    const logContent = await fs.readFile('/var/tmp/auto-cleanup.log', 'utf-8');
    expect(logContent).toContain('auto-cleanup');
    expect(logContent).toContain('Permanently deleting note');
  });
});
