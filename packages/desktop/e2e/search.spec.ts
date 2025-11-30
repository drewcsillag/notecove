/**
 * E2E tests for Note Search Functionality (Phase 2.5.3)
 *
 * Tests the search UI and FTS5 full-text search capabilities.
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
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-search-'));
  console.log('[E2E Search] Launching Electron with userData at:', testUserDataDir);

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
    console.log('[E2E Search] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E Search] Failed to clean up test userData directory:', err);
  }
});

test.describe('Note Search UI', () => {
  test('should display search box in notes list panel', async () => {
    // Look for search input in the notes list panel (middle panel)
    const middlePanel = page.locator('#middle-panel');
    const searchInput = middlePanel.locator('input[type="text"]').first();

    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /search/i);
  });

  test('should allow typing in search box', async () => {
    const middlePanel = page.locator('#middle-panel');
    const searchInput = middlePanel.locator('input[type="text"]').first();

    await searchInput.click();
    await searchInput.fill('test query');

    await expect(searchInput).toHaveValue('test query');
  });

  test('should have clear button when search has text', async () => {
    const middlePanel = page.locator('#middle-panel');
    const searchInput = middlePanel.locator('input[type="text"]').first();

    // Initially no clear button (or disabled)
    await searchInput.fill('');

    // Type text
    await searchInput.click();
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // Clear button should appear (X icon or similar)
    const clearButton = middlePanel
      .locator('button[aria-label*="clear" i], button[aria-label*="reset" i]')
      .first();
    await expect(clearButton).toBeVisible();
  });
});

test.describe('Note Search Functionality', () => {
  test('should search note content and display results', async () => {
    // Create a note with searchable content
    const createButton = page.getByTitle('Create note');
    await createButton.click();
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.waitForTimeout(1000); // Wait for note to be fully selected and editor initialized
    const testContent =
      'Searchable Test Note\nThis note contains unique search terms like xyzabc123';
    await editor.type(testContent);
    await page.waitForTimeout(1500); // Wait for debounce (300ms) + save + FTS indexing

    // Now search for the unique term
    const middlePanel = page.locator('#middle-panel');
    const searchInput = middlePanel.locator('input[type="text"]').first();

    await searchInput.click();
    await searchInput.fill('xyzabc123');
    await page.waitForTimeout(1500); // Wait for search debounce (300ms) + query execution

    // Verify the note appears in results
    const notesList = middlePanel.locator('[role="list"], .notes-list, ul').first();
    await expect(notesList.locator('text=Searchable Test Note').first()).toBeVisible({
      timeout: 8000,
    });
  });

  test('should filter notes list based on search query', async () => {
    // Create two notes with different content
    const createButton = page.getByTitle('Create note');

    // First note
    await createButton.click();
    await page.waitForTimeout(500);
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('First Note About Cats\nCats are great pets');
    await page.waitForTimeout(4000); // Wait for debounce (300ms) + save + FTS indexing

    // Second note
    await createButton.click();
    await page.waitForTimeout(500);
    await editor.click();
    await editor.fill('Second Note About Dogs\nDogs are loyal companions');
    await page.waitForTimeout(4000); // Wait for debounce (300ms) + save + FTS indexing

    // Search for "cats"
    const middlePanel = page.locator('#middle-panel');
    const searchInput = middlePanel.locator('input[type="text"]').first();
    await searchInput.click();
    await searchInput.fill('cats');
    await page.waitForTimeout(1500); // Wait for search debounce (300ms) + query execution

    // Should see first note but not second
    const notesList = middlePanel;
    await expect(notesList.locator('text=First Note About Cats').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(notesList.locator('text=Second Note About Dogs').first()).not.toBeVisible();

    // Clear search
    const clearButton = middlePanel
      .locator('button[aria-label*="clear" i], button[aria-label*="reset" i]')
      .first();
    await clearButton.click();
    await page.waitForTimeout(500);

    // Both notes should be visible again
    await expect(notesList.locator('text=First Note About Cats').first()).toBeVisible();
    await expect(notesList.locator('text=Second Note About Dogs').first()).toBeVisible();
  });

  test('should show empty state when no search results', async () => {
    // Search for something that doesn't exist
    const middlePanel = page.locator('#middle-panel');
    const searchInput = middlePanel.locator('input[type="text"]').first();

    await searchInput.click();
    await searchInput.fill('xyznonexistentterm999');
    await page.waitForTimeout(500);

    // Should show "no results" message
    await expect(middlePanel.locator('text=/no results|no notes found/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should persist search query across app restarts', async () => {
    // Enter a search query
    const middlePanel = page.locator('#middle-panel');
    const searchInput = middlePanel.locator('input[type="text"]').first();

    await searchInput.click();
    await searchInput.fill('persistent search');
    // Wait longer for search query to be persisted to appState
    await page.waitForTimeout(2000);

    // Close and reopen app
    await electronApp.close();

    // Relaunch with same userData
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
    electronApp = await electron.launch({
      args: [mainPath, `--user-data-dir=${testUserDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
      timeout: 60000,
    });

    page = await electronApp.firstWindow();
    await page.waitForSelector('text=Folders', { timeout: 10000 });
    // Wait longer for app to fully initialize and load search query from appState
    await page.waitForTimeout(2000);

    // Check that search query persisted
    const newMiddlePanel = page.locator('#middle-panel');
    const newSearchInput = newMiddlePanel.locator('input[type="text"]').first();

    await expect(newSearchInput).toHaveValue('persistent search');
  });
});
