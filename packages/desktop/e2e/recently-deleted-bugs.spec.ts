/**
 * E2E tests for Recently Deleted folder bugs
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { resolve, join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

/**
 * Helper to get the first window with a longer timeout.
 * The default firstWindow() timeout is 30 seconds, which can be flaky on slower machines.
 */
async function getFirstWindow(app: ElectronApplication, timeoutMs = 60000): Promise<Page> {
  return app.waitForEvent('window', { timeout: timeoutMs });
}

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-recently-deleted-'));
  console.log('[E2E Recently Deleted] Launching Electron with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await getFirstWindow(electronApp);

  // Capture renderer console logs
  page.on('console', (msg) => {
    console.log('[Renderer Console]:', msg.text());
  });

  // Wait for app to be ready
  await page.waitForSelector('text=Folders', { timeout: 15000 });
  await page.waitForTimeout(1000);
}, 120000);

test.afterEach(async () => {
  await electronApp.close();

  // Clean up the temporary user data directory
  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E Recently Deleted] Cleaned up test userData directory');
  } catch (err) {
    console.error('Failed to clean up test directory:', err);
  }
});

test.describe('Recently Deleted Folder Bugs', () => {
  async function createTestNote(page: Page, content: string) {
    const createButton = page.locator('button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Wait for note to appear in list
    const notesList = page.locator('[data-testid="notes-list"]');
    const firstNote = notesList.locator('.MuiListItemButton-root').first();
    await expect(firstNote).toBeVisible();

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially(content);
    await page.waitForTimeout(1000);
  }

  async function deleteNote(page: Page) {
    // Right-click and delete
    const notesList = page.locator('[data-testid="notes-list"]');
    const noteItem = notesList.locator('.MuiListItemButton-root').first();
    await noteItem.click({ button: 'right' });
    await page.waitForTimeout(300);

    // Click Delete in context menu
    const deleteMenuItem = page.locator('[role="menu"]').locator('text=Delete').first();
    await deleteMenuItem.click();
    await page.waitForTimeout(300);

    // Confirm deletion in dialog
    const deleteDialog = page.locator('[role="dialog"]').last();
    const confirmDeleteButton = deleteDialog.locator('button:has-text("Delete")');
    await confirmDeleteButton.click();
    await page.waitForTimeout(500);
  }

  test('Bug 1: + button should not create notes when Recently Deleted is selected', async () => {
    console.log('[Bug 1] Creating test note...');
    // Create a test note first
    await createTestNote(page, 'Test Note for Recently Deleted');

    console.log('[Bug 1] Deleting the note...');
    // Delete the note we just created
    await deleteNote(page);

    console.log('[Bug 1] Navigating to Recently Deleted...');
    // Navigate to Recently Deleted
    const recentlyDeletedFolder = page.locator('text=Recently Deleted').first();
    await recentlyDeletedFolder.click();
    await page.waitForTimeout(500);

    // Verify the note is in Recently Deleted
    const recentlyDeletedList = page.locator('[data-testid="notes-list"]');
    const notesInRecentlyDeleted = recentlyDeletedList.locator('.MuiListItemButton-root');
    await expect(notesInRecentlyDeleted).toHaveCount(1);

    console.log('[Bug 1] Trying to click + button while in Recently Deleted...');
    // Try to click the + button
    const createButton = page.locator('button[title="Create note"]');

    // The button should be disabled or clicking should do nothing
    const countBefore = await notesInRecentlyDeleted.count();
    await createButton.click();
    await page.waitForTimeout(500);

    // Count should remain the same
    const countAfter = await notesInRecentlyDeleted.count();
    expect(countAfter).toBe(countBefore);

    console.log('[Bug 1] Switching to All Notes to verify no blank note was created...');
    // Switch to All Notes to verify no blank note was created there
    const allNotesFolder = page.locator('text=All Notes').first();
    await allNotesFolder.click();
    await page.waitForTimeout(500);

    // Should only have the welcome note (the test note is deleted)
    const allNotesList = page.locator('[data-testid="notes-list"]');
    const notesInAllNotes = allNotesList.locator('.MuiListItemButton-root');
    const allNotesCount = await notesInAllNotes.count();

    // We should have 1 note (welcome note) - the one we created is deleted
    expect(allNotesCount).toBe(1);
    console.log('[Bug 1] Test passed!');
  });

  // SKIP: Drag-drop doesn't work reliably with react-dnd in Playwright.
  // Use the context menu "Restore" option instead, which is tested in note-context-menu.spec.ts
  test.skip('Bug 2: Dragging note from Recently Deleted should restore to target folder', async () => {
    // This test is skipped because Playwright drag simulation doesn't work reliably with react-dnd.
    // The restore functionality is tested via context menu in note-context-menu.spec.ts
  });

  test('Bug 3: Note title should not change to "Untitled" when selected in Recently Deleted', async () => {
    console.log('[Bug 3] Creating test note...');
    // Create a test note first
    await createTestNote(page, 'Test Note for Title Check');

    // Get the original title before deletion
    const notesList = page.locator('[data-testid="notes-list"]');
    const noteItem = notesList.locator('.MuiListItemButton-root').first();
    const originalTitle = await noteItem.locator('.MuiListItemText-primary').textContent();
    console.log('[Bug 3] Original title:', originalTitle);

    console.log('[Bug 3] Deleting the note...');
    // Delete the note we created
    await deleteNote(page);

    console.log('[Bug 3] Navigating to Recently Deleted...');
    // Navigate to Recently Deleted
    const recentlyDeletedFolder = page.locator('text=Recently Deleted').first();
    await recentlyDeletedFolder.click();
    await page.waitForTimeout(500);

    console.log('[Bug 3] Selecting the deleted note...');
    // Click on the note to select it
    const recentlyDeletedList = page.locator('[data-testid="notes-list"]');
    const deletedNote = recentlyDeletedList.locator('.MuiListItemButton-root').first();
    await deletedNote.click();
    await page.waitForTimeout(500);

    // Verify the title in the list hasn't changed
    const currentTitle = await deletedNote.locator('.MuiListItemText-primary').textContent();
    console.log('[Bug 3] Current title after selection:', currentTitle);
    expect(currentTitle).toBe(originalTitle);
    expect(currentTitle).not.toBe('Untitled Note');
    expect(currentTitle).not.toBe('Untitled');

    // Verify the editor shows the content (but is read-only)
    const editor = page.locator('.ProseMirror');
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Test Note for Title Check');
    console.log('[Bug 3] Test passed!');
  });

  test('Bug 4: Changing folders should not change editor pane content', async () => {
    console.log('[Bug 4] Creating first test note...');
    // Create first test note
    await createTestNote(page, 'First Test Note');

    console.log('[Bug 4] Selecting the first test note...');
    // Select the note we just created to load it in editor
    const notesList = page.locator('[data-testid="notes-list"]');
    // Find the note that contains "First Test Note" (not the welcome note)
    const firstTestNote = notesList
      .locator('.MuiListItemButton-root')
      .filter({ hasText: 'First Test Note' })
      .first();
    await firstTestNote.click();
    await page.waitForTimeout(500);

    // Verify we're showing the first note
    const editor = page.locator('.ProseMirror');
    const editorContent1 = await editor.textContent();
    expect(editorContent1).toContain('First Test Note');
    console.log('[Bug 4] Editor content before folder switch:', editorContent1?.substring(0, 50));

    console.log('[Bug 4] Clicking Work folder...');
    // Now switch to a different folder (Work folder exists by default)
    const workFolder = page.locator('text=Work').first();
    await workFolder.click();
    await page.waitForTimeout(500);

    // Editor content should NOT have changed (still shows First Test Note)
    const editorContent2 = await editor.textContent();
    console.log('[Bug 4] Editor content after folder switch:', editorContent2?.substring(0, 50));
    expect(editorContent2).toContain('First Test Note');

    // Notes list should show "No notes in this folder" since Work folder is empty
    const middlePanel = page.locator('#middle-panel');
    const panelText = await middlePanel.textContent();
    expect(panelText).toContain('No notes in this folder');

    console.log('[Bug 4] Test passed!');
  });
});
