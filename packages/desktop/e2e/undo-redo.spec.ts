/**
 * E2E tests for Undo/Redo functionality
 *
 * Tests that undo/redo works correctly in the TipTap editor with Yjs collaboration.
 * Related issue: Undo/redo works once then stops working.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-undo-redo-'));
  console.log('[E2E Undo/Redo] Launching Electron with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await electronApp.firstWindow();

  // Capture renderer console logs for debugging
  page.on('console', (msg) => {
    const text = msg.text();
    // Only log errors and warnings, not all output
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log('[Renderer Console]:', text);
    }
  });

  // Wait for app to be ready
  await page.waitForSelector('text=Folders', { timeout: 10000 });
  await page.waitForTimeout(1000);
}, 60000);

test.afterEach(async () => {
  await electronApp.close();

  // Clean up the temporary user data directory
  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E Undo/Redo] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E Undo/Redo] Failed to clean up test userData directory:', err);
  }
});

test.describe('Undo/Redo - Basic Functionality', () => {
  test('should undo typed text with Cmd+Z', async () => {
    // Use the existing welcome note instead of creating a new one
    // This avoids the issue where switching notes destroys the undo stack
    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000); // Wait for editor to fully initialize

    // Click at the end of the editor content
    await editor.click();
    await page.waitForTimeout(500);

    // Move cursor to end
    await page.keyboard.press('Meta+End');
    await page.waitForTimeout(200);

    // Type some text
    await editor.pressSequentially('TESTUNDO', { delay: 50 });
    await page.waitForTimeout(500);

    // Verify text was typed
    const contentBefore = await editor.textContent();
    console.log('[Test] Content before undo:', contentBefore);
    expect(contentBefore).toContain('TESTUNDO');

    // Undo with Cmd+Z
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);

    // Verify undo worked
    const contentAfter = await editor.textContent();
    console.log('[Test] Content after undo:', contentAfter);

    // The text should no longer contain our typed text
    expect(contentAfter).not.toContain('TESTUNDO');
  });

  test('should undo multiple times consecutively', async () => {
    // Use the existing welcome note
    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await editor.click();
    await page.waitForTimeout(500);

    // Move cursor to end
    await page.keyboard.press('Meta+End');
    await page.waitForTimeout(200);

    // Type first word
    await editor.pressSequentially('AAA', { delay: 50 });
    await page.waitForTimeout(600); // Wait for undo capture timeout (500ms default)

    // Type second word
    await editor.pressSequentially('BBB', { delay: 50 });
    await page.waitForTimeout(600);

    // Type third word
    await editor.pressSequentially('CCC', { delay: 50 });
    await page.waitForTimeout(600);

    const contentFull = await editor.textContent();
    console.log('[Test] Full content:', contentFull);
    expect(contentFull).toContain('AAABBBCCC');

    // First undo - should remove "CCC"
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);

    const contentAfterUndo1 = await editor.textContent();
    console.log('[Test] After first undo:', contentAfterUndo1);

    // Second undo - should remove "BBB"
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);

    const contentAfterUndo2 = await editor.textContent();
    console.log('[Test] After second undo:', contentAfterUndo2);

    // Third undo - should remove "AAA"
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);

    const contentAfterUndo3 = await editor.textContent();
    console.log('[Test] After third undo:', contentAfterUndo3);

    // Verify progressive undos worked - each should be different
    expect(contentAfterUndo1).not.toBe(contentFull);
    expect(contentAfterUndo2).not.toBe(contentAfterUndo1);
  });

  test('should redo after undo with Cmd+Shift+Z', async () => {
    // Use existing welcome note
    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await editor.click();
    await page.waitForTimeout(500);

    // Move cursor to end
    await page.keyboard.press('Meta+End');
    await page.waitForTimeout(200);

    // Type some text
    await editor.pressSequentially('REDO_TEST', { delay: 50 });
    await page.waitForTimeout(500);

    const contentOriginal = await editor.textContent();
    console.log('[Test] Original content:', contentOriginal);
    expect(contentOriginal).toContain('REDO_TEST');

    // Undo
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);

    const contentAfterUndo = await editor.textContent();
    console.log('[Test] After undo:', contentAfterUndo);
    expect(contentAfterUndo).not.toContain('REDO_TEST');

    // Redo with Cmd+Shift+Z
    await page.keyboard.press('Shift+Meta+Z');
    await page.waitForTimeout(500);

    const contentAfterRedo = await editor.textContent();
    console.log('[Test] After redo:', contentAfterRedo);

    // Content should be restored
    expect(contentAfterRedo).toContain('REDO_TEST');
  });

  test('undo button should remain enabled after first undo', async () => {
    // Use existing welcome note
    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await editor.click();
    await page.waitForTimeout(500);

    // Move cursor to end
    await page.keyboard.press('Meta+End');
    await page.waitForTimeout(200);

    // Type first text
    await editor.pressSequentially('XXX', { delay: 50 });
    await page.waitForTimeout(600);

    // Type second text
    await editor.pressSequentially('YYY', { delay: 50 });
    await page.waitForTimeout(600);

    // Get undo button by data-testid
    const undoButton = page.locator('[data-testid="undo-button"]');

    // Check undo button is enabled before first undo
    const isEnabledBefore = await undoButton.isEnabled();
    console.log('[Test] Undo button enabled before first undo:', isEnabledBefore);
    expect(isEnabledBefore).toBe(true);

    // First undo
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);

    // Check undo button is STILL enabled after first undo
    const isEnabledAfter = await undoButton.isEnabled();
    console.log('[Test] Undo button enabled after first undo:', isEnabledAfter);

    // Button should remain enabled because there's still more to undo
    expect(isEnabledAfter).toBe(true);
  });
});

test.describe('Undo/Redo - On Existing Notes', () => {
  test('should undo on existing note (not newly created)', async () => {
    // Wait for default note to be visible (app creates a welcome note)
    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await editor.click();
    await page.waitForTimeout(500);

    // Move cursor to end
    await page.keyboard.press('Meta+End');
    await page.waitForTimeout(200);

    // Type some text
    await editor.pressSequentially('NEW_TEXT_ADDED', { delay: 50 });
    await page.waitForTimeout(500);

    const contentAfterTyping = await editor.textContent();
    console.log('[Test] After typing:', contentAfterTyping?.substring(0, 100));
    expect(contentAfterTyping).toContain('NEW_TEXT_ADDED');

    // Undo
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);

    const contentAfterUndo = await editor.textContent();
    console.log('[Test] After undo:', contentAfterUndo?.substring(0, 100));

    // Should have undone the new text
    expect(contentAfterUndo).not.toContain('NEW_TEXT_ADDED');
  });

  test('should undo multiple times on existing note', async () => {
    // Wait for default note
    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await editor.click();
    await page.waitForTimeout(500);

    // Move cursor to end
    await page.keyboard.press('Meta+End');
    await page.waitForTimeout(200);

    // Type first addition
    await editor.pressSequentially('AAA', { delay: 50 });
    await page.waitForTimeout(600);

    // Type second addition
    await editor.pressSequentially('BBB', { delay: 50 });
    await page.waitForTimeout(600);

    const contentFull = await editor.textContent();
    console.log('[Test] Full content:', contentFull?.substring(0, 100));

    // First undo
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);
    const content1 = await editor.textContent();
    console.log('[Test] After undo 1:', content1?.substring(0, 100));

    // Second undo
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(500);
    const content2 = await editor.textContent();
    console.log('[Test] After undo 2:', content2?.substring(0, 100));

    // The two undos should have different results
    expect(content1).not.toBe(contentFull);
    expect(content2).not.toBe(content1);
  });
});

test.describe('Undo/Redo - Toolbar Buttons', () => {
  test('undo toolbar button should work multiple times', async () => {
    // Use existing welcome note
    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await editor.click();
    await page.waitForTimeout(500);

    // Move cursor to end
    await page.keyboard.press('Meta+End');
    await page.waitForTimeout(200);

    // Type text with pauses to create separate undo entries
    await editor.pressSequentially('111', { delay: 50 });
    await page.waitForTimeout(600);
    await editor.pressSequentially('222', { delay: 50 });
    await page.waitForTimeout(600);

    // Find and click undo button by data-testid
    const undoButton = page.locator('[data-testid="undo-button"]');

    // First click
    await undoButton.click();
    await page.waitForTimeout(500);
    const content1 = await editor.textContent();
    console.log('[Test] After first undo click:', content1);

    // Second click - button should still be clickable
    const isEnabled = await undoButton.isEnabled();
    console.log('[Test] Undo button enabled after first click:', isEnabled);
    expect(isEnabled).toBe(true);

    await undoButton.click();
    await page.waitForTimeout(500);
    const content2 = await editor.textContent();
    console.log('[Test] After second undo click:', content2);
    expect(content2).not.toBe(content1);
  });
});
