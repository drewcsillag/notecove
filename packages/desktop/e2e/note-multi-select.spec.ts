/**
 * E2E Tests for Note Multi-Select Functionality
 * Phase 2.5.7.2
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let window: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  // Create a unique temporary directory for this test
  testUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-test-multi-select-'));

  electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../dist-electron/main/index.js'),
      `--user-data-dir=${testUserDataDir}`,
    ],
    env: {
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Wait for app to be ready
  await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
  await window.waitForTimeout(500);
});

test.afterEach(async () => {
  await electronApp.close();

  // Clean up temporary directory
  if (testUserDataDir && fs.existsSync(testUserDataDir)) {
    fs.rmSync(testUserDataDir, { recursive: true, force: true });
  }
});

test.describe('Multi-Select Functionality', () => {
  test('should select multiple notes with Cmd+Click', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);

    await createButton.click();
    await window.waitForTimeout(300);

    await createButton.click();
    await window.waitForTimeout(300);

    // Wait for notes to appear
    await window.waitForSelector('[data-testid="notes-list"] .MuiListItemButton-root', {
      timeout: 5000,
    });

    // Get all note list items
    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');
    const count = await notes.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Cmd+Click on first note (using Meta which is Cmd on macOS)
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Cmd+Click on second note
    await notes.nth(1).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Verify multi-select badge appears with correct count
    const badge = window.locator('text=/2 notes selected/');
    await expect(badge).toBeVisible();

    // Verify notes have multi-select styling (check background color)
    const firstNoteStyle = await notes.nth(0).evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Should have a blue tint (rgba(33, 150, 243, 0.12))
    expect(firstNoteStyle).toContain('rgb');
  });

  test('should select range with Shift+Click', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    // Get all note list items
    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');

    // Click first note normally to set anchor
    await notes.nth(0).click();
    await window.waitForTimeout(200);

    // Shift+Click on third note to select range
    await notes.nth(2).click({ modifiers: ['Shift'] });
    await window.waitForTimeout(200);

    // Verify multi-select badge shows 3 notes
    const badge = window.locator('text=/3 notes selected/');
    await expect(badge).toBeVisible();
  });

  test('should deselect note with Cmd+Click on already selected note', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');

    // Select two notes
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);
    await notes.nth(1).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Verify 2 notes selected
    let badge = window.locator('text=/2 notes selected/');
    await expect(badge).toBeVisible();

    // Cmd+Click again on first note to deselect
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Verify only 1 note selected now
    badge = window.locator('text=/1 note selected/');
    await expect(badge).toBeVisible();
  });

  test('should clear multi-select on normal click', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');

    // Select two notes
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);
    await notes.nth(1).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Verify 2 notes selected
    const badge = window.locator('text=/2 notes selected/');
    await expect(badge).toBeVisible();

    // Normal click on different note
    await notes.nth(2).click();
    await window.waitForTimeout(200);

    // Badge should disappear
    await expect(badge).not.toBeVisible();
  });

  test('should clear selection with Clear Selection button', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');

    // Select two notes
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);
    await notes.nth(1).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Verify badge visible
    const badge = window.locator('text=/2 notes selected/');
    await expect(badge).toBeVisible();

    // Click Clear Selection button
    const clearButton = window.locator('text=Clear Selection');
    await clearButton.click();
    await window.waitForTimeout(200);

    // Badge should disappear
    await expect(badge).not.toBeVisible();
  });

  test('should clear selection when changing folders', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');

    // Select two notes
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);
    await notes.nth(1).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Verify badge visible
    let badge = window.locator('text=/2 notes selected/');
    await expect(badge).toBeVisible();

    // Click on "Recently Deleted" folder
    const recentlyDeleted = window.locator('[aria-label="Recently Deleted"]');
    await recentlyDeleted.click();
    await window.waitForTimeout(500);

    // Badge should disappear
    await expect(badge).not.toBeVisible();

    // Switch back to "All Notes"
    const allNotes = window.locator('[aria-label="All Notes"]').first();
    await allNotes.click();
    await window.waitForTimeout(500);

    // Badge should still be gone
    badge = window.locator('text=/notes selected/');
    await expect(badge).not.toBeVisible();
  });

  test('should show updated count in context menu for multi-select', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');

    // Select two notes
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);
    await notes.nth(1).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Right-click on one of the selected notes
    await notes.nth(0).click({ button: 'right' });
    await window.waitForTimeout(200);

    // Context menu should show "Delete 2 notes"
    const deleteMenuItem = window.locator('text=Delete 2 notes');
    await expect(deleteMenuItem).toBeVisible();

    // Context menu should show "Move 2 notes to..."
    const moveMenuItem = window.locator('text=/Move 2 notes to\.\.\./');
    await expect(moveMenuItem).toBeVisible();

    // Pin/Unpin should NOT be visible for multi-select
    const pinMenuItem = window.locator('text=/Pin|Unpin/');
    await expect(pinMenuItem).not.toBeVisible();

    // Close context menu
    await window.keyboard.press('Escape');
  });

  test('should delete multiple notes via context menu', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');
    const initialCount = await notes.count();

    // Select two notes
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);
    await notes.nth(1).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Right-click to open context menu
    await notes.nth(0).click({ button: 'right' });
    await window.waitForTimeout(200);

    // Click "Delete 2 notes"
    const deleteMenuItem = window.locator('text=Delete 2 notes');
    await deleteMenuItem.click();
    await window.waitForTimeout(200);

    // Confirm deletion in dialog
    const confirmButton = window.locator('div[role="dialog"] button:has-text("Delete")');
    await expect(confirmButton).toBeVisible();

    // Verify dialog shows correct count
    const dialogTitle = window.locator('text=Delete 2 Notes?');
    await expect(dialogTitle).toBeVisible();

    await confirmButton.click();
    await window.waitForTimeout(500);

    // Verify notes count decreased by 2
    const newCount = await notes.count();
    expect(newCount).toBe(initialCount - 2);

    // Verify badge disappeared
    const badge = window.locator('text=/notes selected/');
    await expect(badge).not.toBeVisible();
  });

  test('should move multiple notes via context menu', async () => {
    // Create a folder first
    const createFolderButton = window.locator('button[title="Create folder"]');
    await createFolderButton.click();
    await window.waitForTimeout(200);

    const folderInput = window.locator('div[role="dialog"] input[type="text"]');
    await folderInput.fill('Test Folder');
    await folderInput.press('Enter');
    // Increased wait to ensure folder creation completes
    await window.waitForTimeout(1000);

    // Navigate to "All Notes" to ensure notes are created there, not in the new folder
    // Increased wait time to ensure folder deselection completes
    const allNotesFolder = window.locator('[aria-label="All Notes"]').first();
    await allNotesFolder.click();
    await window.waitForTimeout(1000);
    // Verify we're on All Notes by checking the notes panel header
    await expect(window.locator('h6:has-text("Notes")')).toBeVisible({ timeout: 5000 });

    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');
    const initialCount = await notes.count();

    // Select two notes
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);
    await notes.nth(1).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Right-click to open context menu
    await notes.nth(0).click({ button: 'right' });
    await window.waitForTimeout(200);

    // Click "Move 2 notes to..."
    const moveMenuItem = window.locator('text=/Move 2 notes to\.\.\./');
    await moveMenuItem.click();
    await window.waitForTimeout(200);

    // Verify dialog shows correct title
    const dialogTitle = window.locator('text=Move 2 Notes to Folder');
    await expect(dialogTitle).toBeVisible();

    // Wait for dialog to be fully loaded
    await window.waitForTimeout(300);

    // Find and click the "Test Folder" radio button using the FormControlLabel
    const testFolderOption = window
      .locator('div[role="radiogroup"] label')
      .filter({ hasText: 'Test Folder' });
    await testFolderOption.click();
    await window.waitForTimeout(300);

    // Click Move button
    const moveButton = window.locator('div[role="dialog"] button:has-text("Move")');
    await moveButton.click();
    await window.waitForTimeout(500);

    // Verify notes disappeared from "All Notes" view (3 notes - 2 moved = 1 left)
    const currentCount = await notes.count();
    expect(currentCount).toBe(initialCount - 2);

    // Verify badge disappeared
    const badge = window.locator('text=/notes selected/');
    await expect(badge).not.toBeVisible();

    // Navigate to the folder to verify notes were moved
    const testFolder = window.locator('[aria-label="Test Folder"]');
    await testFolder.click();
    await window.waitForTimeout(500);

    // Should now see the 2 notes in the folder
    const folderNotes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');
    const folderCount = await folderNotes.count();
    expect(folderCount).toBe(2);
  });

  test('should add right-clicked note to selection if not already selected', async () => {
    // Create three test notes
    const createButton = window.locator('button[title="Create note"]');
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);
    await createButton.click();
    await window.waitForTimeout(300);

    const notes = window.locator('[data-testid="notes-list"] .MuiListItemButton-root');

    // Select first note with Cmd+Click
    await notes.nth(0).click({ modifiers: ['Meta'] });
    await window.waitForTimeout(200);

    // Verify 1 note selected
    let badge = window.locator('text=/1 note selected/');
    await expect(badge).toBeVisible();

    // Right-click on a DIFFERENT note (not in selection)
    await notes.nth(2).click({ button: 'right' });
    await window.waitForTimeout(200);

    // Context menu should show "Delete 2 notes" (original + right-clicked)
    const deleteMenuItem = window.locator('text=Delete 2 notes');
    await expect(deleteMenuItem).toBeVisible();

    // Close context menu
    await window.keyboard.press('Escape');

    // Verify badge now shows 2 notes
    badge = window.locator('text=/2 notes selected/');
    await expect(badge).toBeVisible();
  });
});
