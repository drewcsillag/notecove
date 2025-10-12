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

  test('should search notes', async ({ page }) => {
    // Search input should be visible
    await expect(page.locator('.search-input')).toBeVisible();

    // Should be able to type in search
    await page.locator('.search-input').fill('test');
  });
});