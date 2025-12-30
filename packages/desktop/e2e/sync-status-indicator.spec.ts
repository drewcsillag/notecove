/**
 * E2E tests for Sync Status Indicator
 *
 * Tests the sync status indicator component and IPC methods.
 * @see plans/stale-sync-ux/PLAN.md - Step 2
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;
let testStorageDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
  const testId = Date.now().toString();

  // Create temporary directories
  testUserDataDir = await mkdtemp(join(tmpdir(), `notecove-e2e-${testId}-`));
  testStorageDir = await mkdtemp(join(tmpdir(), `notecove-storage-${testId}-`));

  console.log('[E2E SyncStatus] User data dir:', testUserDataDir);
  console.log('[E2E SyncStatus] Storage dir:', testStorageDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_STORAGE_DIR: testStorageDir,
    },
    timeout: 60000,
  });

  electronApp.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('[Electron Console Error]:', msg.text());
    }
  });

  page = await electronApp.firstWindow();

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('SyncStatus')) {
      console.log('[Renderer Console]:', msg.text());
    }
  });
}, 60000);

test.afterEach(async () => {
  await electronApp.close();

  // Clean up temporary directories
  try {
    await rm(testUserDataDir, { recursive: true, force: true });
    await rm(testStorageDir, { recursive: true, force: true });
  } catch (err) {
    console.error('[E2E SyncStatus] Cleanup error:', err);
  }
});

test.describe('Sync Status Indicator', () => {
  test('sync:getStatus IPC returns valid structure', async () => {
    // Wait for app to load
    await page.waitForSelector('text=Folders', { timeout: 15000 });

    // Call the sync status API directly
    const status = await page.evaluate(() => window.electronAPI.sync.getStatus());

    // Verify the response structure
    expect(status).toHaveProperty('pendingCount');
    expect(status).toHaveProperty('perSd');
    expect(status).toHaveProperty('isSyncing');
    expect(typeof status.pendingCount).toBe('number');
    expect(Array.isArray(status.perSd)).toBe(true);
    expect(typeof status.isSyncing).toBe('boolean');

    console.log('[E2E SyncStatus] Initial status:', JSON.stringify(status));

    // Also check polling group status
    const pollingStatus = await page.evaluate(() => window.electronAPI.polling.getGroupStatus());
    console.log('[E2E SyncStatus] Polling group status:', JSON.stringify(pollingStatus));

    // When no syncs are pending AND polling group is empty, indicator should not be visible
    if (!status.isSyncing && (!pollingStatus || pollingStatus.totalEntries === 0)) {
      const indicator = page.locator('[data-testid="sync-status-indicator"]');
      await expect(indicator).not.toBeVisible();
    }
  });

  test('indicator hidden when no syncs in progress', async () => {
    // Wait for app to load completely
    await page.waitForSelector('text=Folders', { timeout: 15000 });

    // Wait a moment for any initial syncs to complete
    await page.waitForTimeout(2000);

    // Check sync status is idle
    const status = await page.evaluate(() => window.electronAPI.sync.getStatus());
    console.log('[E2E SyncStatus] Status after load:', JSON.stringify(status));

    // Also check polling group status (two-tier system)
    const pollingStatus = await page.evaluate(() => window.electronAPI.polling.getGroupStatus());
    console.log('[E2E SyncStatus] Polling status after load:', JSON.stringify(pollingStatus));

    // The indicator should not be visible when no syncs are pending AND polling group is empty
    const indicator = page.locator('[data-testid="sync-status-indicator"]');

    // With two-tier system, indicator shows when either:
    // 1. Tier 1 (fast-path) syncs are active (isSyncing = true)
    // 2. Tier 2 (polling group) has entries
    // So indicator is hidden only when both are false/empty
    if (!status.isSyncing && (!pollingStatus || pollingStatus.totalEntries === 0)) {
      await expect(indicator).not.toBeVisible();
    }
  });

  test('perSd array contains SD information when SDs exist', async () => {
    // Wait for app to load
    await page.waitForSelector('text=Folders', { timeout: 15000 });

    // Wait for initial setup to complete
    await page.waitForTimeout(1000);

    // Get sync status
    const status = await page.evaluate(() => window.electronAPI.sync.getStatus());

    console.log('[E2E SyncStatus] perSd array:', JSON.stringify(status.perSd));

    // Each perSd entry should have the required fields
    for (const sd of status.perSd) {
      expect(sd).toHaveProperty('sdId');
      expect(sd).toHaveProperty('sdName');
      expect(sd).toHaveProperty('pendingCount');
      expect(sd).toHaveProperty('pendingNoteIds');
      expect(typeof sd.sdId).toBe('string');
      expect(typeof sd.sdName).toBe('string');
      expect(typeof sd.pendingCount).toBe('number');
      expect(Array.isArray(sd.pendingNoteIds)).toBe(true);
    }
  });
});
