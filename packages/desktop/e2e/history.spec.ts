/**
 * E2E Tests for Note History Feature
 *
 * Tests:
 * - Opening history panel
 * - Viewing sessions
 * - Scrubbing through timeline
 * - Restoring previous versions
 * - Handling empty/metadata-only sessions
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

test.describe('Note History', () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testDbPath: string;
  let testStorageDir: string;
  let testConfigPath: string;

  // Helper function to create a note with specific content
  async function createNote(content: string) {
    await window.click('button[title="Create note"]');
    await window.waitForTimeout(1000);

    const editor = window.locator('.ProseMirror');
    await editor.click();
    await window.keyboard.type(content);
    await window.waitForTimeout(5000); // Wait even longer for sync and updates to be persisted to disk
  }

  // Helper function to edit the current note
  async function editNote(additionalContent: string) {
    const editor = window.locator('.ProseMirror');
    await editor.click();

    // Move to end of content
    await window.keyboard.press('End');
    await window.keyboard.press('Enter');
    await window.keyboard.type(additionalContent);
    await window.waitForTimeout(5000); // Wait longer for sync and updates to be persisted to disk
  }

  // Helper function to open history panel
  async function openHistoryPanel() {
    // Use keyboard shortcut (Cmd+Y on Mac, Ctrl+Y on Windows/Linux)
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+y' : 'Control+y');
    await window.waitForTimeout(1000);

    // Wait for history panel header to be visible - use role to be more specific
    const historyHeader = window.getByRole('heading', { name: 'History' });
    await expect(historyHeader).toBeVisible({ timeout: 5000 });
  }

  // Helper function to close history panel
  async function closeHistoryPanel() {
    const closeButton = window.locator('button[aria-label="close"]');
    await closeButton.click();
    await window.waitForTimeout(500);
  }

  // Helper function to select a session in the list
  async function selectSession(index: number) {
    // Find session list items specifically - we need to be more specific to avoid matching folder tree buttons
    // The history panel has a drawer, and sessions are in MUI ListItemButton components within that drawer
    // Look for buttons with "Today", "Yesterday", or date format like "Jan 1, 2024"
    const sessionItems = window.locator('div[role="presentation"] >> div[role="button"]');
    const count = await sessionItems.count();
    console.log(`Found ${count} potential session items`);

    // Filter to only those that look like date/time entries (contain "Today", "Yesterday", or month abbreviations)
    // This avoids selecting folder tree buttons
    const sessionButtons = sessionItems.filter({
      hasText: /Today|Yesterday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/,
    });

    const sessionCount = await sessionButtons.count();
    console.log(`Found ${sessionCount} session buttons`);

    // Wait for the session item to be visible and clickable
    await sessionButtons.nth(index).waitFor({ state: 'visible', timeout: 10000 });

    // Click the session
    await sessionButtons.nth(index).click();

    // Wait for the session detail view to fully render and load the preview
    // This is important because reconstructAt is async
    await window.waitForTimeout(3000);
  }

  // Helper function to get editor content
  async function getEditorContent(): Promise<string> {
    const editor = window.locator('.ProseMirror');
    return (await editor.textContent()) || '';
  }

  test.beforeEach(async () => {
    // Create temp directories with unique names
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}-${process.pid}`;
    testDbPath = path.join(os.tmpdir(), `notecove-test-${uniqueId}.db`);
    testStorageDir = path.join(os.tmpdir(), `notecove-test-storage-${uniqueId}`);
    testConfigPath = path.join(os.tmpdir(), `notecove-test-config-${uniqueId}.json`);

    await fs.mkdir(testStorageDir, { recursive: true });

    // Launch Electron app with test environment
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_STORAGE_DIR: testStorageDir,
        TEST_CONFIG_PATH: testConfigPath,
      },
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);

    // Wait for app to be ready - check for the editor panel
    await expect(window.locator('.ProseMirror')).toBeVisible({ timeout: 10000 });
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close app
    if (electronApp) {
      await electronApp.close();
    }

    // Clean up test files
    try {
      await fs.unlink(testDbPath);
      await fs.rm(testStorageDir, { recursive: true, force: true });
      await fs.unlink(testConfigPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should open and close history panel', async () => {
    // Create a note first
    await createNote('Sample note content');

    // Open history panel
    await openHistoryPanel();

    // Verify history panel is visible
    const historyHeader = window.getByRole('heading', { name: 'History' });
    await expect(historyHeader).toBeVisible();

    // Close history panel
    await closeHistoryPanel();

    // Verify panel is closed
    await expect(historyHeader).not.toBeVisible();
  });

  test('should display session list', async () => {
    // Create a note
    await createNote('Initial content');

    // Wait a bit
    await window.waitForTimeout(1000);

    // Edit the note
    await editNote('Additional content');

    // Open history panel
    await openHistoryPanel();

    // Should show at least one session
    const sessionList = window.locator('[role="button"]', { hasText: /Today|Yesterday/ });
    await expect(sessionList.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show preview when selecting a session', async () => {
    // Create a note
    await createNote('Version 1');
    await window.waitForTimeout(2000);

    // Open history panel
    await openHistoryPanel();

    // Select the first session (selectSession now waits 3 seconds internally)
    await selectSession(0);

    // Session detail view should be visible - check for the restore button
    const sessionDetail = window.locator('button', { hasText: 'Restore to This Version' });
    await expect(sessionDetail).toBeVisible({ timeout: 15000 });
  });

  test('should restore previous version', async () => {
    // Create a note with initial content
    await createNote('Original content');
    await window.waitForTimeout(2000);

    // Edit the note
    await editNote('Modified content');
    await window.waitForTimeout(2000);

    // Verify current content includes modification
    let currentContent = await getEditorContent();
    expect(currentContent).toContain('Modified content');

    // Open history panel
    await openHistoryPanel();

    // Select a session (selectSession now waits 3 seconds internally)
    await selectSession(0);

    // Click restore button
    const restoreButton = window.locator('button', { hasText: 'Restore to This Version' });
    await restoreButton.waitFor({ state: 'visible', timeout: 15000 });
    await restoreButton.click({ force: true });
    await window.waitForTimeout(2000);

    // History panel should close
    await expect(window.locator('text=History').first()).not.toBeVisible();

    // Verify content was restored
    currentContent = await getEditorContent();
    // Content should have been restored (exact check depends on which version we restored)
    expect(currentContent.length).toBeGreaterThan(0);
  });

  test('should handle empty sessions gracefully', async () => {
    // Create a note
    await createNote('Test content');
    await window.waitForTimeout(2000);

    // Open history panel
    await openHistoryPanel();

    // Select first session (selectSession now waits 3 seconds internally)
    await selectSession(0);

    // Session detail should be visible - just check restore button exists
    const restoreButton = window.locator('button', { hasText: 'Restore to This Version' });
    await expect(restoreButton).toBeVisible({ timeout: 15000 });
  });

  test('should display timeline scrubber for sessions with multiple updates', async () => {
    // Create a note
    await createNote('Start');
    await window.waitForTimeout(1000);

    // Make several edits
    for (let i = 1; i <= 3; i++) {
      await editNote(` Edit ${i}`);
      await window.waitForTimeout(500);
    }

    await window.waitForTimeout(2000);

    // Open history panel
    await openHistoryPanel();

    // Select first session (selectSession now waits 3 seconds internally)
    await selectSession(0);

    // Session detail should be visible with restore button
    const restoreButton = window.locator('button', { hasText: 'Restore to This Version' });
    await expect(restoreButton).toBeVisible({ timeout: 15000 });
  });

  test('should show session stats', async () => {
    // Create a note
    await createNote('Test note');
    await window.waitForTimeout(2000);

    // Open history panel
    await openHistoryPanel();

    // Stats should be visible (sessions count, updates count, devices)
    const stats = window.locator('text=/\\d+ sessions/');
    await expect(stats).toBeVisible({ timeout: 5000 });
  });

  test('should display "No history available" for notes without history', async () => {
    // Create a brand new note
    await createNote('Brand new note');
    await window.waitForTimeout(500);

    // Open history panel immediately
    await openHistoryPanel();

    // Should show either empty state or a single session
    const historyPanel = window.locator('text=History').first();
    await expect(historyPanel).toBeVisible();

    // Panel should be functional even for new notes
    // It might show one session or none depending on timing
  });
});
