import { test, expect } from '@playwright/test';

test.describe('Folder Organization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to start fresh
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

  test('should display default folders', async ({ page }) => {
    // Wait for folder tree to be visible
    const folderTree = page.locator('#folderTree');
    await expect(folderTree).toBeVisible();

    // Should have "All Notes" folder
    const allNotesFolder = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await expect(allNotesFolder).toBeVisible();

    // Should have "Recently Deleted" (trash) folder
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await expect(trashFolder).toBeVisible();
  });

  test('should create a new folder', async ({ page }) => {
    // Click the new folder button
    const newFolderBtn = page.locator('#newFolderBtn');
    await newFolderBtn.click();

    // Wait for dialog to appear
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();

    // Fill in the dialog input
    await dialogInput.fill('My Test Folder');

    // Click OK button
    const okButton = page.locator('#dialogOk');
    await okButton.click();

    // Wait for dialog to disappear
    await expect(dialogInput).toBeHidden();

    // Check if the folder appears in the tree
    const testFolder = page.locator('.folder-item').filter({ hasText: 'My Test Folder' });
    await expect(testFolder).toBeVisible();
  });

  test('should select a folder and show it as active', async ({ page }) => {
    // Create a test folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Selected Folder');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();

    // Click on the folder
    const testFolder = page.locator('.folder-item').filter({ hasText: 'Selected Folder' });
    await testFolder.click();

    // Folder should have active class
    await expect(testFolder).toHaveClass(/active/);
  });

  test('should filter notes by selected folder', async ({ page }) => {
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

    // Select Folder A
    const folderA = page.locator('.folder-item').filter({ hasText: 'Folder A' });
    await folderA.click();
    await page.waitForTimeout(200);

    // Create a note in Folder A
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Note in Folder A');
    await page.waitForTimeout(1500); // Wait for debounce

    // Click away to save
    await page.locator('.sidebar').click();
    await page.waitForTimeout(300);

    // Select Folder B
    const folderB = page.locator('.folder-item').filter({ hasText: 'Folder B' });
    await folderB.click();
    await page.waitForTimeout(200);

    // Should show "No notes yet"
    const emptyMessage = page.locator('.notes-list').getByText(/No notes yet/);
    await expect(emptyMessage).toBeVisible();

    // Go back to Folder A
    await folderA.click();
    await page.waitForTimeout(200);

    // Should show the note
    const note = page.locator('.note-item').filter({ hasText: 'Note in Folder A' });
    await expect(note).toBeVisible();
  });

  test('should create new notes in the selected folder', async ({ page }) => {
    // Create a folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Project Notes');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();

    // Select the folder
    const projectFolder = page.locator('.folder-item').filter({ hasText: 'Project Notes' });
    await projectFolder.click();
    await page.waitForTimeout(200);

    // Create a new note
    await page.locator('#newNoteBtn').click();
    await page.locator('#editor .ProseMirror').fill('Project note content');
    await page.waitForTimeout(1500);

    // Click away and go to All Notes
    await page.locator('.sidebar').click();
    await page.waitForTimeout(300);

    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await page.waitForTimeout(200);

    // Note should be visible in All Notes
    const note = page.locator('.note-item').filter({ hasText: 'Project note content' });
    await expect(note).toBeVisible();

    // Go back to Project Notes folder - should still see it there
    await projectFolder.click();
    await page.waitForTimeout(200);
    await expect(note).toBeVisible();
  });

  test('should show trash folder icon', async ({ page }) => {
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await expect(trashFolder).toBeVisible();

    // Check for trash icon
    const trashIcon = trashFolder.locator('.folder-icon');
    await expect(trashIcon).toHaveText('🗑️');
  });
});

test.describe('Drag and Drop', () => {
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

  test('should make notes draggable', async ({ page }) => {
    // Create a note
    await page.locator('.new-note-btn').click();

    // Wait for editor to be ready and focused
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Draggable Note');
    await page.waitForTimeout(1500);

    // Check if note item has draggable attribute
    const noteItem = page.locator('.note-item').filter({ hasText: 'Draggable Note' });
    await expect(noteItem).toHaveAttribute('draggable', 'true');
  });

  test('should move note between folders via drag and drop', async ({ page }) => {
    // Create a folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Target Folder');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();

    // Create a note in All Notes
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await page.waitForTimeout(200);

    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Note to Move');
    await page.waitForTimeout(1500);

    // Click away to save
    await page.locator('.sidebar').click();
    await page.waitForTimeout(300);

    // Drag the note to Target Folder
    const noteItem = page.locator('.note-item').filter({ hasText: 'Note to Move' });
    const targetFolder = page.locator('.folder-item').filter({ hasText: 'Target Folder' });

    await noteItem.dragTo(targetFolder);
    await page.waitForTimeout(500);

    // Select Target Folder
    await targetFolder.click();
    await page.waitForTimeout(200);

    // Note should be visible in Target Folder
    await expect(noteItem).toBeVisible();

    // Go back to All Notes - note should still be in all notes view
    await allNotes.click();
    await page.waitForTimeout(200);
    await expect(noteItem).toBeVisible();
  });

  test('should allow dragging notes from trash to folders for restore', async ({ page }) => {
    // Create a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Note to Delete');
    await page.waitForTimeout(1500);

    // Delete the note using delete button
    await page.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });
    const deleteBtn = page.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Go to trash
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await page.waitForTimeout(200);

    // Note should be draggable for restore
    const noteItem = page.locator('.note-item').filter({ hasText: 'Note to Delete' });
    await expect(noteItem).toHaveAttribute('draggable', 'true');
  });
});

test.describe('Trash Functionality', () => {
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

  test('should show restore and delete buttons in trash view', async ({ page }) => {
    // Create and delete a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Deleted Note');
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = page.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Go to trash
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await page.waitForTimeout(200);

    // Should see restore and delete buttons
    const restoreBtn = page.locator('.restore-btn').first();
    const permDeleteBtn = page.locator('.delete-btn').first();

    await expect(restoreBtn).toBeVisible();
    await expect(permDeleteBtn).toBeVisible();
  });

  test('should restore note from trash', async ({ page }) => {
    // Create and delete a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Restore Me');
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = page.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    const noteItem = page.locator('.note-item').filter({ hasText: 'Restore Me' });

    // Go to trash
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await page.waitForTimeout(200);

    // Click restore button
    const restoreBtn = page.locator('.restore-btn').first();
    await restoreBtn.click();
    await page.waitForTimeout(500);

    // Note should not be in trash anymore
    await expect(noteItem).not.toBeVisible();

    // Go to All Notes
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await page.waitForTimeout(200);

    // Note should be restored
    await expect(noteItem).toBeVisible();
  });

  test('should permanently delete note from trash', async ({ page }) => {
    // Create and delete a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Delete Forever');
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = page.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    const noteItem = page.locator('.note-item').filter({ hasText: 'Delete Forever' });

    // Go to trash
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await page.waitForTimeout(200);

    // Click permanent delete button
    const permDeleteBtn = page.locator('.delete-btn').first();
    await permDeleteBtn.click();
    await page.waitForTimeout(500);

    // Note should not be in trash
    await expect(noteItem).not.toBeVisible();

    // Go to All Notes - note should not be there either
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await page.waitForTimeout(200);

    await expect(noteItem).not.toBeVisible();
  });

  test('should cancel delete when user declines confirmation', async ({ page }) => {
    // Create a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Keep This Note');
    await page.waitForTimeout(1500);

    // Click the delete button
    const deleteBtn = page.locator('#deleteNoteBtn');

    // Mock the custom confirm dialog to click Cancel
    await page.evaluate(() => {
      window.app.showConfirmDialog = async () => false;
    });

    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Note should still be visible in notes list
    const noteItem = page.locator('.note-item').filter({ hasText: 'Keep This Note' });
    await expect(noteItem).toBeVisible();

    // Should not be in trash
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await page.waitForTimeout(200);

    await expect(noteItem).not.toBeVisible();
  });

  test('should not show deleted notes in All Notes view', async ({ page }) => {
    // Create a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Note to Hide');
    await page.waitForTimeout(1500);

    // Delete the note
    await page.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = page.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Go to All Notes
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await page.waitForTimeout(200);

    // Note should NOT be visible in All Notes
    const noteItem = page.locator('.note-item').filter({ hasText: 'Note to Hide' });
    await expect(noteItem).not.toBeVisible();

    // But should be visible in trash
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await page.waitForTimeout(200);

    await expect(noteItem).toBeVisible();
  });

  test('should not show permanently deleted notes anywhere', async ({ page }) => {
    // Create and delete a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Gone Forever');
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = page.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Go to trash and permanently delete
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await page.waitForTimeout(200);

    const permDeleteBtn = page.locator('.delete-btn').first();
    await permDeleteBtn.click();
    await page.waitForTimeout(500);

    // Should not be in trash
    const noteItem = page.locator('.note-item').filter({ hasText: 'Gone Forever' });
    await expect(noteItem).not.toBeVisible();

    // Go to All Notes - should not be there either
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await page.waitForTimeout(200);

    await expect(noteItem).not.toBeVisible();
  });

  test('should restore note from trash via drag-and-drop to folder', async ({ page }) => {
    // Create a folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Restore Folder');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();

    // Create and delete a note
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Restore via Drag');
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      window.app.showConfirmDialog = async () => true;
    });

    const deleteBtn = page.locator('#deleteNoteBtn');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Go to trash
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.click();
    await page.waitForTimeout(200);

    // Drag note to the restore folder
    const noteItem = page.locator('.note-item').filter({ hasText: 'Restore via Drag' });
    const restoreFolder = page.locator('.folder-item').filter({ hasText: 'Restore Folder' });

    await noteItem.dragTo(restoreFolder);
    await page.waitForTimeout(500);

    // Note should not be in trash anymore
    await expect(noteItem).not.toBeVisible();

    // Go to restore folder - note should be there
    await restoreFolder.click();
    await page.waitForTimeout(200);

    await expect(noteItem).toBeVisible();

    // Note should also appear in All Notes
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.click();
    await page.waitForTimeout(200);

    await expect(noteItem).toBeVisible();
  });

  test('should not allow single-click to double-select notes', async ({ page }) => {
    // Create two notes
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('First Note');
    await page.waitForTimeout(1500);

    await page.locator('.sidebar').click();
    await page.waitForTimeout(200);

    await page.locator('#newNoteBtn').click();
    await page.locator('#editor .ProseMirror').fill('Second Note');
    await page.waitForTimeout(1500);

    // Click on first note once
    const firstNote = page.locator('.note-item').filter({ hasText: 'First Note' });
    await firstNote.click();
    await page.waitForTimeout(200);

    // Editor should show first note content
    const editorText = await page.locator('#editor .ProseMirror').textContent();
    expect(editorText).toContain('First Note');

    // First note should be active
    await expect(firstNote).toHaveClass(/active/);
  });
});
