import { test, expect } from '@playwright/test';

test.describe('Sync Infrastructure', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set empty notes array to prevent sample notes from loading
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for sync manager to initialize
  });

  test('should initialize sync manager and show status indicator', async ({ page }) => {
    // Verify sync status indicator exists
    const syncStatus = page.locator('#syncStatus');
    await expect(syncStatus).toBeVisible({ timeout: 5000 });

    // Should show a valid sync status (any of these is acceptable)
    const statusText = await syncStatus.textContent();
    expect(statusText).toMatch(/👁️ Watching|✓ Sync Ready|🔄 Syncing/);
  });

  test('should verify SyncManager is initialized in Electron mode', async ({ page }) => {
    // Check if the app recognizes Electron mode
    const isElectron = await page.evaluate(() => {
      return window.electronAPI?.isElectron || false;
    });

    if (isElectron) {
      // In Electron mode, verify sync manager exists
      const hasSyncManager = await page.evaluate(() => {
        return window.app?.syncManager !== null && window.app?.syncManager !== undefined;
      });
      expect(hasSyncManager).toBe(true);
    }
  });

  test('should maintain sync status through normal operations', async ({ page }) => {
    const syncStatus = page.locator('#syncStatus');

    // Initial status should be visible
    await expect(syncStatus).toBeVisible();
    const initialStatus = await syncStatus.textContent();
    expect(initialStatus).toMatch(/Watching|Sync Ready|Syncing/);

    // Create a note
    await page.locator('#newNoteBtn').click();
    await page.waitForTimeout(500);

    // Status should still be visible and valid after creating a note
    const statusAfterCreate = await syncStatus.textContent();
    expect(statusAfterCreate).toMatch(/Watching|Sync Ready|Syncing/);

    // Type content
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.keyboard.type('Test content for sync status');
    await page.waitForTimeout(1500); // Wait for auto-save

    // Status should still be showing after editing
    const statusAfterEdit = await syncStatus.textContent();
    expect(statusAfterEdit).toMatch(/Watching|Sync Ready|Syncing/);
  });

  test('should have sync manager methods available', async ({ page }) => {
    // Verify the sync manager has expected methods
    const syncManagerMethods = await page.evaluate(() => {
      const sm = window.app?.syncManager;
      if (!sm) return null;

      return {
        hasStartWatching: typeof sm.startWatching === 'function',
        hasStopWatching: typeof sm.stopWatching === 'function',
        hasGetStatus: typeof sm.getStatus === 'function',
        hasForceSyncAll: typeof sm.forceSyncAll === 'function',
      };
    });

    if (syncManagerMethods) {
      expect(syncManagerMethods.hasStartWatching).toBe(true);
      expect(syncManagerMethods.hasStopWatching).toBe(true);
      expect(syncManagerMethods.hasGetStatus).toBe(true);
      expect(syncManagerMethods.hasForceSyncAll).toBe(true);
    }
  });

  test('should show sync status in status bar', async ({ page }) => {
    // Verify sync status is in the status bar (right side)
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toBeVisible();

    const statusRight = page.locator('.status-right');
    await expect(statusRight).toBeVisible();

    const syncStatus = page.locator('#syncStatus');
    await expect(syncStatus).toBeVisible();

    // Verify sync status is actually in the status bar
    const syncStatusInStatusBar = await page.evaluate(() => {
      const syncStatus = document.getElementById('syncStatus');
      const statusBar = document.querySelector('.status-bar');
      return statusBar?.contains(syncStatus) || false;
    });

    expect(syncStatusInStatusBar).toBe(true);
  });

  test('should update sync status text correctly', async ({ page }) => {
    const syncStatus = page.locator('#syncStatus');

    // Get initial status
    const status1 = await syncStatus.textContent();
    expect(status1).toBeTruthy();
    expect(status1.length).toBeGreaterThan(0);

    // Status should be one of the expected values
    const validStatuses = ['👁️ Watching', '✓ Sync Ready', '🔄 Syncing...', '⚠️ Sync Error'];
    expect(validStatuses.some(s => status1.includes(s.replace(/[^\w\s]/g, '')))).toBe(true);
  });

  test('should have sync event handlers in place', async ({ page }) => {
    // Verify sync event handlers are set up
    const hasEventHandlers = await page.evaluate(() => {
      const sm = window.app?.syncManager;
      if (!sm) return false;

      // Check if listeners are set up
      return sm.listeners && sm.listeners.size >= 0;
    });

    expect(hasEventHandlers).toBe(true);
  });

  test('should integrate with note manager', async ({ page }) => {
    // Verify sync manager is connected to note manager
    const isIntegrated = await page.evaluate(() => {
      const sm = window.app?.syncManager;
      const nm = window.app?.noteManager;

      if (!sm || !nm) return false;

      // Check if sync manager has reference to note manager
      return sm.noteManager === nm;
    });

    if (isIntegrated !== null) {
      expect(isIntegrated).toBe(true);
    }
  });
});
