import { test, expect } from '@playwright/test';

test.describe('NoteCove Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should load the application', async ({ page }) => {
    // Check that the app loads
    await expect(page.locator('#app')).toBeVisible();

    // Check for NoteCove branding
    await expect(page.locator('.logo')).toContainText('NoteCove');
  });

  test('should show welcome state when no notes exist', async ({ page }) => {
    // Should show welcome state
    await expect(page.locator('#welcomeState')).toBeVisible();
    await expect(page.locator('.welcome-title')).toContainText('Welcome to NoteCove');

    // Should have create note button
    await expect(page.locator('.new-note-btn')).toBeVisible();
  });

  test('should create a new note', async ({ page }) => {
    // Click create note button
    await page.locator('.new-note-btn').click();

    // Should switch to editor state
    await expect(page.locator('#editorState')).toBeVisible();
    await expect(page.locator('#welcomeState')).toBeHidden();

    // Should have editor focused
    await expect(page.locator('#editor .ProseMirror')).toBeFocused();
  });

  test('should type in note and derive title from first line', async ({ page }) => {
    // Create new note
    await page.locator('.new-note-btn').click();

    // Type in editor - first line becomes the title
    await page.locator('#editor .ProseMirror').fill('My Note Title\nThis is the note content');

    // Wait for debounce
    await page.waitForTimeout(1500);

    // Check that note appears in sidebar with first line as title
    // Use first() to get the most recent note (which appears first in the list)
    await expect(page.locator('.note-item .note-title').first()).toContainText('My Note Title');
  });

  test('should search notes and filter results', async ({ page }) => {
    // Create multiple notes
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Apple Note\nThis is about apples');
    await page.waitForTimeout(1500);

    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);
    await page.locator('#editor .ProseMirror').fill('Banana Note\nThis is about bananas');
    await page.waitForTimeout(1500);

    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);
    await page.locator('#editor .ProseMirror').fill('Cherry Note\nThis is about cherries');
    await page.waitForTimeout(1500);

    // Verify all notes are visible
    const allNotes = await page.locator('.note-item').count();
    expect(allNotes).toBe(3);

    // Search for "banana"
    const searchInput = page.locator('.search-input');
    await searchInput.click();
    await searchInput.fill('banana');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should only show 1 note
    const filteredNotes = await page.locator('.note-item').count();
    expect(filteredNotes).toBe(1);

    // Verify the correct note is shown
    await expect(page.locator('.note-item .note-title').first()).toContainText('Banana Note');

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // All notes should be visible again
    const allNotesAgain = await page.locator('.note-item').count();
    expect(allNotesAgain).toBe(3);
  });

  test('should maintain search input focus while typing', async ({ page }) => {
    // Create a note first
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Test Note\nTest content');
    await page.waitForTimeout(1500);

    // Click in search box
    const searchInput = page.locator('.search-input');
    await searchInput.click();

    // Type multiple characters
    await page.keyboard.type('test');

    // Verify search input still has focus
    await expect(searchInput).toBeFocused();

    // Verify the text was typed into search, not the editor
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('test');
  });
});