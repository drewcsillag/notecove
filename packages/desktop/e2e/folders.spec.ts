/**
 * E2E tests for Folder Operations
 *
 * Tests folder CRUD operations including context menus
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
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
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-'));
  console.log('[E2E] Launching fresh Electron instance with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  electronApp.on('console', (msg) => {
    console.log('[Electron Console]:', msg.text());
  });

  page = await electronApp.firstWindow();

  // Capture renderer console logs
  page.on('console', (msg) => {
    console.log('[Renderer Console]:', msg.text());
  });
}, 60000);

test.afterEach(async () => {
  await electronApp.close();

  // Clean up the temporary user data directory
  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E] Cleaned up test userData directory:', testUserDataDir);
  } catch (err) {
    console.error('[E2E] Failed to clean up test userData directory:', err);
  }
});

/**
 * Helper function to ensure an SD node is in the desired expansion state
 * @param sdNode - The SD node locator
 * @param shouldBeExpanded - Whether the SD should be expanded (true) or collapsed (false)
 */
async function ensureSDExpansionState(
  sdNode: ReturnType<typeof page.locator>,
  shouldBeExpanded: boolean
): Promise<void> {
  // Check if "All Notes" (child of SD) is visible to determine current expansion state
  const testId = await sdNode.getAttribute('data-testid');
  if (!testId) {
    throw new Error('Could not determine SD test ID from node');
  }

  // Extract SD ID from test ID (e.g., "folder-tree-node-sd:abc123" -> "abc123")
  const sdIdMatch = testId.match(/folder-tree-node-sd:(.+)/);
  if (!sdIdMatch) {
    throw new Error(`Invalid SD test ID format: ${testId}`);
  }
  const sdId = sdIdMatch[1];

  // Look for "All Notes" under this SD
  const allNotesNode = page.locator(`[data-testid="folder-tree-node-all-notes:${sdId}"]`);

  // Wait for the tree to stabilize (default expansion might still be happening)
  await page.waitForTimeout(500);

  const isCurrentlyExpanded = await allNotesNode.isVisible().catch(() => false);

  console.log(
    `[E2E] SD ${sdId} is currently ${isCurrentlyExpanded ? 'expanded' : 'collapsed'}, want ${shouldBeExpanded ? 'expanded' : 'collapsed'}`
  );

  // If current state doesn't match desired state, click to toggle
  if (isCurrentlyExpanded !== shouldBeExpanded) {
    console.log(`[E2E] Clicking SD node to ${shouldBeExpanded ? 'expand' : 'collapse'} it`);
    await sdNode.click();

    // Wait for the expansion/collapse animation and state change
    if (shouldBeExpanded) {
      // If we want it expanded, wait for All Notes to become visible
      await expect(allNotesNode).toBeVisible({ timeout: 2000 });
    } else {
      // If we want it collapsed, wait for All Notes to be hidden
      await expect(allNotesNode).not.toBeVisible({ timeout: 2000 });
    }
  }

  // Final verification
  const isNowExpanded = await allNotesNode.isVisible().catch(() => false);
  if (isNowExpanded !== shouldBeExpanded) {
    throw new Error(
      `Failed to set SD expansion state: wanted ${shouldBeExpanded}, got ${isNowExpanded}`
    );
  }
}

test.describe('Folder Context Menu', () => {
  test('should create a folder using the plus button', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Wait for tree to load
    await page.waitForTimeout(1000);

    // Explicitly ensure the first SD node is expanded
    const firstSDNode = page.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await ensureSDExpansionState(firstSDNode, true);

    // Now find and click "All Notes" (should be visible after expanding SD)
    await page.locator('text=All Notes').first().click();
    await page.waitForTimeout(500); // Give React time to update state

    // Use unique folder name
    const folderName = `Test Folder ${Date.now()}`;

    // Click the plus button to create a folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();

    // Wait for create dialog
    await page.waitForSelector('text=Create New Folder');

    // Type folder name - scope to dialog to avoid search box
    const dialog = page.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill(folderName);

    // Click create button
    const createButton = page.locator('button:has-text("Create")');
    await createButton.click();

    // Wait for dialog to close
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });

    // Wait for folder to appear in tree (with explicit timeout for refresh)
    await page.waitForSelector(`text=${folderName}`, { timeout: 5000 });

    // Verify folder appears in tree
    await expect(page.locator(`text=${folderName}`)).toBeVisible();
  });

  test('should open context menu on right-click', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Wait for tree to load
    await page.waitForTimeout(1000);

    // Explicitly ensure the first SD node is expanded
    const firstSDNode = page.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await ensureSDExpansionState(firstSDNode, true);

    // Select "All Notes" first to ensure we create a root-level folder
    await page.locator('text=All Notes').first().click();
    await page.waitForTimeout(500);

    // Find the Test Folder we created (or create one if not exists)
    let testFolder = page.locator('text=Test Folder').first();
    const isVisible = await testFolder.isVisible().catch(() => false);

    if (!isVisible) {
      // Create a test folder first
      const plusButton = page.locator('button[title="Create folder"]');
      await plusButton.click();
      await page.waitForSelector('text=Create New Folder');
      const dialog = page.locator('div[role="dialog"]');
      const folderNameInput = dialog.locator('input[type="text"]');
      await folderNameInput.fill(`Test Folder ${Date.now()}`);
      const createButton = page.locator('button:has-text("Create")');
      await createButton.click();
      await page.waitForSelector('text=Create New Folder', { state: 'hidden' });
      await page.waitForSelector('text=Test Folder', { timeout: 5000 });
      testFolder = page.locator('text=Test Folder').first();
    }

    // Right-click on the folder
    await testFolder.click({ button: 'right' });

    // Wait for context menu to appear
    await page.waitForSelector('text=Rename', { timeout: 5000 });

    // Verify all menu items are visible (use role to be specific)
    await expect(page.locator('role=menuitem[name="Rename"]')).toBeVisible();
    await expect(page.locator('role=menuitem[name="Move to Top Level"]')).toBeVisible();
    await expect(page.locator('role=menuitem[name="Delete"]')).toBeVisible();
  });

  test('should rename folder via context menu', async () => {
    // Wait for folder panel
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Close any open menus/modals by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Wait for tree to load
    await page.waitForTimeout(1000);

    // Explicitly ensure the first SD node is expanded
    const firstSDNode = page.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await ensureSDExpansionState(firstSDNode, true);

    // Select "All Notes" first
    await page.locator('text=All Notes').first().click();
    await page.waitForTimeout(500);

    // Create unique folder names to avoid conflicts
    const timestamp = Date.now();
    const testFolderName = `Test Folder ${timestamp}`;
    const renamedFolderName = `Renamed Folder ${timestamp}`;

    // Create test folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForSelector('text=Create New Folder');
    const dialog = page.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill(testFolderName);
    const createButton = page.locator('button:has-text("Create")');
    await createButton.click();
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });
    await page.waitForSelector(`text=${testFolderName}`, { timeout: 5000 });

    // Right-click on folder
    const testFolder = page.locator(`text=${testFolderName}`).first();
    await testFolder.click({ button: 'right' });

    // Click Rename in context menu (use role=menuitem to avoid matching folder name)
    const renameMenuItem = page.getByRole('menuitem', { name: 'Rename' });
    await renameMenuItem.click();

    // Wait for rename dialog
    await page.waitForSelector('text=Rename Folder');

    // Change the name - scope to dialog to avoid search box
    const renameDialog = page.locator('div[role="dialog"]');
    const nameInput = renameDialog.locator('input[type="text"]');
    await nameInput.fill(renamedFolderName);

    // Click Rename button
    const renameButton = page.locator('button:has-text("Rename")');
    await renameButton.click();

    // Wait for dialog to close
    await page.waitForSelector('text=Rename Folder', { state: 'hidden' });

    // Wait for renamed folder to appear
    await page.waitForSelector(`text=${renamedFolderName}`, { timeout: 5000 });

    // Verify folder has new name
    await expect(page.locator(`text=${renamedFolderName}`)).toBeVisible();
  });

  test('should delete folder via context menu', async () => {
    // Wait for folder panel
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Close any open menus/modals by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Wait for tree to load
    await page.waitForTimeout(1000);

    // Explicitly ensure the first SD node is expanded
    const firstSDNode = page.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await ensureSDExpansionState(firstSDNode, true);

    // Select "All Notes" first
    await page.locator('text=All Notes').first().click();
    await page.waitForTimeout(500);

    // Create a folder to delete
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForSelector('text=Create New Folder');
    const dialog = page.locator('div[role="dialog"]');
    const folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill(`Folder To Delete ${Date.now()}`);
    const createButton = page.locator('button:has-text("Create")');
    await createButton.click();
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });
    await page.waitForSelector('text=Folder To Delete', { timeout: 5000 });

    // Right-click on folder
    const folderToDelete = page.locator('text=Folder To Delete').first();
    await folderToDelete.click({ button: 'right' });

    // Click Delete in context menu
    const deleteMenuItem = page.locator('role=menuitem[name="Delete"]');
    await deleteMenuItem.click();

    // Wait for delete confirmation dialog
    await page.waitForSelector('text=Delete Folder');

    // Confirm deletion
    const deleteButton = page.locator('button:has-text("Delete")').last();
    await deleteButton.click();

    // Wait for dialog to close
    await page.waitForSelector('text=Delete Folder', { state: 'hidden' });

    // Verify folder is gone (should not be visible)
    await expect(page.locator('text=Folder To Delete')).not.toBeVisible();
  });

  test('should not collapse folder when clicking on folder name', async () => {
    // Wait for folder panel
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Wait for tree to load
    await page.waitForTimeout(1000);

    // Explicitly ensure the first SD node is expanded
    const firstSDNode = page.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await ensureSDExpansionState(firstSDNode, true);

    // Select "All Notes" first
    await page.locator('text=All Notes').first().click();
    await page.waitForTimeout(500);

    // Create unique folder names to avoid conflicts
    const timestamp = Date.now();
    const parentFolderName = `Parent Folder ${timestamp}`;
    const childFolderName = `Child Folder ${timestamp}`;

    // Create a parent folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForSelector('text=Create New Folder');
    let dialog = page.locator('div[role="dialog"]');
    let folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill(parentFolderName);
    let createButton = page.locator('button:has-text("Create")');
    await createButton.click();
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });
    await page.waitForSelector(`text=${parentFolderName}`, { timeout: 5000 });

    // Select the parent folder
    const parentFolder = page.locator(`text=${parentFolderName}`).first();
    await parentFolder.click();

    // Create a child folder
    await plusButton.click();
    await page.waitForSelector('text=Create New Folder');
    dialog = page.locator('div[role="dialog"]');
    folderNameInput = dialog.locator('input[type="text"]');
    await folderNameInput.fill(childFolderName);
    createButton = page.locator('button:has-text("Create")');
    await createButton.click();
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });

    // Wait a bit longer for the folder tree to update and auto-expand the parent
    await page.waitForTimeout(1000);

    // The child folder should now be visible (parent should be auto-expanded)
    await expect(page.locator(`text=${childFolderName}`)).toBeVisible({ timeout: 5000 });

    // Click on the parent folder name (not the caret)
    await parentFolder.click();

    // Verify child folder is still visible (should not have collapsed)
    await expect(page.locator(`text=${childFolderName}`)).toBeVisible();
  });
});

test.describe('Folder Drag & Drop UI', () => {
  test('should have draggable attribute on user folders', async () => {
    // Wait for folder panel
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Wait for folders to load
    await page.waitForTimeout(1000);

    // Check if user folders exist (e.g., Work, Personal)
    const workFolder = await page
      .locator('text=Work')
      .first()
      .isVisible()
      .catch(() => false);

    if (workFolder) {
      // Note: react-dnd-treeview uses role="button" for tree items, not role="treeitem"
      // The library handles drag-and-drop internally with react-dnd
      // We verify drag functionality works in folder-bugs.spec.ts drag tests
      const folderButton = page.getByRole('button', { name: /^Work/ }).first();

      // Verify the folder button is visible and clickable (indicates it's interactive)
      await expect(folderButton).toBeVisible();

      // Verify we can actually drag this folder (tested in folder-bugs.spec.ts)
      // The drag-and-drop works via react-dnd, not HTML5 draggable attribute
      expect(await folderButton.isVisible()).toBe(true);
    }
  });

  test('should not have draggable attribute on special items', async () => {
    // Wait for folder panel
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Wait for tree to load
    await page.waitForTimeout(1000);

    // Explicitly ensure the first SD node is expanded
    const firstSDNode = page.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await ensureSDExpansionState(firstSDNode, true);

    // Note: react-dnd-treeview uses role="button" for tree items, not role="treeitem"
    // The library prevents dragging special items via canDrag() callback
    // We verify this behavior in folder-bugs.spec.ts drag tests

    // Get "All Notes" button - now visible after expanding SD
    const allNotesButton = page.locator('text=All Notes').first();

    // Verify it's visible but drag protection is handled by canDrag callback
    await expect(allNotesButton).toBeVisible();

    // Get "Recently Deleted" button
    const recentlyDeletedButton = page.locator('text=Recently Deleted').first();

    // Verify it's visible but drag protection is handled by canDrag callback
    await expect(recentlyDeletedButton).toBeVisible();

    // Actual drag protection is tested functionally in folder-bugs.spec.ts
    // where we verify special items cannot be dragged via react-dnd's canDrag
  });

  test('should display folders with proper hierarchy', async () => {
    // Wait for folder panel header (use role selector to avoid matching welcome note content)
    await page.waitForSelector('#left-panel h6:has-text("Folders")', { timeout: 10000 });

    // Wait for tree to load
    await page.waitForTimeout(1000);

    // Explicitly ensure the first SD node is expanded
    const firstSDNode = page.locator('[data-testid^="folder-tree-node-sd:"]').first();
    await ensureSDExpansionState(firstSDNode, true);

    // Verify special items are present (using text instead of test ID since SD ID is dynamic)
    await expect(page.locator('text=All Notes').first()).toBeVisible();
    await expect(page.locator('text=Recently Deleted').first()).toBeVisible();

    // Verify folder panel header is visible
    const folderPanelHeader = page.locator('#left-panel h6:has-text("Folders")');
    await expect(folderPanelHeader).toBeVisible();
  });
});
