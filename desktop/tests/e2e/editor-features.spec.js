import { test, expect } from '@playwright/test';

test.describe('Enhanced Editor Features', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Create a new note
    await page.locator('.new-note-btn').click();
  });

  test('should toggle task list with TODO/DONE/NOPE states', async ({ page }) => {
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Click task list button in toolbar
    await page.click('[data-action="taskList"]');

    // Wait for task list to be created
    const taskList = page.locator('ul[data-type="taskList"]');
    await expect(taskList).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);

    // Type task items
    await page.keyboard.type('First task item');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.keyboard.type('Second task item');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.keyboard.type('Third task item');
    await page.waitForTimeout(300);

    // Verify we have 3 task items
    const taskItems = page.locator('ul[data-type="taskList"] li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(3);

    // Get the first task item checkbox wrapper
    const firstTaskCheckbox = taskItems.nth(0).locator('label').first();

    // Initial state should be TODO (data-checked="todo")
    await expect(taskItems.nth(0)).toHaveAttribute('data-checked', 'todo');

    // Click once to change to DONE
    await firstTaskCheckbox.dispatchEvent('click');
    // Wait for the attribute to change
    await expect(taskItems.nth(0)).toHaveAttribute('data-checked', 'done', { timeout: 2000 });

    // Verify DONE state has checkmark styling
    const doneCheckbox = taskItems.nth(0).locator('.task-checkbox');
    await expect(doneCheckbox).toHaveClass(/done/);

    // Click again to change to NOPE
    await firstTaskCheckbox.dispatchEvent('click');
    await page.waitForTimeout(100);
    await expect(taskItems.nth(0)).toHaveAttribute('data-checked', 'nope');

    // Verify NOPE state has nope styling
    const nopeCheckbox = taskItems.nth(0).locator('.task-checkbox');
    await expect(nopeCheckbox).toHaveClass(/nope/);

    // Click again to cycle back to TODO
    await firstTaskCheckbox.dispatchEvent('click');
    await page.waitForTimeout(100);
    await expect(taskItems.nth(0)).toHaveAttribute('data-checked', 'todo');
  });

  test('should support image insertion via file picker', async ({ page }) => {
    // This test verifies that clicking the image button doesn't throw errors
    // Actual file selection would require setInputFiles() in a more complete test

    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Listen for file input creation (proves the button works)
    const fileInputPromise = page.waitForEvent('filechooser', { timeout: 5000 });

    // Click insert image button - this should trigger file chooser
    await page.click('[data-action="insertImage"]');

    // Wait for file chooser to appear
    const fileChooser = await fileInputPromise;

    // Verify file chooser accepts images
    await expect(fileChooser.isMultiple()).resolves.toBe(false);
  });

  test('should insert and edit tables', async ({ page }) => {
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Click insert table button (creates 3x3 table with header)
    await page.click('[data-action="insertTable"]');

    // Wait for table to be inserted
    await page.waitForTimeout(500);

    // Verify table was created
    const table = editor.locator('table');
    await expect(table).toBeVisible();

    // Verify table has 3 rows (1 header + 2 body)
    const rows = table.locator('tr');
    await expect(rows).toHaveCount(3);

    // Verify header row
    const headerCells = rows.nth(0).locator('th');
    await expect(headerCells).toHaveCount(3);

    // Verify body rows have 3 cells each
    const firstBodyRow = rows.nth(1).locator('td');
    await expect(firstBodyRow).toHaveCount(3);

    // Type in first cell
    const firstCell = table.locator('th').first();
    await firstCell.click();
    await page.keyboard.type('Header 1');

    // Verify text was entered
    await expect(firstCell).toContainText('Header 1');

    // Navigate to next cell with Tab
    await page.keyboard.press('Tab');
    await page.keyboard.type('Header 2');

    // Verify second header cell
    const secondCell = headerCells.nth(1);
    await expect(secondCell).toContainText('Header 2');
  });

  test('should support column resizing in tables', async ({ page }) => {
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Insert a table
    await page.click('[data-action="insertTable"]');
    await page.waitForTimeout(500);

    const table = editor.locator('table');
    await expect(table).toBeVisible();

    // Get first header cell
    const firstCell = table.locator('th').first();

    // Get initial width
    const initialBox = await firstCell.boundingBox();
    const initialWidth = initialBox.width;

    // Get the right edge of the cell for resizing
    const cellBox = await firstCell.boundingBox();
    const rightEdgeX = cellBox.x + cellBox.width - 5; // 5px from right edge
    const centerY = cellBox.y + cellBox.height / 2;

    // Simulate drag to resize
    await page.mouse.move(rightEdgeX, centerY);
    await page.mouse.down();
    await page.mouse.move(rightEdgeX + 100, centerY); // Drag 100px to the right
    await page.mouse.up();

    // Wait for resize to complete
    await page.waitForTimeout(200);

    // Get new width
    const newBox = await firstCell.boundingBox();
    const newWidth = newBox.width;

    // Verify column was resized (new width should be larger)
    expect(newWidth).toBeGreaterThan(initialWidth);
  });

  test('should maintain toolbar button active states', async ({ page }) => {
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Type some text
    await page.keyboard.type('Test text');

    // Select all text
    await page.keyboard.press('Control+a');

    // Click bold button
    const boldButton = page.locator('[data-action="bold"]');
    await boldButton.click();

    // Wait for state update
    await page.waitForTimeout(100);

    // Verify bold button is active
    await expect(boldButton).toHaveClass(/active/);

    // Click italic button
    const italicButton = page.locator('[data-action="italic"]');
    await italicButton.click();

    // Wait for state update
    await page.waitForTimeout(100);

    // Verify both bold and italic are active
    await expect(boldButton).toHaveClass(/active/);
    await expect(italicButton).toHaveClass(/active/);

    // Click bold again to toggle off
    await boldButton.click();
    await page.waitForTimeout(100);

    // Verify bold is no longer active but italic still is
    await expect(boldButton).not.toHaveClass(/active/);
    await expect(italicButton).toHaveClass(/active/);
  });

  test('should handle nested task lists', async ({ page }) => {
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Create task list
    await page.click('[data-action="taskList"]');
    await page.waitForTimeout(200);
    await page.keyboard.type('Parent task');
    await page.keyboard.press('Enter');

    // Indent to create nested item (Tab key)
    await page.keyboard.press('Tab');
    await page.keyboard.type('Child task');

    // Verify nested structure exists
    const taskList = page.locator('ul[data-type="taskList"]');
    await expect(taskList).toBeVisible();

    // Verify we have task items
    const taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(2);
  });

  test('should support keyboard shortcuts for task lists', async ({ page }) => {
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Use keyboard shortcut to create task list (Cmd+Shift+9 or Ctrl+Shift+9)
    const isMac = await page.evaluate(() => navigator.platform.includes('Mac'));
    const modKey = isMac ? 'Meta' : 'Control';

    await page.keyboard.press(`${modKey}+Shift+9`);
    await page.waitForTimeout(200);

    // Type task item
    await page.keyboard.type('Task from keyboard shortcut');

    // Verify task list was created
    const taskList = page.locator('ul[data-type="taskList"]');
    await expect(taskList).toBeVisible();

    const taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(1);
  });

  test('should persist task states after note switch', async ({ page }) => {
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Create task list with specific states
    await page.click('[data-action="taskList"]');
    await page.waitForTimeout(200);
    await page.keyboard.type('Task 1');

    // Wait for content to be saved
    await page.waitForTimeout(1500);

    // Set first task to DONE
    const firstTaskCheckbox = page.locator('li[data-type="taskItem"]').first().locator('label').first();
    await firstTaskCheckbox.dispatchEvent('click'); // TODO -> DONE
    await page.waitForTimeout(100);

    // Verify DONE state
    await expect(page.locator('li[data-type="taskItem"]').first()).toHaveAttribute('data-checked', 'done');

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Create a new note
    await page.click('button[title="New note"]');
    await page.waitForTimeout(500);

    // Go back to notes list and select the first note
    const notesList = page.locator('.note-item');
    const firstNote = notesList.first();
    await firstNote.click();
    await page.waitForTimeout(500);

    // Verify the task state persisted
    await expect(page.locator('li[data-type="taskItem"]').first()).toHaveAttribute('data-checked', 'done');
  });
});
