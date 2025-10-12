import { test, expect } from '@playwright/test';

test.describe('Tag Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should detect and style hashtags in editor', async ({ page }) => {
    // Create new note
    await page.locator('.new-note-btn').click();

    // Wait for editor to be ready
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Type a note with hashtags
    await page.keyboard.type('Project Ideas');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Working on #javascript and #nodejs projects');

    // Wait for debounce
    await page.waitForTimeout(1500);

    // Check that hashtags are styled
    const hashtags = page.locator('.editor .hashtag');
    await expect(hashtags).toHaveCount(2);
  });

  test('should extract tags from note content', async ({ page }) => {
    // Create new note with hashtags
    await page.locator('.new-note-btn').click();

    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Learning #typescript');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Great experience with #webdev and #typescript');

    // Wait for debounce and tags to be extracted
    await page.waitForTimeout(1500);

    // Check that tags appear in sidebar (typescript and webdev, but typescript only counted once)
    const tagsList = page.locator('#tagsList');
    await expect(tagsList.locator('.tag-item')).toHaveCount(2);

    // Check tag names
    await expect(tagsList.locator('.tag-item').filter({ hasText: '#typescript' })).toBeVisible();
    await expect(tagsList.locator('.tag-item').filter({ hasText: '#webdev' })).toBeVisible();
  });

  test('should show tag counts', async ({ page }) => {
    // Create first note
    await page.locator('.new-note-btn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Note 1 about #javascript');
    await page.waitForTimeout(1500);

    // Create second note
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.keyboard.type('Note 2 also about #javascript');
    await page.waitForTimeout(1500);

    // Check that javascript tag shows count of 2
    const javascriptTag = page.locator('.tag-item').filter({ hasText: '#javascript' });
    await expect(javascriptTag.locator('.tag-count')).toHaveText('2');
  });

  test('should filter notes by tag when clicked', async ({ page }) => {
    // Create multiple notes with different tags
    await page.locator('.new-note-btn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('React Project');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Building with #react and #frontend');
    await page.waitForTimeout(1500);

    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.keyboard.type('Node Backend');
    await page.keyboard.press('Enter');
    await page.keyboard.type('API with #nodejs and #backend');
    await page.waitForTimeout(1500);

    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.keyboard.type('Full Stack App');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Using #react and #nodejs together');
    await page.waitForTimeout(1500);

    // All 3 notes should be visible
    let noteCount = await page.locator('.note-item').count();
    expect(noteCount).toBe(3);

    // Click on #react tag
    await page.locator('.tag-item').filter({ hasText: '#react' }).click();
    await page.waitForTimeout(500);

    // Should show only 2 notes with #react tag
    noteCount = await page.locator('.note-item').count();
    expect(noteCount).toBe(2);

    // Tag should be highlighted as active
    await expect(page.locator('.tag-item.active').filter({ hasText: '#react' })).toBeVisible();
  });

  test('should deselect tag when clicked again', async ({ page }) => {
    // Create note with tag
    await page.locator('.new-note-btn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Test Note with #testing');
    await page.waitForTimeout(1500);

    // Click tag to filter
    const testingTag = page.locator('.tag-item').filter({ hasText: '#testing' });
    await testingTag.click();
    await page.waitForTimeout(500);

    // Tag should be active
    await expect(page.locator('.tag-item.active')).toBeVisible();

    // Click again to deselect
    await testingTag.click();
    await page.waitForTimeout(500);

    // Tag should not be active anymore
    await expect(page.locator('.tag-item.active')).not.toBeVisible();
  });

  test('should support tags with hyphens', async ({ page }) => {
    // Create note with hyphenated tag
    await page.locator('.new-note-btn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Working on #web-development and #full-stack projects');
    await page.waitForTimeout(1500);

    // Check that tags with hyphens appear
    const tagsList = page.locator('#tagsList');
    await expect(tagsList.locator('.tag-item').filter({ hasText: '#web-development' })).toBeVisible();
    await expect(tagsList.locator('.tag-item').filter({ hasText: '#full-stack' })).toBeVisible();
  });

  test('should not scroll to top while typing tags', async ({ page }) => {
    // Create note
    await page.locator('.new-note-btn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Type enough content to make the editor scrollable
    await page.keyboard.type('Title\n\n');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.type(`Line ${i + 1}\n`);
    }
    await page.waitForTimeout(500);

    // Scroll down in the editor
    const editorContainer = page.locator('.editor-container');
    await editorContainer.evaluate(el => el.scrollTop = 300);

    // Verify we're scrolled down
    let initialScrollTop = await editorContainer.evaluate(el => el.scrollTop);
    expect(initialScrollTop).toBeGreaterThan(100);

    // Type a hashtag
    await page.keyboard.type('Testing #hashtag here');

    // Wait for the debounced update
    await page.waitForTimeout(1500);

    // Verify scroll position hasn't changed significantly (allowing for minor variations)
    const finalScrollTop = await editorContainer.evaluate(el => el.scrollTop);
    expect(finalScrollTop).toBeGreaterThan(100);
    // Should be close to the initial position (within 50px tolerance)
    expect(Math.abs(finalScrollTop - initialScrollTop)).toBeLessThan(50);
  });
});
