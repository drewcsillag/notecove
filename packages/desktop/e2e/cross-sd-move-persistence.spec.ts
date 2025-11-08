/**
 * Cross-SD Move Persistence Test
 *
 * Tests that notes moved across Storage Directories persist correctly after app restart.
 *
 * BUG: After moving a note to a second SD and restarting the app, the note reverts
 * back to the original SD.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

test.describe('Cross-SD Move Persistence', () => {
  test('should persist note location after cross-SD move and app restart', async () => {
    console.log('[Test] Testing cross-SD move persistence...');

    // Create temp directory for test
    const userDataPath = await mkdtemp(join(tmpdir(), 'notecove-userdata-'));
    const sd2Path = join(tmpdir(), 'notecove-sd2-' + Date.now());

    console.log('[Test] User data directory:', userDataPath);
    console.log('[Test] SD2 path (will be created later):', sd2Path);

    try {
      const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
      console.log('[Test] Main path:', mainPath);

      console.log('[Test] Launching first instance...');
      const electronApp = await electron.launch({
        args: [mainPath, `--user-data-dir=${userDataPath}`],
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });

      const window = await electronApp.firstWindow();

      // Add console logging
      window.on('console', (msg) => {
        console.log('[Renderer Console]:', msg.text());
      });

      await window.waitForLoadState('domcontentloaded');

      // Wait for app to be ready
      await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });

      console.log('[Test] App loaded, waiting for initial note...');

      // Wait for notes list to populate
      await window.waitForTimeout(3000);

      // Ensure "All Notes" is selected in the folder tree to see all notes
      console.log('[Test] Clicking on All Notes to ensure all notes are visible...');
      const allNotesLabel = window.locator('text=All Notes').first();
      await allNotesLabel.click();
      await window.waitForTimeout(1000);

      // Check if there's a note, if not create one
      let noteCountSd1Initial = await window
        .locator('[data-testid="notes-list"] [data-testid^="note-item-"]')
        .count();
      console.log('[Test] Initial note count in SD1:', noteCountSd1Initial);

      if (noteCountSd1Initial === 0) {
        console.log('[Test] No welcome note found, creating a test note...');

        // Create a new note by clicking the create note button
        const createNoteButton = window.getByTitle('Create note');
        console.log('[Test] Clicking create note button...');
        await createNoteButton.click();
        await window.waitForTimeout(1000);

        // Type some content using ProseMirror selector
        const editor = window.locator('.ProseMirror');
        console.log('[Test] Typing content...');
        await editor.click();
        await editor.fill('Test Note for Cross-SD Move');
        await window.waitForTimeout(2000);

        // The notes are in the database but not showing in UI
        // Let me check if notes are actually in database and just reload the notes list
        const notes = await window.evaluate(async () => {
          const sds = await window.electronAPI.sd.list();
          if (sds.length > 0) {
            return await window.electronAPI.note.list(sds[0].id);
          }
          return [];
        });
        console.log('[Test] Notes in database after creation:', notes.length, 'notes');

        // Now re-query the UI
        // Wait a bit more for UI to update
        await window.waitForTimeout(2000);

        // Check note count again
        noteCountSd1Initial = await window
          .locator('[data-testid="notes-list"] [data-testid^="note-item-"]')
          .count();
        console.log('[Test] Note count in UI:', noteCountSd1Initial);

        // If still 0, the notes exist in DB but UI isn't showing them
        // This might be a separate bug, but for this test, we can just use the first note from DB
        if (noteCountSd1Initial === 0 && notes.length > 0) {
          console.log('[Test] Notes exist in DB but not in UI. Using first note from DB.');
          // The note exists, we'll work with it programmatically
        } else {
          expect(noteCountSd1Initial).toBeGreaterThanOrEqual(1);
        }
      } else {
        console.log('[Test] Welcome note found, using it.');
      }

      // Since UI isn't showing notes (separate bug), get the note ID from database
      const notesInDb = await window.evaluate(async () => {
        const sds = await window.electronAPI.sd.list();
        if (sds.length > 0) {
          return await window.electronAPI.note.list(sds[0].id);
        }
        return [];
      });

      expect(notesInDb.length).toBeGreaterThanOrEqual(1);

      // Try to use the welcome note (default-note) specifically if it exists
      const welcomeNote = notesInDb.find((n: { id: string }) => n.id === 'default-note');
      const noteToMove = welcomeNote || notesInDb[0];
      console.log('[Test] Using note:', noteToMove.id, 'title:', noteToMove.title);

      if (noteToMove.id === 'default-note') {
        console.log('[Test] *** Testing with the WELCOME NOTE specifically ***');
      }

      console.log('[Test] Creating second SD via IPC...');

      // Create SD2 using IPC API directly
      const sd2Id = await window.evaluate(async (path) => {
        return await window.electronAPI.sd.create('SD2', path);
      }, sd2Path);

      console.log('[Test] Created SD2 with ID:', sd2Id);

      // Get SD1 ID
      const sd1Id = await window.evaluate(async () => {
        const sds = await window.electronAPI.sd.list();
        return sds[0].id;
      });

      console.log('[Test] SD1 ID:', sd1Id);

      console.log('[Test] Moving note to SD2 via IPC...');

      // Move the note from SD1 to SD2 using IPC API
      await window.evaluate(
        async (args) => {
          await window.electronAPI.note.moveToSD(
            args.noteId,
            args.sourceSdId,
            args.targetSdId,
            null, // All Notes folder
            null // No conflict resolution needed
          );
        },
        {
          noteId: noteToMove.id,
          sourceSdId: sd1Id,
          targetSdId: sd2Id,
        }
      );

      console.log('[Test] Note moved. Waiting for move to complete...');
      await window.waitForTimeout(2000);

      console.log('[Test] Verifying note moved to SD2 via database...');

      // Verify note is now in SD2 database
      const notesInSd2 = await window.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd2Id);

      console.log('[Test] Notes in SD2:', notesInSd2.length);
      expect(notesInSd2.length).toBe(1);
      expect(notesInSd2[0].id).toBe(noteToMove.id);

      // Verify note is NOT in SD1 database
      const notesInSd1AfterMove = await window.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd1Id);

      console.log('[Test] Notes in SD1 after move:', notesInSd1AfterMove.length);
      console.log(
        '[Test] Note IDs in SD1 after move:',
        notesInSd1AfterMove.map(
          (n: { id: string; title: string }) => `${n.id.substring(0, 8)}... (${n.title})`
        )
      );

      // Check if the moved note is still in SD1
      const movedNoteStillInSd1 = notesInSd1AfterMove.find(
        (n: { id: string }) => n.id === noteToMove.id
      );
      if (movedNoteStillInSd1) {
        console.log('[Test] ❌ BUG: The moved note is STILL in SD1! It should only be in SD2.');
        expect(movedNoteStillInSd1).toBeUndefined(); // This will fail and show the bug
      } else {
        console.log('[Test] ✓ Moved note is not in SD1 (correct)');
      }

      console.log('[Test] Closing app...');
      await electronApp.close();

      console.log('[Test] Restarting app...');
      const electronApp2 = await electron.launch({
        args: [mainPath, `--user-data-dir=${userDataPath}`],
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });

      const window2 = await electronApp2.firstWindow();
      await window2.waitForLoadState('domcontentloaded');
      await window2.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });

      console.log('[Test] App restarted, verifying note location via database...');

      // Wait for app to initialize
      await window2.waitForTimeout(3000);

      // BUG: The note should still be in SD2, but it might have moved back to SD1
      // Check via database queries

      // Get SD IDs after restart
      const sdsAfterRestart = await window2.evaluate(async () => {
        return await window.electronAPI.sd.list();
      });

      console.log(
        '[Test] SDs after restart:',
        sdsAfterRestart
          .map((sd: { id: string; name: string }) => `${sd.name} (${sd.id})`)
          .join(', ')
      );

      const sd1AfterRestart = sdsAfterRestart.find((sd: { name: string }) => sd.name !== 'SD2');
      const sd2AfterRestart = sdsAfterRestart.find((sd: { name: string }) => sd.name === 'SD2');

      expect(sd2AfterRestart).toBeDefined();

      // Check notes in SD1 after restart
      const notesInSd1AfterRestart = await window2.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd1AfterRestart.id);

      console.log('[Test] Notes in SD1 after restart:', notesInSd1AfterRestart.length);

      // Check notes in SD2 after restart
      const notesInSd2AfterRestart = await window2.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd2AfterRestart.id);

      console.log('[Test] Notes in SD2 after restart:', notesInSd2AfterRestart.length);
      console.log(
        '[Test] Note IDs in SD2:',
        notesInSd2AfterRestart
          .map((n: { id: string; title: string }) => `${n.id} (${n.title})`)
          .join(', ')
      );

      // This assertion will FAIL if the bug exists (note reverted to SD1)
      if (notesInSd2AfterRestart.length === 0 && notesInSd1AfterRestart.length > 0) {
        console.log('[Test] ❌ BUG CONFIRMED: Note reverted back to SD1 after restart!');
        expect(notesInSd2AfterRestart.length).toBe(1); // This will fail
      } else {
        expect(notesInSd2AfterRestart.length).toBe(1);
        expect(notesInSd2AfterRestart[0].id).toBe(noteToMove.id);
        console.log('[Test] ✅ Cross-SD move persisted correctly after restart!');
      }

      await electronApp2.close();
    } finally {
      // Clean up
      console.log('[Test] Cleaning up test directories...');
      await rm(userDataPath, { recursive: true, force: true });
      // SD2 path cleanup
      try {
        await rm(sd2Path, { recursive: true, force: true });
      } catch (err) {
        // SD2 might not have been created
      }
    }
  }, 120000); // 2 minute timeout
});
