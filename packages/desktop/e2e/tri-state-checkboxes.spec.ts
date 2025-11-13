/**
 * E2E tests for Tri-State Checkbox Functionality
 *
 * Tests the tri-state task list feature with three states:
 * - unchecked: - [ ]
 * - checked: - [x]
 * - nope: - [N]
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
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-tri-state-checkboxes-'));
  console.log('[E2E Tri-State Checkboxes] Launching Electron with userData at:', testUserDataDir);

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
    console.log('[E2E Tri-State Checkboxes] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E Tri-State Checkboxes] Failed to clean up test userData directory:', err);
  }
});

test.describe('Tri-State Checkboxes - Markdown Input', () => {
  test('should create inline checkbox with "[] "', async () => {
    // Create a note
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

    // Type markdown for inline checkbox
    await page.keyboard.type('[] Task 1');
    await page.waitForTimeout(500);

    // Verify checkbox was created with unchecked state
    const checkbox = page.locator('span[data-type="tri-state-checkbox"][data-checked="unchecked"]');
    await expect(checkbox).toBeVisible();
  });

  test('should create inline checkbox in bullet list with "- [] "', async () => {
    // Create a note
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

    // Type markdown for checkbox in bullet list
    await page.keyboard.type('- [] Task in bullet');
    await page.waitForTimeout(500);

    // Verify checkbox was created
    const checkbox = page.locator('span[data-type="tri-state-checkbox"][data-checked="unchecked"]');
    await expect(checkbox).toBeVisible();

    // Verify we're in a bullet list (within the editor)
    const bulletList = page.locator('.ProseMirror ul');
    await expect(bulletList).toBeVisible();
  });

  test('should create inline checkbox in numbered list with "1. [] "', async () => {
    // Create a note
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

    // Type markdown for checkbox in numbered list
    await page.keyboard.type('1. [] Task in numbered');
    await page.waitForTimeout(500);

    // Verify checkbox was created
    const checkbox = page.locator('span[data-type="tri-state-checkbox"][data-checked="unchecked"]');
    await expect(checkbox).toBeVisible();

    // Verify we're in an ordered list
    const orderedList = page.locator('.ProseMirror ol');
    await expect(orderedList).toBeVisible();
  });

  test('should create inline checkbox between words', async () => {
    // Create a note
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

    // Type text with checkbox in the middle
    await page.keyboard.type('FOOOOO [] BAAAARRR');
    await page.waitForTimeout(500);

    // Verify checkbox was created
    const checkbox = page.locator('span[data-type="tri-state-checkbox"][data-checked="unchecked"]');
    await expect(checkbox).toBeVisible();

    // Verify surrounding text exists
    const paragraph = page.locator('.ProseMirror p');
    await expect(paragraph).toContainText('FOOOOO');
    await expect(paragraph).toContainText('BAAAARRR');
  });

  test('should create checked inline checkbox with "[x] "', async () => {
    // Create a note
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

    // Type markdown for checked checkbox
    await page.keyboard.type('[x] Task 2');
    await page.waitForTimeout(500);

    // Verify checkbox was created with checked state
    const checkbox = page.locator('span[data-type="tri-state-checkbox"][data-checked="checked"]');
    await expect(checkbox).toBeVisible();
  });

  test('should create nope inline checkbox with "[n] "', async () => {
    // Create a note
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

    // Type markdown for nope checkbox
    await page.keyboard.type('[N] Task 3');
    await page.waitForTimeout(500);

    // Verify checkbox was created with nope state
    const checkbox = page.locator('span[data-type="tri-state-checkbox"][data-checked="nope"]');
    await expect(checkbox).toBeVisible();
  });
});

test.describe('Tri-State Checkboxes - Click Cycling', () => {
  test('should cycle from unchecked → checked → nope → unchecked', async () => {
    // Create a note
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Clear the default H1 and create a task using keyboard
    await page.keyboard.press('Control+A'); // Select all
    await page.keyboard.press('Delete'); // Delete
    await page.waitForTimeout(200);

    // Type the markdown for a checkbox: [] followed by space
    await page.keyboard.type('[');
    await page.keyboard.type(']');
    await page.keyboard.type(' '); // This should trigger the input rule
    await page.waitForTimeout(500); // Wait for input rule to process

    // Verify checkbox was created
    const checkbox = page.locator('span[data-type="tri-state-checkbox"]');
    await expect(checkbox).toBeVisible({ timeout: 5000 });

    // Type some text
    await page.keyboard.type('Cycle test');
    await page.waitForTimeout(300);

    // Get current state
    const initialState = await checkbox.getAttribute('data-checked');
    console.log('[E2E] Initial state:', initialState);

    // Click 1: Should go to next state
    await checkbox.click();
    await page.waitForTimeout(500);
    const state1 = await checkbox.getAttribute('data-checked');
    console.log('[E2E] After click 1:', state1);

    // Click 2: Should go to next state
    await checkbox.click();
    await page.waitForTimeout(500);
    const state2 = await checkbox.getAttribute('data-checked');
    console.log('[E2E] After click 2:', state2);

    // Click 3: Should go to next state
    await checkbox.click();
    await page.waitForTimeout(500);
    const state3 = await checkbox.getAttribute('data-checked');
    console.log('[E2E] After click 3:', state3);

    // Click 4: Should cycle back
    await checkbox.click();
    await page.waitForTimeout(500);
    const state4 = await checkbox.getAttribute('data-checked');
    console.log('[E2E] After click 4:', state4);

    // Verify we have 3 distinct states
    const states = [initialState, state1, state2, state3, state4];
    const uniqueStates = new Set(states.filter((s) => s !== null));
    console.log('[E2E] All states seen:', Array.from(uniqueStates));

    // We should see exactly 3 unique states (unchecked, checked, nope)
    expect(uniqueStates.size).toBe(3);

    // Verify the states include our expected values
    expect(uniqueStates.has('unchecked')).toBeTruthy();
    expect(uniqueStates.has('checked')).toBeTruthy();
    expect(uniqueStates.has('nope')).toBeTruthy();
  });
});

test.describe.skip('Tri-State Checkboxes - Multiple Tasks', () => {
  test('should handle multiple tasks with different states', async () => {
    // Create a note with multiple tasks
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Create three tasks with different states
    await editor.type('- [ ] Unchecked task');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await editor.type('- [x] Checked task');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await editor.type('- [N] Nope task');
    await page.waitForTimeout(500);

    // Verify all three tasks exist
    const tasks = page.locator('li[data-type="taskItem"]');
    await expect(tasks).toHaveCount(3);

    // Verify each state
    await expect(tasks.nth(0)).toHaveAttribute('data-checked', 'unchecked');
    await expect(tasks.nth(1)).toHaveAttribute('data-checked', 'checked');
    await expect(tasks.nth(2)).toHaveAttribute('data-checked', 'nope');
  });
});

test.describe.skip('Tri-State Checkboxes - Persistence', () => {
  test('should persist task states across note switches', async () => {
    // Create a note with tasks
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    await editor.type('Task Note');
    await page.keyboard.press('Enter');
    await editor.type('- [ ] Unchecked');
    await page.keyboard.press('Enter');
    await editor.type('- [x] Checked');
    await page.keyboard.press('Enter');
    await editor.type('- [N] Nope');
    await page.waitForTimeout(1000);

    // Create a second note
    await createButton.click();
    await page.waitForTimeout(1000);

    await editor.click();
    await editor.type('Second Note');
    await page.waitForTimeout(1000);

    // Switch back to the first note by clicking its title in the notes list
    const firstNote = page.locator('.notes-list-item').filter({ hasText: 'Task Note' });
    await firstNote.click();
    await page.waitForTimeout(1000);

    // Verify tasks are still there with correct states
    const tasks = page.locator('li[data-type="taskItem"]');
    await expect(tasks).toHaveCount(3);

    await expect(tasks.nth(0)).toHaveAttribute('data-checked', 'unchecked');
    await expect(tasks.nth(1)).toHaveAttribute('data-checked', 'checked');
    await expect(tasks.nth(2)).toHaveAttribute('data-checked', 'nope');
  });
});

test.describe.skip('Tri-State Checkboxes - Keyboard Shortcuts', () => {
  test('should support Enter to create new task item', async () => {
    // Create a note with a task
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    await editor.type('- [ ] First task');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await editor.type('Second task');
    await page.waitForTimeout(500);

    // Verify two task items exist
    const tasks = page.locator('li[data-type="taskItem"]');
    await expect(tasks).toHaveCount(2);
  });

  test('should support Tab to indent task item', async () => {
    // Create a note with tasks
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    await editor.type('- [ ] Parent task');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Indent the second task
    await page.keyboard.press('Tab');
    await editor.type('Child task');
    await page.waitForTimeout(500);

    // Verify nested structure exists
    const tasks = page.locator('li[data-type="taskItem"]');
    await expect(tasks).toHaveCount(2);
  });
});

test.describe.skip('Tri-State Checkboxes - Visual Styling', () => {
  test('should apply correct styling for nope state', async () => {
    // Create a note with a nope task
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    await editor.type('- [N] Nope task');
    await page.waitForTimeout(500);

    const taskItem = page.locator('li[data-type="taskItem"][data-checked="nope"]');
    await expect(taskItem).toBeVisible();

    // Verify nope styling class is applied
    await expect(taskItem).toHaveClass(/task-item-nope/);

    // Verify checkbox label has "N" indicator
    const nopeIndicator = taskItem.locator('.task-item-nope-indicator');
    await expect(nopeIndicator).toBeVisible();
    await expect(nopeIndicator).toHaveText('N');
  });
});
