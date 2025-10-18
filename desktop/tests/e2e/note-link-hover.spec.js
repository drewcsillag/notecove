import { test, expect } from '@playwright/test';

test.describe('Note Link Hover Preview', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set empty notes array
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should show preview on hover over note link', async ({ page }) => {
    // Create target note with some content
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Target Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This is some content in the target note that should appear in the preview.');
    await page.waitForTimeout(1500);

    // Create source note with link
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Source Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Check out ');
    await page.keyboard.type('[[Target Note]]');
    await page.waitForTimeout(1500);

    // Verify link was created
    const link = page.locator('#editor span[data-note-link]');
    await expect(link).toBeVisible();

    // Hover over the link
    await link.hover();

    // Wait for hover delay (300ms) plus a bit
    await page.waitForTimeout(400);

    // Check that preview is visible
    const preview = page.locator('#noteLinkPreview');
    await expect(preview).toHaveClass(/visible/);
    await expect(preview).toBeVisible();

    // Check preview title
    const previewTitle = page.locator('.note-link-preview-title');
    await expect(previewTitle).toHaveText('Target Note');

    // Check preview content contains the note content
    const previewContent = page.locator('.note-link-preview-content');
    const contentText = await previewContent.textContent();
    expect(contentText).toContain('This is some content');
  });

  test('should hide preview when mouse leaves link', async ({ page }) => {
    // Create notes with link
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Target');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Content here');
    await page.waitForTimeout(1500);

    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Source');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Link to ');
    await page.keyboard.type('[[Target]]');
    await page.waitForTimeout(1500);

    const link = page.locator('#editor span[data-note-link]');
    await expect(link).toBeVisible();

    // Hover to show preview
    await link.hover();
    await page.waitForTimeout(400);

    const preview = page.locator('#noteLinkPreview');
    await expect(preview).toHaveClass(/visible/);

    // Move mouse away from link
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);

    // Preview should be hidden
    await expect(preview).not.toHaveClass(/visible/);
  });

  test('should show preview for link without noteId (title-only link)', async ({ page }) => {
    // Create a note
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('My Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Some content in my note');
    await page.waitForTimeout(1500);

    // Create another note with link
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Linking Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Reference: ');
    await page.keyboard.type('[[My Note]]');
    await page.waitForTimeout(1500);

    const link = page.locator('#editor span[data-note-link]');
    await expect(link).toBeVisible();

    // Hover over link
    await link.hover();
    await page.waitForTimeout(400);

    // Preview should show
    const preview = page.locator('#noteLinkPreview');
    await expect(preview).toBeVisible();

    const previewTitle = page.locator('.note-link-preview-title');
    await expect(previewTitle).toHaveText('My Note');

    const previewContent = page.locator('.note-link-preview-content');
    const contentText = await previewContent.textContent();
    expect(contentText).toContain('Some content');
  });

  test('should show "Note not found" for broken link', async ({ page }) => {
    // Create a note with link to non-existent note
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Test Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Link to ');
    await page.keyboard.type('[[Nonexistent Note]]');
    await page.waitForTimeout(1500);

    const link = page.locator('#editor span[data-note-link]');
    await expect(link).toBeVisible();

    // Hover over broken link
    await link.hover();
    await page.waitForTimeout(400);

    const preview = page.locator('#noteLinkPreview');
    await expect(preview).toBeVisible();

    const previewTitle = page.locator('.note-link-preview-title');
    await expect(previewTitle).toHaveText('Nonexistent Note');

    const previewContent = page.locator('.note-link-preview-content');
    await expect(previewContent).toHaveText('Note not found');
  });

  test('should truncate long content in preview', async ({ page }) => {
    // Create note with long content
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Long Note');
    await page.keyboard.press('Enter');

    // Type content longer than 300 chars
    const longText = 'A'.repeat(400);
    await page.keyboard.type(longText);
    await page.waitForTimeout(1500);

    // Create linking note
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Linker');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[[Long Note]]');
    await page.waitForTimeout(1500);

    const link = page.locator('#editor span[data-note-link]');
    await link.hover();
    await page.waitForTimeout(400);

    const previewContent = page.locator('.note-link-preview-content');
    const contentText = await previewContent.textContent();

    // Should be truncated and end with ...
    expect(contentText.length).toBeLessThan(350); // Original was 400, max is 300 + "..."
    expect(contentText).toContain('...');
  });
});
