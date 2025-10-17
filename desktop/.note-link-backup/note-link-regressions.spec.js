import { test, expect } from '@playwright/test';

test.describe('Note Links - Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-test-mode', 'true');
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should not corrupt note title when clicking note with link to it', async ({ page }) => {
    // Create target note with title "Note_to_link" and no body
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Note_to_link');
    await page.waitForTimeout(1000); // Wait for save

    // Verify note appears in list with correct title
    const targetNote = page.locator('.note-item').filter({ hasText: 'Note_to_link' });
    await expect(targetNote).toBeVisible();

    // Create another note with a link to it
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    await editor.click();
    await editor.type('Quick Start\n\nLink to >>Note_to_link here');
    await page.waitForTimeout(1000); // Wait for save

    // Verify link was created
    const noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();

    // Now click on the Note_to_link note in the sidebar (use more specific selector)
    await page.locator('.note-item').filter({ has: page.locator('.note-title', { hasText: 'Note_to_link' }) }).click();
    await page.waitForTimeout(500);

    // Verify the title is still "Note_to_link", not corrupted to "N"
    const activeNoteTitle = page.locator('.note-item.active .note-title');
    await expect(activeNoteTitle).toHaveText('Note_to_link');

    // Verify the editor still shows "Note_to_link"
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Note_to_link');
    expect(editorContent).not.toBe('N');
  });

  test('should persist link when switching between notes', async ({ page }) => {
    // Create target note
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Note_to_link');
    await page.waitForTimeout(1000);

    // Create source note with link
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    await editor.click();
    await editor.type('Quick Start\n\nLink to >>Note_to_link here');
    await page.waitForTimeout(1500); // Wait for save

    // Verify link exists
    let noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveText('>>Note_to_link');

    // Get the source note ID
    const sourceNoteId = await page.evaluate(() => window.app.currentNote?.id);

    // Click on Note_to_link (use specific selector for note title)
    await page.locator('.note-item').filter({ has: page.locator('.note-title', { hasText: 'Note_to_link' }) }).click();
    await page.waitForTimeout(500);

    // Go back to source note
    await page.locator('.note-item').filter({ has: page.locator('.note-title', { hasText: 'Quick Start' }) }).click();
    await page.waitForTimeout(500);

    // Verify link is still there
    noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveText('>>Note_to_link');

    // Verify the full content is still there
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Quick Start');
    expect(editorContent).toContain('Link to');
    expect(editorContent).toContain('>>Note_to_link');
    expect(editorContent).toContain('here');
  });

  test('should not corrupt note content when navigating via link', async ({ page }) => {
    // Create two notes
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Target_Note\n\nTarget note body content');
    await page.waitForTimeout(1000);

    await newNoteBtn.click();
    await page.waitForTimeout(500);

    await editor.click();
    await editor.type('Source_Note\n\nCheck out >>Target_Note for details');
    await page.waitForTimeout(1500);

    // Click the link to navigate
    const noteLink = editor.locator('.note-link');
    await noteLink.click();
    await page.waitForTimeout(500);

    // Verify we're at Target_Note with full content
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Target_Note');
    expect(editorContent).toContain('Target note body content');

    // Verify title in sidebar is correct
    const activeNoteTitle = page.locator('.note-item.active .note-title');
    await expect(activeNoteTitle).toHaveText('Target_Note');
  });
});
