/**
 * Cross-Machine Sync E2E Tests - Comments
 *
 * Tests for comment sync across two app instances:
 * 1. Concurrent comment creation on same text - both threads preserved
 * 2. Comment content syncs live without note switch
 * 3. Replies sync live
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileSyncSimulator, SimulatorLogger } from './utils/sync-simulator';
import { getFirstWindow } from './cross-machine-sync-helpers';

test.describe('cross-machine sync - comments', () => {
  let instance1: ElectronApplication;
  let instance2: ElectronApplication;
  let window1: Page;
  let window2: Page;
  let sd1: string;
  let sd2: string;
  let userDataDir1: string;
  let userDataDir2: string;
  let simulator: FileSyncSimulator;

  test.beforeEach(async () => {
    const testId = Date.now().toString();

    // Create separate SD directories for each instance
    sd1 = await mkdtemp(join(tmpdir(), `notecove-comments-sd1-${testId}-`));
    sd2 = await mkdtemp(join(tmpdir(), `notecove-comments-sd2-${testId}-`));
    userDataDir1 = await mkdtemp(join(tmpdir(), `notecove-comments-userdata1-${testId}-`));
    userDataDir2 = await mkdtemp(join(tmpdir(), `notecove-comments-userdata2-${testId}-`));

    console.log('[Comments Sync] Test ID:', testId);
    console.log('[Comments Sync] SD1:', sd1);
    console.log('[Comments Sync] SD2:', sd2);
  }, 180000);

  test.afterEach(async () => {
    console.log('[Comments Sync] Cleaning up...');

    if (simulator) {
      await simulator.stop();
    }

    // Close instances with timeout to prevent hanging
    const closeWithTimeout = async (
      instance: ElectronApplication | undefined,
      name: string
    ): Promise<void> => {
      if (!instance) return;
      try {
        await Promise.race([
          instance.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
        ]);
      } catch (err) {
        console.error(`[Comments Sync] Error closing ${name}:`, err);
      }
    };

    await closeWithTimeout(instance1, 'instance1');
    await closeWithTimeout(instance2, 'instance2');

    // Clean up temporary directories
    try {
      await rm(sd1, { recursive: true, force: true });
      await rm(sd2, { recursive: true, force: true });
      await rm(userDataDir1, { recursive: true, force: true });
      await rm(userDataDir2, { recursive: true, force: true });
      console.log('[Comments Sync] Cleanup complete');
    } catch (error) {
      console.error('[Comments Sync] Cleanup failed:', error);
    }
  });

  /**
   * Helper to launch both instances with file sync simulator
   */
  async function launchBothInstances() {
    const logger = new SimulatorLogger({
      enabled: true,
      verbose: false,
      prefix: '[CommentSync]',
    });

    // Bidirectional sync
    simulator = new FileSyncSimulator(sd1, sd2, {
      syncDelayRange: [1000, 2000], // Fast sync for testing
      partialSyncProbability: 0.0, // No partial sync to avoid complexity
      partialSyncRatio: [0.5, 0.9],
      logger,
      bidirectional: true,
    });

    await simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Launch instance 1 connected to SD1
    console.log('[Comments Sync] Launching instance 1 on SD1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'comments-sync-instance-1',
      },
      timeout: 60000,
    });

    window1 = await getFirstWindow(instance1);
    await window1.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window1.waitForTimeout(1000);

    // Configure profile for instance 1
    await window1.evaluate(async () => {
      await window.electronAPI.appState.set('username', 'User A');
      await window.electronAPI.appState.set('userHandle', 'user_a');
    });
    // Reload to pick up profile (TipTapEditor fetches profile on mount)
    await window1.reload();
    await window1.waitForSelector('.ProseMirror', { timeout: 15000 });
    // Wait for profile to be fetched (TipTapEditor useEffect is async)
    await window1.waitForTimeout(1000);
    console.log('[Comments Sync] Instance 1 profile configured');

    // Launch instance 2 connected to SD2
    console.log('[Comments Sync] Launching instance 2 on SD2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'comments-sync-instance-2',
      },
      timeout: 60000,
    });

    window2 = await getFirstWindow(instance2);
    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });

    // Configure profile for instance 2
    await window2.evaluate(async () => {
      await window.electronAPI.appState.set('username', 'User B');
      await window.electronAPI.appState.set('userHandle', 'user_b');
    });
    // Reload to pick up profile (TipTapEditor fetches profile on mount)
    await window2.reload();
    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    // Wait for profile to be fetched (TipTapEditor useEffect is async)
    await window2.waitForTimeout(1000);
    console.log('[Comments Sync] Instance 2 profile configured');

    // Wait for initial bidirectional sync to settle
    await window2.waitForTimeout(8000);

    console.log('[Comments Sync] Both instances ready');
  }

  /**
   * Helper to count comment highlights in the editor
   */
  async function countCommentHighlights(window: Page): Promise<number> {
    const highlights = await window.locator('.comment-highlight').count();
    return highlights;
  }

  /**
   * Helper to get thread IDs from comment highlights
   */
  async function getCommentThreadIds(window: Page): Promise<string[]> {
    const threadIds = await window
      .locator('.comment-highlight')
      .evaluateAll((elements) =>
        elements
          .map((el) => el.getAttribute('data-thread-id'))
          .filter((id): id is string => id !== null)
      );
    return [...new Set(threadIds)]; // Unique thread IDs
  }

  /**
   * Helper to get the badge count from the view comments button
   */
  async function getCommentBadgeCount(window: Page): Promise<number> {
    // MUI Badge component uses .MuiBadge-badge class
    const badge = window.locator('[data-testid="view-comments-button"] .MuiBadge-badge');
    const isVisible = await badge.isVisible().catch(() => false);
    if (!isVisible) {
      return 0;
    }
    const text = await badge.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Helper to open the comment sidebar and get visible thread count
   */
  async function openCommentSidebarAndCountThreads(window: Page): Promise<number> {
    // Click the view comments button to open sidebar
    const viewCommentsButton = window.locator('[data-testid="view-comments-button"]');
    await viewCommentsButton.click();
    await window.waitForTimeout(500);

    // Count comment threads in the sidebar
    const threads = await window.locator('[data-testid="comment-thread"], .comment-thread').count();
    return threads;
  }

  /**
   * Helper to get author names from visible comment threads
   */
  async function getCommentAuthors(window: Page): Promise<string[]> {
    const authors = await window
      .locator('[data-testid="comment-author"], .comment-author')
      .allTextContents();
    return authors;
  }

  /**
   * Helper to delete a comment thread via the sidebar
   */
  async function deleteFirstComment(window: Page): Promise<void> {
    // Check if comment sidebar is already open by looking for the close button
    const closeButton = window.locator('[data-testid="close-comments-button"]');
    const sidebarIsOpen = await closeButton.isVisible().catch(() => false);

    if (!sidebarIsOpen) {
      // Move mouse away from toolbar to dismiss any tooltips
      await window.mouse.move(0, 0);
      await window.waitForTimeout(100);

      // Open the comment sidebar if not already open
      const viewCommentsButton = window.locator('[data-testid="view-comments-button"]');
      await viewCommentsButton.click({ force: true });
      await window.waitForTimeout(500);
    }

    // Click the delete button on the first thread
    const deleteButton = window.locator('[data-testid="delete-thread-button"]').first();
    await deleteButton.click();
    await window.waitForTimeout(500);

    // Confirm deletion in the dialog
    const confirmButton = window.locator('[data-testid="delete-confirm-button"]');
    await confirmButton.click();
    await window.waitForTimeout(500);
  }

  test('should sync comment from Instance A to Instance B', async () => {
    await launchBothInstances();

    // Instance 1: Type some content
    const editor1 = window1.locator('.ProseMirror');
    const testText = 'This is test content for commenting';
    await editor1.click();
    await editor1.fill(testText);
    await window1.waitForTimeout(1000);

    // Wait for content to sync to instance 2
    await window1.waitForTimeout(5000);

    // Verify content synced
    const editor2 = window2.locator('.ProseMirror');
    await expect(editor2).toContainText(testText, { timeout: 10000 });

    console.log('[Comments Sync] Content synced, now adding comment...');

    // Instance 1: Select text and add a comment
    await editor1.click({ clickCount: 3 }); // Select all
    await window1.waitForTimeout(200);

    // Click the add comment button in the toolbar
    const addCommentButton1 = window1.locator('[data-testid="comment-button"]');
    await addCommentButton1.click();
    await window1.waitForTimeout(1000);

    // Check for comment highlight in instance 1 using retrying assertion
    await expect.poll(() => countCommentHighlights(window1), { timeout: 30000 }).toBeGreaterThan(0);
    console.log('[Comments Sync] Instance 1 has comment highlight');

    // Wait for comment to sync to instance 2 using retrying assertion
    console.log('[Comments Sync] Waiting for comment to sync to instance 2...');
    await expect.poll(() => countCommentHighlights(window2), { timeout: 60000 }).toBeGreaterThan(0);
    console.log('[Comments Sync] Instance 2 has comment highlight');

    console.log('[Comments Sync] ✅ Comment synced successfully from Instance 1 to Instance 2');
  });

  test('should preserve both comments when created concurrently on different text portions', async () => {
    await launchBothInstances();

    // First, establish shared content with multiple words
    const editor1 = window1.locator('.ProseMirror');
    const sharedText = 'Alpha Beta Gamma Delta';
    await editor1.click();
    await editor1.fill(sharedText);
    await window1.waitForTimeout(1000);

    // Wait for content to sync to instance 2
    await window1.waitForTimeout(5000);

    const editor2 = window2.locator('.ProseMirror');
    await expect(editor2).toContainText(sharedText, { timeout: 10000 });

    console.log('[Comments Sync] Shared content synced, creating concurrent comments...');

    // STOP the simulator briefly to allow concurrent editing
    await simulator.stop();
    console.log('[Comments Sync] Simulator stopped for concurrent edit simulation');

    // Instance 1: Select first word "Alpha" using keyboard
    // Go to start of line, then select word with Shift+Alt+Right (macOS word selection)
    await editor1.click();
    await window1.keyboard.press('Meta+ArrowLeft'); // Go to start of line
    await window1.waitForTimeout(100);
    await window1.keyboard.press('Shift+Alt+ArrowRight'); // Select first word
    await window1.waitForTimeout(200);
    const addCommentButton1 = window1.locator('[data-testid="comment-button"]');
    await addCommentButton1.click();
    await window1.waitForTimeout(1000);

    console.log('[Comments Sync] Instance 1 added comment on first word');

    // Instance 2: Select last word "Delta" using keyboard
    // Go to end of line, then select word backward with Shift+Alt+Left
    await editor2.click();
    await window2.keyboard.press('Meta+ArrowRight'); // Go to end of line
    await window2.waitForTimeout(100);
    await window2.keyboard.press('Shift+Alt+ArrowLeft'); // Select last word
    await window2.waitForTimeout(200);
    const addCommentButton2 = window2.locator('[data-testid="comment-button"]');
    await addCommentButton2.click();
    await window2.waitForTimeout(1000);

    console.log('[Comments Sync] Instance 2 added comment on last word');

    // Verify each instance has their own comment
    const threadIds1Before = await getCommentThreadIds(window1);
    const threadIds2Before = await getCommentThreadIds(window2);

    console.log('[Comments Sync] Instance 1 thread IDs before sync:', threadIds1Before);
    console.log('[Comments Sync] Instance 2 thread IDs before sync:', threadIds2Before);

    expect(threadIds1Before.length).toBeGreaterThan(0);
    expect(threadIds2Before.length).toBeGreaterThan(0);

    // Restart the simulator to sync changes
    await simulator.start();
    console.log('[Comments Sync] Simulator restarted for sync');

    // Use retrying assertions for bidirectional sync
    // Wait until both instances have 2 threads
    await expect.poll(() => getCommentThreadIds(window1), { timeout: 60000 }).toHaveLength(2);
    console.log('[Comments Sync] Instance 1 now has 2 threads');

    await expect.poll(() => getCommentThreadIds(window2), { timeout: 60000 }).toHaveLength(2);
    console.log('[Comments Sync] Instance 2 now has 2 threads');

    // Verify both instances have the same thread IDs
    const threadIds1After = await getCommentThreadIds(window1);
    const threadIds2After = await getCommentThreadIds(window2);
    console.log('[Comments Sync] Instance 1 thread IDs after sync:', threadIds1After);
    console.log('[Comments Sync] Instance 2 thread IDs after sync:', threadIds2After);
    expect(threadIds1After.sort()).toEqual(threadIds2After.sort());

    console.log(
      '[Comments Sync] ✅ Both concurrent comments preserved and synced to both instances'
    );
  });

  // ==========================================================================
  // BUG REPRODUCTION TESTS
  // These tests reproduce specific bugs found during manual testing
  // ==========================================================================

  test('comment sidebar should show synced comments (not just badge)', async () => {
    // BUG: Badge shows 1 comment but sidebar is empty when clicked
    // Expected: When badge shows 1, clicking "view comments" should show 1 thread
    await launchBothInstances();

    // Instance 1: Create content and add a comment
    const editor1 = window1.locator('.ProseMirror');
    const testText = 'Text with a comment for sidebar test';
    await editor1.click();
    await editor1.fill(testText);
    await window1.waitForTimeout(1000);

    // Wait for content to sync to instance 2
    await window1.waitForTimeout(5000);
    const editor2 = window2.locator('.ProseMirror');
    await expect(editor2).toContainText(testText, { timeout: 10000 });

    // Instance 1: Add a comment
    await editor1.click({ clickCount: 3 }); // Select all
    await window1.waitForTimeout(200);
    const addCommentButton = window1.locator('[data-testid="comment-button"]');
    await addCommentButton.click();
    await window1.waitForTimeout(1000);

    console.log('[Comments Sync] Comment added on instance 1');

    // Wait for comment to sync to instance 2 - use retrying assertion
    // Wait for badge to show 1 (this confirms sync happened)
    const badge2 = window2.locator('[data-testid="view-comments-button"] .MuiBadge-badge');
    await expect(badge2).toHaveText('1', { timeout: 30000 });
    console.log('[Comments Sync] Instance 2 badge shows 1');

    // Open the comment sidebar
    const viewCommentsButton = window2.locator('[data-testid="view-comments-button"]');
    await viewCommentsButton.click();
    await window2.waitForTimeout(500);

    // Wait for the thread to appear in sidebar with retrying assertion
    const threads = window2.locator('[data-testid="comment-thread"], .comment-thread');
    await expect(threads).toHaveCount(1, { timeout: 10000 });
    console.log('[Comments Sync] Instance 2 sidebar shows 1 thread');

    console.log('[Comments Sync] ✅ Badge and sidebar counts match');
  });

  test('comments from B should appear on A without note switch', async () => {
    // BUG: Comments created on B don't show on A unless A switches notes
    // Expected: Comments should sync live without requiring note switch
    await launchBothInstances();

    // Create shared content
    const editor1 = window1.locator('.ProseMirror');
    const editor2 = window2.locator('.ProseMirror');
    const testText = 'Shared content for bidirectional sync test';
    await editor1.click();
    await editor1.fill(testText);
    await window1.waitForTimeout(1000);

    // Wait for sync
    await window1.waitForTimeout(5000);
    await expect(editor2).toContainText(testText, { timeout: 10000 });

    console.log('[Comments Sync] Content synced to both instances');

    // Instance 2: Add a comment
    await editor2.click({ clickCount: 3 }); // Select all
    await window2.waitForTimeout(200);
    const addCommentButton2 = window2.locator('[data-testid="comment-button"]');
    await addCommentButton2.click();
    await window2.waitForTimeout(1000);

    // Use retrying assertion for Instance B highlights
    await expect.poll(() => countCommentHighlights(window2), { timeout: 30000 }).toBeGreaterThan(0);
    console.log('[Comments Sync] Instance B has comment highlight');

    // Instance A: Check if comment highlight appears WITHOUT switching notes
    // Use retrying assertion instead of fixed wait + one-shot check
    console.log('[Comments Sync] Waiting for comment to sync to Instance A...');
    await expect.poll(() => countCommentHighlights(window1), { timeout: 60000 }).toBeGreaterThan(0);
    console.log('[Comments Sync] Instance A has comment highlight after sync');

    console.log('[Comments Sync] ✅ Comment from B synced to A without note switch');
  });

  test('comment deletion should sync live', async () => {
    // BUG: When a comment is deleted on one instance, it doesn't sync to the other
    // Expected: Deletes should sync live like creates
    await launchBothInstances();

    // Create content and add a comment on instance 1
    const editor1 = window1.locator('.ProseMirror');
    const testText = 'Text for delete sync test';
    await editor1.click();
    await editor1.fill(testText);
    await window1.waitForTimeout(1000);

    // Wait for sync
    await window1.waitForTimeout(5000);
    const editor2 = window2.locator('.ProseMirror');
    await expect(editor2).toContainText(testText, { timeout: 10000 });

    // Instance 1: Add a comment
    await editor1.click({ clickCount: 3 });
    await window1.waitForTimeout(200);
    const addCommentButton = window1.locator('[data-testid="comment-button"]');
    await addCommentButton.click();
    await window1.waitForTimeout(1000);

    // Wait for comment to sync to instance 2 using retrying assertions
    await expect.poll(() => countCommentHighlights(window1), { timeout: 30000 }).toBeGreaterThan(0);
    console.log('[Comments Sync] Instance 1 has comment highlight');

    await expect.poll(() => countCommentHighlights(window2), { timeout: 60000 }).toBeGreaterThan(0);
    console.log('[Comments Sync] Instance 2 has comment highlight');

    // Instance 1: Delete the comment
    console.log('[Comments Sync] Deleting comment on instance 1...');
    await deleteFirstComment(window1);

    // Wait for delete to complete on instance 1 using retrying assertion
    await expect.poll(() => countCommentHighlights(window1), { timeout: 30000 }).toBe(0);
    console.log('[Comments Sync] Instance 1 has no highlights after delete');

    // Wait for delete to sync to instance 2 using retrying assertion
    console.log('[Comments Sync] Waiting for delete to sync to instance 2...');
    await expect.poll(() => countCommentHighlights(window2), { timeout: 60000 }).toBe(0);
    console.log('[Comments Sync] Instance 2 has no highlights after sync');

    console.log('[Comments Sync] ✅ Comment deletion synced to instance B');
  });

  test('comment author should show profile name not anonymous', async () => {
    // Verifies that author shows the configured profile name, not "Anonymous"
    await launchBothInstances();

    // Create content
    const editor1 = window1.locator('.ProseMirror');
    const testText = 'Text for author name test';
    await editor1.click();
    await editor1.fill(testText);
    await window1.waitForTimeout(1000);

    // Instance 1: Add a comment
    await editor1.click({ clickCount: 3 });
    await window1.waitForTimeout(200);
    const addCommentButton = window1.locator('[data-testid="comment-button"]');
    await addCommentButton.click();
    await window1.waitForTimeout(1000);

    // Check if comment sidebar is already open (it should be after adding a comment)
    const closeButton = window1.locator('[data-testid="close-comments-button"]');
    const sidebarIsOpen = await closeButton.isVisible().catch(() => false);

    if (!sidebarIsOpen) {
      // Move mouse away from toolbar to dismiss any tooltips
      await window1.mouse.move(0, 0);
      await window1.waitForTimeout(100);

      // Open comment sidebar to see the comment
      const viewCommentsButton = window1.locator('[data-testid="view-comments-button"]');
      await viewCommentsButton.click({ force: true });
      await window1.waitForTimeout(500);
    }

    // Get author names from the sidebar
    const authors = await getCommentAuthors(window1);
    console.log('[Comments Sync] Comment authors:', authors);

    // Author should be "User A" (the profile name we configured)
    expect(authors.length).toBeGreaterThan(0);
    expect(authors).toContain('User A');

    // Verify no anonymous authors
    const hasAnonymous = authors.some(
      (name) => name.toLowerCase().includes('anonymous') || name.trim() === ''
    );
    expect(hasAnonymous).toBe(false);

    console.log('[Comments Sync] ✅ Author name is "User A" as expected');
  });
});
