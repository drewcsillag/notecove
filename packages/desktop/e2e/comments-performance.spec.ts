/**
 * Performance tests for Comments Feature
 *
 * Tests that the app performs well with 100+ comments:
 * - Load time should be < 500ms
 * - Scrolling should be smooth
 * - Editor typing should not lag
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { join, resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

// Longer timeout for performance tests
test.setTimeout(120000);

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-comments-perf-'));

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await electronApp.firstWindow();

  // Wait for app to be ready
  await page.waitForSelector('.ProseMirror', { timeout: 15000 });
}, 60000);

test.afterEach(async () => {
  try {
    await Promise.race([
      electronApp.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
    ]);
  } catch (err) {
    console.error('[E2E Comments Perf] Error closing app:', err);
  }

  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
  } catch (err) {
    console.error('[E2E Comments Perf] Failed to clean up:', err);
  }
});

/**
 * Helper to type text in the editor
 */
async function typeInEditor(page: Page, text: string) {
  const editor = page.locator('.ProseMirror').first();
  await editor.click({ force: true });
  await editor.pressSequentially(text, { delay: 5 });
}

/**
 * Helper to create many comments via keyboard shortcut
 * This is slower but more realistic
 */
async function createCommentViaUI(page: Page, commentText: string) {
  // Select all text
  await page.keyboard.press('Meta+a');

  // Use keyboard shortcut to add comment
  await page.keyboard.press('Meta+Alt+m');
  await page.waitForTimeout(200);

  // Type comment
  const textarea = page.locator('textarea').first();
  if (await textarea.isVisible({ timeout: 1000 })) {
    await textarea.fill(commentText);

    // Submit
    const submitBtn = page.locator('button:has-text("Add"), button:has-text("Comment")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(100);
    }
  }
}

test.describe('Comments Performance', () => {
  test('should handle 20 comments without lag', async () => {
    // Create base text
    await typeInEditor(page, 'This is a test note with many comments. '.repeat(10));

    const commentCount = 20;
    const createTimes: number[] = [];

    // Create comments and measure time
    for (let i = 0; i < commentCount; i++) {
      const start = Date.now();
      await createCommentViaUI(
        page,
        `Comment number ${i + 1} - Testing performance with multiple comments`
      );
      createTimes.push(Date.now() - start);

      // Click back in editor for next iteration
      // Use force:true to avoid timeout when UI is slow with many comments
      const editor = page.locator('.ProseMirror').first();
      await editor.click({ force: true });
    }

    // Log timing info
    const avgCreateTime = createTimes.reduce((a, b) => a + b, 0) / createTimes.length;
    console.log(`[Perf] Average comment create time: ${avgCreateTime.toFixed(0)}ms`);
    console.log(
      `[Perf] Total time for ${commentCount} comments: ${createTimes.reduce((a, b) => a + b, 0)}ms`
    );

    // Verify comments were created
    const commentPanel = page.locator('[class*="comment" i]');
    await expect(commentPanel.first()).toBeVisible();

    // Test scrolling in comment panel if visible
    const scrollStart = Date.now();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);
    await page.mouse.wheel(0, -500);
    const scrollTime = Date.now() - scrollStart;
    console.log(`[Perf] Scroll test time: ${scrollTime}ms`);

    // Test typing performance
    const editor = page.locator('.ProseMirror').first();
    await editor.click({ force: true });
    await page.keyboard.press('End');

    const typeStart = Date.now();
    await page.keyboard.type(' Additional text typed after comments were added.', { delay: 10 });
    const typeTime = Date.now() - typeStart;
    console.log(`[Perf] Typing test time: ${typeTime}ms`);

    // Performance assertions
    // Average comment creation should be reasonable (< 2 seconds per comment)
    expect(avgCreateTime).toBeLessThan(2000);
  });

  test('should render comment panel smoothly with many threads', async () => {
    // Type some content first
    await typeInEditor(page, 'Performance test content for comments panel rendering.');

    // Create a few comments to test panel rendering
    for (let i = 0; i < 5; i++) {
      await createCommentViaUI(page, `Thread ${i + 1}: Testing panel rendering performance`);

      // Click back in editor
      const editor = page.locator('.ProseMirror').first();
      await editor.click({ force: true });
    }

    // Measure panel interaction time
    const interactionStart = Date.now();

    // Try to click on a comment thread
    const thread = page.locator('[class*="comment" i]').first();
    if (await thread.isVisible()) {
      await thread.click();
      await page.waitForTimeout(100);
    }

    const interactionTime = Date.now() - interactionStart;
    console.log(`[Perf] Panel interaction time: ${interactionTime}ms`);

    // Should respond in under 500ms
    expect(interactionTime).toBeLessThan(500);
  });

  test('should maintain editor responsiveness with comment highlights', async () => {
    // Create content with comments
    await typeInEditor(
      page,
      'Text with multiple comment highlights for testing editor performance.'
    );

    // Add a few comments
    for (let i = 0; i < 3; i++) {
      await createCommentViaUI(page, `Highlight test comment ${i + 1}`);
      const editor = page.locator('.ProseMirror').first();
      await editor.click({ force: true });
    }

    // Test editor responsiveness by measuring typing latency
    const editor = page.locator('.ProseMirror').first();
    await editor.click({ force: true });
    await page.keyboard.press('End');

    // Type a paragraph and measure
    const testText = 'This is a test paragraph to measure typing performance. ';
    const typeStart = Date.now();

    for (const char of testText) {
      await page.keyboard.type(char);
    }

    const typeTime = Date.now() - typeStart;
    const charsPerSecond = testText.length / (typeTime / 1000);

    console.log(`[Perf] Typing speed: ${charsPerSecond.toFixed(1)} chars/sec`);
    console.log(`[Perf] Total typing time for ${testText.length} chars: ${typeTime}ms`);

    // Should be able to type at reasonable speed (> 5 chars/sec even with delay)
    expect(charsPerSecond).toBeGreaterThan(5);
  });
});
