/**
 * E2E test to debug note count badge issue
 * Testing: Select "Personal" folder and create 3 notes
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

test.describe('Note count badge debugging', () => {
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

    // Capture console logs from renderer
    window.on('console', (msg) => {
      console.log('[Renderer Console]', msg.text());
    });

    await window.waitForLoadState('domcontentloaded');

    // Wait for app to be ready
    await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
    await window.waitForTimeout(1000);
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

  test('should show badge on Personal folder when creating 3 notes in it', async () => {
    // First, let's check what the initial state is
    console.log('=== INITIAL STATE ===');

    // Get all notes via API
    const initialNotes = await window.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default', 'all-notes:default');
      return notes.map((n) => ({ id: n.id, title: n.title, folderId: n.folderId }));
    });
    console.log('Initial notes:', initialNotes);

    // Get All Notes badge
    const allNotesNode = window.locator('[data-testid="folder-tree-node-all-notes:default"]');
    await expect(allNotesNode).toBeVisible();

    const initialAllNotesBadge = allNotesNode.locator('.MuiChip-root');
    const initialAllNotesCount = await initialAllNotesBadge.count();
    console.log('Initial All Notes badge count:', initialAllNotesCount);
    if (initialAllNotesCount > 0) {
      const badgeText = await initialAllNotesBadge.first().textContent();
      console.log('Initial All Notes badge text:', badgeText);
    }

    // Get the Personal folder node (it already exists in default setup)
    console.log('\n=== FINDING PERSONAL FOLDER ===');
    const folderNodes = window.locator('[data-testid^="folder-tree-node-"]');
    const personalFolderNode = folderNodes.filter({ hasText: 'Personal' });
    await expect(personalFolderNode).toBeVisible();

    // Get folder ID via API
    const folderId = await window.evaluate(async () => {
      const folders = await window.electronAPI.folder.list('default');
      const personal = folders.find((f) => f.name === 'Personal');
      return personal?.id;
    });
    console.log('Personal folder ID:', folderId);

    // Select Personal folder
    console.log('\n=== SELECTING PERSONAL FOLDER ===');
    await personalFolderNode.click();
    await window.waitForTimeout(500);

    // Create 3 notes in Personal folder
    console.log('\n=== CREATING 3 NOTES IN PERSONAL FOLDER ===');
    for (let i = 1; i <= 3; i++) {
      console.log(`\nCreating note ${i}...`);

      const createButton = window.locator('button[title="Create note"]');
      await createButton.click();
      await window.waitForTimeout(1000);

      // Wait for editor to load
      const editor = window.locator('.ProseMirror');
      await editor.waitFor({ state: 'visible', timeout: 5000 });

      // Type content
      await editor.click();
      await window.keyboard.type(`Note ${i} in Personal`);
      await window.waitForTimeout(1000);

      // Check notes via API
      const notesAfterCreate = await window.evaluate(async (fId) => {
        const allNotes = await window.electronAPI.note.list('default', 'all-notes:default');
        const personalNotes = await window.electronAPI.note.list('default', fId);
        return {
          allCount: allNotes.length,
          personalCount: personalNotes.length,
          allNotes: allNotes.map((n) => ({ title: n.title, folderId: n.folderId })),
          personalNotes: personalNotes.map((n) => ({ title: n.title, folderId: n.folderId })),
        };
      }, folderId);

      console.log(`After creating note ${i}:`);
      console.log('  All notes count:', notesAfterCreate.allCount);
      console.log('  Personal notes count:', notesAfterCreate.personalCount);
      console.log('  All notes:', JSON.stringify(notesAfterCreate.allNotes, null, 2));
      console.log('  Personal notes:', JSON.stringify(notesAfterCreate.personalNotes, null, 2));

      // Give time for badge to update
      await window.waitForTimeout(1500);
    }

    console.log('\n=== CHECKING BADGES AFTER CREATING 3 NOTES ===');

    // Check All Notes badge
    const allNotesBadgeAfter = allNotesNode.locator('.MuiChip-root');
    const allNotesBadgeCount = await allNotesBadgeAfter.count();
    console.log('All Notes badge elements found:', allNotesBadgeCount);

    if (allNotesBadgeCount > 0) {
      const badgeText = await allNotesBadgeAfter.first().textContent();
      console.log('All Notes badge text:', badgeText);
    }

    // Check Personal folder badge
    const personalBadge = personalFolderNode.locator('.MuiChip-root');
    const personalBadgeCount = await personalBadge.count();
    console.log('Personal folder badge elements found:', personalBadgeCount);

    if (personalBadgeCount > 0) {
      const badgeText = await personalBadge.first().textContent();
      console.log('Personal folder badge text:', badgeText);
    }

    // Get final note counts via API
    const finalCounts = await window.evaluate(async (fId) => {
      const allNotesCount = await window.electronAPI.note.getAllNotesCount('default');
      const personalCount = await window.electronAPI.note.getCountForFolder('default', fId);
      return { allNotesCount, personalCount };
    }, folderId);

    console.log('\nFinal counts via API:');
    console.log('  getAllNotesCount:', finalCounts.allNotesCount);
    console.log('  getCountForFolder (Personal):', finalCounts.personalCount);

    // Assertions
    console.log('\n=== ASSERTIONS ===');

    // All Notes should show badge with count (1 welcome note + 3 new notes = 4)
    const expectedAllNotesCount = initialNotes.length + 3;
    console.log(`Expected All Notes count: ${expectedAllNotesCount}`);

    const allNotesBadgeWithCount = allNotesNode
      .locator('.MuiChip-root')
      .filter({ hasText: String(expectedAllNotesCount) });

    console.log('Checking if All Notes badge shows expected count...');
    await expect(allNotesBadgeWithCount).toBeVisible({ timeout: 10000 });

    // Personal folder should show badge with count 3
    console.log('Checking if Personal folder badge shows 3...');
    const personalBadgeWith3 = personalFolderNode.locator('.MuiChip-root').filter({ hasText: '3' });
    await expect(personalBadgeWith3).toBeVisible({ timeout: 10000 });

    console.log('\n=== TEST PASSED ===');
  });
});
