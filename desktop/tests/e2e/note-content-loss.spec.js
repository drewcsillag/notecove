import { test, expect } from '@playwright/test';

test.describe('Note Content Loss Bug', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-test-mode', 'true');
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should preserve note content when switching between notes', async ({ page }) => {
    // Wait for welcome state
    await page.waitForSelector('#welcomeState');

    // Click "New Note" button to create first note
    const newNoteBtn = page.locator('button.new-note-btn');
    await newNoteBtn.click();

    // Now wait for editor to be visible
    await page.waitForSelector('#editor .ProseMirror', { state: 'visible' });
    const editor = page.locator('#editor .ProseMirror');

    // Create first note
    await editor.click();
    await page.waitForTimeout(500); // pause
    await editor.click();
    await editor.type('First Note Title');
    await editor.press('Enter');
    await editor.type('First note body content here.');
    await page.waitForTimeout(1000); // Wait for save

    // Create second note using sidebar button
    const sidebarNewBtn = page.locator('#newNoteBtn');
    await sidebarNewBtn.click();
    await page.waitForTimeout(500); // pause
    await editor.click();
    await editor.type('Second Note Title');
    await editor.press('Enter');
    await editor.type('Second note body content here.');
    await page.waitForTimeout(1000); // Wait for save

    // Get references to both notes by their titles (as user sees them)
    const firstCreatedNote = page.locator('.note-item').filter({ has: page.locator('.note-title', { hasText: 'First Note Title' }) });
    const secondCreatedNote = page.locator('.note-item').filter({ has: page.locator('.note-title', { hasText: 'Second Note Title' }) });

    // User's reproduction: click welcome note (doesn't exist in this test, skip)
    // Instead click first created note
    console.log('Clicking first created note (First Note Title)...');
    await firstCreatedNote.click();
    await page.waitForTimeout(500); // pause
    await page.waitForTimeout(1000); // Wait for note to load

    // Verify it loaded correctly
    let content = await editor.textContent();
    console.log('After clicking First Note Title, editor shows:', content.substring(0, 50));
    expect(content).toContain('First Note Title');
    expect(content).toContain('First note body content here.');

    // Verify title in sidebar is still correct
    const activeTitleElement = page.locator('.note-item.active .note-title');
    const titleText = await activeTitleElement.textContent();
    console.log('First note title in sidebar:', titleText);

    expect(titleText).toBe('First Note Title');
    expect(titleText).not.toBe('F'); // Should not be truncated to single char
    expect(titleText.length).toBeGreaterThan(2); // Should not be 1-2 chars
  });
});
