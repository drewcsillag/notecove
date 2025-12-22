/**
 * E2E Tests for Note List Display
 *
 * Tests that titles and snippets in the notes list are displayed correctly:
 * 1. [[uuid]] links should show the linked note's title, not the raw UUID
 * 2. Snippets should show actual content (not empty, not from wrong block)
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

// Use beforeEach/afterEach to ensure each test gets a fresh Electron app
// This prevents race conditions when tests run in parallel
test.beforeEach(async () => {
  // Create unique temp directory for this test
  testUserDataDir = path.join(
    os.tmpdir(),
    `notecove-e2e-list-display-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  await fs.mkdir(testUserDataDir, { recursive: true });
  console.log('[E2E List Display] Launching Electron with userData at:', testUserDataDir);

  // Launch Electron app
  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Get the first window
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000); // Wait for app initialization
});

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close();
  }

  // Clean up test userData directory
  try {
    await fs.rm(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E List Display] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E List Display] Failed to clean up test userData directory:', err);
  }
});

test.describe('Note List Display - Link Resolution', () => {
  test('should display linked note title instead of UUID in notes list title', async () => {
    // Step 1: Create a target note that will be linked to
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('My Target Note');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Get the target note ID
    const targetNoteId = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'My Target Note');
      return targetNote?.id || 'unknown-id';
    });
    expect(targetNoteId).not.toBe('unknown-id');

    // Step 2: Create a note with the target note's UUID in the title
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    // Type a title that includes a link to the target note
    await page.keyboard.type(`Note linking to [[${targetNoteId}]]`);
    await page.waitForTimeout(2500); // Wait for auto-save and database update

    // Step 3: Verify the notes list shows the linked note's title, not the UUID
    // Find the note in the notes list by clicking on All Notes
    const allNotesButton = page.locator('[aria-label="All Notes"]').first();
    await allNotesButton.click();
    await page.waitForTimeout(1000);

    // Find the note item in the list that contains our link
    // The title should show "Note linking to [[My Target Note]]" NOT "Note linking to [[uuid]]"
    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList).toBeVisible({ timeout: 5000 });

    // Look for the note with the resolved title
    const noteWithLink = notesList.getByText('Note linking to [[My Target Note]]', {
      exact: false,
    });
    await expect(noteWithLink).toBeVisible({ timeout: 5000 });

    // Verify the UUID is NOT visible in the notes list
    const noteWithUuid = notesList.getByText(targetNoteId);
    await expect(noteWithUuid).not.toBeVisible();
  });

  test('should display linked note title instead of UUID in notes list snippet', async () => {
    // Step 1: Create a target note that will be linked to
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Snippet Target Note');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Get the target note ID
    const targetNoteId = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Snippet Target Note');
      return targetNote?.id || 'unknown-id';
    });
    expect(targetNoteId).not.toBe('unknown-id');

    // Step 2: Create a note with a title and a second paragraph containing the link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    // Type title
    await page.keyboard.type('Note with Link in Body');
    // Press Enter to create a new paragraph (this will be the snippet)
    await page.keyboard.press('Enter');
    await page.keyboard.type(`Check out this note: [[${targetNoteId}]] for more info`);
    await page.waitForTimeout(3500); // Wait for auto-save and database update

    // Step 3: Verify the notes list snippet shows the linked note's title, not the UUID
    const allNotesButton = page.locator('[aria-label="All Notes"]').first();
    await allNotesButton.click();
    await page.waitForTimeout(1000);

    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList).toBeVisible({ timeout: 5000 });

    // The snippet should contain the resolved link title
    const snippetWithResolvedLink = notesList.getByText('[[Snippet Target Note]]', {
      exact: false,
    });
    await expect(snippetWithResolvedLink).toBeVisible({ timeout: 5000 });

    // Verify the UUID is NOT visible in the notes list snippet
    const snippetWithUuid = notesList.getByText(targetNoteId);
    await expect(snippetWithUuid).not.toBeVisible();
  });

  test('should display "deleted note" for broken links in notes list', async () => {
    // Create a note with a link to a non-existent note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    // Use a fake UUID that doesn't exist
    const fakeNoteId = 'deadbeef-dead-beef-dead-beefdeadbeef';
    await page.keyboard.type(`Title with broken link [[${fakeNoteId}]]`);
    await page.waitForTimeout(2500); // Wait for auto-save and database update

    // Verify the notes list shows "deleted note" for the broken link
    const allNotesButton = page.locator('[aria-label="All Notes"]').first();
    await allNotesButton.click();
    await page.waitForTimeout(1000);

    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList).toBeVisible({ timeout: 5000 });

    // The title should show "[[deleted note]]" for the broken link
    const noteWithBrokenLink = notesList.getByText('[[deleted note]]', { exact: false });
    await expect(noteWithBrokenLink).toBeVisible({ timeout: 5000 });

    // Verify the fake UUID is NOT visible
    const noteWithUuid = notesList.getByText(fakeNoteId);
    await expect(noteWithUuid).not.toBeVisible();
  });
});

test.describe('Note List Display - Snippet Generation', () => {
  test('should show snippet from second paragraph, not empty', async () => {
    // Create a note with multiple paragraphs
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    // Type title (first line)
    await page.keyboard.type('Multi Paragraph Note');
    // Press Enter to create second paragraph
    await page.keyboard.press('Enter');
    await page.keyboard.type('This is the second paragraph that should appear in the snippet');
    // Press Enter to create third paragraph
    await page.keyboard.press('Enter');
    await page.keyboard.type('This is the third paragraph');
    await page.waitForTimeout(3500); // Wait for auto-save (increased for debounce)

    // Navigate to All Notes to see the list
    const allNotesButton = page.locator('[aria-label="All Notes"]').first();
    await allNotesButton.click();
    await page.waitForTimeout(1000);

    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList).toBeVisible({ timeout: 5000 });

    // Debug: Log the notes list content
    const listText = await notesList.textContent();
    console.log('[E2E Debug] Notes list content:', listText);

    // The snippet should contain content from the second paragraph
    const snippetContent = notesList.getByText('This is the second paragraph', { exact: false });
    await expect(snippetContent).toBeVisible({ timeout: 10000 });
  });

  test('should skip empty lines when generating snippet', async () => {
    // Create a note with empty lines between paragraphs
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    // Type title
    await page.keyboard.type('Note with Empty Lines');
    // Press Enter multiple times to create empty lines
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    // Type actual content
    await page.keyboard.type('Content after empty lines should be in snippet');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Navigate to All Notes
    const allNotesButton = page.locator('[aria-label="All Notes"]').first();
    await allNotesButton.click();
    await page.waitForTimeout(1000);

    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList).toBeVisible({ timeout: 5000 });

    // The snippet should contain the actual content, not be empty
    const snippetContent = notesList.getByText('Content after empty lines', { exact: false });
    await expect(snippetContent).toBeVisible({ timeout: 5000 });
  });

  test('should show code block content in snippet when it is the first content', async () => {
    // Create a note where the first content after title is a code block
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    // Type title
    await page.keyboard.type('Note with Code Block');
    // Press Enter
    await page.keyboard.press('Enter');
    // Type code block content (using triple backticks)
    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('const x = 42;');
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log(x);');
    await page.waitForTimeout(3500); // Wait for auto-save

    // Navigate to All Notes
    const allNotesButton = page.locator('[aria-label="All Notes"]').first();
    await allNotesButton.click();
    await page.waitForTimeout(1000);

    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList).toBeVisible({ timeout: 5000 });

    // The snippet should include code block content
    const snippetContent = notesList.getByText('const x = 42', { exact: false });
    await expect(snippetContent).toBeVisible({ timeout: 10000 });
  });

  test('should show descriptive content before code block in snippet', async () => {
    // Create a note with descriptive text followed by code
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    // Type title with unique identifier
    await page.keyboard.type('Tutorial Note E2E Test');
    // Press Enter
    await page.keyboard.press('Enter');
    // Type descriptive text first with unique content
    await page.keyboard.type('Unique tutorial content for testing snippets');
    // Press Enter for code
    await page.keyboard.press('Enter');
    await page.keyboard.type('```');
    await page.keyboard.press('Enter');
    await page.keyboard.type('some code here');
    await page.waitForTimeout(3500); // Wait for auto-save

    // Navigate to All Notes
    const allNotesButton = page.locator('[aria-label="All Notes"]').first();
    await allNotesButton.click();
    await page.waitForTimeout(1000);

    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList).toBeVisible({ timeout: 5000 });

    // The snippet should show the descriptive text, not the code
    // Use unique text to avoid matching other notes
    const snippetContent = notesList.getByText('Unique tutorial content', { exact: false });
    await expect(snippetContent).toBeVisible({ timeout: 10000 });
  });
});
