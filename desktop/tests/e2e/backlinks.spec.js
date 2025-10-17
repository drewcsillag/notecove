import { test, expect } from '@playwright/test';

test.describe('Backlinks Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test-mode');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('should show backlinks panel when note is linked from another note', async ({ page }) => {
    // Create target note
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Target Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This is the target note content');
    await page.waitForTimeout(1500);

    // Create source note with link to target
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Source Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This note links to ');
    await page.keyboard.type('[[Target Note]]');
    await page.waitForTimeout(1500);

    // Verify the link was created
    const link = page.locator('#editor span[data-note-link]');
    await expect(link).toBeVisible();

    // Click on the target note in the notes list
    // Use the note-title class to be more specific
    const targetNoteItem = page.locator('.note-item').filter({ has: page.locator('.note-title:has-text("Target Note")') }).first();
    await targetNoteItem.click();
    await page.waitForTimeout(500);

    // Check if backlinks panel is visible
    const backlinksPanel = page.locator('#backlinksPanel');
    await expect(backlinksPanel).toBeVisible({ timeout: 2000 });

    // Check backlinks count
    const backlinksCount = page.locator('#backlinksCount');
    await expect(backlinksCount).toHaveText('1');

    // Check backlink item exists
    const backlinkItem = page.locator('.backlink-item');
    await expect(backlinkItem).toBeVisible();

    // Check backlink shows source note title
    const backlinkTitle = backlinkItem.locator('.backlink-item-title');
    await expect(backlinkTitle).toHaveText('Source Note');

    // Check backlink shows context
    const backlinkContext = backlinkItem.locator('.backlink-item-context');
    const contextText = await backlinkContext.textContent();
    expect(contextText).toContain('links to');
  });

  test('should hide backlinks panel when note has no backlinks', async ({ page }) => {
    // Create a note without any backlinks
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Standalone Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This note has no backlinks');
    await page.waitForTimeout(1500);

    // Check that backlinks panel is hidden
    const backlinksPanel = page.locator('#backlinksPanel');
    await expect(backlinksPanel).toBeHidden();
  });

  test('should navigate to linking note when backlink is clicked', async ({ page }) => {
    // Create target note
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Target Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Target content');
    await page.waitForTimeout(1500);

    // Create source note with link
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Source Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Link: ');
    await page.keyboard.type('[[Target Note]]');
    await page.waitForTimeout(1500);

    // Go to target note
    const targetNoteItem = page.locator('.note-item').filter({ has: page.locator('.note-title:has-text("Target Note")') }).first();
    await targetNoteItem.click();
    await page.waitForTimeout(500);

    // Verify backlinks panel is visible
    const backlinksPanel = page.locator('#backlinksPanel');
    await expect(backlinksPanel).toBeVisible();

    // Click on the backlink
    const backlinkItem = page.locator('.backlink-item');
    await backlinkItem.click();
    await page.waitForTimeout(500);

    // Verify we navigated to Source Note
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Source Note');
    expect(editorContent).toContain('Link:');
  });

  test('should update backlinks panel when links are added or removed', async ({ page }) => {
    // Create target note
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Target Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Target content');
    await page.waitForTimeout(1500);

    // Initially no backlinks
    let backlinksPanel = page.locator('#backlinksPanel');
    await expect(backlinksPanel).toBeHidden();

    // Create source note with link
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Source Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[[Target Note]]');
    await page.waitForTimeout(1500);

    // Go back to target note - should now show backlinks
    const targetNoteItem = page.locator('.note-item').filter({ has: page.locator('.note-title:has-text("Target Note")') }).first();
    await targetNoteItem.click();
    await page.waitForTimeout(500);

    backlinksPanel = page.locator('#backlinksPanel');
    await expect(backlinksPanel).toBeVisible();

    const backlinksCount = page.locator('#backlinksCount');
    await expect(backlinksCount).toHaveText('1');
  });
});
