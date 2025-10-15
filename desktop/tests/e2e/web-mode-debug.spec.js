import { test, expect } from '@playwright/test';

test.describe('Web Mode Title Debug', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set empty notes array to prevent sample notes from loading
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should debug title update in web mode', async ({ page }) => {
    // Expose console logs
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    // Create new note using sidebar button (sample notes will be present)
    await page.locator('#newNoteBtn').click();
    await page.waitForTimeout(1000);

    // Get initial state
    const initialState = await page.evaluate(() => {
      return {
        isElectron: window.app.isElectron,
        isSettingContent: window.app.isSettingContent,
        currentNoteId: window.app.currentNote?.id,
        currentNoteTitle: window.app.currentNote?.title,
        notesCount: window.app.notes.length,
        editorExists: !!window.app.editor
      };
    });
    console.log('Initial state:', initialState);

    // Type in editor
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await page.keyboard.type('Test Title Line');

    // Wait a bit
    await page.waitForTimeout(300);

    // Check intermediate state
    const midState = await page.evaluate(() => {
      return {
        editorText: window.app.editor ? window.app.editor.getText() : 'no editor',
        currentNoteTitle: window.app.currentNote?.title,
        isSettingContent: window.app.isSettingContent
      };
    });
    console.log('Mid state (after typing, before debounce):', midState);

    // Wait for debounce
    await page.waitForTimeout(1500);

    // Check final state
    const finalState = await page.evaluate(() => {
      const note = window.app.notes.find(n => n.id === window.app.currentNote?.id);
      return {
        editorText: window.app.editor ? window.app.editor.getText() : 'no editor',
        currentNoteTitle: window.app.currentNote?.title,
        notesArrayTitle: note?.title,
        notesArrayCount: window.app.notes.length,
        noteManagerHasNote: window.app.noteManager?.notes.has(window.app.currentNote?.id),
        noteFromManager: window.app.noteManager?.getNote(window.app.currentNote?.id)?.title
      };
    });
    console.log('Final state (after debounce):', finalState);

    // Check sidebar HTML
    const sidebarTitles = await page.locator('.note-item .note-title').allTextContents();
    console.log('Sidebar titles:', sidebarTitles);

    // Verify expectations
    expect(finalState.currentNoteTitle).toBe('Test Title Line');
    expect(finalState.notesArrayTitle).toBe('Test Title Line');
    expect(finalState.noteFromManager).toBe('Test Title Line');

    // Check if sidebar shows the title
    await expect(page.locator('.note-item .note-title').first()).toContainText('Test Title Line');
  });

  test('should check if handleEditorUpdate is called', async ({ page }) => {
    let updateCallCount = 0;

    // Intercept handleEditorUpdate calls
    await page.exposeFunction('testHandleEditorUpdateCalled', () => {
      updateCallCount++;
    });

    await page.evaluate(() => {
      const originalHandler = window.app.handleEditorUpdate.bind(window.app);
      window.app.handleEditorUpdate = function() {
        window.testHandleEditorUpdateCalled();
        return originalHandler();
      };
    });

    // Create new note
    await page.locator('#newNoteBtn').click();
    await page.waitForTimeout(1000);

    // Type
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await page.keyboard.type('Test');

    // Wait for debounce
    await page.waitForTimeout(500);

    console.log('handleEditorUpdate was called', updateCallCount, 'times');
    expect(updateCallCount).toBeGreaterThan(0);
  });
});
