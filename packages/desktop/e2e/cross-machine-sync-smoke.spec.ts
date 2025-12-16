/**
 * Cross-Machine Sync E2E Tests - Smoke Test
 *
 * Step 2: Smoke Test - Two Instances with Shared SD
 *
 * This test validates that:
 * 1. We can launch two Electron instances with separate user-data directories
 * 2. Both instances can share the same SD directory
 * 3. Edits in one instance appear in the other (via existing file-based sync)
 *
 * This is the foundation test that proves our two-instance setup works before
 * we add the file sync simulator.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { getFirstWindow } from './cross-machine-sync-helpers';

test.describe('cross-machine sync - smoke test', () => {
  let instance1: ElectronApplication;
  let instance2: ElectronApplication;
  let window1: Page;
  let window2: Page;
  let sharedStorageDir: string;
  let userDataDir1: string;
  let userDataDir2: string;

  test.beforeEach(async () => {
    const testId = Date.now().toString();

    // Create temporary directories for this test
    sharedStorageDir = await mkdtemp(join(tmpdir(), `notecove-shared-sd-${testId}-`));
    userDataDir1 = await mkdtemp(join(tmpdir(), `notecove-userdata1-${testId}-`));
    userDataDir2 = await mkdtemp(join(tmpdir(), `notecove-userdata2-${testId}-`));

    console.log('[Smoke Test] Test ID:', testId);
    console.log('[Smoke Test] Shared SD:', sharedStorageDir);
    console.log('[Smoke Test] User data 1:', userDataDir1);
    console.log('[Smoke Test] User data 2:', userDataDir2);

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Launch first instance
    console.log('[Smoke Test] Launching instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sharedStorageDir,
        INSTANCE_ID: 'smoke-test-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await getFirstWindow(instance1);
    window1.on('console', (msg) => {
      console.log('[Instance1 Renderer]:', msg.text());
    });

    // Wait for instance 1 to be ready
    await window1.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window1.waitForTimeout(1000);

    // Launch second instance with same storage directory but different user data
    console.log('[Smoke Test] Launching instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sharedStorageDir,
        INSTANCE_ID: 'smoke-test-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Renderer]:', msg.text());
    });

    // Wait for instance 2 to be ready
    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window2.waitForTimeout(1000);

    console.log('[Smoke Test] Both instances ready');
  }, 120000); // 2 minute timeout for setup

  test.afterEach(async () => {
    console.log('[Smoke Test] Cleaning up...');

    if (instance1) {
      await instance1.close();
    }
    if (instance2) {
      await instance2.close();
    }

    // Clean up temporary directories
    try {
      await rm(sharedStorageDir, { recursive: true, force: true });
      await rm(userDataDir1, { recursive: true, force: true });
      await rm(userDataDir2, { recursive: true, force: true });
      console.log('[Smoke Test] Cleanup complete');
    } catch (error) {
      console.error('[Smoke Test] Cleanup failed:', error);
    }
  });

  test('should launch two instances and sync edits via shared SD', async () => {
    // This test verifies the basic two-instance setup works
    // Both instances share the same SD, so sync happens through the filesystem directly
    // (no file sync simulator yet - that comes in later steps)

    // Get the editor in instance 1
    const editor1 = window1.locator('.ProseMirror');
    await editor1.waitFor({ state: 'visible', timeout: 5000 });

    // Type some content in instance 1
    const testContent = `Smoke test content ${Date.now()}`;
    console.log('[Smoke Test] Typing in instance 1:', testContent);
    await editor1.click();
    await editor1.fill(testContent);

    // Wait for the content to be saved and synced
    await window1.waitForTimeout(3000);

    // Get the editor in instance 2
    const editor2 = window2.locator('.ProseMirror');
    await editor2.waitFor({ state: 'visible', timeout: 5000 });

    // Verify the content appears in instance 2
    // Note: Due to the live editor sync bug (to be fixed in Step 10), we can't verify live updates.
    // For the smoke test, we verify that:
    // 1. The backend sync occurred (check logs)
    // 2. A new instance can see the synced content
    console.log('[Smoke Test] Waiting for sync to complete in instance 2...');
    await window2.waitForTimeout(5000); // Wait for activity sync to trigger

    // Close instance 2 and relaunch to verify content persisted
    console.log('[Smoke Test] Closing instance 2 to verify persistence...');
    await instance2.close();

    // Relaunch instance 2
    console.log('[Smoke Test] Relaunching instance 2...');
    instance2 = await electron.launch({
      args: [
        resolve(__dirname, '..', 'dist-electron', 'main', 'index.js'),
        `--user-data-dir=${userDataDir2}`,
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sharedStorageDir,
        INSTANCE_ID: 'smoke-test-instance-2-relaunch',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2 Relaunch]:', msg.text());
    });

    window2 = await getFirstWindow(instance2);
    window2.on('console', (msg) => {
      console.log('[Instance2 Relaunch Renderer]:', msg.text());
    });

    // Wait for instance 2 to be ready
    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window2.waitForTimeout(2000);

    // Now check if the content is there
    const editor2Relaunched = window2.locator('.ProseMirror');
    await expect(editor2Relaunched).toContainText(testContent, { timeout: 5000 });

    console.log('[Smoke Test] ✅ Content synced successfully and persisted between instances');

    // Checkpoint: Two-instance Playwright setup works, we can see sync behavior through persistence
    // Live editor updates don't work yet - that's the bug we'll fix in Step 10
  });
});
