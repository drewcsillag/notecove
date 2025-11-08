/**
 * Multi-Select Badge Clear Test
 *
 * Tests Bug #1: After multiselecting and moving notes to a new SD,
 * the multiselect badge (showing count of selected notes) doesn't clear.
 *
 * Steps:
 * 1. Delete welcome note
 * 2. Create notes a, b, c
 * 3. Create SD2
 * 4. Multiselect and move notes to SD2's All Notes
 * 5. Check if badge clears (selectedNoteIds.size should be 0)
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

test.describe('Multi-Select Badge Clear', () => {
  test('should clear multiselect badge after cross-SD move', async () => {
    console.log('[Test] Testing multiselect badge clearing after cross-SD move...');

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

      const window = await electronApp.firstWindow();
      window.on('console', (msg) => {
        if (msg.text().includes('multiselect') || msg.text().includes('badge')) {
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

      console.log('[Test] Step 3: Create SD2');
      const sd2Id = await window.evaluate(async (path) => {
        return await window.electronAPI.sd.create('SD2', path);
      }, sd2Path);

      console.log('[Test] Created SD2 with ID:', sd2Id);
      await window.waitForTimeout(1000);

      console.log('[Test] Step 4: Multiselect notes A, B, C using Cmd+Click in UI');

      // Wait for notes to appear in the UI
      await window.waitForTimeout(2000);

      // Debug: Check what notes are in the UI
      const notesInUI = await window.evaluate(() => {
        const noteItems = document.querySelectorAll('[data-testid^="note-item-"]');
        return Array.from(noteItems).map((item) => item.getAttribute('data-testid'));
      });
      console.log('[Test] Note items in UI:', notesInUI);

      // Click on note A with Cmd key
      const noteAItem = window.locator(`[data-testid="note-item-${noteAId}"]`);
      await noteAItem.waitFor({ state: 'visible', timeout: 10000 });
      console.log('[Test] Clicking note A with Cmd');
      await noteAItem.click({ modifiers: ['Meta'] });
      await window.waitForTimeout(500);

      // Click on note B with Cmd key
      const noteBItem = window.locator(`[data-testid="note-item-${noteBId}"]`);
      await noteBItem.waitFor({ state: 'visible', timeout: 10000 });
      console.log('[Test] Clicking note B with Cmd');
      await noteBItem.click({ modifiers: ['Meta'] });
      await window.waitForTimeout(500);

      // Click on note C with Cmd key
      const noteCItem = window.locator(`[data-testid="note-item-${noteCId}"]`);
      await noteCItem.waitFor({ state: 'visible', timeout: 10000 });
      console.log('[Test] Clicking note C with Cmd');
      await noteCItem.click({ modifiers: ['Meta'] });
      await window.waitForTimeout(500);

      // Verify badge is showing by looking for Typography component with the text
      const badgeBeforeMove = await window.evaluate(() => {
        // Look for any element containing "notes selected" or "note selected"
        const allElements = document.querySelectorAll('p, span, div');
        for (const el of allElements) {
          const text = el.textContent?.trim();
          if (text && /^\d+ notes? selected$/.test(text)) {
            return text;
          }
        }
        return null;
      });

      console.log('[Test] Badge before move:', badgeBeforeMove);
      expect(badgeBeforeMove).toContain('3 notes selected');

      console.log('[Test] Step 5: Right-click on a selected note and choose "Move to..."');

      // Right-click on note C (which is part of the selection)
      await noteCItem.click({ button: 'right' });
      await window.waitForTimeout(500);

      // Click "Move to..." menu item
      const moveToMenuItem = window.locator('text="Move 3 notes to..."');
      await moveToMenuItem.click();
      await window.waitForTimeout(500);

      console.log('[Test] Step 6: Select SD2 and All Notes folder in Move dialog');

      // The move dialog shows radio buttons for each SD and folder
      // We need to click the radio button for "SD2 / All Notes (No Folder)"
      // The radio buttons have a value like "sdId:null" for "All Notes"

      // Wait for the dialog to be fully rendered
      await window.waitForTimeout(500);

      // Find the FormControlLabel containing "SD2" text and "All Notes" text
      // Since there's both "Default" SD and "SD2", we need to find the SD2 section
      // and then click on its "All Notes" radio button
      const sd2AllNotesRadio = window
        .locator('label')
        .filter({ hasText: 'All Notes (No Folder)' })
        .nth(1);
      await sd2AllNotesRadio.click();
      await window.waitForTimeout(300);

      // Click the Move button in the dialog
      const moveButton = window.locator('button:has-text("Move")');
      await moveButton.click();
      await window.waitForTimeout(2000);

      console.log('[Test] Step 7: Check if multiselect badge state is cleared');

      // Check if the badge is still visible after move
      const badgeText = await window.evaluate(() => {
        const allElements = document.querySelectorAll('p, span, div');
        for (const el of allElements) {
          const text = el.textContent?.trim();
          if (text && /^\d+ notes? selected$/.test(text)) {
            return text;
          }
        }
        return null;
      });

      console.log('[Test] Badge text after move:', badgeText);

      if (badgeText) {
        console.log('[Test] BUG CONFIRMED: Badge text:', badgeText);
        console.log('[Test] The multiselect badge should have cleared after the move!');
      } else {
        console.log('[Test] Badge is not visible (correct)');
      }

      // Assertion
      expect(badgeText).toBe(null);

      await electronApp.close();
    } finally {
      console.log('[Test] Cleaning up...');
      await rm(userDataPath, { recursive: true, force: true });
      try {
        await rm(sd2Path, { recursive: true, force: true });
      } catch (err) {
        // Ignore
      }
    }
  }, 120000); // 2 minute timeout
});
