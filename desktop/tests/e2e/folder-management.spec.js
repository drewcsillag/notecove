import { test, expect } from '@playwright/test';

test.describe('Folder Management', () => {
  test.beforeEach(async ({ page }) => {
    // Use URL parameter for test mode (more reliable than localStorage)
    await page.goto('/?test-mode');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Add extra wait to ensure app is fully initialized
    await page.waitForTimeout(500);
  });

  test('should unnest folder by dragging to All Notes', async ({ page }) => {
    // Create a parent folder
    await page.locator('#newFolderBtn').click();
    let dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Parent Folder');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Select the parent folder
    const parentFolder = page.locator('.folder-item').filter({ hasText: 'Parent Folder' });
    await parentFolder.click();
    await page.waitForTimeout(200);

    // Create a child folder inside the parent
    // First, click new folder button
    await page.locator('#newFolderBtn').click();

    // Handle the confirm dialog asking if we want to create a subfolder
    const confirmBtn = page.locator('#dialogConfirm');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click(); // Click Yes to create subfolder
    await page.waitForTimeout(200);

    // Now handle the input dialog for folder name
    dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Child Folder');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Verify child folder is nested (has padding)
    const childFolder = page.locator('.folder-item').filter({ hasText: 'Child Folder' });
    await expect(childFolder).toBeVisible();

    // Get the parent's padding to verify it's at root level
    const parentPadding = await parentFolder.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseInt(style.paddingLeft);
    });

    // Get the child's padding to verify it's nested
    const childPaddingBefore = await childFolder.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseInt(style.paddingLeft);
    });

    // Child should have more padding than parent (indicating nesting)
    expect(childPaddingBefore).toBeGreaterThan(parentPadding);

    // Drag child folder to All Notes to unnest it
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await childFolder.dragTo(allNotes);
    await page.waitForTimeout(500);

    // Verify child folder is now at root level (same padding as parent)
    const childPaddingAfter = await childFolder.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseInt(style.paddingLeft);
    });

    expect(childPaddingAfter).toBe(parentPadding);

    // Verify status message
    const statusLeft = page.locator('.status-left');
    await expect(statusLeft).toHaveText('Moved folder to top level');
  });

  test('should rename folder via context menu', async ({ page }) => {
    // Create a test folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Old Name');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Right-click on the folder to trigger context menu
    const testFolder = page.locator('.folder-item').filter({ hasText: 'Old Name' });
    await testFolder.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Context menu should be visible
    const contextMenu = page.locator('#folderContextMenu');
    await expect(contextMenu).toBeVisible();

    // Mock the prompt to return new name
    await page.evaluate(() => {
      window.prompt = () => 'New Name';
    });

    // Click rename option
    const renameOption = page.locator('[data-action="rename"]');
    await renameOption.click();
    await page.waitForTimeout(500);

    // Folder should now have new name
    const renamedFolder = page.locator('.folder-item').filter({ hasText: 'New Name' });
    await expect(renamedFolder).toBeVisible();

    // Old name should not exist
    const oldFolder = page.locator('.folder-item').filter({ hasText: 'Old Name' });
    await expect(oldFolder).not.toBeVisible();

    // Verify status message
    const statusLeft = page.locator('.status-left');
    await expect(statusLeft).toHaveText('Renamed folder to "New Name"');
  });

  test('should move nested folder to root via context menu', async ({ page }) => {
    // Create a parent folder
    await page.locator('#newFolderBtn').click();
    let dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Parent');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Select the parent folder
    const parentFolder = page.locator('.folder-item').filter({ hasText: 'Parent' });
    await parentFolder.click();
    await page.waitForTimeout(200);

    // Create a child folder - handle two dialogs
    await page.locator('#newFolderBtn').click();

    // Handle confirm dialog for subfolder creation
    const confirmBtn = page.locator('#dialogConfirm');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await page.waitForTimeout(200);

    // Handle input dialog for folder name
    dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Nested Child');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Right-click on the nested folder using dispatchEvent
    const childFolder = page.locator('.folder-item').filter({ hasText: 'Nested Child' });
    await childFolder.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Context menu should be visible
    const contextMenu = page.locator('#folderContextMenu');
    await expect(contextMenu).toBeVisible();

    // "Move to Top Level" option should be enabled
    const moveToRootOption = page.locator('[data-action="move-to-root"]');
    await expect(moveToRootOption).not.toHaveClass(/disabled/);

    // Click "Move to Top Level"
    await moveToRootOption.click();
    await page.waitForTimeout(500);

    // Get padding levels to verify unnesting
    const parentPadding = await parentFolder.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseInt(style.paddingLeft);
    });

    const childPadding = await childFolder.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseInt(style.paddingLeft);
    });

    // Child should now have same padding as parent (both at root level)
    expect(childPadding).toBe(parentPadding);

    // Verify status message
    const statusLeft = page.locator('.status-left');
    await expect(statusLeft).toHaveText('Moved "Nested Child" to top level');
  });

  test('should disable "Move to Top Level" for root-level folders', async ({ page }) => {
    // Create a root-level folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Root Level Folder');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Right-click on the root-level folder using dispatchEvent
    const rootFolder = page.locator('.folder-item').filter({ hasText: 'Root Level Folder' });
    await rootFolder.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Context menu should be visible
    const contextMenu = page.locator('#folderContextMenu');
    await expect(contextMenu).toBeVisible();

    // "Move to Top Level" option should be disabled
    const moveToRootOption = page.locator('[data-action="move-to-root"]');
    await expect(moveToRootOption).toHaveClass(/disabled/);
  });

  test('should delete empty folder via context menu', async ({ page }) => {
    // Create a test folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Folder to Delete');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Right-click on the folder using dispatchEvent
    const testFolder = page.locator('.folder-item').filter({ hasText: 'Folder to Delete' });
    await testFolder.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Context menu should be visible
    const contextMenu = page.locator('#folderContextMenu');
    await expect(contextMenu).toBeVisible();

    // Mock confirm to return true
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Click delete option
    const deleteOption = page.locator('[data-action="delete"]');
    await deleteOption.click();
    await page.waitForTimeout(500);

    // Folder should no longer exist
    await expect(testFolder).not.toBeVisible();

    // Verify status message
    const statusLeft = page.locator('.status-left');
    await expect(statusLeft).toHaveText('Deleted folder "Folder to Delete"');
  });

  test('should prevent deleting folder with notes', async ({ page }) => {
    // Create a test folder
    await page.locator('#newFolderBtn').click();
    let dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Folder with Notes');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Select the folder
    const testFolder = page.locator('.folder-item').filter({ hasText: 'Folder with Notes' });
    await testFolder.click();
    await page.waitForTimeout(200);

    // Create a note in the folder
    await page.locator('.new-note-btn').click();
    await page.locator('#editor .ProseMirror').fill('Note in folder');
    await page.waitForTimeout(1500); // Wait for debounce
    await page.locator('.sidebar').click(); // Click away to save
    await page.waitForTimeout(300);

    // Mock alert to capture the message
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    // Right-click on the folder using dispatchEvent
    await testFolder.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Click delete option
    const deleteOption = page.locator('[data-action="delete"]');
    await deleteOption.click();
    await page.waitForTimeout(500);

    // Should show alert about folder containing notes
    expect(alertMessage).toContain('Cannot delete folder');
    expect(alertMessage).toContain('contains 1 note');

    // Folder should still exist
    await expect(testFolder).toBeVisible();
  });

  test('should prevent deleting folder with subfolders', async ({ page }) => {
    // Create a parent folder
    await page.locator('#newFolderBtn').click();
    let dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Parent with Child');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Select the parent folder
    const parentFolder = page.locator('.folder-item').filter({ hasText: 'Parent with Child' });
    await parentFolder.click();
    await page.waitForTimeout(200);

    // Create a child folder - handle two dialogs
    await page.locator('#newFolderBtn').click();

    // Handle confirm dialog for subfolder creation
    const confirmBtn = page.locator('#dialogConfirm');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await page.waitForTimeout(200);

    // Handle input dialog for folder name
    dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Child');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Mock alert to capture the message
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    // Right-click on the parent folder using dispatchEvent
    await parentFolder.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Click delete option
    const deleteOption = page.locator('[data-action="delete"]');
    await deleteOption.click();
    await page.waitForTimeout(500);

    // Should show alert about folder containing subfolders
    expect(alertMessage).toContain('Cannot delete folder');
    expect(alertMessage).toContain('contains subfolders');

    // Parent folder should still exist
    await expect(parentFolder).toBeVisible();
  });

  test('should not show context menu on special folders', async ({ page }) => {
    // Try to dispatch contextmenu event on "All Notes" (special folder)
    const allNotes = page.locator('.folder-item').filter({ hasText: 'All Notes' });
    await allNotes.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Context menu should NOT be visible (or should be hidden)
    const contextMenu = page.locator('#folderContextMenu');
    const isVisible = await contextMenu.isVisible();
    expect(isVisible).toBe(false);

    // Try to dispatch contextmenu event on "Recently Deleted" (special folder)
    const trashFolder = page.locator('.folder-item').filter({ hasText: 'Recently Deleted' });
    await trashFolder.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Context menu should still NOT be visible
    const isStillVisible = await contextMenu.isVisible();
    expect(isStillVisible).toBe(false);
  });

  test('should close context menu when clicking outside', async ({ page }) => {
    // Create a test folder
    await page.locator('#newFolderBtn').click();
    const dialogInput = page.locator('#dialogInput');
    await expect(dialogInput).toBeVisible();
    await dialogInput.fill('Test Folder');
    await page.locator('#dialogOk').click();
    await expect(dialogInput).toBeHidden();
    await page.waitForTimeout(300);

    // Right-click on the folder using dispatchEvent
    const testFolder = page.locator('.folder-item').filter({ hasText: 'Test Folder' });
    await testFolder.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);

    // Context menu should be visible
    const contextMenu = page.locator('#folderContextMenu');
    await expect(contextMenu).toBeVisible();

    // Click outside the context menu
    await page.locator('.sidebar').click();
    await page.waitForTimeout(200);

    // Context menu should be hidden
    await expect(contextMenu).not.toBeVisible();
  });
});
