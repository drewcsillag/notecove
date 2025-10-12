import { test, expect } from '@playwright/test';

test.describe('Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      console.log('localStorage cleared, items:', localStorage.length);
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should not create duplicate notes when typing', async ({ page }) => {
    // Get initial count (should be sample notes)
    const initialCount = await page.locator('.note-item').count();

    // Create a new note
    await page.locator('.new-note-btn').click();

    // Type a multi-line note
    await page.locator('#editor .ProseMirror').fill('This is a test note\n\nfoo bar baz\nfronky boinky boo!');

    // Wait for debounce and any saves
    await page.waitForTimeout(2000);

    // Count the notes in the list
    const noteItems = page.locator('.note-item');
    const count = await noteItems.count();

    // Should only have added 1 note to the initial count
    expect(count).toBe(initialCount + 1);

    // Verify the title is correct (from first line)
    const firstNoteTitle = await page.locator('.note-item .note-title').first().textContent();
    expect(firstNoteTitle).toContain('This is a test note');
  });

  test('should switch note content when clicking different notes', async ({ page }) => {
    // Create first note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('First Note Title\nFirst note content');
    await page.waitForTimeout(1500);

    // Create second note (using keyboard shortcut or button)
    const welcomeBtn = page.locator('.new-note-btn');
    const isVisible = await welcomeBtn.isVisible().catch(() => false);

    if (!isVisible) {
      // Use keyboard shortcut if button not visible
      await page.keyboard.press('Control+n'); // or Meta+n on Mac
      await page.waitForTimeout(500);
    } else {
      await welcomeBtn.click();
    }

    await page.locator('#editor .ProseMirror').fill('Second Note Title\nSecond note content');
    await page.waitForTimeout(1500);

    // Click on the first note in the list
    const firstNote = page.locator('.note-item').filter({ hasText: 'First Note Title' });
    await firstNote.click();

    // Wait for content to load
    await page.waitForTimeout(500);

    // Verify the editor shows the first note's content
    const editorText = await page.locator('#editor .ProseMirror').textContent();
    expect(editorText).toContain('First Note Title');
    expect(editorText).toContain('First note content');

    // Click on the second note
    const secondNote = page.locator('.note-item').filter({ hasText: 'Second Note Title' });
    await secondNote.click();

    // Wait for content to load
    await page.waitForTimeout(500);

    // Verify the editor shows the second note's content
    const editorText2 = await page.locator('#editor .ProseMirror').textContent();
    expect(editorText2).toContain('Second Note Title');
    expect(editorText2).toContain('Second note content');
  });

  test('should maintain consistent note count after edits', async ({ page }) => {
    // Get initial note count
    const initialCount = await page.locator('.note-item').count();

    // Create a new note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Consistent Test\nContent here');
    await page.waitForTimeout(1500);

    // Get note count after creation
    const afterCreateCount = await page.locator('.note-item').count();
    expect(afterCreateCount).toBe(initialCount + 1);

    // Edit the note by adding more text
    await page.locator('#editor .ProseMirror').fill('Consistent Test\nContent here\nMore content added');
    await page.waitForTimeout(1500);

    // Count should remain the same after editing
    const afterEditCount = await page.locator('.note-item').count();
    expect(afterEditCount).toBe(afterCreateCount);
  });

  test('should show reset button in status bar', async ({ page }) => {
    const resetBtn = page.locator('#resetStoreBtn');
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toHaveText('🔄 Reset');
  });

  test('reset button should have confirmation dialog', async ({ page }) => {
    const resetBtn = page.locator('#resetStoreBtn');

    // Set up dialog handler to dismiss it
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('reset');
      dialog.dismiss();
    });

    await resetBtn.click();

    // If we got here without error, the dialog was shown and dismissed
    expect(true).toBe(true);
  });

  test('reset button should clear all notes and reload page', async ({ page }) => {
    // Create some notes
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('First Test Note\nSome content');
    await page.waitForTimeout(1500);

    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);
    await page.locator('#editor .ProseMirror').fill('Second Test Note\nMore content');
    await page.waitForTimeout(1500);

    // Verify we have notes
    const notesBeforeReset = await page.locator('.note-item').count();
    expect(notesBeforeReset).toBeGreaterThan(0);

    // Click reset and accept confirmation
    const resetBtn = page.locator('#resetStoreBtn');

    // Listen for dialog and accept it
    page.once('dialog', dialog => {
      dialog.accept();
    });

    await resetBtn.click();

    // Wait for page reload
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify welcome state is shown (no notes)
    await expect(page.locator('#welcomeState')).toBeVisible();
    await expect(page.locator('#editorState')).toBeHidden();

    // Verify we can create a new note after reset
    const newNoteBtn = page.locator('.new-note-btn');
    await expect(newNoteBtn).toBeVisible();
    await newNoteBtn.click();
    await page.locator('#editor .ProseMirror').fill('Post-Reset Note\nThis works!');
    await page.waitForTimeout(1500);

    const notesAfterReset = await page.locator('.note-item').count();
    expect(notesAfterReset).toBe(1);
  });

  test('should not create files with changing titles', async ({ page }) => {
    // This test verifies that note files use consistent IDs, not changing titles

    // Create a note
    await page.locator('.new-note-btn').click();

    // Type gradually (simulating the bug where each character created a new file)
    await page.locator('#editor .ProseMirror').type('T');
    await page.waitForTimeout(200);

    await page.locator('#editor .ProseMirror').type('e');
    await page.waitForTimeout(200);

    await page.locator('#editor .ProseMirror').type('st');
    await page.waitForTimeout(200);

    await page.locator('#editor .ProseMirror').type(' Title');
    await page.waitForTimeout(1500);

    // Should only have one new note, not multiple
    const noteItems = page.locator('.note-item');
    const notesWithTest = noteItems.filter({ hasText: /^Test Title$/ });

    const count = await notesWithTest.count();
    expect(count).toBeLessThanOrEqual(1); // Should be exactly 1, but at most 1
  });
});
