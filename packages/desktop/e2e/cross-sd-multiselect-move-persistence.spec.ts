/**
 * Cross-SD Multi-Select Move Persistence Test
 *
 * Tests that multiple notes moved together across Storage Directories persist correctly after app restart.
 *
 * BUG: After moving multiple notes (via multiselect) to a second SD and restarting the app,
 * the notes revert back to the original SD.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Helper to get the first window with a longer timeout.
 * The default firstWindow() timeout is 30 seconds, which can be flaky on slower machines.
 */
async function getFirstWindow(app: ElectronApplication, timeoutMs = 60000): Promise<Page> {
  return app.waitForEvent('window', { timeout: timeoutMs });
}

test.describe('Cross-SD Multi-Select Move Persistence', () => {
  test('should persist ALL note locations after multi-select cross-SD move and app restart', async () => {
    console.log('[Test] Testing cross-SD MULTI-SELECT move persistence...');

    // Create temp directory for test
    const userDataPath = await mkdtemp(join(tmpdir(), 'notecove-userdata-'));
    const sd2Path = join(tmpdir(), 'notecove-sd2-' + Date.now());

    console.log('[Test] User data directory:', userDataPath);
    console.log('[Test] SD2 path (will be created later):', sd2Path);

    try {
      const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

      console.log('[Test] Launching first instance...');
      const electronApp = await electron.launch({
        args: [mainPath, `--user-data-dir=${userDataPath}`],
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });

      const window = await getFirstWindow(electronApp);

      // Add console logging
      window.on('console', (msg) => {
        console.log('[Renderer Console]:', msg.text());
      });

      await window.waitForLoadState('domcontentloaded');
      await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });

      console.log('[Test] App loaded, creating 3 notes total (welcome + 2 new)...');
      await window.waitForTimeout(3000);

      // Get SD1 info
      const sd1Info = await window.evaluate(async () => {
        const sds = await window.electronAPI.sd.list();
        return { id: sds[0].id, name: sds[0].name };
      });

      console.log('[Test] SD1:', sd1Info.name, '(', sd1Info.id, ')');

      // Create 2 new notes
      for (let i = 1; i <= 2; i++) {
        await window.evaluate(async (noteNum) => {
          const sds = await window.electronAPI.sd.list();
          const noteId = await window.electronAPI.note.create(
            sds[0].id,
            '',
            `Note ${noteNum} content`
          );
          return noteId;
        }, i);
        await window.waitForTimeout(500);
      }

      console.log('[Test] Created 2 new notes.');

      // Get all notes in SD1
      const notesInSd1 = await window.evaluate(async () => {
        const sds = await window.electronAPI.sd.list();
        return await window.electronAPI.note.list(sds[0].id);
      });

      console.log('[Test] Total notes in SD1:', notesInSd1.length);
      console.log(
        '[Test] Note IDs:',
        notesInSd1.map(
          (n: { id: string; title: string }) =>
            `${n.id.substring(0, 8)}... (${n.title.substring(0, 30)})`
        )
      );

      expect(notesInSd1.length).toBe(3); // Welcome note + 2 new notes

      console.log('[Test] Creating second SD via IPC...');
      const sd2Id = await window.evaluate(async (path) => {
        return await window.electronAPI.sd.create('SD2', path);
      }, sd2Path);

      console.log('[Test] Created SD2 with ID:', sd2Id);

      console.log('[Test] Moving ALL 3 notes to SD2 via IPC (simulating multi-select)...');

      // Move all notes from SD1 to SD2
      for (const note of notesInSd1) {
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
            noteId: note.id,
            sourceSdId: sd1Info.id,
            targetSdId: sd2Id,
          }
        );
        await window.waitForTimeout(300);
      }

      console.log('[Test] All notes moved. Waiting for moves to complete...');
      await window.waitForTimeout(2000);

      console.log('[Test] Verifying ALL notes moved to SD2 via database...');

      // Verify all notes are now in SD2
      const notesInSd2AfterMove = await window.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd2Id);

      console.log('[Test] Notes in SD2 after move:', notesInSd2AfterMove.length);
      expect(notesInSd2AfterMove.length).toBe(3);

      // Verify NO notes in SD1
      const notesInSd1AfterMove = await window.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd1Info.id);

      console.log('[Test] Notes in SD1 after move:', notesInSd1AfterMove.length);
      console.log(
        '[Test] Note IDs in SD1 after move:',
        notesInSd1AfterMove.map(
          (n: { id: string; title: string }) =>
            `${n.id.substring(0, 8)}... (${n.title.substring(0, 30)})`
        )
      );

      expect(notesInSd1AfterMove.length).toBe(0);

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

      const window2 = await getFirstWindow(electronApp2);
      await window2.waitForLoadState('domcontentloaded');
      await window2.waitForSelector('[data-testid="notes-list"]', { timeout: 20000 });

      console.log('[Test] App restarted, verifying note locations via database...');
      await window2.waitForTimeout(3000);

      // Get SD IDs after restart
      const sdsAfterRestart = await window2.evaluate(async () => {
        return await window.electronAPI.sd.list();
      });

      const sd1AfterRestart = sdsAfterRestart.find((sd: { name: string }) => sd.name !== 'SD2');
      const sd2AfterRestart = sdsAfterRestart.find((sd: { name: string }) => sd.name === 'SD2');

      // BUG: All notes should still be in SD2, but they might have moved back to SD1
      const notesInSd1AfterRestart = await window2.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd1AfterRestart.id);

      const notesInSd2AfterRestart = await window2.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd2AfterRestart.id);

      console.log('[Test] ========================================');
      console.log('[Test] RESULTS AFTER RESTART:');
      console.log('[Test] Notes in SD1:', notesInSd1AfterRestart.length);
      console.log('[Test] Notes in SD2:', notesInSd2AfterRestart.length);
      console.log('[Test] ========================================');

      if (notesInSd1AfterRestart.length > 0) {
        console.log('[Test] ❌ BUG CONFIRMED: Notes moved back to SD1 after restart!');
        console.log(
          '[Test] Notes that reverted to SD1:',
          notesInSd1AfterRestart.map(
            (n: { id: string; title: string }) => `${n.id.substring(0, 8)}... (${n.title})`
          )
        );
      }

      // This assertion will FAIL if the bug exists
      expect(notesInSd1AfterRestart.length).toBe(0);
      expect(notesInSd2AfterRestart.length).toBe(3);

      console.log('[Test] ✅ Cross-SD multi-select move persisted correctly after restart!');

      await electronApp2.close();
    } finally {
      // Clean up
      console.log('[Test] Cleaning up test directories...');
      await rm(userDataPath, { recursive: true, force: true });
      try {
        await rm(sd2Path, { recursive: true, force: true });
      } catch (err) {
        // SD2 might not have been created
      }
    }
  }, 180000); // 3 minute timeout
});
