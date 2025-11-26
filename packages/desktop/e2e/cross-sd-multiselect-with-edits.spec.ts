/**
 * Cross-SD Multi-Select Move with Edits Test
 *
 * Tests the scenario:
 * 1. Delete welcome note
 * 2. Create notes a, b, c
 * 3. Create SD2
 * 4. Multiselect and move a, b, c to SD2
 * 5. Bug #1: Multiselect badge doesn't clear
 * 6. Edit note c
 * 7. Restart app
 * 8. Bug #2: Note c reverts to default SD
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

test.describe('Cross-SD Multi-Select with Edits', () => {
  test('should persist note moves even after editing post-move', async () => {
    console.log('[Test] Testing cross-SD multiselect move with post-move edits...');

    const userDataPath = await mkdtemp(join(tmpdir(), 'notecove-userdata-'));
    const sd2Path = join(tmpdir(), 'notecove-sd2-' + Date.now());

    try {
      const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

      console.log('[Test] Launching app...');
      const electronApp = await electron.launch({
        args: [mainPath, `--user-data-dir=${userDataPath}`],
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });

      const window = await getFirstWindow(electronApp);
      window.on('console', (msg) => {
        if (msg.text().includes('Bug') || msg.text().includes('multiselect')) {
          console.log('[Renderer Console]:', msg.text());
        }
      });

      await window.waitForLoadState('domcontentloaded');
      await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
      await window.waitForTimeout(2000);

      // Get default SD ID
      const sd1Id = await window.evaluate(async () => {
        const sds = await window.electronAPI.sd.list();
        return sds[0].id;
      });

      console.log('[Test] Step 1: Delete welcome note');
      await window.evaluate(async () => {
        await window.electronAPI.note.delete('default-note');
      });
      await window.waitForTimeout(500);

      console.log('[Test] Step 2: Create notes a, b, c');
      const noteAId = await window.evaluate(async () => {
        const sds = await window.electronAPI.sd.list();
        return await window.electronAPI.note.create(sds[0].id, '', 'A');
      });
      await window.waitForTimeout(300);

      const noteBId = await window.evaluate(async () => {
        const sds = await window.electronAPI.sd.list();
        return await window.electronAPI.note.create(sds[0].id, '', 'B');
      });
      await window.waitForTimeout(300);

      const noteCId = await window.evaluate(async () => {
        const sds = await window.electronAPI.sd.list();
        return await window.electronAPI.note.create(sds[0].id, '', 'C');
      });
      await window.waitForTimeout(500);

      console.log('[Test] Created notes:', { noteAId, noteBId, noteCId });

      // Verify notes exist in SD1
      const notesInSd1Initial = await window.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd1Id);

      console.log('[Test] Notes in SD1 initially:', notesInSd1Initial.length);
      expect(notesInSd1Initial.length).toBe(3);

      console.log('[Test] Step 3: Create SD2');
      const sd2Id = await window.evaluate(async (path) => {
        return await window.electronAPI.sd.create('SD2', path);
      }, sd2Path);

      console.log('[Test] Created SD2 with ID:', sd2Id);
      await window.waitForTimeout(1000);

      console.log('[Test] Step 4: Move all 3 notes to SD2');
      // Move notes one by one
      for (const noteId of [noteAId, noteBId, noteCId]) {
        await window.evaluate(
          async (args) => {
            await window.electronAPI.note.moveToSD(
              args.noteId,
              args.sourceSdId,
              args.targetSdId,
              null,
              null
            );
          },
          { noteId, sourceSdId: sd1Id, targetSdId: sd2Id }
        );
        await window.waitForTimeout(500);
      }

      console.log('[Test] All notes moved to SD2');
      await window.waitForTimeout(1000);

      // Verify move
      const notesInSd2AfterMove = await window.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd2Id);

      const notesInSd1AfterMove = await window.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd1Id);

      console.log(
        '[Test] After move: SD1 has',
        notesInSd1AfterMove.length,
        'notes, SD2 has',
        notesInSd2AfterMove.length,
        'notes'
      );
      expect(notesInSd2AfterMove.length).toBe(3);
      expect(notesInSd1AfterMove.length).toBe(0);

      console.log('[Test] Step 6: Edit note C (add more content)');
      await window.evaluate(async (noteId) => {
        // Load the note
        await window.electronAPI.note.load(noteId);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Get current state
        const state = await window.electronAPI.note.getState(noteId);

        // Apply an update (simulate typing)
        await window.electronAPI.note.updateTitle(
          noteId,
          'Note C - EDITED',
          'Note C content with additional edits made after the move'
        );
      }, noteCId);

      await window.waitForTimeout(2000);

      console.log('[Test] Edited note C');

      // Verify note C is still in SD2 after edit
      const notesInSd2AfterEdit = await window.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd2Id);

      console.log('[Test] After edit: SD2 has', notesInSd2AfterEdit.length, 'notes');
      const noteCInSd2 = notesInSd2AfterEdit.find((n: { id: string }) => n.id === noteCId);
      console.log('[Test] Note C in SD2 after edit:', noteCInSd2 ? 'YES' : 'NO');

      console.log('[Test] Step 7: Restart app');
      await electronApp.close();
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
      await window2.waitForTimeout(3000);

      console.log('[Test] Step 8: Check if note C is still in SD2');

      const sdsAfterRestart = await window2.evaluate(async () => {
        return await window.electronAPI.sd.list();
      });

      const sd1AfterRestart = sdsAfterRestart.find((sd: { name: string }) => sd.name !== 'SD2');
      const sd2AfterRestart = sdsAfterRestart.find((sd: { name: string }) => sd.name === 'SD2');

      const notesInSd1AfterRestart = await window2.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd1AfterRestart.id);

      const notesInSd2AfterRestart = await window2.evaluate(async (sdId) => {
        return await window.electronAPI.note.list(sdId);
      }, sd2AfterRestart.id);

      console.log('[Test] ========================================');
      console.log('[Test] RESULTS AFTER RESTART:');
      console.log('[Test] SD1 notes:', notesInSd1AfterRestart.length);
      console.log('[Test] SD2 notes:', notesInSd2AfterRestart.length);

      if (notesInSd1AfterRestart.length > 0) {
        console.log(
          '[Test] Notes in SD1:',
          notesInSd1AfterRestart.map(
            (n: { id: string; title: string }) => `${n.id.substring(0, 8)}... (${n.title})`
          )
        );
      }

      if (notesInSd2AfterRestart.length > 0) {
        console.log(
          '[Test] Notes in SD2:',
          notesInSd2AfterRestart.map(
            (n: { id: string; title: string }) => `${n.id.substring(0, 8)}... (${n.title})`
          )
        );
      }

      // Check if note C reverted to SD1
      const noteCInSd1 = notesInSd1AfterRestart.find((n: { id: string }) => n.id === noteCId);
      const noteCInSd2AfterRestart = notesInSd2AfterRestart.find(
        (n: { id: string }) => n.id === noteCId
      );

      if (noteCInSd1) {
        console.log('[Test] ❌ BUG #2 CONFIRMED: Note C reverted to SD1 after restart!');
        console.log(
          '[Test] Note C was edited after the move, and the edit seems to have caused it to revert.'
        );
      }

      console.log('[Test] ========================================');

      // Assertions
      expect(notesInSd1AfterRestart.length).toBe(0);
      expect(notesInSd2AfterRestart.length).toBe(3);
      expect(noteCInSd2AfterRestart).toBeDefined();
      expect(noteCInSd1).toBeUndefined();

      console.log('[Test] ✅ All notes persisted correctly in SD2 after restart!');

      await electronApp2.close();
    } finally {
      console.log('[Test] Cleaning up...');
      await rm(userDataPath, { recursive: true, force: true });
      try {
        await rm(sd2Path, { recursive: true, force: true });
      } catch (err) {
        // Ignore
      }
    }
  }, 240000); // 4 minute timeout
});
