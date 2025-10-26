/**
 * E2E tests for Folder Operations
 *
 * Tests folder CRUD operations including context menus
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
  console.log('[E2E] Launching Electron with main process at:', mainPath);

  electronApp = await electron.launch({
    args: [mainPath],
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

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Folder Context Menu', () => {
  test('should create a folder using the plus button', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Select "All Notes" first to ensure we create a root-level folder
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500); // Give React time to update state

    // Click the plus button to create a folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();

    // Wait for create dialog
    await page.waitForSelector('text=Create New Folder');

    // Type folder name
    const folderNameInput = page.locator('input[type="text"]').first();
    await folderNameInput.fill('Test Folder');

    // Click create button
    const createButton = page.locator('button:has-text("Create")');
    await createButton.click();

    // Wait for dialog to close
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });

    // Verify folder appears in tree
    await expect(page.locator('text=Test Folder')).toBeVisible();
  });

  test('should open context menu on right-click', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Select "All Notes" first to ensure we create a root-level folder
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Find the Test Folder we created (or create one if not exists)
    let testFolder = page.locator('text=Test Folder').first();
    const isVisible = await testFolder.isVisible().catch(() => false);

    if (!isVisible) {
      // Create a test folder first
      const plusButton = page.locator('button[title="Create folder"]');
      await plusButton.click();
      await page.waitForSelector('text=Create New Folder');
      const folderNameInput = page.locator('input[type="text"]').first();
      await folderNameInput.fill('Test Folder');
      const createButton = page.locator('button:has-text("Create")');
      await createButton.click();
      await page.waitForSelector('text=Create New Folder', { state: 'hidden' });
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

    // Select "All Notes" first
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Ensure Test Folder exists
    let testFolder = page.locator('text=Test Folder').first();
    const isVisible = await testFolder.isVisible().catch(() => false);

    if (!isVisible) {
      // Create test folder
      const plusButton = page.locator('button[title="Create folder"]');
      await plusButton.click();
      await page.waitForSelector('text=Create New Folder');
      const folderNameInput = page.locator('input[type="text"]').first();
      await folderNameInput.fill('Test Folder');
      const createButton = page.locator('button:has-text("Create")');
      await createButton.click();
      await page.waitForSelector('text=Create New Folder', { state: 'hidden' });
      testFolder = page.locator('text=Test Folder').first();
    }

    // Right-click on folder
    await testFolder.click({ button: 'right' });

    // Click Rename in context menu
    const renameMenuItem = page.locator('text=Rename').first();
    await renameMenuItem.click();

    // Wait for rename dialog
    await page.waitForSelector('text=Rename Folder');

    // Change the name
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('Renamed Folder');

    // Click Rename button
    const renameButton = page.locator('button:has-text("Rename")');
    await renameButton.click();

    // Wait for dialog to close
    await page.waitForSelector('text=Rename Folder', { state: 'hidden' });

    // Verify folder has new name
    await expect(page.locator('text=Renamed Folder')).toBeVisible();
  });

  test('should delete folder via context menu', async () => {
    // Wait for folder panel
    await page.waitForSelector('text=Folders', { timeout: 10000 });

    // Close any open menus/modals by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Select "All Notes" first
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Create a folder to delete
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForSelector('text=Create New Folder');
    const folderNameInput = page.locator('input[type="text"]').first();
    await folderNameInput.fill('Folder To Delete');
    const createButton = page.locator('button:has-text("Create")');
    await createButton.click();
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });

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

    // Select "All Notes" first
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Create a parent folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();
    await page.waitForSelector('text=Create New Folder');
    let folderNameInput = page.locator('input[type="text"]').first();
    await folderNameInput.fill('Parent Folder');
    let createButton = page.locator('button:has-text("Create")');
    await createButton.click();
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });

    // Select the parent folder
    const parentFolder = page.locator('text=Parent Folder').first();
    await parentFolder.click();

    // Create a child folder
    await plusButton.click();
    await page.waitForSelector('text=Create New Folder');
    folderNameInput = page.locator('input[type="text"]').first();
    await folderNameInput.fill('Child Folder');
    createButton = page.locator('button:has-text("Create")');
    await createButton.click();
    await page.waitForSelector('text=Create New Folder', { state: 'hidden' });

    // Verify child folder is visible (parent should be expanded)
    await expect(page.locator('text=Child Folder')).toBeVisible();

    // Click on the parent folder name (not the caret)
    await parentFolder.click();

    // Verify child folder is still visible (should not have collapsed)
    await expect(page.locator('text=Child Folder')).toBeVisible();
  });
});
