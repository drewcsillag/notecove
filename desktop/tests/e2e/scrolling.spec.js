import { test, expect } from '@playwright/test';

test.describe('Editor Scrolling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Delete all sample notes to start with truly empty state
    await page.evaluate(() => {
      if (window.app?.noteManager) {
        const notes = window.app.noteManager.getAllNotes();
        notes.forEach(note => {
          window.app.noteManager.permanentlyDeleteNote(note.id);
        });
        localStorage.setItem('notecove-notes', JSON.stringify([]));
      }
    });
  });

  test('should scroll long notes properly', async ({ page }) => {
    // Create a new note
    await page.locator('.new-note-btn').click();
    await page.waitForTimeout(500);

    // Get the editor
    const editor = page.locator('#editor .ProseMirror');
    await editor.click();

    // Insert a lot of content to make it scrollable
    const longContent = Array(50).fill(0).map((_, i) =>
      `<h2>Section ${i + 1}</h2><p>This is paragraph ${i + 1} with some content that should make the note scrollable. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>`
    ).join('');

    await page.evaluate((html) => {
      const proseMirror = document.querySelector('#editor .ProseMirror');
      if (proseMirror) {
        proseMirror.innerHTML = html;
        // Trigger input event to save
        proseMirror.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, longContent);

    await page.waitForTimeout(1500); // Wait for debounce

    // Get the editor container
    const editorContainer = page.locator('.editor-container');

    // Check that the editor container has scrollable content
    const isScrollable = await editorContainer.evaluate((el) => {
      return el.scrollHeight > el.clientHeight;
    });

    expect(isScrollable).toBe(true);

    // Get initial scroll position (should be at top)
    const initialScrollTop = await editorContainer.evaluate(el => el.scrollTop);

    // Scroll down
    await editorContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });

    await page.waitForTimeout(100);

    // Check that scroll position changed
    const middleScrollTop = await editorContainer.evaluate(el => el.scrollTop);
    expect(middleScrollTop).toBeGreaterThan(initialScrollTop);

    // Scroll to top
    await editorContainer.evaluate((el) => {
      el.scrollTop = 0;
    });

    await page.waitForTimeout(100);

    // Verify we're back at the top
    const topScrollTop = await editorContainer.evaluate(el => el.scrollTop);
    expect(topScrollTop).toBe(0);

    // Scroll to bottom
    await editorContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    await page.waitForTimeout(100);

    // Verify we're at the bottom
    const bottomScrollTop = await editorContainer.evaluate(el => el.scrollTop);
    expect(bottomScrollTop).toBeGreaterThan(middleScrollTop);
  });

  test('should show scrollbar when content exceeds viewport', async ({ page }) => {
    // Create a new note with lots of content
    await page.locator('.new-note-btn').click();
    await page.waitForTimeout(500);

    const longContent = Array(50).fill(0).map((_, i) =>
      `<h2>Section ${i + 1}</h2><p>Content for section ${i + 1}</p>`
    ).join('');

    await page.evaluate((html) => {
      const proseMirror = document.querySelector('#editor .ProseMirror');
      if (proseMirror) {
        proseMirror.innerHTML = html;
      }
    }, longContent);

    await page.waitForTimeout(500);

    // Check computed style for overflow
    const editorContainer = page.locator('.editor-container');
    const overflowY = await editorContainer.evaluate((el) => {
      return window.getComputedStyle(el).overflowY;
    });

    expect(overflowY).toBe('auto');

    // Verify the content is taller than the container
    const dimensions = await editorContainer.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      offsetHeight: el.offsetHeight
    }));

    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  });

  test('should position cursor at top when opening long note', async ({ page }) => {
    // Create a note with long content
    await page.locator('.new-note-btn').click();
    await page.waitForTimeout(500);

    const longContent = '<h1>Title at Top</h1>' +
      Array(40).fill(0).map((_, i) => `<p>Line ${i + 1}</p>`).join('');

    await page.evaluate((html) => {
      const proseMirror = document.querySelector('#editor .ProseMirror');
      if (proseMirror) {
        proseMirror.innerHTML = html;
        proseMirror.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, longContent);

    await page.waitForTimeout(1500);

    // Click away to save
    await page.locator('.sidebar').click();
    await page.waitForTimeout(300);

    // Click the note again to reopen it
    const noteItem = page.locator('.note-item').first();
    await noteItem.click();
    await page.waitForTimeout(300);

    // Check that we're scrolled to the top
    const editorContainer = page.locator('.editor-container');
    const scrollTop = await editorContainer.evaluate(el => el.scrollTop);

    // Should be at or near the top (allowing small margin for variations)
    expect(scrollTop).toBeLessThan(50);
  });
});
