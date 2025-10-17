import { test, expect } from '@playwright/test';

test.describe('Note Links', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set empty notes array
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-test-mode', 'true');
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should create note link with >>note_title syntax', async ({ page }) => {
    // Create a note to link to
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;
      await noteManager.createNote({
        title: 'Target_Note',
        content: '<p>Target Note Content</p>'
      });
      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(300);

    // Create a new note
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    // Type link syntax in editor (space after >>Target_Note triggers the input rule)
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Link to >>Target_Note ');
    await page.waitForTimeout(500);

    // Verify link was created
    const noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveClass(/note-link-exists/);
    await expect(noteLink).toHaveText('>>Target_Note');
  });

  test('should create note link with >>"note title" syntax for titles with spaces', async ({ page }) => {
    // Create a note to link to
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;
      await noteManager.createNote({
        title: 'Note With Spaces',
        content: '<p>Content here</p>'
      });
      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(300);

    // Create a new note
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    // Type link syntax with quotes in editor (closing quote triggers the input rule)
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Link to >>"Note With Spaces" ');
    await page.waitForTimeout(500);

    // Verify link was created
    const noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveClass(/note-link-exists/);
    await expect(noteLink).toHaveText('>>"Note With Spaces"');
  });

  test('should show missing link style for non-existent notes', async ({ page }) => {
    // Create a new note
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    // Type link to non-existent note (space triggers the input rule)
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Link to >>NonExistentNote ');
    await page.waitForTimeout(500);

    // Verify link was created with missing style
    const noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveClass(/note-link-missing/);
    await expect(noteLink).toHaveText('>>NonExistentNote');
  });

  test('should navigate to existing note when clicking link', async ({ page }) => {
    // Create two notes
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;

      const note1 = await noteManager.createNote({
        title: 'First_Note',
        content: '<p>First Note Content</p>'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const note2 = await noteManager.createNote({
        title: 'Second_Note',
        content: '<p>Second Note Content</p>'
      });

      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(500);

    // Open the second note
    const secondNote = page.locator('.note-item').filter({ hasText: 'Second_Note' });
    await secondNote.click();
    await page.waitForTimeout(500);

    // Add a link to the first note
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.press('End');
    await editor.type(' Link to >>First_Note ');
    await page.waitForTimeout(500);

    // Click the note link
    const noteLink = editor.locator('.note-link');

    // Wait for link to be visible and clickable
    await expect(noteLink).toBeVisible();
    await noteLink.click();
    await page.waitForTimeout(500);

    // Verify we navigated to First Note
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('First Note Content');

    // Verify the note is highlighted in the sidebar
    const activeNote = page.locator('.note-item.active');
    await expect(activeNote).toHaveText(/First_Note/);
  });

  test('should offer to create new note when clicking missing link', async ({ page }) => {
    // Create a new note
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    // Add a link to a non-existent note
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Link to >>MissingNote ');
    await page.waitForTimeout(500);

    // Click the missing note link
    const noteLink = editor.locator('.note-link-missing');
    await noteLink.click();
    await page.waitForTimeout(300);

    // Verify create dialog appears
    const dialog = page.locator('#customDialog');
    await expect(dialog).toBeVisible();

    const dialogMessage = page.locator('#dialogMessage');
    await expect(dialogMessage).toHaveText(/MissingNote.*doesn't exist.*Create it/);

    // Click OK to create the note
    await page.locator('#dialogOk').click();
    await page.waitForTimeout(500);

    // Verify the new note was created and is now active
    const activeNote = page.locator('.note-item.active .note-title');
    await expect(activeNote).toHaveText('MissingNote');
  });

  test('should cancel note creation when clicking cancel in dialog', async ({ page }) => {
    // Create a new note
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    // Add a link to a non-existent note
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('Link to >>CancelledNote ');
    await page.waitForTimeout(500);

    // Click the missing note link
    const noteLink = editor.locator('.note-link-missing');
    await noteLink.click();
    await page.waitForTimeout(300);

    // Verify dialog appears
    const dialog = page.locator('#customDialog');
    await expect(dialog).toBeVisible();

    // Click Cancel
    await page.locator('#dialogCancel').click();
    await page.waitForTimeout(300);

    // Verify dialog is hidden
    await expect(dialog).toBeHidden();

    // Verify the cancelled note was NOT created (check title specifically, not content)
    const notesList = page.locator('#notesList');
    const cancelledNote = notesList.locator('.note-item .note-title').filter({ hasText: /^CancelledNote$/ });
    await expect(cancelledNote).toHaveCount(0);
  });

  test.skip('should update link display when target note is renamed', async ({ page }) => {
    // Create two notes with IDs we can track
    const noteIds = await page.evaluate(async () => {
      const noteManager = window.app.noteManager;

      const target = await noteManager.createNote({
        title: 'OrigTitle',
        content: '<p>Target content</p>'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const source = await noteManager.createNote({
        title: 'SourceDoc',
        content: '<p>See >>OrigTitle </p>'
      });

      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();

      return { targetId: target.id, sourceId: source.id };
    });

    await page.waitForTimeout(1000);

    // Open the source note to verify initial link
    await page.evaluate((sourceId) => {
      window.app.selectNote(sourceId);
    }, noteIds.sourceId);

    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    let noteLink = editor.locator('.note-link');
    await expect(noteLink).toHaveText('OrigTitle');

    // Rename the target note
    await page.evaluate((targetId) => {
      const noteManager = window.app.noteManager;
      const target = noteManager.getNote(targetId);
      if (target) {
        target.title = 'RenamedTitle';
        noteManager.saveNote(target.id);
      }
      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    }, noteIds.targetId);

    await page.waitForTimeout(500);

    // Reload the source note to see updated link
    await page.evaluate((sourceId) => {
      window.app.selectNote(sourceId);
    }, noteIds.sourceId);

    await page.waitForTimeout(500);

    // Verify link now shows the renamed title
    noteLink = editor.locator('.note-link');
    await expect(noteLink).toHaveText('RenamedTitle');
  });

  test('should persist note links after saving and reloading', async ({ page }) => {
    // Create notes with link
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;

      await noteManager.createNote({
        title: 'Target',
        content: '<p>Target content</p>'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await noteManager.createNote({
        title: 'Source',
        content: '<p>Source content</p>'
      });

      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(1500); // Wait for save

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Open the source note and add a link
    const sourceNote = page.locator('.note-item').filter({ hasText: 'Source' });
    await sourceNote.click();
    await page.waitForTimeout(500);

    // Add link
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.press('End');
    await editor.type(' Link to >>Target ');
    await page.waitForTimeout(1500); // Wait for save

    // Verify link is there
    const noteLink = editor.locator('.note-link');
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveClass(/note-link-exists/);
    await expect(noteLink).toHaveText('>>Target');
  });

  test('should support multiple links in the same note', async ({ page }) => {
    // Create target notes
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;

      await noteManager.createNote({
        title: 'First_Target',
        content: '<p>First content</p>'
      });

      await noteManager.createNote({
        title: 'Second_Target',
        content: '<p>Second content</p>'
      });

      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(300);

    // Create a new note with multiple links
    const newNoteBtn = page.locator('#newNoteBtn');
    await newNoteBtn.click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.type('See >>First_Target and >>Second_Target ');
    await page.waitForTimeout(500);

    // Verify both links were created
    const noteLinks = editor.locator('.note-link');
    await expect(noteLinks).toHaveCount(2);

    const firstLink = noteLinks.nth(0);
    const secondLink = noteLinks.nth(1);

    await expect(firstLink).toHaveText('>>First_Target');
    await expect(secondLink).toHaveText('>>Second_Target');

    // Verify both are marked as existing
    await expect(firstLink).toHaveClass(/note-link-exists/);
    await expect(secondLink).toHaveClass(/note-link-exists/);
  });
});
