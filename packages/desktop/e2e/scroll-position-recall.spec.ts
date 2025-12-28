/**
 * E2E tests for Scroll Position Recall
 *
 * Tests that scroll positions are remembered when:
 * 1. Switching between notes within a session
 * 2. Across app restarts
 *
 * @see plans/scroll-position-recall/PLAN.md
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve, join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;
const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

/**
 * Launch the app and wait for it to be ready
 */
async function launchApp(): Promise<void> {
  console.log('[E2E] Launching Electron with main process at:', mainPath);
  console.log('[E2E] Using userData directory:', testUserDataDir);

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
  page.on('console', (msg) => {
    console.log('[Page Console]:', msg.text());
  });

  await page.waitForSelector('body', { timeout: 10000 });
  await page.waitForTimeout(1000);
}

/**
 * Close the app gracefully
 */
async function closeApp(): Promise<void> {
  try {
    await electronApp.evaluate(async ({ app }) => {
      app.quit();
    });
    await Promise.race([
      electronApp.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 10000)),
    ]);
  } catch (err) {
    console.error('[E2E] Error closing app:', err);
  }
}

/**
 * Create a note with lots of content that requires scrolling
 */
async function createLongNote(page: Page, title: string): Promise<void> {
  const createButton = page.getByTitle('Create note');
  await createButton.click();
  await page.waitForTimeout(500);

  const editor = page.locator('.ProseMirror');
  await editor.click();

  // Create content with many lines to ensure scrolling is needed
  const lines: string[] = [title];
  for (let i = 1; i <= 50; i++) {
    lines.push(`Line ${i}: This is some content to make the note scrollable.`);
  }
  lines.push('END OF NOTE - MARKER');

  await editor.fill(lines.join('\n'));
  await page.waitForTimeout(1000);
}

/**
 * Get the scroll position of the editor container
 */
async function getScrollPosition(page: Page): Promise<number> {
  return await page.evaluate(() => {
    // The editor container has data-testid="editor-scroll-container"
    const container = document.querySelector('[data-testid="editor-scroll-container"]');
    return container?.scrollTop ?? 0;
  });
}

/**
 * Set the scroll position of the editor container
 */
async function setScrollPosition(page: Page, scrollTop: number): Promise<void> {
  await page.evaluate((targetScroll) => {
    const container = document.querySelector('[data-testid="editor-scroll-container"]');
    if (container) {
      container.scrollTop = targetScroll;
    }
  }, scrollTop);
  // Wait for scroll to settle and be reported
  await page.waitForTimeout(500);
}

/**
 * Scroll to the bottom of the editor
 */
async function scrollToBottom(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const container = document.querySelector('[data-testid="editor-scroll-container"]');
    if (container) {
      container.scrollTop = container.scrollHeight;
      return container.scrollTop;
    }
    return 0;
  });
}

test.describe('Scroll Position Recall - Note Switching', () => {
  test.beforeEach(async () => {
    testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-scroll-'));
    console.log('[E2E] Created fresh userData directory:', testUserDataDir);
    await launchApp();
  });

  test.afterEach(async () => {
    if (electronApp) {
      await closeApp();
    }
    try {
      rmSync(testUserDataDir, { recursive: true, force: true });
      console.log('[E2E] Cleaned up test userData directory:', testUserDataDir);
    } catch (err) {
      console.error('[E2E] Failed to clean up:', err);
    }
  });

  test('should remember scroll position when switching between notes', async () => {
    console.log('[Test] Starting scroll position recall test');

    // Create first note with lots of content
    await createLongNote(page, 'First Long Note');

    // Scroll to a specific position (somewhere in the middle)
    const targetScroll = 500;
    await setScrollPosition(page, targetScroll);
    const scrollAfterSet = await getScrollPosition(page);
    console.log(`[Test] Set scroll to ${targetScroll}, actual: ${scrollAfterSet}`);
    expect(scrollAfterSet).toBeGreaterThan(100); // Verify we actually scrolled

    // Wait for debounced save (1000ms debounce + buffer)
    await page.waitForTimeout(1500);

    // Create second note
    await createLongNote(page, 'Second Long Note');
    console.log('[Test] Created second note');

    // After filling a note, the cursor may be anywhere - scroll to top explicitly
    // This isn't testing restoration, just making sure we're in a known state
    await setScrollPosition(page, 0);
    const scrollSecondNote = await getScrollPosition(page);
    console.log(`[Test] Second note scroll position after reset: ${scrollSecondNote}`);

    // Switch back to first note
    const middlePanel = page.locator('#middle-panel');
    const firstNoteButton = middlePanel.locator('text=First Long Note').first();
    await firstNoteButton.click();
    console.log('[Test] Clicked first note');

    // Wait for note to load and scroll to be restored
    await page.waitForTimeout(2000);

    // Check scroll position was restored
    const restoredScroll = await getScrollPosition(page);
    console.log(`[Test] Restored scroll position: ${restoredScroll} (expected ~${targetScroll})`);

    // Allow some tolerance (within 100px)
    expect(restoredScroll).toBeGreaterThan(targetScroll - 100);
    expect(restoredScroll).toBeLessThan(targetScroll + 100);

    console.log('[Test] Scroll position recall test passed!');
  });

  test('should remember scroll position at bottom of note', async () => {
    console.log('[Test] Starting scroll to bottom test');

    // Create a long note
    await createLongNote(page, 'Bottom Scroll Note');

    // Scroll to the very bottom
    const bottomScroll = await scrollToBottom(page);
    console.log(`[Test] Scrolled to bottom: ${bottomScroll}`);
    expect(bottomScroll).toBeGreaterThan(100);

    // Wait for debounced save
    await page.waitForTimeout(1500);

    // Create another note
    await createLongNote(page, 'Another Note');

    // Switch back
    const middlePanel = page.locator('#middle-panel');
    const bottomNoteButton = middlePanel.locator('text=Bottom Scroll Note').first();
    await bottomNoteButton.click();

    // Wait for restoration
    await page.waitForTimeout(2000);

    // Should be near the bottom
    const restoredScroll = await getScrollPosition(page);
    console.log(`[Test] Restored bottom scroll: ${restoredScroll} (expected ~${bottomScroll})`);

    // Should be within 100px of where we were
    expect(restoredScroll).toBeGreaterThan(bottomScroll - 100);

    console.log('[Test] Scroll to bottom test passed!');
  });

  test('should handle multiple note switches correctly', async () => {
    console.log('[Test] Starting multiple note switches test');

    // Create three notes with different scroll positions
    await createLongNote(page, 'Note A');
    await setScrollPosition(page, 200);
    await page.waitForTimeout(1500);

    await createLongNote(page, 'Note B');
    await setScrollPosition(page, 400);
    await page.waitForTimeout(1500);

    await createLongNote(page, 'Note C');
    await setScrollPosition(page, 600);
    await page.waitForTimeout(1500);

    const middlePanel = page.locator('#middle-panel');

    // Switch to Note A
    await middlePanel.locator('text=Note A').first().click();
    await page.waitForTimeout(2000);
    let scroll = await getScrollPosition(page);
    console.log(`[Test] Note A scroll: ${scroll} (expected ~200)`);
    expect(scroll).toBeGreaterThan(100);
    expect(scroll).toBeLessThan(300);

    // Switch to Note B
    await middlePanel.locator('text=Note B').first().click();
    await page.waitForTimeout(2000);
    scroll = await getScrollPosition(page);
    console.log(`[Test] Note B scroll: ${scroll} (expected ~400)`);
    expect(scroll).toBeGreaterThan(300);
    expect(scroll).toBeLessThan(500);

    // Switch to Note C
    await middlePanel.locator('text=Note C').first().click();
    await page.waitForTimeout(2000);
    scroll = await getScrollPosition(page);
    console.log(`[Test] Note C scroll: ${scroll} (expected ~600)`);
    expect(scroll).toBeGreaterThan(500);
    expect(scroll).toBeLessThan(700);

    console.log('[Test] Multiple note switches test passed!');
  });
});

test.describe('Scroll Position Recall - App Restart', () => {
  test.beforeEach(async () => {
    testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-scroll-restart-'));
    console.log('[E2E] Created fresh userData directory:', testUserDataDir);
  });

  test.afterEach(async () => {
    if (electronApp) {
      await closeApp();
    }
    try {
      rmSync(testUserDataDir, { recursive: true, force: true });
    } catch (err) {
      console.error('[E2E] Failed to clean up:', err);
    }
  });

  test('should remember scroll position across app restart', async () => {
    console.log('[Test] Starting app restart scroll test');

    // First session: create note and scroll
    await launchApp();
    await createLongNote(page, 'Restart Test Note');

    const targetScroll = 400;
    await setScrollPosition(page, targetScroll);
    const scrollAfterSet = await getScrollPosition(page);
    console.log(`[Test] Set scroll to ${targetScroll}, actual: ${scrollAfterSet}`);

    // Wait for debounced save
    await page.waitForTimeout(2000);

    // Close app
    await closeApp();
    console.log('[Test] App closed');

    // Wait for cleanup
    await new Promise((r) => setTimeout(r, 1000));

    // Relaunch app
    await launchApp();
    console.log('[Test] App relaunched');

    // Wait for app to be ready
    await page.waitForTimeout(1000);

    // Click on the note to select it (it may not be auto-selected)
    const middlePanel = page.locator('#middle-panel');
    const noteButton = middlePanel.locator('text=Restart Test Note').first();
    await noteButton.click();
    console.log('[Test] Clicked on note to select it');

    // Wait for note to load and scroll to be restored
    await page.waitForTimeout(2000);

    // Check scroll position
    const restoredScroll = await getScrollPosition(page);
    console.log(
      `[Test] Restored scroll after restart: ${restoredScroll} (expected ~${targetScroll})`
    );

    expect(restoredScroll).toBeGreaterThan(targetScroll - 150);
    expect(restoredScroll).toBeLessThan(targetScroll + 150);

    console.log('[Test] App restart scroll test passed!');
  });
});
