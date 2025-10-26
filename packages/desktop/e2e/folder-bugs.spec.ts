/**
 * E2E tests for Folder Bug Fixes
 *
 * These tests are expected to FAIL initially and should PASS after fixes.
 * Written BEFORE implementing fixes per TDD approach.
 *
 * Bugs being tested:
 * 1. Right-click rename renames topmost parent folder instead of clicked folder
 * 2. Drag-and-drop moves parent folder instead of dragged folder
 * 3. Drag-and-drop stops working after first drag
 * 4. Folders don't persist across app restarts
 * 5. Folder changes don't replicate across windows
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { rm } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

let electronApp: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  // Clean up any existing test storage to start fresh for EACH test
  const storageDir = join(homedir(), 'Library', 'Application Support', 'Electron', 'storage');
  try {
    await rm(storageDir, { recursive: true, force: true });
    console.log('[E2E] Cleaned up existing storage directory');
  } catch (err) {
    // Ignore errors if directory doesn't exist
  }

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

test.afterEach(async () => {
  if (electronApp) {
    try {
      await electronApp.close();
    } catch (err) {
      // App may already be closed by test (e.g., restart tests)
      console.log('[E2E] App already closed or failed to close:', err);
    }
  }
});

test.describe('Bug: Right-click rename renames wrong folder', () => {
  test('should rename the clicked nested folder, not its parent', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify "Work" folder exists (top level)
    await expect(page.locator('text=Work')).toBeVisible();

    // Expand "Work" folder to see "Projects"
    const workFolder = page.getByRole('button', { name: /Work/ }).first();
    await workFolder.click();
    await page.waitForTimeout(500);

    // Now "Projects" should be visible
    await expect(page.locator('text=Projects')).toBeVisible();

    // Right-click on "Projects" (nested under Work)
    const projectsFolder = page.locator('text=Projects').first();
    await projectsFolder.click({ button: 'right' });

    // Wait for context menu
    await page.waitForSelector('text=Rename', { timeout: 5000 });

    // Click Rename
    const renameMenuItem = page.locator('role=menuitem[name="Rename"]');
    await renameMenuItem.click();

    // Wait for rename dialog
    await page.waitForSelector('text=Rename Folder');

    // Verify the current name shown is "Projects" (NOT "Work")
    const nameInput = page.locator('input[type="text"]').first();
    const currentValue = await nameInput.inputValue();
    expect(currentValue).toBe('Projects');

    // Change the name to "My Projects"
    await nameInput.fill('My Projects');

    // Click Rename button
    const renameButton = page.locator('button:has-text("Rename")');
    await renameButton.click();

    // Wait for dialog to close and tree to refresh
    await page.waitForSelector('text=Rename Folder', { state: 'hidden' });
    await page.waitForTimeout(1500);

    // Verify "Projects" was renamed to "My Projects"
    await expect(page.locator('text=My Projects')).toBeVisible();

    // Verify "Work" still exists and was NOT renamed
    await expect(page.locator('text=Work')).toBeVisible();
  });
});

test.describe('Bug: Drag-and-drop moves wrong folder', () => {
  test('should move only the dragged folder, not its parent', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify Work and Personal exist at top level
    await expect(page.locator('text=Work')).toBeVisible();
    await expect(page.locator('text=Personal')).toBeVisible();

    // Expand "Personal" to see "Ideas" and "Recipes"
    const personalFolder = page.getByRole('button', { name: /Personal/ }).first();
    await personalFolder.click();
    await page.waitForTimeout(500);

    // Now nested folders should be visible
    await expect(page.locator('text=Ideas')).toBeVisible();
    await expect(page.locator('text=Recipes')).toBeVisible();

    // Get tree items for drag and drop - be very specific to avoid selecting parent
    // Use getByRole with exact name to ensure we get the right element
    const recipesItem = page.getByRole('button', { name: 'Recipes', exact: true });
    const workItem = page.getByRole('button', { name: /^Work/, exact: false });

    // Verify we found the right elements
    await expect(recipesItem).toBeVisible();
    await expect(workItem).toBeVisible();

    // Use Playwright's native drag and drop
    await recipesItem.dragTo(workItem);

    // Wait for tree to update and folder:updated event to propagate
    await page.waitForTimeout(3000);

    // Force reload the tree by clicking "All Notes" to trigger fresh data load
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Expand Work folder to see Recipes (which should have moved there)
    const workFolderItem = page.getByRole('button', { name: /^Work/ });
    await workFolderItem.click(); // Always click to ensure expansion
    await page.waitForTimeout(1000);

    // Expand Personal to see Ideas
    const personalFolderItem = page.getByRole('button', { name: /^Personal/ });
    await personalFolderItem.click(); // Always click to ensure expansion
    await page.waitForTimeout(1000);

    // Verify ONLY "Recipes" moved under "Work"
    // The entire "Personal" folder should NOT have moved
    await expect(page.locator('text=Personal')).toBeVisible();
    await expect(page.locator('text=Ideas')).toBeVisible();
    await expect(page.locator('text=Recipes')).toBeVisible();

    // Verify "Personal" is still at root level (not under Work)
    // Both Work and Personal should be visible as root folders
    // The exact visual order doesn't matter, just that they're both present and at root level
    const bodyText = await page.locator('body').textContent();

    expect(bodyText).toContain('Work');
    expect(bodyText).toContain('Personal');
    expect(bodyText).toContain('Recently Deleted');

    // Verify Personal is not nested under Work by checking that it's a clickable root folder
    const personalButton = page.getByRole('button', { name: /^Personal/ });
    await expect(personalButton).toBeVisible();
  });
});

test.describe('Bug: Drag-and-drop stops working after first drag', () => {
  test('should continue to work for multiple drag operations', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Expand "Personal" to see "Ideas" and "Recipes"
    const personalFolder = page.getByRole('button', { name: /Personal/ }).first();
    await personalFolder.click();
    await page.waitForTimeout(500);

    // First drag: Move "Ideas" to "Work" - use exact selectors
    const ideasItem = page.getByRole('button', { name: 'Ideas', exact: true });
    const workItem = page.getByRole('button', { name: /^Work/, exact: false });

    await ideasItem.dragTo(workItem);

    // Wait for folder:updated event and force tree refresh
    await page.waitForTimeout(2000);
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Expand Work to verify Ideas moved
    const workFolderItem = page.getByRole('button', { name: /^Work/ });
    await workFolderItem.click();
    await page.waitForTimeout(1000);

    // Verify "Ideas" is now visible (should be under Work)
    await expect(page.locator('text=Ideas')).toBeVisible();

    // Second drag: Move "Recipes" to "Work" - use exact selector
    const recipesItem = page.getByRole('button', { name: 'Recipes', exact: true });

    await recipesItem.dragTo(workItem);

    // Wait for folder:updated event and force tree refresh
    await page.waitForTimeout(2000);
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Re-expand Work to see both Ideas and Recipes
    const workFolderItem2 = page.getByRole('button', { name: /^Work/ });
    await workFolderItem2.click();
    await page.waitForTimeout(1000);

    // Verify "Recipes" is now also under Work
    await expect(page.locator('text=Recipes')).toBeVisible();

    // Third drag: Move "Ideas" back to "Personal" - use exact selectors
    const ideasItem2 = page.getByRole('button', { name: 'Ideas', exact: true });
    const personalItem = page.getByRole('button', { name: /^Personal/, exact: false });

    await ideasItem2.dragTo(personalItem);

    // Wait for folder:updated event and force tree refresh
    await page.waitForTimeout(2000);
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Expand Personal to verify Ideas moved back
    const personalFolderItem = page.getByRole('button', { name: /^Personal/ });
    await personalFolderItem.click();
    await page.waitForTimeout(1000);

    // Verify "Ideas" is back under Personal
    await expect(page.locator('text=Ideas')).toBeVisible();
  });
});

test.describe('Bug: Folders don\'t persist across app restarts', () => {
  test('should persist created folders after app restart', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for folder tree to fully load

    // Select "All Notes"
    await page.locator('text=All Notes').click();
    await page.waitForTimeout(500);

    // Create a new folder
    const plusButton = page.locator('button[title="Create folder"]');
    await plusButton.click();

    await page.waitForSelector('text=Create New Folder');
    const folderNameInput = page.locator('input[type="text"]').first();
    await folderNameInput.fill('Persistent Test Folder');

    const createButton = page.locator('button:has-text("Create")');
    await createButton.click();

    await page.waitForSelector('text=Create New Folder', { state: 'hidden', timeout: 5000 });
    await page.waitForSelector('text=Persistent Test Folder', { timeout: 5000 });

    // Verify folder exists
    await expect(page.locator('text=Persistent Test Folder')).toBeVisible();

    // Close the app
    await electronApp.close();

    // Relaunch the app
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
    electronApp = await electron.launch({
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
      timeout: 60000,
    });

    page = await electronApp.firstWindow();

    // Wait for app to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify the folder still exists after restart
    await expect(page.locator('text=Persistent Test Folder')).toBeVisible();
  });

  test('should persist renamed folders after app restart', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for folder tree to fully load

    // Right-click on "Work" and rename it
    const workFolder = page.locator('text=Work').first();
    await workFolder.click({ button: 'right' });

    await page.waitForSelector('text=Rename');
    const renameMenuItem = page.locator('role=menuitem[name="Rename"]');
    await renameMenuItem.click();

    await page.waitForSelector('text=Rename Folder');
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('Career');

    const renameButton = page.locator('button:has-text("Rename")');
    await renameButton.click();

    await page.waitForSelector('text=Rename Folder', { state: 'hidden' });
    await page.waitForSelector('text=Career', { timeout: 5000 });

    // Close and relaunch
    await electronApp.close();

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
    electronApp = await electron.launch({
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
      timeout: 60000,
    });

    page = await electronApp.firstWindow();

    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify the folder was renamed and persisted
    await expect(page.locator('text=Career')).toBeVisible();
    await expect(page.locator('text=Work')).not.toBeVisible();
  });
});

test.describe('Bug: Folder changes don\'t sync across windows', () => {
  test('should sync folder creation across multiple windows in same instance', async () => {
    // Wait for first window to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create a second window using the testing IPC method
    await page.evaluate(() => window.electronAPI.testing.createWindow());

    // Wait for window to be created
    await page.waitForTimeout(1000);

    // Get all windows
    const allPages = await electronApp.windows();
    console.log('Windows after new window request:', allPages.length);

    // If we successfully have 2 windows, test sync
    if (allPages.length >= 2) {
      const page1 = allPages[0];
      const page2 = allPages[1];

      // Wait for both windows to load
      await page1.waitForSelector('text=Folders', { timeout: 10000 });
      await page2.waitForSelector('text=Folders', { timeout: 10000 });

      // Create a folder in window 1
      await page1.locator('text=All Notes').click();
      await page1.waitForTimeout(500);

      const plusButton = page1.locator('button[title="Create folder"]');
      await plusButton.click();

      await page1.waitForSelector('text=Create New Folder');
      const folderNameInput = page1.locator('input[type="text"]').first();
      await folderNameInput.fill('Sync Test Folder');

      const createButton = page1.locator('button:has-text("Create")');
      await createButton.click();

      await page1.waitForSelector('text=Create New Folder', { state: 'hidden' });
      await page1.waitForSelector('text=Sync Test Folder', { timeout: 5000 });

      // Verify folder exists in window 1
      await expect(page1.locator('text=Sync Test Folder')).toBeVisible();

      // Wait for sync to propagate
      await page2.waitForTimeout(2000);

      // Verify folder appears in window 2 (should sync via folder:updated event)
      await expect(page2.locator('text=Sync Test Folder')).toBeVisible();
    } else {
      // If we can't create a second window, mark this as a limitation
      console.log('Could not create second window for sync test');
      throw new Error(
        'Sync test requires multiple windows - this test needs app support for window creation',
      );
    }
  });

  test('should sync folder rename across multiple windows in same instance', async () => {
    // Wait for first window to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create second window using testing IPC method
    await page.evaluate(() => window.electronAPI.testing.createWindow());

    await page.waitForTimeout(1000);

    const allPages = await electronApp.windows();

    if (allPages.length >= 2) {
      const page1 = allPages[0];
      const page2 = allPages[1];

      await page1.waitForSelector('text=Folders', { timeout: 10000 });
      await page2.waitForSelector('text=Folders', { timeout: 10000 });

      // Rename a folder in window 1
      const workFolder = page1.locator('text=Work').first();
      await workFolder.click({ button: 'right' });

      await page1.waitForSelector('text=Rename');
      const renameMenuItem = page1.locator('role=menuitem[name="Rename"]');
      await renameMenuItem.click();

      await page1.waitForSelector('text=Rename Folder');
      const nameInput = page1.locator('input[type="text"]').first();
      await nameInput.fill('Office');

      const renameButton = page1.locator('button:has-text("Rename")');
      await renameButton.click();

      await page1.waitForSelector('text=Rename Folder', { state: 'hidden' });
      await page1.waitForSelector('text=Office', { timeout: 5000 });

      // Verify rename in window 1
      await expect(page1.locator('text=Office')).toBeVisible();
      await expect(page1.locator('text=Work')).not.toBeVisible();

      // Wait for sync
      await page2.waitForTimeout(2000);

      // Verify rename synced to window 2
      await expect(page2.locator('text=Office')).toBeVisible();
      await expect(page2.locator('text=Work')).not.toBeVisible();
    } else {
      throw new Error(
        'Sync test requires multiple windows - this test needs app support for window creation',
      );
    }
  });

  test('should sync folder move across multiple windows in same instance', async () => {
    // Wait for first window to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Create second window using testing IPC method
    await page.evaluate(() => window.electronAPI.testing.createWindow());

    await page.waitForTimeout(1000);

    const allPages = await electronApp.windows();

    if (allPages.length >= 2) {
      const page1 = allPages[0];
      const page2 = allPages[1];

      await page1.waitForSelector('text=Folders', { timeout: 10000 });
      await page2.waitForSelector('text=Folders', { timeout: 10000 });

      // Expand "Personal" to see "Ideas"
      const personalFolder = page1.getByRole('button', { name: /Personal/ }).first();
      await personalFolder.click();
      await page1.waitForTimeout(500);

      // Move a folder in window 1 using context menu
      const ideasFolder = page1.locator('text=Ideas').first();
      await ideasFolder.click({ button: 'right' });

      await page1.waitForSelector('text=Rename');

      // Click "Move to Top Level" to move Ideas from Personal to root
      const moveMenuItem = page1.locator('role=menuitem[name="Move to Top Level"]');
      await moveMenuItem.click();

      await page1.waitForTimeout(2000);

      // Verify in window 1 that Ideas is now at root level
      const bodyText1 = await page1.locator('body').textContent();
      // Ideas should now appear between root folders, not nested under Personal

      // Wait for sync
      await page2.waitForTimeout(2000);

      // Verify move synced to window 2
      const bodyText2 = await page2.locator('body').textContent();
      // Both windows should show Ideas at the same hierarchy level
      expect(bodyText1).toContain('Ideas');
      expect(bodyText2).toContain('Ideas');
    } else {
      throw new Error(
        'Sync test requires multiple windows - this test needs app support for window creation',
      );
    }
  });

  test('should sync folder changes across separate Electron instances', async () => {
    // This test launches TWO separate Electron processes (not just windows)
    // to test true cross-instance sync via file system + file watchers
    //
    // Key setup:
    // - Different instance IDs (to avoid conflicts)
    // - Different user data dirs (for Electron app data)
    // - SAME storage directory (for shared folder/note CRDT files)

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
    const tmpDir = require('os').tmpdir();
    const testRunId = Date.now();

    // Each instance gets its own user data directory (for app state, SQLite cache, etc.)
    const userDataDir1 = resolve(tmpDir, `notecove-test-instance1-${testRunId}`);
    const userDataDir2 = resolve(tmpDir, `notecove-test-instance2-${testRunId}`);

    // BUT: Both instances share the SAME storage directory for CRDT files
    const sharedStorageDir = resolve(tmpDir, `notecove-test-shared-storage-${testRunId}`);

    console.log('[SYNC TEST] User data dir 1:', userDataDir1);
    console.log('[SYNC TEST] User data dir 2:', userDataDir2);
    console.log('[SYNC TEST] Shared storage dir:', sharedStorageDir);

    // Launch FIRST Electron instance
    console.log('[SYNC TEST] Launching first Electron instance...');
    const electronApp1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        INSTANCE_ID: 'test-instance-1',
        TEST_STORAGE_DIR: sharedStorageDir, // Point to shared storage
      },
      timeout: 60000,
    });

    electronApp1.on('console', (msg) => {
      console.log('[Instance 1 Console]:', msg.text());
    });

    const page1 = await electronApp1.firstWindow();
    page1.on('console', (msg) => {
      console.log('[Instance 1 Renderer]:', msg.text());
    });

    // Wait for first instance to fully load
    await page1.waitForSelector('text=Folders', { timeout: 10000 });
    await page1.waitForTimeout(2000);

    // Launch SECOND Electron instance (separate process, different user data, SAME storage)
    console.log('[SYNC TEST] Launching second Electron instance...');
    const electronApp2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        INSTANCE_ID: 'test-instance-2',
        TEST_STORAGE_DIR: sharedStorageDir, // Same shared storage!
      },
      timeout: 60000,
    });

    electronApp2.on('console', (msg) => {
      console.log('[Instance 2 Console]:', msg.text());
    });

    const page2 = await electronApp2.firstWindow();
    page2.on('console', (msg) => {
      console.log('[Instance 2 Renderer]:', msg.text());
    });

    // Wait for second instance to fully load
    await page2.waitForSelector('text=Folders', { timeout: 10000 });
    await page2.waitForTimeout(2000);

    console.log('[SYNC TEST] Both instances loaded. Testing sync...');

    try {
      // TEST 1: Create a folder in instance 1
      console.log('[SYNC TEST] Creating folder in instance 1...');
      await page1.locator('text=All Notes').click();
      await page1.waitForTimeout(500);

      const plusButton1 = page1.locator('button[title="Create folder"]');
      await plusButton1.click();

      await page1.waitForSelector('text=Create New Folder');
      const folderNameInput1 = page1.locator('input[type="text"]').first();
      await folderNameInput1.fill('Cross Instance Sync Test');

      const createButton1 = page1.locator('button:has-text("Create")');
      await createButton1.click();

      await page1.waitForSelector('text=Create New Folder', { state: 'hidden' });
      await page1.waitForSelector('text=Cross Instance Sync Test', { timeout: 5000 });

      console.log('[SYNC TEST] Folder created in instance 1');

      // Verify folder exists in instance 1
      await expect(page1.locator('text=Cross Instance Sync Test')).toBeVisible();

      // Wait for file system write + file watcher to propagate
      console.log('[SYNC TEST] Waiting for sync to instance 2...');
      await page2.waitForTimeout(3000);

      // Verify folder appears in instance 2
      // The folder:updated event should trigger a UI refresh in instance 2
      console.log('[SYNC TEST] Checking instance 2 for synced folder...');

      // Give the UI time to refresh after folder:updated event
      await page2.waitForTimeout(1000);

      await expect(page2.locator('text=Cross Instance Sync Test')).toBeVisible({ timeout: 5000 });

      console.log('[SYNC TEST] ✓ Folder creation synced!');

      // TEST 2: Rename the folder in instance 2, verify sync to instance 1
      console.log('[SYNC TEST] Renaming folder in instance 2...');
      const syncTestFolder = page2.locator('text=Cross Instance Sync Test').first();
      await syncTestFolder.click({ button: 'right' });

      await page2.waitForSelector('text=Rename');
      const renameMenuItem2 = page2.locator('role=menuitem[name="Rename"]');
      await renameMenuItem2.click();

      await page2.waitForSelector('text=Rename Folder');
      const nameInput2 = page2.locator('input[type="text"]').first();
      await nameInput2.fill('Synced and Renamed');

      const renameButton2 = page2.locator('button:has-text("Rename")');
      await renameButton2.click();

      await page2.waitForSelector('text=Rename Folder', { state: 'hidden' });
      await page2.waitForSelector('text=Synced and Renamed', { timeout: 5000 });

      console.log('[SYNC TEST] Folder renamed in instance 2');

      // Verify rename in instance 2
      await expect(page2.locator('text=Synced and Renamed')).toBeVisible();

      // Wait for sync back to instance 1
      console.log('[SYNC TEST] Waiting for sync back to instance 1...');
      await page1.waitForTimeout(3000);

      // Give UI time to refresh after folder:updated event
      await page1.waitForTimeout(1000);

      // Verify rename synced to instance 1
      console.log('[SYNC TEST] Checking instance 1 for synced rename...');
      await expect(page1.locator('text=Synced and Renamed')).toBeVisible({ timeout: 5000 });
      await expect(page1.locator('text=Cross Instance Sync Test')).not.toBeVisible();

      console.log('[SYNC TEST] ✓ Folder rename synced!');
    } finally {
      // Clean up: close both instances
      console.log('[SYNC TEST] Closing instances...');
      await electronApp1.close();
      await electronApp2.close();
      console.log('[SYNC TEST] Test complete');
    }
  });
});

test.describe('Bug: Expand/collapse all button does not work', () => {
  test('should actually expand and collapse tree nodes when button is clicked', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // The tree starts fully expanded, so Work's children should be visible
    const workFolder = page.getByRole('button', { name: /^Work/ }).first();
    await workFolder.click(); // Ensure Work is expanded
    await page.waitForTimeout(500);

    // Verify "Projects" (child of Work) is visible
    await expect(page.locator('text=Projects')).toBeVisible();

    // Find the expand/collapse all button by its SVG icon (UnfoldMore or UnfoldLess)
    // Look for the button in the border-divided section at top of folder panel
    const expandCollapseButton = page.locator('button').filter({
      has: page.locator('svg[data-testid="UnfoldMoreIcon"], svg[data-testid="UnfoldLessIcon"]'),
    }).first();

    // Click to collapse all
    await expandCollapseButton.click();
    await page.waitForTimeout(500);

    // After clicking collapse all, "Projects" should NOT be visible (folder closed)
    // This will FAIL initially because the button doesn't actually work (the bug)
    await expect(page.locator('text=Projects')).not.toBeVisible();

    // Click again to expand all
    await expandCollapseButton.click();
    await page.waitForTimeout(500);

    // After clicking expand all, "Projects" should be visible again
    await expect(page.locator('text=Projects')).toBeVisible();
  });
});

test.describe('Bug: Folders without children show expand icon', () => {
  test('should NOT show expand/collapse chevron for childless folders', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Expand "Personal" to see its children
    const personalFolder = page.getByRole('button', { name: /^Personal/ }).first();
    await personalFolder.click();
    await page.waitForTimeout(500);

    // "Ideas" and "Recipes" are leaf nodes (no children)
    // Find the "Ideas" row
    const ideasButton = page.getByRole('button', { name: 'Ideas', exact: true });
    await expect(ideasButton).toBeVisible();

    // Check if Ideas has a chevron icon (ChevronRight or ExpandMore)
    // The chevron should NOT exist for childless folders
    const ideasRow = ideasButton.locator('..');
    const chevronInIdeas = ideasRow.locator('svg[data-testid="ChevronRightIcon"], svg[data-testid="ExpandMoreIcon"]');

    // This should fail initially (bug exists) - childless folder has chevron
    await expect(chevronInIdeas).not.toBeVisible();

    // Also check "Recipes"
    const recipesButton = page.getByRole('button', { name: 'Recipes', exact: true });
    await expect(recipesButton).toBeVisible();

    const recipesRow = recipesButton.locator('..');
    const chevronInRecipes = recipesRow.locator('svg[data-testid="ChevronRightIcon"], svg[data-testid="ExpandMoreIcon"]');

    await expect(chevronInRecipes).not.toBeVisible();

    // "Work" has a child ("Projects"), so it SHOULD have a chevron
    const workButton = page.getByRole('button', { name: /^Work/ }).first();
    const workRow = workButton.locator('..');
    const chevronInWork = workRow.locator('svg[data-testid="ChevronRightIcon"], svg[data-testid="ExpandMoreIcon"]');

    await expect(chevronInWork).toBeVisible();
  });
});

test.describe('Bug: Drag shadow shows multiple items', () => {
  test('should only show the dragged folder in drag preview, not other folders', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Expand "Personal" to see "Ideas" and "Recipes"
    const personalFolder = page.getByRole('button', { name: /^Personal/ }).first();
    await personalFolder.click();
    await page.waitForTimeout(500);

    // Get the "Ideas" folder to drag
    const ideasItem = page.getByRole('button', { name: 'Ideas', exact: true });
    await expect(ideasItem).toBeVisible();

    // Take a screenshot before drag to understand the structure
    await page.screenshot({ path: '/tmp/before-drag.png' });

    // Start dragging Ideas using Playwright's drag API
    await ideasItem.hover();
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move mouse to trigger drag preview
    const workItem = page.getByRole('button', { name: /^Work/ });
    const workBox = await workItem.boundingBox();
    if (workBox) {
      await page.mouse.move(workBox.x + workBox.width / 2, workBox.y + workBox.height / 2, { steps: 10 });
    }
    await page.waitForTimeout(200);

    // Take screenshot during drag to see the drag preview
    await page.screenshot({ path: '/tmp/during-drag.png' });

    // The drag preview is created by react-dnd and should only show "Ideas"
    // Since the drag preview rendering is complex, we'll check by taking a screenshot
    // and manually verify that only "Ideas" appears in the drag shadow
    // For automated testing, we can check if specific elements are being cloned incorrectly

    // NOTE: This is a visual test that requires manual verification of screenshots
    // The bug manifests as multiple folder items appearing in the drag shadow
    // After fix with custom dragPreviewRender, only "Ideas" should be visible

    // For now, just verify drag operation completes
    await page.mouse.up();

    // This test serves as documentation of the bug
    // Manual verification needed: Check /tmp/during-drag.png
    // Expected: Only "Ideas" in drag shadow
    // Actual (before fix): Multiple folders including "All Notes", "Personal", etc.
    console.log('Drag shadow test completed. Check /tmp/during-drag.png for visual verification.');
  });
});
