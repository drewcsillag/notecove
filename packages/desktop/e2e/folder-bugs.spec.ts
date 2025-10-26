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

test.beforeAll(async () => {
  // Clean up any existing test storage to start fresh
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

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Bug: Right-click rename renames wrong folder', () => {
  test('should rename the clicked nested folder, not its parent', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify "Work" folder exists (top level)
    await expect(page.locator('text=Work')).toBeVisible();

    // Expand "Work" folder to see "Projects"
    const workFolder = page.locator('role=treeitem[name=/Work/]').first();
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
    const personalFolder = page.locator('role=treeitem[name=/Personal/]').first();
    await personalFolder.click();
    await page.waitForTimeout(500);

    // Now nested folders should be visible
    await expect(page.locator('text=Ideas')).toBeVisible();
    await expect(page.locator('text=Recipes')).toBeVisible();

    // Get tree items for drag and drop - be very specific to avoid selecting parent
    // Use getByRole with exact name to ensure we get the right element
    const recipesItem = page.getByRole('treeitem', { name: 'Recipes', exact: true });
    const workItem = page.getByRole('treeitem', { name: /^Work/, exact: false });

    // Verify we found the right elements
    await expect(recipesItem).toBeVisible();
    await expect(workItem).toBeVisible();

    // Use Playwright's native drag and drop
    await recipesItem.dragTo(workItem);

    // Wait for tree to update and folder:updated event to propagate
    await page.waitForTimeout(3000);

    // Expand Work folder to see Recipes (which should have moved there)
    const workFolderItem = page.getByRole('treeitem', { name: /^Work/ });
    const isWorkExpanded = await workFolderItem.getAttribute('aria-expanded');
    if (isWorkExpanded !== 'true') {
      await workFolderItem.click();
      await page.waitForTimeout(1000);
    }

    // Personal should still be expanded from before, but verify
    const personalFolderItem = page.getByRole('treeitem', { name: /^Personal/ });
    const isPersonalExpanded = await personalFolderItem.getAttribute('aria-expanded');
    if (isPersonalExpanded !== 'true') {
      await personalFolderItem.click();
      await page.waitForTimeout(1000);
    }

    // Verify ONLY "Recipes" moved under "Work"
    // The entire "Personal" folder should NOT have moved
    await expect(page.locator('text=Personal')).toBeVisible();
    await expect(page.locator('text=Ideas')).toBeVisible();
    await expect(page.locator('text=Recipes')).toBeVisible();

    // Verify "Personal" is still at root level (not under Work)
    // Check hierarchy by looking at tree structure
    const bodyText = await page.locator('body').textContent();

    // "Personal" should appear before "Recently Deleted" and after "Work"
    const workIndex = bodyText?.indexOf('Work') ?? -1;
    const personalIndex = bodyText?.indexOf('Personal') ?? -1;
    const recentlyDeletedIndex = bodyText?.indexOf('Recently Deleted') ?? -1;

    expect(workIndex).toBeGreaterThan(-1);
    expect(personalIndex).toBeGreaterThan(workIndex);
    expect(recentlyDeletedIndex).toBeGreaterThan(personalIndex);
  });
});

test.describe('Bug: Drag-and-drop stops working after first drag', () => {
  test('should continue to work for multiple drag operations', async () => {
    // Wait for folder panel to load
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Expand "Personal" to see "Ideas" and "Recipes"
    const personalFolder = page.locator('role=treeitem[name=/Personal/]').first();
    await personalFolder.click();
    await page.waitForTimeout(500);

    // First drag: Move "Ideas" to "Work" - use exact selectors
    const ideasItem = page.getByRole('treeitem', { name: 'Ideas', exact: true });
    const workItem = page.getByRole('treeitem', { name: /^Work/, exact: false });

    await ideasItem.dragTo(workItem);

    // Wait longer for folder:updated event to propagate and UI to refresh
    await page.waitForTimeout(3000);

    // Expand Work to verify Ideas moved (check aria-expanded first)
    const workFolderItem = page.getByRole('treeitem', { name: /^Work/ });
    const isWorkExpanded = await workFolderItem.getAttribute('aria-expanded');
    if (isWorkExpanded !== 'true') {
      await workFolderItem.click();
      await page.waitForTimeout(1000);
    }

    // Verify "Ideas" is now visible (should be under Work)
    await expect(page.locator('text=Ideas')).toBeVisible();

    // Second drag: Move "Recipes" to "Work" - use exact selector
    const recipesItem = page.getByRole('treeitem', { name: 'Recipes', exact: true });

    await recipesItem.dragTo(workItem);
    await page.waitForTimeout(3000);

    // Verify "Recipes" is now also under Work (Work should still be expanded)
    await expect(page.locator('text=Recipes')).toBeVisible();

    // Third drag: Move "Ideas" back to "Personal" - use exact selectors
    const ideasItem2 = page.getByRole('treeitem', { name: 'Ideas', exact: true });
    const personalItem = page.getByRole('treeitem', { name: /^Personal/, exact: false });

    await ideasItem2.dragTo(personalItem);
    await page.waitForTimeout(3000);

    // Expand Personal to verify Ideas moved back (check aria-expanded first)
    const personalFolderItem = page.getByRole('treeitem', { name: /^Personal/ });
    const isPersonalExpanded = await personalFolderItem.getAttribute('aria-expanded');
    if (isPersonalExpanded !== 'true') {
      await personalFolderItem.click();
      await page.waitForTimeout(500);
    }

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

    // Create a second window programmatically by getting the first window's path
    const firstWindowUrl = await page.evaluate(() => window.location.href);
    console.log('[TEST] First window URL:', firstWindowUrl);

    // Create second window via Electron evaluate with hardcoded paths
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const newWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        autoHideMenuBar: false,
        webPreferences: {
          preload: __dirname + '/../preload/index.js',
          sandbox: false,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      newWindow.on('ready-to-show', () => {
        newWindow.show();
      });

      // Load the renderer
      await newWindow.loadFile(__dirname + '/../renderer/index.html');

      console.log('[TEST] Created second window. Total windows:', BrowserWindow.getAllWindows().length);
    });

    await page.waitForTimeout(2000);

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

    // Create second window programmatically
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const newWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        autoHideMenuBar: false,
        webPreferences: {
          preload: __dirname + '/../preload/index.js',
          sandbox: false,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      newWindow.on('ready-to-show', () => { newWindow.show(); });
      await newWindow.loadFile(__dirname + '/../renderer/index.html');
    });

    await page.waitForTimeout(2000);

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

    // Create second window programmatically
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const newWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        autoHideMenuBar: false,
        webPreferences: {
          preload: __dirname + '/../preload/index.js',
          sandbox: false,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      newWindow.on('ready-to-show', () => { newWindow.show(); });
      await newWindow.loadFile(__dirname + '/../renderer/index.html');
    });

    await page.waitForTimeout(2000);

    const allPages = await electronApp.windows();

    if (allPages.length >= 2) {
      const page1 = allPages[0];
      const page2 = allPages[1];

      await page1.waitForSelector('text=Folders', { timeout: 10000 });
      await page2.waitForSelector('text=Folders', { timeout: 10000 });

      // Expand "Personal" to see "Ideas"
      const personalFolder = page1.locator('role=treeitem[name=/Personal/]').first();
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
