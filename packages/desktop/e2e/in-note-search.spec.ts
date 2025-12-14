/**
 * E2E tests for In-Note Search Functionality
 *
 * Tests the in-note search panel (Shift+Cmd+F) with case-sensitive option.
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
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-in-note-search-'));
  console.log('[E2E In-Note Search] Launching Electron with userData at:', testUserDataDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await electronApp.firstWindow();

  // Capture renderer console logs
  page.on('console', (msg) => {
    console.log('[Renderer Console]:', msg.text());
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
    console.log('[E2E In-Note Search] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E In-Note Search] Failed to clean up test userData directory:', err);
  }
});

test.describe('In-Note Search Panel - Basic Functionality', () => {
  test('should open search panel with Shift+Cmd+F and not crash', async () => {
    // Create a note first
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Type some content
    await editor.type('Hello World');
    await page.waitForTimeout(500);

    // Open search panel with keyboard shortcut
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    // Search panel should be visible
    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Verify app didn't crash - check that editor is still visible
    await expect(editor).toBeVisible();
  });

  test('should allow typing in search box without crashing', async () => {
    // Create a note with content
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);
    await editor.type('Test content here');
    await page.waitForTimeout(500);

    // Open search panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await expect(searchInput).toBeVisible();

    // Type in search box
    await searchInput.fill('test');
    await page.waitForTimeout(1000);

    // Verify app didn't crash - search input should still be visible and editor too
    await expect(searchInput).toBeVisible();
    await expect(editor).toBeVisible();
    await expect(searchInput).toHaveValue('test');
  });

  test('should close search panel with Escape key', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Open search panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await expect(searchInput).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect(searchInput).not.toBeVisible();
  });

  test('should display case-sensitive checkbox', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Open search panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    // Check for case-sensitive checkbox
    const caseSensitiveLabel = page.locator('text=/case sensitive/i');
    await expect(caseSensitiveLabel).toBeVisible();
  });
});

test.describe('In-Note Search - Search Results', () => {
  test('should show match counter when searching', async () => {
    // Create a note with searchable content
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Type content with multiple occurrences of a word
    await editor.type('apple banana apple cherry apple');
    await page.waitForTimeout(1000);

    // Open search panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await searchInput.fill('apple');
    await page.waitForTimeout(1000);

    // Should show match counter (3/3 or 1/3 depending on which match is current)
    const matchCounter = page.locator('text=/[0-9]+\\/[0-9]+/');
    await expect(matchCounter).toBeVisible({ timeout: 5000 });
  });

  test('should show "No matches" when search term not found', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);
    await editor.type('Some content here');
    await page.waitForTimeout(1000);

    // Open search panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await searchInput.fill('nonexistent');
    await page.waitForTimeout(1000);

    // Should show "No matches"
    await expect(page.locator('text=/no matches/i')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to next match with Enter key', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Type content with multiple matches
    await editor.type('first match second match third match');
    await page.waitForTimeout(1000);

    // Open search panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await searchInput.fill('match');
    await page.waitForTimeout(1000);

    // Should start at 1/3
    await expect(page.locator('text=1/3')).toBeVisible({ timeout: 5000 });

    // Press Enter to go to next match
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Should now be at 2/3
    await expect(page.locator('text=2/3')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to previous match with Shift+Enter', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    await editor.type('one two three');
    await page.waitForTimeout(1000);

    // Open search and search for a word
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await searchInput.fill('o');
    await page.waitForTimeout(1000);

    // Move to next match
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    const currentMatch = await page.locator('text=/[0-9]+\\/[0-9]+/').textContent();
    console.log('[Test] Current match after Enter:', currentMatch);

    // Navigate backwards with Shift+Enter
    await searchInput.press('Shift+Enter');
    await page.waitForTimeout(500);

    const prevMatch = await page.locator('text=/[0-9]+\\/[0-9]+/').textContent();
    console.log('[Test] Current match after Shift+Enter:', prevMatch);

    // Should have navigated backwards (counter should be different)
    expect(prevMatch).not.toBe(currentMatch);
  });
});

test.describe('In-Note Search - Cleanup on Close', () => {
  test('should clear search highlights when panel is closed with Escape', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Type content with searchable text
    await editor.type('apple banana apple cherry apple');
    await page.waitForTimeout(1000);

    // Open search panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await searchInput.fill('apple');
    await page.waitForTimeout(1000);

    // Verify highlights are present
    const highlights = editor.locator('.search-result');
    await expect(highlights.first()).toBeVisible({ timeout: 5000 });
    const highlightCount = await highlights.count();
    expect(highlightCount).toBe(3);

    // Close search panel with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify search panel is closed
    await expect(searchInput).not.toBeVisible();

    // Verify highlights are cleared
    const highlightsAfterClose = editor.locator('.search-result');
    await expect(highlightsAfterClose).toHaveCount(0, { timeout: 5000 });
  });

  test('should clear search highlights when panel is closed with close button', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    await editor.type('test content test');
    await page.waitForTimeout(1000);

    // Open search panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await searchInput.fill('test');
    await page.waitForTimeout(1000);

    // Verify highlights are present
    const highlights = editor.locator('.search-result');
    await expect(highlights.first()).toBeVisible({ timeout: 5000 });

    // Close with close button (specifically the search close button, not comment panel)
    const closeButton = page.locator('button[aria-label="Close search (Esc)"]');
    await closeButton.click();
    await page.waitForTimeout(500);

    // Verify highlights are cleared
    const highlightsAfterClose = editor.locator('.search-result');
    await expect(highlightsAfterClose).toHaveCount(0, { timeout: 5000 });
  });

  test('should close search panel when switching notes', async () => {
    // Create first note
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);
    await editor.type('first note content');
    await page.waitForTimeout(1000);

    // Open search panel and search
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await searchInput.fill('first');
    await page.waitForTimeout(1000);

    // Verify search panel is open
    await expect(searchInput).toBeVisible();

    // Create a second note (this switches to it)
    await createButton.click();
    await page.waitForTimeout(1000);

    // Search panel should be closed after switching notes
    await expect(searchInput).not.toBeVisible({ timeout: 5000 });
  });

  test('should retain search term when reopening panel on same note', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);
    await editor.type('searchable content here');
    await page.waitForTimeout(1000);

    // Open search panel and enter a search term
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');
    await searchInput.fill('searchable');
    await page.waitForTimeout(1000);

    // Close the panel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Reopen the panel
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    // Search term should be retained
    await expect(searchInput).toHaveValue('searchable');

    // And highlights should be reapplied
    const highlights = editor.locator('.search-result');
    await expect(highlights.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('In-Note Search - Case Sensitivity', () => {
  test('should respect case-sensitive option', async () => {
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(500);

    // Type mixed case content
    await editor.type('Test test TEST');
    await page.waitForTimeout(1000);

    // Open search
    await page.keyboard.press('Shift+Meta+F');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder*="Find in note" i]');

    // Search without case-sensitive (should find all 3)
    await searchInput.fill('test');
    await page.waitForTimeout(1000);

    let matchCounter = await page.locator('text=/[0-9]+\\/[0-9]+/').textContent();
    console.log('[Test] Matches without case-sensitive:', matchCounter);

    // Enable case-sensitive
    const caseSensitiveCheckbox = page.locator('input[type="checkbox"]').first();
    await caseSensitiveCheckbox.click();
    await page.waitForTimeout(1000);

    matchCounter = await page.locator('text=/[0-9]+\\/[0-9]+/').textContent();
    console.log('[Test] Matches with case-sensitive:', matchCounter);

    // Should now find fewer matches (only lowercase "test")
    await expect(page.locator('text=/[12]\\/[12]/')).toBeVisible({ timeout: 5000 });
  });
});
