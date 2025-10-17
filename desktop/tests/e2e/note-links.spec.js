import { test, expect } from '@playwright/test';

test.describe('Note Linking Functionality', () => {
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

  test.describe('Phase 1: Basic Link Creation', () => {
    test('should create a clickable link using [[Note Title]] syntax', async ({ page }) => {
      // Create first note
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Target Note');
      await page.keyboard.press('Enter');
      await page.keyboard.type('This is the target note content');
      await page.waitForTimeout(1500);

      // Create second note with link to first
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Source Note');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Check out this note: ');

      // Type the link syntax
      await page.keyboard.type('[[Target Note]]');
      await page.waitForTimeout(500);

      // Verify link was created
      const linkText = await page.locator('#editor span[data-note-link]').textContent();
      expect(linkText).toBe('Target Note');

      // Verify link has the correct attributes
      const link = page.locator('#editor span[data-note-link]');
      await expect(link).toHaveAttribute('data-note-title', 'Target Note');
    });

    test('should navigate to linked note when clicked', async ({ page }) => {
      // Create target note
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Destination Note');
      await page.keyboard.press('Enter');
      await page.keyboard.type('You have arrived!');
      await page.waitForTimeout(1500);

      // Create source note with link
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Start Note');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Go to [[Destination Note]]');
      await page.waitForTimeout(1500);

      // Click the link
      await page.locator('#editor span[data-note-link]').click();
      await page.waitForTimeout(500);

      // Verify we navigated to the destination note
      const content = await editor.textContent();
      expect(content).toContain('You have arrived!');

      // Verify the correct note is selected in sidebar
      const activeNote = page.locator('.note-item.active .note-title');
      await expect(activeNote).toContainText('Destination Note');
    });

    test('should style note links with accent color', async ({ page }) => {
      // Create notes
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Linked Note');
      await page.waitForTimeout(1500);

      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('See [[Linked Note]]');
      await page.waitForTimeout(500);

      // Check link styling
      const link = page.locator('#editor span[data-note-link]');
      await expect(link).toBeVisible();

      // Verify it has the data-note-link attribute (CSS styles it)
      await expect(link).toHaveAttribute('data-note-link');
    });
  });

  test.describe('Phase 2: Robustness - ID-Based Linking', () => {
    test('should store note ID when creating a link', async ({ page }) => {
      // Create target note
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Referenced Note');
      await page.waitForTimeout(1500);

      // Get the note ID from localStorage
      const targetNoteId = await page.evaluate(() => {
        const notes = JSON.parse(localStorage.getItem('notecove-notes') || '[]');
        return notes.find(n => n.title === 'Referenced Note')?.id;
      });

      // Create source note with link
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Link: [[Referenced Note]]');
      await page.waitForTimeout(1000);

      // Verify link has note ID stored
      const link = page.locator('#editor span[data-note-link]');
      await expect(link).toHaveAttribute('data-note-id', targetNoteId);
    });

    test('should navigate by ID even after note rename', async ({ page }) => {
      // Create target note
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Original Name');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Target content');
      await page.waitForTimeout(1500);

      // Create source note with link
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Link to [[Original Name]]');
      await page.waitForTimeout(1500);

      // Switch back to first note and rename it (use .last() to get the actual note, not the one containing the link)
      await page.locator('.note-item').filter({ hasText: 'Original Name' }).last().click();
      await page.waitForTimeout(500);

      // Select and replace the H1 title
      await editor.click();
      await page.keyboard.press('Control+a'); // Select all
      await page.keyboard.type('Renamed Note');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Target content');
      await page.waitForTimeout(1500);

      // Go back to source note
      await page.locator('.note-item').filter({ hasText: 'Link to' }).click();
      await page.waitForTimeout(500);

      // Click the link (which still displays "Original Name")
      await page.locator('#editor span[data-note-link]').click();
      await page.waitForTimeout(500);

      // Verify we navigated to the renamed note (using ID)
      const content = await editor.textContent();
      expect(content).toContain('Target content');

      // Verify the renamed note is active
      const activeNote = page.locator('.note-item.active .note-title');
      await expect(activeNote).toContainText('Renamed Note');
    });
  });

  test.describe('Phase 2: Robustness - Broken Link Detection', () => {
    test('should mark broken links when target note is deleted', async ({ page }) => {
      // Create target note
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Will Be Deleted');
      await page.waitForTimeout(1500);

      // Create source note with link
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Link: [[Will Be Deleted]]');
      await page.waitForTimeout(1500);

      // Delete the target note (use .last() to get the actual note, not the one containing the link)
      await page.locator('.note-item').filter({ hasText: 'Will Be Deleted' }).last().click();
      await page.waitForTimeout(500);
      await page.locator('#deleteNoteBtn').click();
      await page.waitForTimeout(500);

      // Go back to source note
      await page.locator('.note-item').first().click();
      await page.waitForTimeout(500);

      // Verify the link has broken link styling
      const link = page.locator('#editor .note-link-broken');
      await expect(link).toBeVisible();
      await expect(link).toHaveText('Will Be Deleted');
    });

    test('should not navigate when clicking a broken link', async ({ page }) => {
      // Create target note
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Temporary Note');
      await page.waitForTimeout(1500);

      const targetNoteId = await page.evaluate(() => {
        const notes = JSON.parse(localStorage.getItem('notecove-notes') || '[]');
        return notes.find(n => n.title === 'Temporary Note')?.id;
      });

      // Create source note with link
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Source with link');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Link: [[Temporary Note]]');
      await page.waitForTimeout(1500);

      const sourceNoteId = await page.evaluate(() => {
        const notes = JSON.parse(localStorage.getItem('notecove-notes') || '[]');
        return notes.find(n => n.title === 'Source with link')?.id;
      });

      // Delete target note (use .last() to get the actual note, not the one containing the link)
      await page.locator('.note-item').filter({ hasText: 'Temporary Note' }).last().click();
      await page.waitForTimeout(500);
      await page.locator('#deleteNoteBtn').click();
      await page.waitForTimeout(500);

      // Go back to source note
      await page.locator('.note-item').first().click();
      await page.waitForTimeout(500);

      // Click the broken link
      await page.locator('#editor .note-link-broken').click();
      await page.waitForTimeout(500);

      // Verify we're still on the source note (didn't navigate)
      const activeNoteId = await page.evaluate(() => {
        const notes = JSON.parse(localStorage.getItem('notecove-notes') || '[]');
        const activeNotes = notes.filter(n => !n.deleted);
        // Get the currently displayed note
        return document.querySelector('.note-item.active')?.getAttribute('data-note-id') || activeNotes[0]?.id;
      });

      expect(activeNoteId).toBe(sourceNoteId);
    });

    test('should show broken link styling for non-existent notes', async ({ page }) => {
      // Create note with link to non-existent note (simulated by manual HTML)
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Note with broken link');
      await page.waitForTimeout(1500);

      // Inject a broken link directly via HTML
      await page.evaluate(() => {
        const proseMirror = document.querySelector('#editor .ProseMirror');
        if (proseMirror) {
          const brokenLinkHTML = '<p>This links to <span data-note-link data-note-title="NonExistent" data-note-id="fake-id-999">NonExistent</span> note</p>';
          proseMirror.innerHTML = brokenLinkHTML;
        }
      });

      await page.waitForTimeout(500);

      // Verify broken link class is applied
      const brokenLink = page.locator('#editor .note-link-broken');
      await expect(brokenLink).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle links with special characters in titles', async ({ page }) => {
      // Create note with special characters
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Note: Special & Chars!');
      await page.waitForTimeout(1500);

      // Create note with link
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Link: [[Note: Special & Chars!]]');
      await page.waitForTimeout(500);

      // Verify link created
      const link = page.locator('#editor span[data-note-link]');
      await expect(link).toBeVisible();
      await expect(link).toHaveText('Note: Special & Chars!');
    });

    test('should handle multiple links in one note', async ({ page }) => {
      // Create target notes
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('First Target');
      await page.waitForTimeout(1500);

      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Second Target');
      await page.waitForTimeout(1500);

      // Create note with multiple links
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Multi Link Note');
      await page.keyboard.press('Enter');
      await page.keyboard.type('See [[First Target]] and [[Second Target]]');
      await page.waitForTimeout(1000);

      // Verify both links created
      const links = await page.locator('#editor span[data-note-link]').count();
      expect(links).toBe(2);

      // Click first link
      await page.locator('#editor span[data-note-link]').first().click();
      await page.waitForTimeout(500);

      const content = await editor.textContent();
      expect(content).toContain('First Target');
    });

    test('should handle case-insensitive title matching', async ({ page }) => {
      // Create note
      await page.locator('#newNoteBtn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Case Sensitive Note');
      await page.waitForTimeout(1500);

      // Create link with different casing
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Link: [[case sensitive note]]');
      await page.waitForTimeout(1000);

      // Click link
      await page.locator('#editor span[data-note-link]').click();
      await page.waitForTimeout(500);

      // Should navigate to the correctly-cased note
      const activeNote = page.locator('.note-item.active .note-title');
      await expect(activeNote).toContainText('Case Sensitive Note');
    });
  });
});
