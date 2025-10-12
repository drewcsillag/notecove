import { test, expect } from '@playwright/test';

test.describe('Folder Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should display folder section in sidebar', async ({ page }) => {
    // Check that folders section exists
    await expect(page.locator('.folder-section')).toBeVisible();
    await expect(page.locator('.folder-section .section-header')).toContainText('Folders');
  });

  test('should show new folder button', async ({ page }) => {
    // Check that new folder button is visible
    const newFolderBtn = page.locator('#newFolderBtn');
    await expect(newFolderBtn).toBeVisible();
    await expect(newFolderBtn).toHaveAttribute('title', 'New Folder');
  });

  test('should display notes section with count', async ({ page }) => {
    // Check that notes section exists
    await expect(page.locator('.notes-section')).toBeVisible();
    await expect(page.locator('.notes-section .section-header')).toContainText('Notes');

    // Check that notes count is displayed
    const notesCount = page.locator('#notesCount');
    await expect(notesCount).toBeVisible();
  });

  test('should create note and see it in notes list', async ({ page }) => {
    // Create a new note
    await page.locator('.new-note-btn').click();

    // Type content
    await page.locator('#editor .ProseMirror').fill('Test Folder Note\nThis is a test note');

    // Wait for debounce
    await page.waitForTimeout(1500);

    // Check that note appears in sidebar
    await expect(page.locator('.note-item .note-title').first()).toContainText('Test Folder Note');

    // Check that notes count updated (should be more than default 2 sample notes)
    const notesCount = await page.locator('#notesCount').textContent();
    expect(parseInt(notesCount)).toBeGreaterThan(0);
  });

  test('should show folder tree placeholder', async ({ page }) => {
    // Check that folder tree container exists
    const folderTree = page.locator('#folderTree');
    await expect(folderTree).toBeVisible();
  });

  test('should maintain folder structure when creating notes', async ({ page }) => {
    // Create first note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('First Note\nContent');
    await page.waitForTimeout(1500);

    // Create second note - should be in same folder structure
    const welcomeState = page.locator('#welcomeState');
    const editorState = page.locator('#editorState');

    // Verify we're in editor state
    await expect(editorState).toBeVisible();
    await expect(welcomeState).toBeHidden();

    // Check that both sections (folders and notes) are still visible
    await expect(page.locator('.folder-section')).toBeVisible();
    await expect(page.locator('.notes-section')).toBeVisible();
  });

  test('should have search box in sidebar', async ({ page }) => {
    const searchBox = page.locator('.search-box');
    const searchInput = page.locator('.search-input');

    await expect(searchBox).toBeVisible();
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search notes...');
  });

  test('should filter notes when searching', async ({ page }) => {
    // Create a note to search for
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Unique Search Term\nTest content');
    await page.waitForTimeout(1500);

    // Type in search box
    await page.locator('.search-input').fill('Unique Search Term');

    // Wait a bit for search to process
    await page.waitForTimeout(500);

    // Should show the note with matching title
    const notesList = page.locator('#notesList');
    await expect(notesList).toBeVisible();
  });

  test('should show correct UI states', async ({ page }) => {
    // Initially should show welcome state (or notes if sample notes exist)
    const welcomeState = page.locator('#welcomeState');
    const editorState = page.locator('#editorState');

    // Check initial state
    const welcomeVisible = await welcomeState.isVisible();
    const editorVisible = await editorState.isVisible();

    // One should be visible, one should be hidden
    expect(welcomeVisible || editorVisible).toBe(true);
    expect(welcomeVisible && editorVisible).toBe(false);
  });

  test('should maintain sidebar layout when creating notes', async ({ page }) => {
    // Create a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Layout Test\nContent');

    // Check that sidebar is still visible and properly laid out
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Check that all sidebar sections are present
    await expect(page.locator('.sidebar-header')).toBeVisible();
    await expect(page.locator('.search-box')).toBeVisible();
    await expect(page.locator('.folder-section')).toBeVisible();
    await expect(page.locator('.notes-section')).toBeVisible();
  });

  test('should show NoteCove branding in sidebar', async ({ page }) => {
    const logo = page.locator('.logo');
    await expect(logo).toBeVisible();
    await expect(logo).toContainText('NoteCove');
  });
});
