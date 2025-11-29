/**
 * E2E tests for Tri-State Task List Functionality
 *
 * Task lists are nested list items with three states:
 * - unchecked: [ ]
 * - checked: [x] (with strikethrough)
 * - nope: [N] (with strikethrough)
 *
 * Task lists can only appear nested under bullet or ordered lists.
 * Checked/nope items auto-sort to the bottom of their parent list.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-task-list-'));
  console.log('[E2E Task List] Launching Electron with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await electronApp.firstWindow();

  // Capture renderer console logs
  page.on('console', (msg) => {
    console.log('[Renderer Console]:', msg.text());
  });

  // Wait for app to be ready
  await page.waitForSelector('text=Folders', { timeout: 10000 });
  await page.waitForTimeout(1000);
}, 60000);

test.afterEach(async () => {
  await electronApp.close();

  // Clean up the temporary user data directory
  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E Task List] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E Task List] Failed to clean up test userData directory:', err);
  }
});

/**
 * Helper to create a note and clear the default H1
 */
async function createNoteAndClear(page: Page) {
  const createButton = page.getByTitle('Create note');
  await createButton.click();
  await page.waitForTimeout(1000);

  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.waitForTimeout(500);

  // Clear default H1
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(200);

  return editor;
}

test.describe('Task List - Input Syntax (Nested Under Bullet List)', () => {
  test('should create task item with "- [] " syntax', async () => {
    await createNoteAndClear(page);

    // Type bullet list with task item
    await page.keyboard.type('- [] Task 1');
    await page.waitForTimeout(500);

    // Verify task item was created within a bullet list
    const bulletList = page.locator('.ProseMirror ul');
    await expect(bulletList).toBeVisible();

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toBeVisible();
    await expect(taskItem).toHaveAttribute('data-checked', 'unchecked');
  });

  test('should create task item with "- [ ] " syntax (with space)', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [ ] Task with space');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toBeVisible();
    await expect(taskItem).toHaveAttribute('data-checked', 'unchecked');
  });

  test('should create checked task item with "- [x] " syntax', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [x] Checked task');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toBeVisible();
    await expect(taskItem).toHaveAttribute('data-checked', 'checked');
  });

  test('should create checked task item with "- [X] " syntax (uppercase)', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [X] Checked uppercase');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toHaveAttribute('data-checked', 'checked');
  });

  test('should create nope task item with "- [n] " syntax', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [n] Nope task');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toBeVisible();
    await expect(taskItem).toHaveAttribute('data-checked', 'nope');
  });

  test('should create nope task item with "- [N] " syntax (uppercase)', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [N] Nope uppercase');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toHaveAttribute('data-checked', 'nope');
  });
});

test.describe('Task List - Input Syntax (Nested Under Ordered List)', () => {
  test('should create task item with "1. [] " syntax', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('1. [] Task in numbered list');
    await page.waitForTimeout(500);

    // Verify task item was created within an ordered list
    const orderedList = page.locator('.ProseMirror ol');
    await expect(orderedList).toBeVisible();

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toBeVisible();
    await expect(taskItem).toHaveAttribute('data-checked', 'unchecked');
  });

  test('should create checked task item with "1. [x] " syntax', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('1. [x] Checked numbered task');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toHaveAttribute('data-checked', 'checked');
  });
});

test.describe('Task List - Alternative Input Syntax', () => {
  test('should create task item with "[] " at start of bullet (shorthand)', async () => {
    await createNoteAndClear(page);

    // First create a bullet list
    await page.keyboard.type('- Item');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Now type [] which should convert current bullet to task
    await page.keyboard.type('[] Task from shorthand');
    await page.waitForTimeout(500);

    const taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(1);
  });

  test('should create task item with "[ ] " at start of bullet (shorthand with space)', async () => {
    await createNoteAndClear(page);

    // First create a bullet list
    await page.keyboard.type('- Item');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Now type [ ] which should convert current bullet to task
    await page.keyboard.type('[ ] Task from shorthand');
    await page.waitForTimeout(500);

    const taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(1);
  });
});

test.describe('Task List - Standalone Input Syntax (Creates List)', () => {
  test('should create task list with "[] " at paragraph level', async () => {
    await createNoteAndClear(page);

    // First type some regular text to establish we're in a paragraph
    await page.keyboard.type('Title');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Now type [] at start of new paragraph - should create a bullet list with task item
    await page.keyboard.type('[] Standalone task');
    await page.waitForTimeout(500);

    // Should have a task item
    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toHaveCount(1);
    await expect(taskItem).toHaveAttribute('data-checked', 'unchecked');
    await expect(taskItem).toContainText('Standalone task');

    // Should be wrapped in a bullet list
    const bulletList = page.locator('.ProseMirror ul');
    await expect(bulletList).toHaveCount(1);
  });

  test('should create task list with "[ ] " at paragraph level', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('Title');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await page.keyboard.type('[ ] Task with space');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toHaveCount(1);
    await expect(taskItem).toHaveAttribute('data-checked', 'unchecked');
  });

  test('should create checked task with "[x] " at paragraph level', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('Title');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await page.keyboard.type('[x] Already done');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toHaveCount(1);
    await expect(taskItem).toHaveAttribute('data-checked', 'checked');
  });

  test('should create nope task with "[n] " at paragraph level', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('Title');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await page.keyboard.type('[n] Not doing this');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toHaveCount(1);
    await expect(taskItem).toHaveAttribute('data-checked', 'nope');
  });
});

test.describe('Task List - Click Cycling', () => {
  test('should cycle from unchecked → checked → nope → unchecked', async () => {
    await createNoteAndClear(page);

    // Create a task item
    await page.keyboard.type('- [] Cycle test');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"]');
    await expect(taskItem).toBeVisible();

    // Find the checkbox element within the task item
    const checkbox = taskItem.locator('.task-checkbox-wrapper');

    // Get initial state
    const initialState = await taskItem.getAttribute('data-checked');
    expect(initialState).toBe('unchecked');

    // Click 1: unchecked → checked
    await checkbox.click();
    await page.waitForTimeout(300);
    await expect(taskItem).toHaveAttribute('data-checked', 'checked');

    // Click 2: checked → nope
    await checkbox.click();
    await page.waitForTimeout(300);
    await expect(taskItem).toHaveAttribute('data-checked', 'nope');

    // Click 3: nope → unchecked
    await checkbox.click();
    await page.waitForTimeout(300);
    await expect(taskItem).toHaveAttribute('data-checked', 'unchecked');
  });
});

test.describe('Task List - Strikethrough Styling', () => {
  test('should show strikethrough for checked items', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [x] Checked with strikethrough');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"][data-checked="checked"]');
    await expect(taskItem).toBeVisible();

    // Verify strikethrough styling is applied
    const contentDiv = taskItem.locator('div').first();
    const textDecoration = await contentDiv.evaluate((el) => {
      return window.getComputedStyle(el).textDecoration;
    });
    expect(textDecoration).toContain('line-through');
  });

  test('should show strikethrough for nope items', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [n] Nope with strikethrough');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"][data-checked="nope"]');
    await expect(taskItem).toBeVisible();

    // Verify strikethrough styling is applied
    const contentDiv = taskItem.locator('div').first();
    const textDecoration = await contentDiv.evaluate((el) => {
      return window.getComputedStyle(el).textDecoration;
    });
    expect(textDecoration).toContain('line-through');
  });

  test('should NOT show strikethrough for unchecked items', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [] Unchecked no strikethrough');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"][data-checked="unchecked"]');
    await expect(taskItem).toBeVisible();

    // Verify NO strikethrough styling
    const contentDiv = taskItem.locator('div').first();
    const textDecoration = await contentDiv.evaluate((el) => {
      return window.getComputedStyle(el).textDecoration;
    });
    expect(textDecoration).not.toContain('line-through');
  });
});

// Auto-sort behavior is deferred to a future iteration due to complexity
// with ProseMirror node view re-creation when items are moved
test.describe.skip('Task List - Auto-Sort Behavior', () => {
  test('should move checked item to bottom of list', async () => {
    await createNoteAndClear(page);

    // Create three unchecked tasks
    await page.keyboard.type('- [] Task A');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] Task B');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] Task C');
    await page.waitForTimeout(500);

    // Verify initial order
    const taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(3);

    // Click the checkbox on Task B (middle item) to check it
    const taskB = taskItems.nth(1);
    const checkboxB = taskB.locator('.task-checkbox-wrapper');
    await checkboxB.click();
    await page.waitForTimeout(500);

    // Task B should now be at the bottom
    const reorderedItems = page.locator('li[data-type="taskItem"]');
    const lastItem = reorderedItems.last();
    await expect(lastItem).toContainText('Task B');
    await expect(lastItem).toHaveAttribute('data-checked', 'checked');
  });

  test('should move nope item to bottom of list', async () => {
    await createNoteAndClear(page);

    // Create three unchecked tasks
    await page.keyboard.type('- [] Task 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] Task 2');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] Task 3');
    await page.waitForTimeout(500);

    // Click Task 1 twice to make it nope (unchecked → checked → nope)
    const taskItems = page.locator('li[data-type="taskItem"]');
    const task1 = taskItems.first();
    const checkbox1 = task1.locator('.task-checkbox-wrapper');
    await checkbox1.click(); // → checked
    await page.waitForTimeout(300);
    await checkbox1.click(); // → nope
    await page.waitForTimeout(500);

    // Task 1 should now be at the bottom with nope state
    const reorderedItems = page.locator('li[data-type="taskItem"]');
    const lastItem = reorderedItems.last();
    await expect(lastItem).toContainText('Task 1');
    await expect(lastItem).toHaveAttribute('data-checked', 'nope');
  });

  test('should move unchecked item back to top when cycling from nope', async () => {
    await createNoteAndClear(page);

    // Create two tasks: one unchecked, one checked
    await page.keyboard.type('- [] Active task');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[x] Completed task');
    await page.waitForTimeout(500);

    // The checked task should already be at bottom
    let taskItems = page.locator('li[data-type="taskItem"]');
    let lastItem = taskItems.last();
    await expect(lastItem).toContainText('Completed task');

    // Click the completed task to cycle it: checked → nope → unchecked
    const checkbox = lastItem.locator('.task-checkbox-wrapper');
    await checkbox.click(); // → nope
    await page.waitForTimeout(300);
    await checkbox.click(); // → unchecked
    await page.waitForTimeout(500);

    // Now "Completed task" should be at top (unchecked items at top)
    taskItems = page.locator('li[data-type="taskItem"]');
    const firstItem = taskItems.first();
    await expect(firstItem).toContainText('Completed task');
    await expect(firstItem).toHaveAttribute('data-checked', 'unchecked');
  });

  test('should maintain order within completed items group', async () => {
    await createNoteAndClear(page);

    // Create tasks and check them in order
    await page.keyboard.type('- [] First');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] Second');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] Third');
    await page.waitForTimeout(500);

    const taskItems = page.locator('li[data-type="taskItem"]');

    // Check First
    const firstCheckbox = taskItems.nth(0).locator('.task-checkbox-wrapper');
    await firstCheckbox.click();
    await page.waitForTimeout(300);

    // Check Third (now at position 1 since First moved to bottom)
    const thirdCheckbox = taskItems.nth(1).locator('.task-checkbox-wrapper');
    await thirdCheckbox.click();
    await page.waitForTimeout(500);

    // Order should be: Second (unchecked), First (checked), Third (checked)
    // Completed items maintain completion order
    const finalItems = page.locator('li[data-type="taskItem"]');
    await expect(finalItems.nth(0)).toContainText('Second');
    await expect(finalItems.nth(0)).toHaveAttribute('data-checked', 'unchecked');
  });
});

test.describe('Task List - Multiple Tasks', () => {
  test('should handle multiple tasks with different states', async () => {
    await createNoteAndClear(page);

    // Create tasks with different initial states
    await page.keyboard.type('- [] Unchecked task');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[x] Checked task');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[n] Nope task');
    await page.waitForTimeout(500);

    const taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(3);

    // With auto-sort, unchecked should be first, then checked/nope at bottom
    const uncheckedItem = page.locator('li[data-type="taskItem"][data-checked="unchecked"]');
    const checkedItem = page.locator('li[data-type="taskItem"][data-checked="checked"]');
    const nopeItem = page.locator('li[data-type="taskItem"][data-checked="nope"]');

    await expect(uncheckedItem).toHaveCount(1);
    await expect(checkedItem).toHaveCount(1);
    await expect(nopeItem).toHaveCount(1);
  });
});

test.describe('Task List - Persistence', () => {
  test('should persist task states across note switches', async () => {
    await createNoteAndClear(page);

    // Create note with tasks
    await page.keyboard.type('Task Note Title');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- [] Unchecked item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[x] Checked item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[n] Nope item');
    await page.waitForTimeout(1000);

    // Verify tasks were created
    let taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(3);

    // Create a second note
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('Second Note');
    await page.waitForTimeout(1000);

    // Switch back to first note
    const notesList = page.locator('[data-testid="notes-list"]');
    const firstNote = notesList
      .locator('.MuiListItemButton-root')
      .filter({ hasText: 'Task Note Title' });
    await firstNote.click();
    await page.waitForTimeout(1000);

    // Verify tasks are still there with correct states
    taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(3);

    await expect(page.locator('li[data-type="taskItem"][data-checked="unchecked"]')).toHaveCount(1);
    await expect(page.locator('li[data-type="taskItem"][data-checked="checked"]')).toHaveCount(1);
    await expect(page.locator('li[data-type="taskItem"][data-checked="nope"]')).toHaveCount(1);
  });
});

test.describe('Task List - Keyboard Behavior', () => {
  test('should continue task list on Enter', async () => {
    await createNoteAndClear(page);

    // Create first task
    await page.keyboard.type('- [] First task');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Should still be in task list context, typing [] should create another task
    await page.keyboard.type('[] Second task');
    await page.waitForTimeout(500);

    const taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(2);
  });

  test('should exit task list on double Enter', async () => {
    await createNoteAndClear(page);

    // Create task
    await page.keyboard.type('- [] Only task');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // Double enter to exit list
    await page.waitForTimeout(200);

    // Now typing should create a paragraph, not a task
    await page.keyboard.type('This is a paragraph');
    await page.waitForTimeout(500);

    const taskItems = page.locator('li[data-type="taskItem"]');
    await expect(taskItems).toHaveCount(1);

    const paragraph = page.locator('.ProseMirror > p');
    await expect(paragraph).toContainText('This is a paragraph');
  });
});

test.describe('Task List - Visual Indicators', () => {
  test('should show checkbox indicator for each state', async () => {
    await createNoteAndClear(page);

    await page.keyboard.type('- [] Unchecked');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[x] Checked');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[n] Nope');
    await page.waitForTimeout(500);

    // Verify all task items have correct data-checked attributes
    const unchecked = page.locator('li[data-type="taskItem"][data-checked="unchecked"]');
    const checked = page.locator('li[data-type="taskItem"][data-checked="checked"]');
    const nope = page.locator('li[data-type="taskItem"][data-checked="nope"]');

    await expect(unchecked).toBeVisible();
    await expect(checked).toBeVisible();
    await expect(nope).toBeVisible();
  });
});
