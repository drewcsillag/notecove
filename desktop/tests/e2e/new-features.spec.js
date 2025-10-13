import { test, expect } from '@playwright/test';

test.describe('New Features', () => {
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

  test.describe('Three-State Tag Filtering', () => {
    test('should cycle through include, exclude, and no filter states', async ({ page }) => {
      // Create multiple notes with different tags
      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('React Project');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Building with #react');
      await page.waitForTimeout(1500);

      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('Node Backend');
      await page.keyboard.press('Enter');
      await page.keyboard.type('API with #nodejs');
      await page.waitForTimeout(1500);

      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('Plain Note');
      await page.keyboard.press('Enter');
      await page.keyboard.type('No tags here');
      await page.waitForTimeout(1500);

      // All 3 notes should be visible initially
      let noteCount = await page.locator('.note-item').count();
      expect(noteCount).toBe(3);

      // First click: Include mode - should show only notes WITH #react tag
      const reactTag = page.locator('.tag-item').filter({ hasText: '#react' });
      await reactTag.click();
      await page.waitForTimeout(500);

      noteCount = await page.locator('.note-item').count();
      expect(noteCount).toBe(1);
      await expect(page.locator('.tag-item.active').filter({ hasText: '#react' })).toBeVisible();
      await expect(reactTag).not.toHaveClass(/tag-exclude/);

      // Second click: Exclude mode - should show only notes WITHOUT #react tag
      await reactTag.click();
      await page.waitForTimeout(500);

      noteCount = await page.locator('.note-item').count();
      expect(noteCount).toBe(2);
      await expect(reactTag).toHaveClass(/tag-exclude/);

      // Third click: No filter - should show all notes again
      await reactTag.click();
      await page.waitForTimeout(500);

      noteCount = await page.locator('.note-item').count();
      expect(noteCount).toBe(3);
      await expect(page.locator('.tag-item.active')).not.toBeVisible();
    });

    test('should show visual indicators for exclude mode', async ({ page }) => {
      // Create note with tag
      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('Test with #testing tag');
      await page.waitForTimeout(1500);

      const testingTag = page.locator('.tag-item').filter({ hasText: '#testing' });

      // Click twice to get to exclude mode
      await testingTag.click();
      await page.waitForTimeout(200);
      await testingTag.click();
      await page.waitForTimeout(200);

      // Should have red background (tag-exclude class)
      await expect(testingTag).toHaveClass(/tag-exclude/);

      // Tag name should have strikethrough
      const tagName = testingTag.locator('.tag-name');
      const hasStrikethrough = await tagName.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.textDecoration.includes('line-through');
      });
      expect(hasStrikethrough).toBe(true);
    });
  });

  test.describe('Folder Collapse/Expand', () => {
    test('should show collapse arrows for folders with children', async ({ page }) => {
      // Create a parent folder
      await page.locator('#newFolderBtn').click();
      let dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Parent Folder');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();

      // Initially arrow should be hidden (no children yet)
      const parentFolder = page.locator('.folder-item').filter({ hasText: 'Parent Folder' });
      const arrow = parentFolder.locator('.folder-collapse-arrow');
      await expect(arrow).toBeHidden();

      // Select the parent folder
      await parentFolder.click();
      await page.waitForTimeout(200);

      // Create a child folder
      await page.locator('#newFolderBtn').click();
      dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Child Folder');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();
      await page.waitForTimeout(300);

      // Now arrow should be visible (has children)
      await expect(arrow).toBeVisible();
    });

    test('should collapse and expand folders', async ({ page }) => {
      // Create parent and child folders
      await page.locator('#newFolderBtn').click();
      let dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Parent');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();

      // Select parent folder
      const parentFolder = page.locator('.folder-item').filter({ hasText: 'Parent' });
      await parentFolder.click();
      await page.waitForTimeout(200);

      // Create child folder - this shows confirm dialog first
      await page.locator('#newFolderBtn').click();
      // Handle the "Create Subfolder?" confirm dialog
      const confirmBtn = page.locator('#dialogConfirm');
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();
      await page.waitForTimeout(100);

      // Now the input dialog appears
      dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Child');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();

      await page.waitForTimeout(300);

      // Child folder should be visible
      const childFolder = page.locator('.folder-item').filter({ hasText: 'Child' });
      await expect(childFolder).toBeVisible();

      // Click collapse arrow
      const collapseArrow = parentFolder.locator('.folder-collapse-arrow');
      await collapseArrow.click();
      await page.waitForTimeout(200);

      // Child folder should be hidden
      await expect(childFolder).not.toBeVisible();

      // Arrow should show collapsed state (▶)
      await expect(collapseArrow).toHaveText('▶');

      // Click again to expand
      await collapseArrow.click();
      await page.waitForTimeout(200);

      // Child folder should be visible again
      await expect(childFolder).toBeVisible();

      // Arrow should show expanded state (▼)
      await expect(collapseArrow).toHaveText('▼');
    });

    test('should persist folder collapse state across page reloads', async ({ page }) => {
      // Create parent and child folders
      await page.locator('#newFolderBtn').click();
      let dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Parent');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();

      const parentFolder = page.locator('.folder-item').filter({ hasText: 'Parent' });
      await parentFolder.click();
      await page.waitForTimeout(200);

      // Create child folder - handle confirm dialog
      await page.locator('#newFolderBtn').click();
      const confirmBtn = page.locator('#dialogConfirm');
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();
      await page.waitForTimeout(100);

      // Now the input dialog appears
      dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Child');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();
      await page.waitForTimeout(300);

      // Collapse the folder
      const collapseArrow = parentFolder.locator('.folder-collapse-arrow');
      await collapseArrow.click();
      await page.waitForTimeout(200);

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Folder should still be collapsed
      const childFolder = page.locator('.folder-item').filter({ hasText: 'Child' });
      await expect(childFolder).not.toBeVisible();
    });
  });

  test.describe('Last Opened Note Restoration', () => {
    // TODO: Fix bug where notes aren't restored after page reload
    // The editor remains empty even though localStorage has the note ID
    // Issue: selectNote() is called before editor DOM elements are ready
    test.skip('should restore last opened note on startup', async ({ page }) => {
      // Create two notes
      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('First Note');
      await page.waitForTimeout(2000); // Wait for autosave

      // Create second note by clicking the + button in notes panel
      await page.locator('#newNoteBtn').click();
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('Second Note');
      await page.waitForTimeout(2000); // Wait for autosave

      // Second note should be open
      await expect(editor).toContainText('Second Note');

      // Click on the second note in the list to ensure it's selected
      const secondNoteInList = page.locator('.note-item').filter({ hasText: 'Second Note' });
      await secondNoteInList.click();
      await page.waitForTimeout(500);

      // Verify the editor shows Second Note
      await expect(editor).toContainText('Second Note');

      // Verify last opened note is saved to localStorage
      const lastOpenedNote = await page.evaluate(() => {
        return localStorage.getItem('notecove-last-opened-note');
      });
      expect(lastOpenedNote).toBeTruthy();

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000); // Increased timeout for async operations

      // Wait for notes to be loaded and visible in list
      await page.locator('.note-item').first().waitFor({ state: 'visible', timeout: 10000 });

      // Second note should still be open
      const editorAfterReload = page.locator('#editor .ProseMirror');
      await expect(editorAfterReload).toContainText('Second Note', { timeout: 10000 });
    });

    // TODO: Same bug as above test - note restoration not working
    test.skip('should open most recent note if last opened was deleted', async ({ page }) => {
      // Create two notes
      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('First Note');
      await page.waitForTimeout(2000); // Wait for autosave

      // Create second note by clicking the + button in notes panel
      await page.locator('#newNoteBtn').click();
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('Second Note');
      await page.waitForTimeout(2000); // Wait for autosave

      // Ensure the note is selected and editor has content
      await expect(editor).toContainText('Second Note');

      // Delete the second note (currently open)
      const deleteBtn = page.locator('#deleteNoteBtn');
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.click();

      // Handle the confirmation dialog
      const confirmBtn = page.locator('#dialogConfirm');
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();
      await page.waitForTimeout(300);

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Wait for notes to be loaded
      await page.locator('.note-item').first().waitFor({ state: 'visible', timeout: 10000 });

      // First note should be open (most recent non-deleted)
      const editorAfterReload = page.locator('#editor .ProseMirror');
      await expect(editorAfterReload).toContainText('First Note', { timeout: 10000 });
    });
  });

  test.describe('Folder Note Counts', () => {
    test('should display note count for folders', async ({ page }) => {
      // Create a folder
      await page.locator('#newFolderBtn').click();
      const dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Test Folder');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();

      // Select the folder
      const testFolder = page.locator('.folder-item').filter({ hasText: 'Test Folder' });
      await testFolder.click();
      await page.waitForTimeout(200);

      // Create a note in the folder
      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('Note in folder');
      await page.waitForTimeout(1500);

      // Folder should show count of 1
      const folderCount = testFolder.locator('.folder-count');
      await expect(folderCount).toHaveText('1');

      // Create another note
      await page.keyboard.press('Control+n');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('Second note in folder');
      await page.waitForTimeout(1500);

      // Folder should show count of 2
      await expect(folderCount).toHaveText('2');
    });

    test('should show correct counts on app startup', async ({ page }) => {
      // Create a folder with a note
      await page.locator('#newFolderBtn').click();
      const dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Test Folder');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();

      const testFolder = page.locator('.folder-item').filter({ hasText: 'Test Folder' });
      await testFolder.click();
      await page.waitForTimeout(200);

      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('Note in folder');
      await page.waitForTimeout(1500);

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Folder should still show count of 1 (not 0)
      const folderCount = testFolder.locator('.folder-count');
      await expect(folderCount).toHaveText('1');
    });

    test('should update counts when notes are moved between folders', async ({ page }) => {
      // Create two folders
      await page.locator('#newFolderBtn').click();
      let dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Folder A');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();

      await page.locator('#newFolderBtn').click();
      dialogInput = page.locator('#dialogInput');
      await expect(dialogInput).toBeVisible();
      await dialogInput.fill('Folder B');
      await page.locator('#dialogOk').click();
      await expect(dialogInput).toBeHidden();

      // Select Folder A and create a note
      const folderA = page.locator('.folder-item').filter({ hasText: 'Folder A' });
      await folderA.click();
      await page.waitForTimeout(200);

      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.keyboard.type('Note in Folder A');
      await page.waitForTimeout(1500);

      // Folder A should have count of 1
      const folderACount = folderA.locator('.folder-count');
      await expect(folderACount).toHaveText('1');

      // Folder B should have count of 0
      const folderB = page.locator('.folder-item').filter({ hasText: 'Folder B' });
      const folderBCount = folderB.locator('.folder-count');
      await expect(folderBCount).toHaveText('0');

      // Drag the note to Folder B
      const noteItem = page.locator('.note-item').first();
      await noteItem.dragTo(folderB);
      await page.waitForTimeout(500);

      // Folder A should now have 0 notes
      await expect(folderACount).toHaveText('0');

      // Folder B should now have 1 note
      await expect(folderBCount).toHaveText('1');
    });
  });

  test.describe('Tag Recognition with Whitespace', () => {
    test('should only recognize tags with whitespace before #', async ({ page }) => {
      // Create a note
      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      // Type text with # that should NOT be recognized as a tag (no whitespace)
      await page.keyboard.type('Check out file#123 and user#456');
      await page.waitForTimeout(1500);

      // No tags should appear in the sidebar
      const tagsList = page.locator('#tagsList');
      const tagItems = await tagsList.locator('.tag-item').count();
      expect(tagItems).toBe(0);

      // Now type actual tags with whitespace
      await page.keyboard.press('Enter');
      await page.keyboard.type('Now using #javascript and #typescript');
      await page.waitForTimeout(1500);

      // Two tags should appear
      await expect(tagsList.locator('.tag-item')).toHaveCount(2);
      await expect(tagsList.locator('.tag-item').filter({ hasText: '#javascript' })).toBeVisible();
      await expect(tagsList.locator('.tag-item').filter({ hasText: '#typescript' })).toBeVisible();
    });

    test('should recognize tags at the start of a line', async ({ page }) => {
      // Create a note
      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      // Type a tag at the start
      await page.keyboard.type('#firsttag should be recognized');
      await page.waitForTimeout(1500);

      // Tag should appear
      const tagsList = page.locator('#tagsList');
      await expect(tagsList.locator('.tag-item').filter({ hasText: '#firsttag' })).toBeVisible();
    });

    test('should recognize tags after newlines', async ({ page }) => {
      // Create a note
      await page.locator('.new-note-btn').click();
      const editor = page.locator('#editor .ProseMirror');
      await expect(editor).toBeFocused({ timeout: 5000 });
      await page.waitForTimeout(500);

      await page.keyboard.type('First line');
      await page.keyboard.press('Enter');
      await page.keyboard.type('#newtag on new line');
      await page.waitForTimeout(1500);

      // Tag should appear
      const tagsList = page.locator('#tagsList');
      await expect(tagsList.locator('.tag-item').filter({ hasText: '#newtag' })).toBeVisible();
    });
  });
});
