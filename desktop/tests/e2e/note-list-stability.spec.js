import { test, expect } from '@playwright/test';

test.describe('Note List Stability', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set empty notes array to prevent sample notes from loading
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-test-mode', 'true'); // Enable test mode to skip sample notes
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should not reorder notes when clicking between them', async ({ page }) => {
    // Create three notes programmatically with different timestamps
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;

      // Create notes with explicit timestamps to ensure order
      const note1 = await noteManager.createNote({
        title: 'First Note Content',
        content: '<p>First Note Content</p>'
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 50));

      const note2 = await noteManager.createNote({
        title: 'Second Note Content',
        content: '<p>Second Note Content</p>'
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const note3 = await noteManager.createNote({
        title: 'Third Note Content',
        content: '<p>Third Note Content</p>'
      });

      // Refresh the notes list
      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(500); // Wait for UI to update

    // Get the initial order of notes (should be: Third, Second, First)
    const initialOrder = await page.evaluate(() => {
      const noteItems = Array.from(document.querySelectorAll('.note-item'));
      return noteItems.map(item => {
        const title = item.querySelector('.note-title')?.textContent || '';
        return title.trim();
      });
    });

    expect(initialOrder).toEqual(['Third Note Content', 'Second Note Content', 'First Note Content']);

    // Click on the middle note (Second Note)
    const secondNote = page.locator('.note-item').filter({ hasText: 'Second Note Content' });
    await secondNote.click();
    await page.waitForTimeout(500); // Wait for editor to load and debounce

    // Verify the order hasn't changed after clicking
    const orderAfterClick = await page.evaluate(() => {
      const noteItems = Array.from(document.querySelectorAll('.note-item'));
      return noteItems.map(item => {
        const title = item.querySelector('.note-title')?.textContent || '';
        return title.trim();
      });
    });

    expect(orderAfterClick).toEqual(initialOrder);

    // Click on the oldest note (First Note)
    const firstNote = page.locator('.note-item').filter({ hasText: 'First Note Content' });
    await firstNote.click();
    await page.waitForTimeout(500); // Wait for editor to load and debounce

    // Verify the order still hasn't changed
    const orderAfterSecondClick = await page.evaluate(() => {
      const noteItems = Array.from(document.querySelectorAll('.note-item'));
      return noteItems.map(item => {
        const title = item.querySelector('.note-title')?.textContent || '';
        return title.trim();
      });
    });

    expect(orderAfterSecondClick).toEqual(initialOrder);
  });

  test('should reorder notes when content is actually edited', async ({ page }) => {
    // Create two notes programmatically
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;

      const note1 = await noteManager.createNote({
        title: 'Old Note Content',
        content: '<p>Old Note Content</p>'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const note2 = await noteManager.createNote({
        title: 'New Note Content',
        content: '<p>New Note Content</p>'
      });

      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(500);

    // Get the initial order (should be: New, Old)
    const initialOrder = await page.evaluate(() => {
      const noteItems = Array.from(document.querySelectorAll('.note-item'));
      return noteItems.map(item => {
        const title = item.querySelector('.note-title')?.textContent || '';
        return title.trim();
      });
    });

    expect(initialOrder).toEqual(['New Note Content', 'Old Note Content']);

    // Click on the old note
    const oldNote = page.locator('.note-item').filter({ hasText: 'Old Note Content' });
    await oldNote.click();
    await page.waitForTimeout(300); // Wait for editor to load

    // Edit the old note's content
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();
    await editor.press('End'); // Move to end of content
    await editor.type(' - EDITED');
    await page.waitForTimeout(1500); // Wait for debounce to save

    // Now the order should have changed (edited note should be first)
    const orderAfterEdit = await page.evaluate(() => {
      const noteItems = Array.from(document.querySelectorAll('.note-item'));
      return noteItems.map(item => {
        const title = item.querySelector('.note-title')?.textContent || '';
        return title.trim();
      });
    });

    expect(orderAfterEdit).toEqual(['Old Note Content - EDITED', 'New Note Content']);
  });

  test('should not reorder when switching folders', async ({ page }) => {
    // Create a folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Test Folder');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Create notes programmatically
    await page.evaluate(async () => {
      const noteManager = window.app.noteManager;

      await noteManager.createNote({
        title: 'First Note',
        content: '<p>First Note</p>'
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      await noteManager.createNote({
        title: 'Second Note',
        content: '<p>Second Note</p>'
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      await noteManager.createNote({
        title: 'Third Note',
        content: '<p>Third Note</p>'
      });

      window.app.notes = noteManager.getAllNotes();
      window.app.renderNotesList();
    });

    await page.waitForTimeout(500);

    // Get initial order in All Notes
    const initialOrder = await page.evaluate(() => {
      const noteItems = Array.from(document.querySelectorAll('.note-item'));
      return noteItems.map(item => {
        const title = item.querySelector('.note-title')?.textContent || '';
        return title.trim();
      });
    });

    expect(initialOrder).toEqual(['Third Note', 'Second Note', 'First Note']);

    // Click on Test Folder (should show 0 notes)
    const testFolder = page.locator('.folder-item').filter({ hasText: 'Test Folder' });
    await testFolder.click();
    await page.waitForTimeout(300);

    // Verify no notes shown
    const noteCount = await page.locator('.note-item').count();
    expect(noteCount).toBe(0);

    // Click back to All Notes
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await page.waitForTimeout(300);

    // Verify order is still the same
    const orderAfterFolderSwitch = await page.evaluate(() => {
      const noteItems = Array.from(document.querySelectorAll('.note-item'));
      return noteItems.map(item => {
        const title = item.querySelector('.note-title')?.textContent || '';
        return title.trim();
      });
    });

    expect(orderAfterFolderSwitch).toEqual(initialOrder);
  });
});
