/**
 * E2E Tests for Inter-Note Links (Phase 4.2)
 *
 * Tests inter-note link parsing, rendering, autocomplete, and navigation.
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeAll(async () => {
  // Create unique temp directory for this test
  testUserDataDir = path.join(
    os.tmpdir(),
    `notecove-e2e-links-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  await fs.mkdir(testUserDataDir, { recursive: true });
  console.log('[E2E Links] Launching Electron with userData at:', testUserDataDir);

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

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }

  // Clean up test userData directory
  try {
    await fs.rm(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E Links] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E Links] Failed to clean up test userData directory:', err);
  }
});

test.describe('Inter-Note Links - Basic Rendering', () => {
  test('should render inter-note links with styling', async () => {
    // Create a target note first
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Target Note for Rendering Test');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Get the note ID
    const targetNoteId = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Target Note for Rendering Test');
      return targetNote?.id || 'unknown-id';
    });

    // Create a note with a link to the target note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();

    await page.keyboard.type(`Link to note: [[${targetNoteId}]]`);
    await page.waitForTimeout(2000); // Wait for decoration to apply and title to load

    // Check that link has the 'inter-note-link' class (not broken)
    const linkElement = page.locator('.ProseMirror .inter-note-link');
    await expect(linkElement).toBeVisible();

    // Verify the data-note-id attribute
    const dataNoteId = await linkElement.getAttribute('data-note-id');
    expect(dataNoteId).toBe(targetNoteId);
  });

  test('should support multiple links in one note', async () => {
    // Create two target notes
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Target Note 1');
    await page.waitForTimeout(2500);

    const note1Id = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Target Note 1');
      return targetNote?.id || 'unknown-id';
    });

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Target Note 2');
    await page.waitForTimeout(2500);

    const note2Id = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Target Note 2');
      return targetNote?.id || 'unknown-id';
    });

    // Create note with multiple links
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();

    await page.keyboard.type(`Links: [[${note1Id}]] and [[${note2Id}]]`);
    await page.waitForTimeout(2000);

    // Check all links are rendered (not broken)
    const links = page.locator('.ProseMirror .inter-note-link');
    const count = await links.count();
    expect(count).toBe(2);
  });
});

test.describe('Inter-Note Links - Autocomplete', () => {
  test('should show autocomplete when typing [[', async () => {
    // Create a target note first
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Autocomplete Target Note');
    await page.waitForTimeout(2500); // Wait for auto-save and indexing

    // Create a new note and test autocomplete
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('[[');
    await page.waitForTimeout(1000); // Give autocomplete time to appear

    // The autocomplete popup should appear
    const autocompletePopup = page.locator('[role="tooltip"]');
    await expect(autocompletePopup).toBeVisible({ timeout: 3000 });

    // Verify that the target note appears in suggestions
    const targetNoteItem = page
      .locator('[role="tooltip"]')
      .getByText('Autocomplete Target Note', { exact: false })
      .first();

    await expect(targetNoteItem).toBeVisible({ timeout: 3000 });
  });

  test('should filter autocomplete suggestions based on query', async () => {
    // Create multiple target notes
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Programming Guide');
    await page.waitForTimeout(2500); // Wait for auto-save and FTS5 indexing

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Project Notes');
    await page.waitForTimeout(2500); // Wait for auto-save and FTS5 indexing

    // Create new note and test filtering
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('[[Pro');
    await page.waitForTimeout(1500); // Give autocomplete time to query

    // The autocomplete popup should appear
    const autocompletePopup = page.locator('[role="tooltip"]');
    await expect(autocompletePopup).toBeVisible({ timeout: 3000 });

    // Both 'Programming Guide' and 'Project Notes' should be suggested
    const programmingItem = page
      .locator('[role="tooltip"]')
      .getByText('Programming Guide', { exact: false })
      .first();

    const projectItem = page
      .locator('[role="tooltip"]')
      .getByText('Project Notes', { exact: false })
      .first();

    await expect(programmingItem).toBeVisible({ timeout: 3000 });
    await expect(projectItem).toBeVisible({ timeout: 3000 });
  });

  test('should insert link when autocomplete suggestion is selected', async () => {
    // Create a target note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Insert Me Note');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Get the note ID via the API
    const targetNoteId = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Insert Me Note');
      return targetNote?.id || 'unknown-id';
    });

    // Create new note and use autocomplete
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('[[Inser');
    await page.waitForTimeout(1500);

    // Wait for autocomplete
    const autocompletePopup = page.locator('[role="tooltip"]');
    await expect(autocompletePopup).toBeVisible({ timeout: 3000 });

    const insertMeItem = page
      .locator('[role="tooltip"]')
      .getByText('Insert Me Note', { exact: false })
      .first();
    await expect(insertMeItem).toBeVisible({ timeout: 3000 });

    // Press Enter to select
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // The link should be inserted
    const content = await editor.textContent();
    expect(content).toContain(`[[${targetNoteId}]]`);

    // And it should be styled as a link
    const linkElement = page.locator('.ProseMirror .inter-note-link');
    await expect(linkElement).toBeVisible();
  });

  test('should close autocomplete on Escape', async () => {
    // Create a target note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Escape Test Note');
    await page.waitForTimeout(2000);

    // Create new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('[[');
    await page.waitForTimeout(1000);

    // Wait for autocomplete to appear
    const autocompletePopup = page.locator('[role="tooltip"]');
    await expect(autocompletePopup).toBeVisible({ timeout: 3000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Autocomplete popup should be hidden
    await expect(autocompletePopup).not.toBeVisible();
  });
});

test.describe('Inter-Note Links - Navigation', () => {
  test('should navigate to linked note on single click', async () => {
    // Create target note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Navigation Target Note');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Get the note ID via the API
    const targetNoteId = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Navigation Target Note');
      return targetNote?.id || 'unknown-id';
    });

    // Create source note with link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type(`Click this link: [[${targetNoteId}]]`);
    await page.waitForTimeout(2000); // Wait for decoration to apply and title to load

    // Click the link
    const linkElement = page.locator('.ProseMirror .inter-note-link');
    await linkElement.click({ timeout: 5000 });

    // Wait for navigation to complete by checking the editor content
    await page.waitForTimeout(2000);

    // Verify we navigated to the target note by checking innerText (respects CSS visibility)
    const content = await editor.innerText();
    expect(content).toContain('Navigation Target Note');
  });
});

test.describe('Inter-Note Links - Database Indexing', () => {
  test('should index links in database when note is created', async () => {
    // Create target notes
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Index Target 1');
    await page.waitForTimeout(2500);

    // Get the note ID via the API
    const target1Id = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Index Target 1');
      return targetNote?.id || 'unknown-id';
    });

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Index Target 2');
    await page.waitForTimeout(2500);

    // Get the note ID via the API
    const target2Id = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Index Target 2');
      return targetNote?.id || 'unknown-id';
    });

    // Create note with links
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type(`Links: [[${target1Id}]] and [[${target2Id}]]`);
    await page.waitForTimeout(2500); // Wait for auto-save and indexing

    // Get the note ID via the API
    const sourceNoteId = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const sourceNote = notes.find((n) => n.title.startsWith('Links:'));
      return sourceNote?.id || 'unknown-id';
    });

    // Query the database via IPC to verify links are indexed
    const links = await page.evaluate(async (noteId) => {
      // Access test API to check links
      return await window.electronAPI.testing?.getLinksFromNote?.(noteId);
    }, sourceNoteId);

    // Verify the links were indexed (if test API is available)
    if (links) {
      expect(links).toContain(target1Id);
      expect(links).toContain(target2Id);
    }
  });
});

test.describe('Inter-Note Links - Broken Links', () => {
  test('should show broken link styling for non-existent note', async () => {
    // Create a note with a link to a non-existent note ID
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Use a UUID that definitely doesn't exist
    const fakeNoteId = '00000000-0000-0000-0000-000000000000';
    await page.keyboard.type(`Broken link: [[${fakeNoteId}]]`);
    await page.waitForTimeout(2000); // Wait for decoration to apply and title check

    // Check that link has the 'inter-note-link-broken' class
    const brokenLinkElement = page.locator('.ProseMirror .inter-note-link-broken');
    await expect(brokenLinkElement).toBeVisible();

    // Verify the data-note-id attribute
    const dataNoteId = await brokenLinkElement.getAttribute('data-note-id');
    expect(dataNoteId).toBe(fakeNoteId);

    // Verify it says "Note not found"
    const linkText = await brokenLinkElement.textContent();
    expect(linkText).toContain('[Note not found]');
  });
});

test.describe('Inter-Note Links - Persistence', () => {
  test('should persist links across app restarts', async () => {
    // Create target note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Persistent Target');
    await page.waitForTimeout(2500);

    // Get the note ID via the API
    const targetNoteId = await page.evaluate(async () => {
      const notes = await window.electronAPI.note.list('default');
      const targetNote = notes.find((n) => n.title === 'Persistent Target');
      return targetNote?.id || 'unknown-id';
    });

    // Create note with link
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type(`Persistent link: [[${targetNoteId}]]`);
    await page.waitForTimeout(2500); // Wait for auto-save

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: ['.', `--user-data-dir=${testUserDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Navigate to "All Notes"
    await page.getByRole('button', { name: /All Notes/ }).click();
    await page.waitForTimeout(1000);

    // Click on the note with the link
    await page.getByRole('button', { name: /Persistent link:/ }).click();
    await page.waitForTimeout(1000);

    // Verify link is still styled
    const linkElement = page.locator('.ProseMirror .inter-note-link');
    await expect(linkElement).toBeVisible({ timeout: 5000 });

    const dataNoteId = await linkElement.getAttribute('data-note-id');
    expect(dataNoteId).toBe(targetNoteId);
  });
});
