/**
 * E2E tests for clipboard copy behavior
 *
 * Tests that copying content from the editor produces expected text formatting,
 * specifically that block elements (paragraphs, list items) are separated by
 * single newlines, not double newlines.
 *
 * Note: Tests run serially because they share the system clipboard.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { join, resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

// Run tests serially since they share the system clipboard
test.describe.configure({ mode: 'serial' });

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-clipboard-'));
  console.log('[E2E] Launching Electron with main process at:', mainPath);
  console.log('[E2E] Using fresh userData directory:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await electronApp.firstWindow();

  // Clear clipboard at the start of each test to avoid cross-test contamination
  await electronApp.evaluate(async ({ clipboard }) => {
    clipboard.writeText('');
  });
}, 60000);

test.afterEach(async () => {
  try {
    await Promise.race([
      electronApp.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
    ]);
  } catch (err) {
    console.error('[E2E] Error closing app:', err);
  }

  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E] Cleaned up test userData directory:', testUserDataDir);
  } catch (err) {
    console.error('[E2E] Failed to clean up test userData directory:', err);
  }
});

test.describe('Clipboard Copy', () => {
  test('copying paragraphs should preserve blank lines between them', async () => {
    // Wait for editor to be ready
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Clear any existing content and type multiple paragraphs
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Type first paragraph
    await page.keyboard.type('First paragraph');
    await page.keyboard.press('Enter');
    // Type second paragraph
    await page.keyboard.type('Second paragraph');
    await page.keyboard.press('Enter');
    // Type third paragraph
    await page.keyboard.type('Third paragraph');

    await page.waitForTimeout(500);

    // Select all and copy
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+c');
    await page.waitForTimeout(200);

    // Get clipboard text from Electron
    const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
      return clipboard.readText();
    });

    console.log('[E2E] Clipboard text:', JSON.stringify(clipboardText));

    // Paragraphs should be separated by double newlines (blank line between them)
    const expected = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
    expect(clipboardText).toBe(expected);
  });

  test('copying bullet list items should use single newlines between them', async () => {
    // Wait for editor to be ready
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Clear any existing content
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Type a header first
    await page.keyboard.type('My List');
    await page.keyboard.press('Enter');

    // Create a bullet list using toolbar or markdown syntax
    // Type dash-space to start a bullet list
    await page.keyboard.type('- First item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third item');

    await page.waitForTimeout(500);

    // Select all and copy
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+c');
    await page.waitForTimeout(200);

    // Get clipboard text from Electron
    const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
      return clipboard.readText();
    });

    console.log('[E2E] Clipboard text for list:', JSON.stringify(clipboardText));

    // Expected: header and list separated by blank line, list items with - markers
    const expected = 'My List\n\n- First item\n- Second item\n- Third item';
    expect(clipboardText).toBe(expected);
  });

  test('copying mixed content (header + list) should have correct spacing', async () => {
    // Wait for editor to be ready
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Clear any existing content
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Type content that matches the user's reported issue:
    // A header followed by bullet list items
    await page.keyboard.type('Your responsibilities:');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Analyze and understand the existing codebase thoroughly.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Determine exactly how this feature integrates.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Clearly identify anything unclear or ambiguous.');

    await page.waitForTimeout(500);

    // Select all and copy
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+c');
    await page.waitForTimeout(200);

    // Get clipboard text from Electron
    const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
      return clipboard.readText();
    });

    console.log('[E2E] Clipboard text for mixed content:', JSON.stringify(clipboardText));

    // Expected: paragraph and list separated by blank line, list items with - markers
    const expected =
      'Your responsibilities:\n\n' +
      '- Analyze and understand the existing codebase thoroughly.\n' +
      '- Determine exactly how this feature integrates.\n' +
      '- Clearly identify anything unclear or ambiguous.';
    expect(clipboardText).toBe(expected);
  });

  test('copying paragraph followed by list followed by paragraphs', async () => {
    // This matches the exact user scenario from the bug report
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Clear any existing content
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Type: paragraph, list items, paragraph, blank, paragraph
    await page.keyboard.type('Your responsibilities:');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Analyze and understand the existing codebase thoroughly.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Determine exactly how this feature integrates.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Clearly identify anything unclear.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('List clearly all questions you need clarified');
    await page.keyboard.press('Enter');
    // Exit the list by pressing Enter twice or Backspace
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Remember, your job is not to implement (yet).');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Use ~/devel/plans for how to write out the plans');

    await page.waitForTimeout(500);

    // Select all and copy
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+c');
    await page.waitForTimeout(200);

    // Get clipboard text from Electron
    const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
      return clipboard.readText();
    });

    console.log('[E2E] Clipboard text for complex content:', JSON.stringify(clipboardText));

    // Expected format:
    // - Header paragraph
    // - List items with - markers and single newlines between them
    // - Paragraph after list (single blank line separation from list)
    // - Another paragraph (single blank line separation)
    // - Final paragraph
    const expected =
      'Your responsibilities:\n\n' +
      '- Analyze and understand the existing codebase thoroughly.\n' +
      '- Determine exactly how this feature integrates.\n' +
      '- Clearly identify anything unclear.\n' +
      '- List clearly all questions you need clarified\n\n' +
      'Remember, your job is not to implement (yet).\n\n' +
      'Use ~/devel/plans for how to write out the plans';
    expect(clipboardText).toBe(expected);
  });

  test('copying just bullet list should use single newlines', async () => {
    // Wait for editor to be ready
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Clear any existing content
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Create just a bullet list (no preceding paragraph)
    await page.keyboard.type('- First item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third item');

    await page.waitForTimeout(500);

    // Log what's in the editor before copying
    const editorContent = await editor.textContent();
    console.log('[E2E] Editor content before copy:', JSON.stringify(editorContent));

    // Select all and copy
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+c');
    await page.waitForTimeout(200);

    // Get clipboard text from Electron
    const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
      return clipboard.readText();
    });

    console.log('[E2E] Clipboard text for bullet list only:', JSON.stringify(clipboardText));

    // List items should have - markers and single newlines
    const expected = '- First item\n- Second item\n- Third item';
    expect(clipboardText).toBe(expected);
  });
});
