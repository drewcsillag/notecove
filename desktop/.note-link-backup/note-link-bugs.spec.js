import { test, expect } from '@playwright/test';

test.describe('Note Links - Bug Verification', () => {
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

  test('should preserve link markup (>>note_title) in editor display', async ({ page }) => {
    // Create a target note
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;
      await noteManager.createNote({
        title: 'TargetNote',
        content: '<p>Target content</p>'
      });
      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(300);

    // Create a new note with a link
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('See >>TargetNote for details');
    await page.waitForTimeout(500);

    // Verify the link displays with >> prefix
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('>>TargetNote');
    // Should NOT show without the prefix
    expect(editorContent).not.toMatch(/^See TargetNote for details$/);
  });

  test('should preserve link markup (>>"note title") for titles with spaces', async ({ page }) => {
    // Create a target note
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;
      await noteManager.createNote({
        title: 'Target Note',
        content: '<p>Target content</p>'
      });
      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(300);

    // Create a new note with a link
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('See >>"Target Note" for details');
    await page.waitForTimeout(500);

    // Verify the link displays with >>" " syntax
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('>>"Target Note"');
  });

  test('should persist link when switching between notes', async ({ page }) => {
    // Create target note
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('TargetNote');
    await page.waitForTimeout(1000); // Wait for save

    // Create source note with link
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    await editor.click();
    await editor.type('SourceNote\n\nInitial content Link to >>TargetNote ');
    await page.waitForTimeout(1500); // Wait for save

    // Verify link exists
    let noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveText('>>TargetNote');

    // Switch to target note using sidebar
    await page.locator('.note-item')
      .filter({ has: page.locator('.note-title', { hasText: 'TargetNote' }) })
      .click();
    await page.waitForTimeout(500);

    // Switch back to source note
    await page.locator('.note-item')
      .filter({ has: page.locator('.note-title', { hasText: 'SourceNote' }) })
      .click();
    await page.waitForTimeout(500);

    // Verify link is still there
    noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveText('>>TargetNote');

    // Verify the full content is intact
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('SourceNote');
    expect(editorContent).toContain('Initial content');
    expect(editorContent).toContain('Link to');
    expect(editorContent).toContain('>>TargetNote');
  });

  test('should persist link after page reload', async ({ page }) => {
    // Create target note
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;
      await noteManager.createNote({
        title: 'TargetNote',
        content: '<p>Target content</p>'
      });
      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(300);

    // Create source note with link
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Link to >>TargetNote here');
    await page.waitForTimeout(2000); // Wait for save

    // Get the source note ID
    const sourceId = await page.evaluate(() => {
      return window.app.currentNote?.id;
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open the source note
    await page.evaluate((id) => {
      window.app.selectNote(id);
    }, sourceId);

    await page.waitForTimeout(500);

    // Verify link is still there
    const editorAfterReload = page.locator('#editor .ProseMirror');
    const noteLink = editorAfterReload.locator('.note-link');
    await expect(noteLink).toBeVisible();

    const editorContent = await editorAfterReload.textContent();
    expect(editorContent).toContain('>>TargetNote');
  });

  test('should save link in HTML format correctly', async ({ page }) => {
    // Create target note
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;
      await noteManager.createNote({
        title: 'TestTarget',
        content: '<p>Target content</p>'
      });
      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(300);

    // Create note with link
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('See >>TestTarget ');
    await page.waitForTimeout(1500); // Wait for save

    // Get the saved HTML from noteManager
    const savedHTML = await page.evaluate(() => {
      const note = window.app.currentNote;
      return note?.content;
    });

    console.log('Saved HTML:', savedHTML);

    // Verify the HTML contains the note link mark
    expect(savedHTML).toContain('data-note-link');
    expect(savedHTML).toContain('TestTarget');
  });
});
