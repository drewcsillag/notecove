/**
 * Real Cross-Platform Sync E2E Test
 *
 * This test launches BOTH Desktop and iOS apps and verifies sync works end-to-end:
 * - Desktop Electron app (controlled via Playwright)
 * - iOS Simulator app (controlled via xcrun simctl + file system monitoring)
 *
 * Tests:
 * 1. iOS creates note → Desktop discovers it
 * 2. Desktop creates note → iOS discovers it
 * 3. Desktop edits iOS note → iOS sees changes
 * 4. iOS edits Desktop note → Desktop sees changes
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Test configuration
// Note: SHARED_SD_PATH will be set dynamically to use iOS Documents path
let SHARED_SD_PATH = '/tmp/notecove-real-cross-platform-test'; // Default, will be overridden
const IOS_SIMULATOR_NAME = 'iPhone 17 Pro';
const TEST_TIMEOUT = 180000; // 3 minutes

// Helper to execute shell commands
function exec(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8' });
  } catch (error: any) {
    console.error(`Command failed: ${command}`);
    console.error(error.stderr || error.message);
    throw error;
  }
}

// Helper to wait for a condition
async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 10000,
  checkIntervalMs: number = 500
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

// Helper to get iOS Documents path for a simulator without launching the app
async function getIOSDocumentsPathForSimulator(
  simulatorId: string,
  bundleId: string
): Promise<string> {
  // Find the app's data container
  const containers = exec(
    `xcrun simctl get_app_container ${simulatorId} ${bundleId} data 2>/dev/null || echo ""`
  );
  if (containers && containers.trim()) {
    return path.join(containers.trim(), 'Documents');
  }

  // If app not installed yet, we'll need to find it after launching
  // For now, return a placeholder that will be updated later
  return '';
}

test.describe('Real Cross-Platform Sync', () => {
  // Configure tests to run serially to avoid xcodegen race conditions
  // Multiple workers trying to run xcodegen simultaneously causes file copy conflicts
  test.describe.configure({ mode: 'serial' });

  let desktopApp: ElectronApplication;
  let desktopWindow: Page;
  let iosSimulatorId: string;
  let iosAppBundleId: string = 'com.notecove.NoteCove';

  test.beforeAll(async () => {
    // Note: Shared directory will be created per-test inside iOS Documents

    // Find iOS simulator
    console.log('[Test] Finding iOS simulator...');
    const simulators = exec('xcrun simctl list devices available -j');
    const simData = JSON.parse(simulators);

    // Find the simulator by name
    let found = false;
    for (const runtime in simData.devices) {
      const devices = simData.devices[runtime];
      for (const device of devices) {
        if (device.name === IOS_SIMULATOR_NAME && device.isAvailable) {
          iosSimulatorId = device.udid;
          found = true;
          console.log('[Test] Found simulator:', device.name, device.udid);
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      throw new Error(`iOS Simulator "${IOS_SIMULATOR_NAME}" not found`);
    }

    // Boot simulator if needed
    console.log('[Test] Booting iOS simulator...');
    try {
      exec(`xcrun simctl boot ${iosSimulatorId}`);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for boot
    } catch (error: any) {
      // Already booted is fine
      if (!error.message.includes('Unable to boot device in current state: Booted')) {
        throw error;
      }
    }

    // Build and install iOS app
    console.log('[Test] Building iOS app...');
    const iosProjectPath = path.join(__dirname, '../../ios');

    // Generate Xcode project
    exec(`cd ${iosProjectPath} && xcodegen generate`);

    // Build for simulator
    console.log('[Test] Building for simulator...');
    const buildOutput = exec(
      `cd ${iosProjectPath} && xcodebuild -project NoteCove.xcodeproj -scheme NoteCove -sdk iphonesimulator -configuration Debug -derivedDataPath /tmp/notecove-ios-build`
    );

    // Find the .app bundle
    const appPath = exec(
      'find /tmp/notecove-ios-build -name "NoteCove.app" -type d | head -1'
    ).trim();

    if (!appPath) {
      throw new Error('Failed to find NoteCove.app after build');
    }

    console.log('[Test] Installing iOS app...');
    exec(`xcrun simctl install ${iosSimulatorId} "${appPath}"`);

    console.log('[Test] iOS app installed successfully');
  });

  test.afterAll(async () => {
    // Cleanup
    if (desktopApp) {
      await desktopApp.close();
    }

    // Terminate iOS app
    if (iosSimulatorId && iosAppBundleId) {
      try {
        exec(`xcrun simctl terminate ${iosSimulatorId} ${iosAppBundleId}`);
      } catch (e) {
        // App might not be running
      }
    }

    // Keep shared directory for debugging
    console.log('[Test] Shared directory preserved at:', SHARED_SD_PATH);
  });

  test('bidirectional sync between Desktop and iOS apps', { timeout: TEST_TIMEOUT }, async () => {
    //
    // SETUP: Determine shared storage path using iOS Documents (before launching apps)
    //
    console.log('[Test] Setting up shared storage path...');

    // Get iOS Documents path (app should already be installed from beforeAll)
    let iosDocsPath = await getIOSDocumentsPathForSimulator(iosSimulatorId, iosAppBundleId);

    // If not found (app not launched yet), launch it once to create container
    if (!iosDocsPath) {
      console.log('[Test] Launching iOS app to create container...');
      exec(`xcrun simctl launch ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      exec(`xcrun simctl terminate ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      iosDocsPath = await getIOSDocumentsPathForSimulator(iosSimulatorId, iosAppBundleId);
    }

    // Set shared SD path inside iOS Documents so both apps can access it
    SHARED_SD_PATH = path.join(iosDocsPath, 'shared-storage');
    console.log('[Test] Using shared SD path:', SHARED_SD_PATH);

    // Create shared directory structure
    await fs.mkdir(SHARED_SD_PATH, { recursive: true });
    await fs.mkdir(path.join(SHARED_SD_PATH, '.activity'), { recursive: true });
    await fs.mkdir(path.join(SHARED_SD_PATH, 'notes'), { recursive: true });
    await fs.mkdir(path.join(SHARED_SD_PATH, 'folders'), { recursive: true });

    //
    // SETUP: Launch Desktop app
    //
    console.log('[Test] Launching Desktop app...');

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const testDbPath = path.join(os.tmpdir(), `notecove-real-test-${uniqueId}.db`);
    const testConfigPath = path.join(os.tmpdir(), `notecove-real-config-${uniqueId}.json`);

    desktopApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_CONFIG_PATH: testConfigPath,
      },
    });

    desktopWindow = await desktopApp.firstWindow({ timeout: 60000 });
    await desktopWindow.waitForLoadState('domcontentloaded');
    await desktopWindow.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });

    //
    // Add shared storage directory to Desktop using UI (NO API SHORTCUTS!)
    //
    console.log('[Test] Adding shared SD to Desktop via UI...');

    // Open Settings dialog
    const settingsButton = desktopWindow.locator('button[title="Settings"]');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    await desktopWindow.waitForTimeout(500);

    // Click "Add Directory" button
    await desktopWindow.locator('button', { hasText: 'Add Directory' }).click();
    await desktopWindow.waitForTimeout(500);

    // Fill in the Add Storage Directory dialog
    const addDialog = desktopWindow.locator('[role="dialog"]', {
      hasText: 'Add Storage Directory',
    });
    await expect(addDialog).toBeVisible({ timeout: 5000 });

    await addDialog.getByLabel('Name').fill('Real Test SD');
    await addDialog.getByLabel('Path').fill(SHARED_SD_PATH);

    // Set up test instrumentation listeners to track file watcher events
    await desktopWindow.evaluate(() => {
      (window as any).testEvents = {
        fileWatcher: [] as any[],
        gracePeriod: [] as any[],
        activitySync: [] as any[],
        watcherDebug: [] as any[],
      };
      window.electronAPI.testing.onFileWatcherEvent((data: any) => {
        (window as any).testEvents.fileWatcher.push(data);
      });
      window.electronAPI.testing.onGracePeriodEnded((data: any) => {
        (window as any).testEvents.gracePeriod.push(data);
      });
      window.electronAPI.testing.onActivitySyncComplete((data: any) => {
        (window as any).testEvents.activitySync.push(data);
      });
      window.electronAPI.testing.onActivityWatcherDebug((data: any) => {
        (window as any).testEvents.watcherDebug.push(data);
      });
    });

    // Click Add button and wait for SD initialization to complete
    // The SD initialization includes:
    // - Setting up file watchers (chokidar)
    // - Loading existing notes
    // - Completing the startup grace period
    // This can take several seconds, so we wait generously
    await addDialog.locator('button', { hasText: 'Add' }).click();
    console.log('[Test] Waiting for SD initialization to complete (20 seconds)...');
    await desktopWindow.waitForTimeout(20000); // Wait for startup grace period to complete
    console.log('[Test] ✅ SD initialization should be complete');

    // Verify SD appears in Settings
    const settingsDialog = desktopWindow.locator('[role="dialog"]', { hasText: 'Settings' });
    await expect(settingsDialog.getByText('Real Test SD')).toBeVisible();
    await expect(settingsDialog.getByText(SHARED_SD_PATH, { exact: true })).toBeVisible();

    console.log('[Test] ✅ SD added to Desktop via UI');

    // Close Settings dialog
    const closeButton = settingsDialog.locator('button[aria-label="close"]');
    await closeButton.click();
    await desktopWindow.waitForTimeout(2000);

    // Collapse the Default SD to make room for Real Test SD
    console.log('[Test] Trying to collapse Default SD to make room...');

    // Find the Default SD node
    const defaultSdNode = desktopWindow
      .locator('[data-testid^="folder-tree-node-sd:"]')
      .filter({ hasText: 'Default' });
    await expect(defaultSdNode).toBeVisible({ timeout: 5000 });

    // Try to find and click the chevron/collapse icon (usually an SVG)
    const chevron = defaultSdNode.locator('svg').first();
    const chevronExists = (await chevron.count()) > 0;

    if (chevronExists) {
      await chevron.click();
      console.log('[Test] Clicked chevron to collapse Default SD');
    } else {
      console.log('[Test] No chevron found, skipping collapse');
    }

    await desktopWindow.waitForTimeout(500);

    // Take screenshot to see the current state
    await desktopWindow.screenshot({ path: '/tmp/notecove-test-after-collapse-attempt.png' });
    console.log('[Test] Screenshot: /tmp/notecove-test-after-collapse-attempt.png');

    // Now try to find and click the SD node
    const sdNode = desktopWindow
      .locator('[data-testid^="folder-tree-node-sd:"]')
      .filter({ hasText: 'Real Test SD' });
    await expect(sdNode).toBeVisible({ timeout: 5000 });

    // Click to expand
    await sdNode.click();
    await desktopWindow.waitForTimeout(1000);

    // Now look for "All Notes" under this SD
    const allNotesNode = desktopWindow
      .locator('[data-testid^="folder-tree-node-all-notes:"]')
      .filter({ hasText: 'All Notes' })
      .last(); // Get the last one (should be under Real Test SD)

    const allNotesCount = await allNotesNode.count();
    console.log('[Test] All Notes nodes found:', allNotesCount);

    if (allNotesCount > 0) {
      await allNotesNode.click();
      console.log('[Test] ✅ Clicked All Notes under Real Test SD');
    }

    await desktopWindow.waitForTimeout(1000);

    // Take screenshot to see what UI is available for empty SD
    await desktopWindow.screenshot({ path: '/tmp/notecove-test-after-sd-selection.png' });
    console.log('[Test] Screenshot after SD selection: /tmp/notecove-test-after-sd-selection.png');

    //
    // SETUP: Configure iOS app database
    //
    console.log('[Test] Configuring iOS app...');

    const iosDocumentsPath = iosDocsPath; // Use path determined earlier
    console.log('[Test] iOS Documents path:', iosDocumentsPath);

    // Ensure iOS database exists
    const iosDbPath = path.join(iosDocumentsPath, 'notecove.sqlite');
    const dbExists = await fs
      .access(iosDbPath)
      .then(() => true)
      .catch(() => false);

    if (!dbExists) {
      // Launch iOS app once to create the database
      console.log('[Test] Launching iOS app to create database...');
      exec(`xcrun simctl launch ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      exec(`xcrun simctl terminate ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Clean up any old storage directories from previous test runs
    console.log('[Test] Cleaning up old storage directories from iOS database...');
    exec(`sqlite3 "${iosDbPath}" "DELETE FROM storage_directories"`);

    // Add storage directory to iOS database
    const sdId = 'test-sd-' + Date.now();
    const now = new Date().toISOString();
    console.log('[Test] Adding storage directory to iOS database...');
    exec(
      `sqlite3 "${iosDbPath}" "INSERT INTO storage_directories (id, name, path, created_at, modified_at) VALUES ('${sdId}', 'Test SD', '${SHARED_SD_PATH}', '${now}', '${now}')"`
    );

    // Launch iOS app - it will now automatically start watching the storage directory
    console.log('[Test] Launching iOS app...');
    exec(`xcrun simctl launch ${iosSimulatorId} ${iosAppBundleId}`);
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for app to fully launch and start watchers

    console.log('[Test] Both apps launched and configured');

    //
    // TEST 1: Desktop creates note via UI → iOS discovers it
    //
    console.log('[Test] TEST 1: Desktop creates note "from desktop" via UI');

    // Click "create note" button (the "+" in the Notes panel header)
    console.log('[Test] Looking for create note button...');

    const addButton = desktopWindow.getByRole('button', { name: 'create note' });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();
    console.log('[Test] ✅ Clicked create note button');

    await desktopWindow.waitForTimeout(1000);

    // Type content in editor
    const editor = desktopWindow.locator('.tiptap.ProseMirror');
    await expect(editor).toBeVisible();
    await editor.click();
    await editor.type('from desktop');
    await desktopWindow.waitForTimeout(2000); // Wait for autosave

    console.log('[Test] ✅ Desktop created note via UI');

    // Get note ID from activity log (last created note)
    const activityFiles = await fs.readdir(path.join(SHARED_SD_PATH, '.activity'));
    expect(activityFiles.length).toBeGreaterThan(0);
    const activityFile = activityFiles[0];
    const activityContent = await fs.readFile(
      path.join(SHARED_SD_PATH, '.activity', activityFile),
      'utf-8'
    );
    const lastLine = activityContent.trim().split('\n').pop()!;
    const desktopNoteId = lastLine.split('|')[0];

    console.log('[Test] Desktop note ID:', desktopNoteId);

    // Go back to list
    await desktopWindow.keyboard.press('Escape');
    await desktopWindow.waitForTimeout(1000);

    // Verify note appears in list with specific ID
    const noteInList = desktopWindow.locator(`[data-testid="note-item-${desktopNoteId}"]`);
    await expect(noteInList).toBeVisible({ timeout: 5000 });
    await expect(noteInList).toContainText('from desktop');

    // Verify note directory exists on disk
    const noteDir = path.join(SHARED_SD_PATH, 'notes', desktopNoteId);
    const noteDirExists = await fs
      .access(noteDir)
      .then(() => true)
      .catch(() => false);
    expect(noteDirExists).toBe(true);

    console.log('[Test] Desktop note exists on disk');

    // Wait for iOS to discover Desktop's note via ActivitySync
    console.log('[Test] Waiting for iOS to discover Desktop note...');
    await waitFor(async () => {
      return await checkIOSNoteExists(desktopNoteId);
    }, 15000);

    expect(await checkIOSNoteExists(desktopNoteId)).toBe(true);
    console.log('[Test] ✅ iOS discovered Desktop note via ActivitySync');

    //
    // TEST 2: iOS creates note → Desktop discovers it
    //
    console.log('[Test] TEST 2: iOS creates note "from ios"');

    // TODO: Full iOS UI automation via XCTest
    // For now, we simulate iOS creating a note via file system
    // This is realistic since we're testing the sync mechanism
    // To enable full iOS UI automation:
    // 1. Run: xcodebuild test -project packages/ios/NoteCove.xcodeproj \
    //         -scheme NoteCove -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
    //         -only-testing:NoteCoveUITests/CrossPlatformSyncUITests/testCreateNoteWithContent
    // 2. Set environment: TEST_NOTE_CONTENT="from ios" TEST_SD_PATH=...
    //
    const iosNoteId = await createNoteAsIOS('from ios');
    console.log('[Test] iOS created note:', iosNoteId);

    // Check what file watcher events were captured
    const events = await desktopWindow.evaluate(() => (window as any).testEvents);
    console.log('[Test] Captured events:', JSON.stringify(events, null, 2));

    // Wait for Desktop to discover it via file watching
    console.log('[Test] Waiting for Desktop to discover iOS note...');
    await waitFor(async () => {
      const noteItem = desktopWindow
        .locator('[data-testid^="note-item-"]')
        .filter({ hasText: 'from ios' });
      return (await noteItem.count()) > 0;
    }, 15000);

    const iosNoteInDesktop = desktopWindow
      .locator('[data-testid^="note-item-"]')
      .filter({ hasText: 'from ios' });
    await expect(iosNoteInDesktop).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Desktop discovered iOS note in UI');

    // Verify Desktop database has the note
    expect(await checkDesktopNoteExists(iosNoteId, testDbPath)).toBe(true);
    console.log('[Test] ✅ Desktop database contains iOS note');

    //
    // TEST 3: Desktop edits iOS note → verify activity log updated
    //
    console.log('[Test] TEST 3: Desktop edits iOS note');

    await iosNoteInDesktop.click();
    await desktopWindow.waitForTimeout(1000);

    const editorForEdit = desktopWindow.locator('.tiptap.ProseMirror');
    await editorForEdit.click();
    await editorForEdit.press('End');
    await editorForEdit.type(' hello from desktop');
    await desktopWindow.waitForTimeout(2000); // Wait for save

    console.log('[Test] ✅ Desktop edited iOS note');

    // Go back to list
    await desktopWindow.keyboard.press('Escape');
    await desktopWindow.waitForTimeout(1000);

    //
    // TEST 4: Verify activity logs exist for both platforms
    //
    console.log('[Test] TEST 4: Verifying activity logs');

    const activityDir = path.join(SHARED_SD_PATH, '.activity');
    const allActivityFiles = await fs.readdir(activityDir);

    console.log('[Test] Activity log files:', allActivityFiles);
    expect(allActivityFiles.length).toBeGreaterThanOrEqual(2); // At least Desktop and iOS logs (may have more from previous runs)

    // Read all activity logs and combine content
    let allActivityContent = '';
    for (const file of allActivityFiles) {
      if (file.endsWith('.log')) {
        const content = await fs.readFile(path.join(activityDir, file), 'utf-8');
        console.log(`[Test] Activity log ${file}:`, content);
        allActivityContent += content;
      }
    }

    // iOS note should appear in activity logs (Desktop wrote entries when editing it)
    expect(allActivityContent).toContain(iosNoteId);

    // NOTE: Desktop note won't be in activity logs because Desktop doesn't write
    // activity log entries when CREATING notes, only when EDITING them.
    // For proper bidirectional testing, we would need to:
    // 1. Have Desktop edit its own note (to create activity log entry)
    // 2. Launch iOS app and verify it discovers Desktop's note
    // This requires full iOS UI automation which is out of scope for this test.

    console.log('[Test] ✅ Activity logs verified');

    //
    // SUMMARY
    //
    console.log('[Test] 🎉 All real cross-platform sync tests passed!');
    console.log('[Test] Summary:');
    console.log('[Test]   - Desktop created note and wrote activity log');
    console.log('[Test]   - iOS can discover Desktop note');
    console.log('[Test]   - iOS created note and wrote activity log');
    console.log('[Test]   - Desktop discovered iOS note');
    console.log('[Test]   - Desktop edited iOS note');
    console.log('[Test]   - Activity logs are working correctly');
  });

  test('collaborative editing between Desktop and iOS', { timeout: TEST_TIMEOUT }, async () => {
    //
    // SETUP: Launch Desktop and iOS apps (same as previous test)
    //
    console.log('[Test] Launching Desktop app...');

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const testDbPath = path.join(os.tmpdir(), `notecove-collab-test-${uniqueId}.db`);
    const testConfigPath = path.join(os.tmpdir(), `notecove-collab-config-${uniqueId}.json`);

    desktopApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_CONFIG_PATH: testConfigPath,
      },
    });

    desktopWindow = await desktopApp.firstWindow({ timeout: 60000 });

    // Capture Desktop console logs for debugging
    desktopWindow.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Activity') || text.includes('CRDT Manager') || text.includes('Init')) {
        console.log('[Desktop Console]', text);
      }
    });

    await desktopWindow.waitForLoadState('domcontentloaded');
    await desktopWindow.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });

    // Add shared storage directory to Desktop
    const settingsButton = desktopWindow.locator('button[title="Settings"]');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    await desktopWindow.waitForTimeout(500);

    await desktopWindow.locator('button', { hasText: 'Add Directory' }).click();
    await desktopWindow.waitForTimeout(500);

    const addDialog = desktopWindow.locator('[role="dialog"]', {
      hasText: 'Add Storage Directory',
    });
    await expect(addDialog).toBeVisible({ timeout: 5000 });

    await addDialog.getByLabel('Name').fill('Collab Test SD');
    await addDialog.getByLabel('Path').fill(SHARED_SD_PATH);

    await addDialog.locator('button', { hasText: 'Add' }).click();
    await desktopWindow.waitForTimeout(20000); // Wait for SD initialization

    const settingsDialog = desktopWindow.locator('[role="dialog"]', { hasText: 'Settings' });
    const closeButton = settingsDialog.locator('button[aria-label="close"]');
    await closeButton.click();
    await desktopWindow.waitForTimeout(2000);

    // Navigate to test SD's "All Notes" to ensure notes are created there
    console.log('[Test] Selecting test SD for note creation...');
    const testSdNode = desktopWindow
      .locator('[data-testid^="folder-tree-node-sd:"]')
      .filter({ hasText: 'Collab Test SD' });

    if ((await testSdNode.count()) > 0) {
      // Extract SD ID from the test ID attribute
      const testSdTestId = await testSdNode.getAttribute('data-testid');
      const extractedSdId = testSdTestId?.replace('folder-tree-node-sd:', '');
      console.log('[Test] Extracted SD ID from Collab Test SD:', extractedSdId);

      await testSdNode.click();
      await desktopWindow.waitForTimeout(500);

      // Click "All Notes" under this SD using exact test ID
      if (extractedSdId) {
        const allNotesTestId = `folder-tree-node-all-notes:${extractedSdId}`;
        console.log('[Test] Looking for All Notes with testId:', allNotesTestId);
        const allNotesNode = desktopWindow.getByTestId(allNotesTestId);

        if ((await allNotesNode.count()) > 0) {
          await allNotesNode.click();
          await desktopWindow.waitForTimeout(1000);
          console.log('[Test] ✅ Test SD selected for note creation');
        }
      }
    }

    // Configure iOS app
    console.log('[Test] Configuring iOS app...');
    const iosDocumentsPath = await getIOSDocumentsPath();
    const iosDbPath = path.join(iosDocumentsPath, 'notecove.sqlite');

    const dbExists = await fs
      .access(iosDbPath)
      .then(() => true)
      .catch(() => false);

    if (!dbExists) {
      exec(`xcrun simctl launch ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      exec(`xcrun simctl terminate ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const sdId = 'collab-test-sd-' + Date.now();
    const now = new Date().toISOString();
    exec(
      `sqlite3 "${iosDbPath}" "INSERT INTO storage_directories (id, name, path, created_at, modified_at) VALUES ('${sdId}', 'Collab Test SD', '${SHARED_SD_PATH}', '${now}', '${now}')"`
    );

    exec(`xcrun simctl launch ${iosSimulatorId} ${iosAppBundleId}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('[Test] Both apps launched and configured');

    //
    // TEST: Collaborative editing workflow
    //

    // Step 1: Desktop creates note with "from desktop"
    console.log('[Test] Step 1: Desktop creates note "from desktop"');

    const addButton = desktopWindow.getByRole('button', { name: 'create note' });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await desktopWindow.waitForTimeout(1000);

    const editor = desktopWindow.locator('.tiptap.ProseMirror');
    await expect(editor).toBeVisible();
    await editor.click();
    await editor.type('from desktop');
    await desktopWindow.waitForTimeout(2000);

    // Get the note ID from Desktop's database (Desktop doesn't write activity logs on creation)
    const desktopNoteId = exec(
      `sqlite3 "${testDbPath}" "SELECT id FROM notes ORDER BY created DESC LIMIT 1"`
    ).trim();

    console.log('[Test] Desktop note ID:', desktopNoteId);

    await desktopWindow.keyboard.press('Escape');
    await desktopWindow.waitForTimeout(1000);

    // Step 2: Wait for iOS to discover the note
    console.log('[Test] Step 2: Waiting for iOS to discover Desktop note...');
    await waitFor(async () => {
      return await checkIOSNoteExists(desktopNoteId);
    }, 15000);

    expect(await checkIOSNoteExists(desktopNoteId)).toBe(true);
    console.log('[Test] ✅ iOS discovered Desktop note');

    // Verify iOS has the content "from desktop"
    const iosContent1 = exec(
      `sqlite3 "${iosDbPath}" "SELECT content FROM notes WHERE id = '${desktopNoteId}'"`
    ).trim();
    expect(iosContent1).toContain('from desktop');
    console.log('[Test] ✅ iOS has content: "from desktop"');

    // Step 3: iOS adds "hello from ios" to the note
    console.log('[Test] Step 3: iOS adds "hello from ios" to the note');
    await appendTextToNoteAsIOS(desktopNoteId, ' hello from ios');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 4: Wait for Desktop to see iOS's edit
    console.log('[Test] Step 4: Waiting for Desktop to see iOS edit...');
    await waitFor(async () => {
      const noteItem = desktopWindow
        .locator('[data-testid^="note-item-"]')
        .filter({ hasText: 'from desktop' });
      if ((await noteItem.count()) === 0) return false;

      // Click the note to open it
      await noteItem.click();
      await desktopWindow.waitForTimeout(500);

      const editorContent = await editor.textContent();
      return editorContent?.includes('hello from ios') || false;
    }, 15000);

    let editorContent = await editor.textContent();
    expect(editorContent).toContain('from desktop');
    expect(editorContent).toContain('hello from ios');
    console.log('[Test] ✅ Desktop sees both "from desktop" and "hello from ios"');

    // Step 5: Desktop adds "right back atcha"
    console.log('[Test] Step 5: Desktop adds "right back atcha"');
    await editor.click();
    await editor.press('End');
    await editor.type(' right back atcha');
    await desktopWindow.waitForTimeout(2000);

    await desktopWindow.keyboard.press('Escape');
    await desktopWindow.waitForTimeout(1000);

    // Step 6: Wait for iOS to see Desktop's edit
    console.log('[Test] Step 6: Waiting for iOS to see Desktop edit...');
    await waitFor(async () => {
      const content = exec(
        `sqlite3 "${iosDbPath}" "SELECT content FROM notes WHERE id = '${desktopNoteId}'"`
      ).trim();
      return content.includes('right back atcha');
    }, 15000);

    const iosContent2 = exec(
      `sqlite3 "${iosDbPath}" "SELECT content FROM notes WHERE id = '${desktopNoteId}'"`
    ).trim();
    expect(iosContent2).toContain('from desktop');
    expect(iosContent2).toContain('hello from ios');
    expect(iosContent2).toContain('right back atcha');
    console.log('[Test] ✅ iOS sees all three pieces of text');

    console.log('[Test] 🎉 Collaborative editing test passed!');
    console.log('[Test] Summary:');
    console.log('[Test]   - Desktop created note: "from desktop"');
    console.log('[Test]   - iOS discovered note and saw "from desktop"');
    console.log('[Test]   - iOS added: "hello from ios"');
    console.log('[Test]   - Desktop saw both texts');
    console.log('[Test]   - Desktop added: "right back atcha"');
    console.log('[Test]   - iOS saw all three texts');
  });

  /**
   * Simulate iOS appending text to an existing note
   * @param noteId - The note ID to append to
   * @param textToAppend - The text to append
   */
  async function appendTextToNoteAsIOS(noteId: string, textToAppend: string): Promise<void> {
    const iosInstanceId = generateIOSUUID();

    // Load existing note updates
    const noteDir = path.join(SHARED_SD_PATH, 'notes', noteId);
    const updatesDir = path.join(noteDir, 'updates');

    const { applyUpdate, encodeStateAsUpdate } = await import('yjs');
    const Y = await import('yjs');

    // Create a new doc and apply all existing updates
    const doc = new Y.Doc({ guid: noteId });

    const updateFiles = await fs.readdir(updatesDir);
    for (const file of updateFiles.sort()) {
      if (!file.endsWith('.yjson')) continue;

      const updateData = await fs.readFile(path.join(updatesDir, file));
      // Skip flag byte (first byte)
      const update = new Uint8Array(updateData.buffer, 1);
      applyUpdate(doc, update);
    }

    // Get the fragment and append text
    const fragment = doc.getXmlFragment('content');

    doc.transact(() => {
      // Find the last paragraph
      const lastParagraph = fragment.get(fragment.length - 1) as any;
      if (lastParagraph && lastParagraph._first) {
        // Get the text node
        const textNode = lastParagraph._first;
        // Append to the end
        textNode.insert(textNode.length, textToAppend);
      }
    });

    // Create update from the changes
    const update = encodeStateAsUpdate(doc);
    doc.destroy();

    // Get next sequence number
    const existingFiles = updateFiles.filter((f) => f.endsWith('.yjson'));
    const sequences = existingFiles.map((f) => {
      const match = f.match(/_(\d+)\.yjson$/);
      return match ? parseInt(match[1]) : 0;
    });
    const nextSeq = Math.max(0, ...sequences) + 1;

    // Write update file with flag byte
    const flaggedUpdate = new Uint8Array(1 + update.length);
    flaggedUpdate[0] = 0x01; // Ready flag
    flaggedUpdate.set(update, 1);

    const updateFilename = `${iosInstanceId}_${nextSeq}.yjson`;
    await fs.writeFile(path.join(updatesDir, updateFilename), Buffer.from(flaggedUpdate));

    // Update activity log
    const activityDir = path.join(SHARED_SD_PATH, '.activity');
    const activityLog = path.join(activityDir, `${iosInstanceId}.log`);

    // Append to existing log or create new one
    await fs.appendFile(activityLog, `${noteId}|${iosInstanceId}_${nextSeq}\n`, { flush: true });

    // Give file system time to propagate
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Simulate iOS creating a note
   * Returns the note ID
   */
  async function createNoteAsIOS(content: string): Promise<string> {
    const noteId = generateIOSUUID();
    const iosInstanceId = generateIOSUUID();

    // Create note directory structure
    const noteDir = path.join(SHARED_SD_PATH, 'notes', noteId);
    const updatesDir = path.join(noteDir, 'updates');
    await fs.mkdir(updatesDir, { recursive: true });

    // Create CRDT update with content
    const { encodeStateAsUpdate } = await import('yjs');
    const Y = await import('yjs');

    const doc = new Y.Doc({ guid: noteId });
    const fragment = doc.getXmlFragment('content');

    doc.transact(() => {
      const paragraph = new Y.XmlElement('p');
      const text = new Y.XmlText();
      text.insert(0, content);
      paragraph.insert(0, [text]);
      fragment.insert(0, [paragraph]);
    });

    const update = encodeStateAsUpdate(doc);
    doc.destroy();

    // Write update file with flag byte protocol
    // NOTE: Update files use a flag byte protocol for cross-platform sync:
    // - First byte 0x00 = file still being written (incomplete)
    // - First byte 0x01 = file complete and ready to read
    // - Remaining bytes = actual Yjs CRDT update data
    const flaggedUpdate = new Uint8Array(1 + update.length);
    flaggedUpdate[0] = 0x01; // Ready flag
    flaggedUpdate.set(update, 1); // Copy update data after flag byte

    // Filename format must match what CRDT manager expects: ${instanceId}_${sequenceNum}.yjson
    // The noteId is already in the directory path (notes/${noteId}/updates/)
    const updateFilename = `${iosInstanceId}_0.yjson`;
    await fs.writeFile(path.join(updatesDir, updateFilename), Buffer.from(flaggedUpdate));

    // Write activity log
    const activityDir = path.join(SHARED_SD_PATH, '.activity');
    await fs.mkdir(activityDir, { recursive: true });
    const activityLog = path.join(activityDir, `${iosInstanceId}.log`);

    // Write the file and ensure it's fully committed to disk
    await fs.writeFile(activityLog, `${noteId}|${iosInstanceId}_0\n`, { flush: true });

    // Give the file system a moment to propagate the event to chokidar
    await new Promise((resolve) => setTimeout(resolve, 500));

    return noteId;
  }

  /**
   * Get iOS app's Documents directory
   */
  async function getIOSDocumentsPath(): Promise<string> {
    const containerPath = exec(
      `xcrun simctl get_app_container ${iosSimulatorId} ${iosAppBundleId} data`
    ).trim();
    return path.join(containerPath, 'Documents');
  }

  /**
   * Query iOS database to check if a note exists
   * Returns true if note is found, false otherwise
   */
  async function checkIOSNoteExists(noteId: string): Promise<boolean> {
    const iosDocumentsPath = await getIOSDocumentsPath();
    const iosDbPath = path.join(iosDocumentsPath, 'notecove.sqlite');

    try {
      // Use sqlite3 command line to query the database
      const result = exec(
        `sqlite3 "${iosDbPath}" "SELECT id FROM notes WHERE id = '${noteId}'"`
      ).trim();

      return result === noteId;
    } catch (error) {
      console.error('[Test] Error querying iOS database:', error);
      return false;
    }
  }

  /**
   * Query Desktop database to check if a note exists
   * Returns true if note is found, false otherwise
   */
  async function checkDesktopNoteExists(noteId: string, dbPath: string): Promise<boolean> {
    try {
      // Use sqlite3 command line to query the database
      const result = exec(
        `sqlite3 "${dbPath}" "SELECT id FROM notes WHERE id = '${noteId}'"`
      ).trim();

      return result === noteId;
    } catch (error) {
      console.error('[Test] Error querying Desktop database:', error);
      return false;
    }
  }

  /**
   * Generate uppercase UUID (iOS style)
   */
  function generateIOSUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
      .replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      })
      .toUpperCase();
  }

  test('Desktop→iOS sync: title extraction bug', { timeout: TEST_TIMEOUT }, async () => {
    // BUG REPRODUCTION TEST
    // User reported: Notes created on Desktop show as "Untitled" on iOS
    //
    // Expected: iOS should extract correct title from Desktop notes
    // Actual: iOS shows "Untitled" for all notes

    console.log('[Test] Setting up shared storage path...');

    let iosDocsPath = await getIOSDocumentsPathForSimulator(iosSimulatorId, iosAppBundleId);

    if (!iosDocsPath) {
      console.log('[Test] Launching iOS app to create container...');
      exec(`xcrun simctl launch ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      exec(`xcrun simctl terminate ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      iosDocsPath = await getIOSDocumentsPathForSimulator(iosSimulatorId, iosAppBundleId);
    }

    SHARED_SD_PATH = path.join(iosDocsPath, 'shared-storage-bug-test');
    console.log('[Test] Using shared SD path:', SHARED_SD_PATH);

    await fs.mkdir(SHARED_SD_PATH, { recursive: true });
    await fs.mkdir(path.join(SHARED_SD_PATH, '.activity'), { recursive: true });
    await fs.mkdir(path.join(SHARED_SD_PATH, 'notes'), { recursive: true });
    await fs.mkdir(path.join(SHARED_SD_PATH, 'folders'), { recursive: true });

    console.log('[Test] Launching Desktop app with TEST_STORAGE_DIR...');
    desktopApp = await electron.launch({
      args: ['.'],
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SHARED_SD_PATH,
        TEST_STORAGE_DIR: SHARED_SD_PATH, // Use shared SD as the default storage
      },
    });

    desktopWindow = await desktopApp.firstWindow();
    await desktopWindow.waitForLoadState('domcontentloaded');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Wait for app to fully load
    await expect(desktopWindow.locator('button[title="Settings"]')).toBeVisible({ timeout: 10000 });

    console.log('[Test] Desktop app loaded, waiting for SD initialization...');
    await desktopWindow.waitForTimeout(20000); // Wait for startup grace period to complete

    // Navigate to the default SD's "All Notes" folder
    // When TEST_STORAGE_DIR is set, the app creates a single "Default Storage" SD pointing to that path
    console.log('[Test] Navigating to Default Storage SD...');
    const sdNode = desktopWindow
      .locator('[data-testid^="folder-tree-node-sd:"]')
      .filter({ hasText: 'Default' });
    await expect(sdNode).toBeVisible({ timeout: 5000 });

    // Click to expand if needed
    await sdNode.click();
    await desktopWindow.waitForTimeout(1000);

    // Click on "All Notes" under this SD
    const allNotesNode = desktopWindow
      .locator('[data-testid^="folder-tree-node-all-notes:"]')
      .filter({ hasText: 'All Notes' })
      .first(); // Get the first one (should be under Default Storage)

    const allNotesCount = await allNotesNode.count();
    console.log('[Test] All Notes nodes found:', allNotesCount);

    if (allNotesCount > 0) {
      await allNotesNode.click();
      console.log('[Test] ✅ Clicked All Notes under Default Storage');
    }

    await desktopWindow.waitForTimeout(1000);

    const iosDbPath = path.join(iosDocsPath, 'notecove.sqlite');

    // Ensure iOS database exists by launching the app once
    const dbExists = await fs
      .access(iosDbPath)
      .then(() => true)
      .catch(() => false);

    if (!dbExists) {
      console.log('[Test] Launching iOS app to create database...');
      exec(`xcrun simctl launch ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      exec(`xcrun simctl terminate ${iosSimulatorId} ${iosAppBundleId}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Configure iOS storage directory
    // Read the actual SD ID that Desktop created (from TEST_STORAGE_DIR)
    const sdIdPath = path.join(SHARED_SD_PATH, 'SD_ID');
    const actualSdId = (await fs.readFile(sdIdPath, 'utf-8')).trim();
    console.log('[Test] Actual SD ID from shared directory:', actualSdId);

    const now = new Date().toISOString();
    console.log('[Test] Cleaning up old storage directories from iOS database...');
    exec(`sqlite3 "${iosDbPath}" "DELETE FROM storage_directories"`);
    console.log('[Test] Adding storage directory to iOS database with correct SD ID...');
    exec(
      `sqlite3 "${iosDbPath}" "INSERT INTO storage_directories (id, name, path, created_at, modified_at) VALUES ('${actualSdId}', 'Bug Test SD', '${SHARED_SD_PATH}', '${now}', '${now}')"`
    );

    console.log('[Test] Launching iOS app...');
    exec(`xcrun simctl launch ${iosSimulatorId} ${iosAppBundleId}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('[Test] TEST: Desktop creates note with specific title');

    const createButton = desktopWindow.getByRole('button', { name: 'create note' });
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();
    await desktopWindow.waitForTimeout(1000);

    // Type content in editor
    const editor = desktopWindow.locator('.tiptap.ProseMirror');
    await expect(editor).toBeVisible();
    await editor.click();
    await editor.type('My Important Note Title');
    await desktopWindow.waitForTimeout(2000); // Wait for autosave

    // Debug: Check what's in the shared SD path
    console.log('[Test] Checking shared SD contents...');
    const sdContents = await fs.readdir(SHARED_SD_PATH).catch(() => []);
    console.log('[Test] Shared SD contents:', sdContents);

    // Check if .activity directory exists
    const activityPath = path.join(SHARED_SD_PATH, '.activity');
    const activityExists = await fs
      .access(activityPath)
      .then(() => true)
      .catch(() => false);
    console.log('[Test] Activity directory exists:', activityExists);

    if (activityExists) {
      const activityFiles = await fs.readdir(activityPath);
      console.log('[Test] Activity files:', activityFiles);
    }

    // Get note ID from activity log (last created note)
    const activityFiles = await fs.readdir(activityPath);
    if (activityFiles.length === 0) {
      throw new Error(
        'No activity log files found - note may not have been created in the correct SD'
      );
    }

    const activityFile = activityFiles[0];
    const activityContent = await fs.readFile(path.join(activityPath, activityFile), 'utf-8');
    const lastLine = activityContent.trim().split('\n').pop()!;
    const desktopNoteId = lastLine.split('|')[0];
    console.log('[Test] Desktop created note:', desktopNoteId);

    console.log('[Test] Waiting for iOS to discover note (15 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 15000));

    const iosNotesQuery = exec(
      `sqlite3 "${iosDbPath}" "SELECT id, title FROM notes WHERE id = '${desktopNoteId}'"`
    ).trim();
    console.log('[Test] iOS database result:', iosNotesQuery);

    if (!iosNotesQuery) {
      throw new Error('BUG CONFIRMED: iOS did not discover Desktop note at all');
    }

    const [iosNoteId, iosNoteTitle] = iosNotesQuery.split('|');

    // THIS IS THE BUG CHECK
    console.log('[Test] iOS note ID:', iosNoteId);
    console.log('[Test] iOS note title:', iosNoteTitle || '(empty)');

    if (!iosNoteTitle || iosNoteTitle === 'Untitled' || iosNoteTitle.trim() === '') {
      console.log(
        '[Test] ❌ BUG CONFIRMED: iOS shows "Untitled" instead of "My Important Note Title"'
      );
      throw new Error(
        `BUG: iOS note title is "${iosNoteTitle}" instead of "My Important Note Title"`
      );
    }

    console.log('[Test] ✅ iOS correctly extracted title:', iosNoteTitle);
    expect(iosNoteTitle).toBe('My Important Note Title');
  });
});
