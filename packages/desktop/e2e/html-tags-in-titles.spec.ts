/**
 * E2E Test: HTML/XML Tags in Note Titles When Loading Existing SD
 *
 * Tests that note titles are properly extracted without HTML/XML tags when
 * adding an existing Storage Directory that contains notes with rich text.
 *
 * Bug: When loading an existing SD (like from Google Drive), note titles
 * appear with HTML/XML markup instead of clean text.
 */

import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import path from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { mkdir } from 'fs/promises';

const E2E_LOG_PREFIX = '[E2E HTML Tags]';

test.describe('HTML Tags in Titles When Loading Existing SD', () => {
  let testSdPath: string;
  let testUserDataDir: string;

  test.beforeEach(async () => {
    // Create temp SD directory that will contain notes with rich text
    testSdPath = mkdtempSync(path.join(tmpdir(), 'notecove-test-sd-'));
    console.log(`${E2E_LOG_PREFIX} Created test SD at: ${testSdPath}`);
  });

  test.afterEach(async () => {
    // Clean up - note: testUserDataDir cleanup happens in the test itself
    if (testSdPath) {
      try {
        rmSync(testSdPath, { recursive: true, force: true });
        console.log(`${E2E_LOG_PREFIX} Cleaned up test SD`);
      } catch (error) {
        console.error(`${E2E_LOG_PREFIX} Error cleaning up SD:`, error);
      }
    }
  });

  test('should show clean titles without HTML tags when loading existing SD', async () => {
    console.log(`${E2E_LOG_PREFIX} Step 1: Create first app instance with notes`);

    // Launch first instance to create notes with rich text
    testUserDataDir = mkdtempSync(path.join(tmpdir(), 'notecove-e2e-html-'));
    let electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../dist-electron/main/index.js'),
        `--user-data-dir=${testUserDataDir}`,
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: testSdPath,
      },
    });

    let page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
    await page.waitForTimeout(2000);

    console.log(`${E2E_LOG_PREFIX} Step 2: Create notes with rich text content`);

    // Get the SD ID from the first SD
    const sdId = await page.evaluate(async () => {
      const sds = await window.electronAPI.sd.list();
      return sds[0].id;
    });
    console.log(`${E2E_LOG_PREFIX} Using SD ID: ${sdId}`);

    // Create first note with bold text
    await page.evaluate(async (id) => {
      const noteId = await window.electronAPI.note.create(
        id,
        null,
        '<p><strong>Bold Title</strong></p><p>Some content</p>'
      );
      await window.electronAPI.note.updateTitle(noteId, 'Bold Title', 'Bold Title\nSome content');
    }, sdId);
    await page.waitForTimeout(500);

    // Create second note with italic and link
    await page.evaluate(async (id) => {
      const noteId = await window.electronAPI.note.create(
        id,
        null,
        '<p><em>Italic</em> and <a href="#">Link</a></p>'
      );
      await window.electronAPI.note.updateTitle(noteId, 'Italic and Link', 'Italic and Link');
    }, sdId);
    await page.waitForTimeout(500);

    // Create third note with heading
    await page.evaluate(async (id) => {
      const noteId = await window.electronAPI.note.create(
        id,
        null,
        '<h1>Heading Title</h1><p>Content here</p>'
      );
      await window.electronAPI.note.updateTitle(
        noteId,
        'Heading Title',
        'Heading Title\nContent here'
      );
    }, sdId);
    await page.waitForTimeout(500);

    // Wait longer to ensure all notes are synced to disk
    console.log(`${E2E_LOG_PREFIX} Waiting for notes to sync to disk...`);
    await page.waitForTimeout(3000);

    console.log(`${E2E_LOG_PREFIX} Step 3: Close first instance`);
    await electronApp.close();

    // Small delay before relaunching
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Debug: List files in test SD
    const { readdirSync, readFileSync } = await import('fs');
    const files = readdirSync(testSdPath);
    console.log(`${E2E_LOG_PREFIX} Files in test SD:`, files);
    const notesPath = `${testSdPath}/notes`;
    const noteFiles = readdirSync(notesPath);
    console.log(`${E2E_LOG_PREFIX} Note files:`, noteFiles);

    // Check what's inside one of the note directories
    if (noteFiles.length > 0 && noteFiles[0] !== 'default-note') {
      const sampleNotePath = `${notesPath}/${noteFiles[0]}`;
      const noteContents = readdirSync(sampleNotePath);
      console.log(`${E2E_LOG_PREFIX} Contents of note directory:`, noteContents);

      // Check if there are any logs (new format uses logs/ instead of updates/)
      const logsPath = `${sampleNotePath}/logs`;
      try {
        const logFiles = readdirSync(logsPath);
        console.log(`${E2E_LOG_PREFIX} Log files count:`, logFiles.length);
      } catch {
        console.log(`${E2E_LOG_PREFIX} No logs directory found (may use snapshots only)`);
      }

      // Check if there are any snapshots
      const snapshotsPath = `${sampleNotePath}/snapshots`;
      try {
        const snapshotFiles = readdirSync(snapshotsPath);
        console.log(`${E2E_LOG_PREFIX} Snapshot files:`, snapshotFiles);
      } catch {
        console.log(`${E2E_LOG_PREFIX} No snapshots directory found`);
      }
    }

    console.log(`${E2E_LOG_PREFIX} Step 4: Launch second instance with fresh database`);

    // Create new userData directory for second instance (fresh database)
    const secondUserDataDir = mkdtempSync(path.join(tmpdir(), 'notecove-e2e-html2-'));
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../dist-electron/main/index.js'),
        `--user-data-dir=${secondUserDataDir}`,
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
    await page.waitForTimeout(2000);

    console.log(`${E2E_LOG_PREFIX} Step 5: Add existing SD through settings`);

    // Open Settings
    await page.locator('button[title="Settings"]').click();
    await page.waitForTimeout(500);

    // Click Add Directory
    await page.locator('button:has-text("Add Directory")').click();
    await page.waitForTimeout(500);

    // Wait for Add SD dialog
    const addDialog = page.locator('[role="dialog"]').filter({ hasText: 'Add Storage Directory' });
    await expect(addDialog).toBeVisible();

    // Fill in the form with the existing SD path
    await addDialog.getByLabel('Name').fill('Existing SD');
    await addDialog.getByLabel('Path').fill(testSdPath);

    // Click Add button
    await addDialog.locator('button:has-text("Add")').click();

    // Wait for SD to initialize (progress dialog may appear)
    await page.waitForTimeout(5000);

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2000);

    // Get the newly added SD ID
    console.log(`${E2E_LOG_PREFIX} Finding the newly added SD`);
    const newSdId = await page.evaluate(async () => {
      const sds = await window.electronAPI.sd.list();
      const newSd = sds.find((sd) => sd.name === 'Existing SD');
      return newSd?.id;
    });
    console.log(`${E2E_LOG_PREFIX} New SD ID:`, newSdId);

    console.log(`${E2E_LOG_PREFIX} Step 6: Verify note titles are clean (no HTML/XML tags)`);

    // Wait for notes list to populate
    await page.waitForSelector('[data-testid="notes-list"]', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Debug: Check what notes are in the newly added SD
    const allNotes = await page.evaluate(async (sdId) => {
      return await window.electronAPI.note.list(sdId);
    }, newSdId);
    console.log(`${E2E_LOG_PREFIX} Notes from API for new SD "${newSdId}":`, allNotes.length);

    // Check each note's title and content
    for (const note of allNotes) {
      console.log(`${E2E_LOG_PREFIX}   Note:`, {
        id: note.id,
        title: note.title,
        contentText: note.contentText?.substring(0, 100),
      });

      // Check if title or contentText contains HTML tags
      const hasHtmlInTitle = /<[^>]+>/.test(note.title);
      const hasHtmlInContent = /<[^>]+>/.test(note.contentText || '');
      if (hasHtmlInTitle || hasHtmlInContent) {
        console.log(
          `${E2E_LOG_PREFIX}   ⚠️  HTML tags found! hasHtmlInTitle:`,
          hasHtmlInTitle,
          'hasHtmlInContent:',
          hasHtmlInContent
        );
      }
    }

    // Get all note items
    const noteItems = page.locator('[data-testid^="note-item-"]');
    const count = await noteItems.count();

    console.log(`${E2E_LOG_PREFIX} Found ${count} note elements in DOM`);
    expect(count).toBeGreaterThan(0);

    // Check each note title for HTML/XML tags
    for (let i = 0; i < count; i++) {
      const noteItem = noteItems.nth(i);
      // Get all text content from the note item (includes title, preview, date)
      const fullText = await noteItem.textContent();
      // Extract first line as title (before the preview and date)
      const lines = fullText?.split('\n').filter((line) => line.trim()) ?? [];
      const titleText = lines[0]?.trim() ?? '';

      console.log(`${E2E_LOG_PREFIX} Note ${i + 1} title: "${titleText}"`);
      console.log(`${E2E_LOG_PREFIX} Full text: "${fullText}"`);

      // Should NOT contain HTML/XML tags
      expect(titleText).not.toMatch(/<[^>]+>/); // No HTML tags like <p>, <strong>, <em>, etc.
      expect(titleText).not.toMatch(/&[a-z]+;/); // No HTML entities like &nbsp;, &amp;, etc.

      // Should be clean text
      if (titleText?.includes('Bold')) {
        expect(titleText).toContain('Bold Title');
        expect(titleText).not.toContain('<strong>');
        expect(titleText).not.toContain('</strong>');
      } else if (titleText?.includes('Italic')) {
        expect(titleText).toContain('Italic and Link');
        expect(titleText).not.toContain('<em>');
        expect(titleText).not.toContain('<a ');
      } else if (titleText?.includes('Heading')) {
        expect(titleText).toContain('Heading Title');
        expect(titleText).not.toContain('<h1>');
        expect(titleText).not.toContain('</h1>');
      }
    }

    console.log(`${E2E_LOG_PREFIX} Test passed - all titles are clean!`);

    // Cleanup both userData directories
    await electronApp.close();
    try {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log(`${E2E_LOG_PREFIX} Cleaned up first userData directory`);
    } catch (error) {
      console.error(`${E2E_LOG_PREFIX} Error cleaning up first userData:`, error);
    }
    try {
      rmSync(secondUserDataDir, { recursive: true, force: true });
      console.log(`${E2E_LOG_PREFIX} Cleaned up second userData directory`);
    } catch (error) {
      console.error(`${E2E_LOG_PREFIX} Error cleaning up second userData:`, error);
    }
  });
});
