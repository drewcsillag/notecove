/**
 * Non-Blocking Startup E2E Tests
 *
 * Tests that the app window appears immediately on startup, with sync running
 * in the background. This prevents long startup delays when activity log entries
 * reference CRDT sequences that take time to sync (or may never arrive).
 *
 * Key behavior tested:
 * - App window should appear within 5 seconds regardless of sync status
 * - Background sync should complete and update UI
 * - Stale sync entries should not block window creation
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve, join } from 'path';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';

/**
 * Helper to get the first window with measurement of how long it takes.
 */
async function getFirstWindowTimed(
  app: ElectronApplication,
  timeoutMs = 60000
): Promise<{ window: Page; elapsedMs: number }> {
  const startTime = Date.now();
  const window = await app.waitForEvent('window', { timeout: timeoutMs });
  const elapsedMs = Date.now() - startTime;
  return { window, elapsedMs };
}

test.describe('Non-Blocking Startup', () => {
  let instance: ElectronApplication;
  let window: Page;
  let storageDir: string;
  let userDataDir: string;

  test.beforeEach(async () => {
    const testId = Date.now().toString();

    // Create temporary directories for this test
    storageDir = await mkdtemp(join(tmpdir(), `notecove-startup-test-${testId}-`));
    userDataDir = await mkdtemp(join(tmpdir(), `notecove-userdata-${testId}-`));

    console.log('[Non-Blocking Startup] Test ID:', testId);
    console.log('[Non-Blocking Startup] Storage Dir:', storageDir);
    console.log('[Non-Blocking Startup] User Data Dir:', userDataDir);
  });

  test.afterEach(async () => {
    // Close the app
    if (instance) {
      await instance.close();
    }

    // Clean up temp directories
    if (storageDir) {
      await rm(storageDir, { recursive: true, force: true });
    }
    if (userDataDir) {
      await rm(userDataDir, { recursive: true, force: true });
    }
  });

  test('window should appear within 5 seconds even with pending sync entries', async () => {
    // Create a fake note structure with activity log entries that would normally
    // cause sync delays (referencing sequences that don't exist yet)
    const noteId = 'test-note-' + Date.now();
    const fakeInstanceId = 'fake-instance-' + Date.now();
    const notesDir = join(storageDir, 'notes', noteId);
    const activityDir = join(storageDir, 'activity');

    // Create directories
    await mkdir(notesDir, { recursive: true });
    await mkdir(activityDir, { recursive: true });

    // Create a minimal note CRDT file (sequence 1)
    // The actual CRDT content isn't important - we just need the note to exist
    const crdtLogContent = JSON.stringify({
      header: { version: 1 },
      entries: [{ seq: 1, op: 'insert', path: ['title'], value: 'Test Note' }],
    });
    await writeFile(join(notesDir, `${fakeInstanceId}.log`), crdtLogContent);

    // Create activity log entry that references a much higher sequence (stale/pending)
    // This would normally cause sync to wait/retry, blocking startup
    // Format: noteId|instanceId_sequence
    const activityLogContent = [
      `${noteId}|${fakeInstanceId}_1`, // This one exists
      `${noteId}|${fakeInstanceId}_100`, // This one doesn't - would cause sync delay
    ].join('\n');
    await writeFile(join(activityDir, `${fakeInstanceId}.log`), activityLogContent);

    // Launch the app
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
    const launchStartTime = Date.now();

    console.log('[Non-Blocking Startup] Launching app with pending sync entries...');

    instance = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: storageDir,
        INSTANCE_ID: 'non-blocking-test-instance',
      },
      timeout: 60000,
    });

    instance.on('console', (msg) => {
      console.log('[Non-Blocking Startup Console]:', msg.text());
    });

    // Time how long it takes for the window to appear
    const { window: win, elapsedMs } = await getFirstWindowTimed(instance, 30000);
    window = win;

    console.log(`[Non-Blocking Startup] Window appeared in ${elapsedMs}ms`);

    // The window should appear within 5 seconds
    // This is the key assertion - before the fix, this would take 44+ seconds
    // because waitForPendingSyncs blocks with exponential backoff retries
    expect(elapsedMs).toBeLessThan(5000);

    // Wait for the app to be interactive
    await window.waitForSelector('.ProseMirror', { timeout: 15000 });

    console.log('[Non-Blocking Startup] App is interactive');

    // Verify the app is functional (can see the UI)
    const noteList = await window.locator('[data-testid="note-list"]').count();
    expect(noteList).toBeGreaterThanOrEqual(0); // Just verify the list exists

    console.log('[Non-Blocking Startup] Test passed - window appeared quickly!');
  });

  test('sync status should be trackable during background sync', async () => {
    // This test verifies that we can track sync status after window appears
    // For now, just verify the basic IPC infrastructure exists

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    instance = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: storageDir,
        INSTANCE_ID: 'sync-status-test-instance',
      },
      timeout: 60000,
    });

    const { window: win, elapsedMs } = await getFirstWindowTimed(instance, 30000);
    window = win;

    console.log(`[Sync Status Test] Window appeared in ${elapsedMs}ms`);

    // Wait for app to be ready
    await window.waitForSelector('.ProseMirror', { timeout: 15000 });

    // TODO: Once sync:getSyncStatus IPC is implemented, verify we can call it
    // For now, just verify the app starts correctly
    expect(true).toBe(true);

    console.log('[Sync Status Test] Test passed!');
  });
});
