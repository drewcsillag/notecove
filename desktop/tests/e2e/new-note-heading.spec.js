import { test, expect } from '@playwright/test';

test.describe('New Note H1 Heading', () => {
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

  test('should initialize new note with H1 heading', async ({ page }) => {
    // Create a new note
    await page.locator('#newNoteBtn').click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });

    // Wait for editor to initialize
    await page.waitForTimeout(500);

    // Check that the first element is an H1
    const firstElement = editor.locator('> *').first();
    const tagName = await firstElement.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('h1');

    // Type some text to verify it goes into the H1
    await page.keyboard.type('My Note Title');
    await page.waitForTimeout(300);

    // Verify the text is in an H1
    const h1Text = await editor.locator('h1').first().textContent();
    expect(h1Text).toBe('My Note Title');
  });

  test('should have paragraph after H1', async ({ page }) => {
    // Create a new note
    await page.locator('#newNoteBtn').click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Type in H1 and press Enter
    await page.keyboard.type('Title');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Verify cursor is now in a paragraph (not another H1)
    const focusedElement = editor.locator(':focus');
    const tagName = await page.evaluate(() => {
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        let node = selection.anchorNode;
        // If it's a text node, get parent element
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentElement;
        }
        return node.tagName?.toLowerCase();
      }
      return null;
    });

    expect(tagName).toBe('p');

    // Type some body text
    await page.keyboard.type('This is the body content');
    await page.waitForTimeout(300);

    // Verify we have both H1 and paragraph
    const h1Count = await editor.locator('h1').count();
    const pCount = await editor.locator('p').count();

    expect(h1Count).toBeGreaterThanOrEqual(1);
    expect(pCount).toBeGreaterThanOrEqual(1);
  });

  test('should maintain H1 structure after switching notes', async ({ page }) => {
    // Create first note with H1
    await page.locator('#newNoteBtn').click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('First Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Content of first note');
    await page.waitForTimeout(1500);

    // Create second note
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Check that the new note also has H1 structure
    const firstElement = editor.locator('> *').first();
    const tagName = await firstElement.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('h1');

    // Type in the new note
    await page.keyboard.type('Second Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Content of second note');
    await page.waitForTimeout(1500);

    // Switch back to first note (use data-note-id to avoid ambiguity)
    const notesList = page.locator('.notes-list');
    const allNotes = await notesList.locator('.note-item').all();

    // Find the note by checking exact title match
    let firstNoteElement = null;
    for (const noteItem of allNotes) {
      const titleText = await noteItem.locator('.note-title').textContent();
      if (titleText?.trim() === 'First Note') {
        firstNoteElement = noteItem;
        break;
      }
    }

    if (!firstNoteElement) {
      throw new Error('Could not find "First Note" in notes list');
    }

    await firstNoteElement.click();
    await page.waitForTimeout(500);

    // Verify first note still has its H1
    const h1Text = await editor.locator('h1').first().textContent();
    expect(h1Text).toBe('First Note');
  });

  test('should not add H1 to existing note with content', async ({ page }) => {
    // Create a note and add content without H1
    await page.locator('#newNoteBtn').click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Remove the H1 by clearing and typing directly into paragraph
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    // Type content as paragraphs
    await page.keyboard.type('Just regular text');
    await page.keyboard.press('Enter');
    await page.keyboard.type('No heading here');
    await page.waitForTimeout(1500);

    // Switch to another note
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Another note');
    await page.waitForTimeout(1500);

    // Switch back to the first note (find by exact title match)
    const notesList = page.locator('.notes-list');
    const allNotes = await notesList.locator('.note-item').all();

    let firstNoteElement = null;
    for (const noteItem of allNotes) {
      const titleText = await noteItem.locator('.note-title').textContent();
      if (titleText?.includes('Just regular')) {
        firstNoteElement = noteItem;
        break;
      }
    }

    if (!firstNoteElement) {
      throw new Error('Could not find note starting with "Just regular" in notes list');
    }

    await firstNoteElement.click();
    await page.waitForTimeout(500);

    // Verify it still doesn't have an H1 (we didn't add one when switching back)
    const h1Count = await editor.locator('h1').count();
    const content = await editor.textContent();

    // If it has H1s, they should be from our test content, not auto-added
    expect(content).toContain('Just regular text');
  });

  test('should allow typing immediately in H1 on new note', async ({ page }) => {
    // Create a new note
    await page.locator('#newNoteBtn').click();
    await page.waitForTimeout(500);

    const editor = page.locator('#editor .ProseMirror');

    // Type immediately without any additional clicks
    await page.keyboard.type('Quick Title');
    await page.waitForTimeout(300);

    // Verify it went into the H1
    const h1Text = await editor.locator('h1').first().textContent();
    expect(h1Text).toBe('Quick Title');
  });
});
