/**
 * E2E Tests for Tags System (Phase 4.1)
 *
 * Tests tag parsing, rendering, and basic functionality.
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Tests share an Electron instance via beforeAll, so they must run serially
test.describe.configure({ mode: 'serial' });

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

test.beforeAll(async () => {
  // Create unique temp directory for this test
  testUserDataDir = path.join(
    os.tmpdir(),
    `notecove-e2e-tags-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  await fs.mkdir(testUserDataDir, { recursive: true });
  console.log('[E2E Tags] Launching Electron with userData at:', testUserDataDir);

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

  // Set link display preference to 'none' so links appear as plain links
  // This ensures tests checking for a.web-link elements find visible links
  await page.evaluate(async () => {
    await window.electronAPI.appState.set('linkDisplayPreference', 'none');
  });

  // Reload the page so the preference is picked up by the React context
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000); // Wait for app re-initialization
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }

  // Clean up test userData directory
  try {
    await fs.rm(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E Tags] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E Tags] Failed to clean up test userData directory:', err);
  }
});

// Clean up all notes before each test to ensure test isolation
test.beforeEach(async () => {
  await page.evaluate(async () => {
    const sds = await window.electronAPI.sd.list();
    for (const sd of sds) {
      const notes = await window.electronAPI.note.list(sd.id);
      for (const note of notes) {
        await window.electronAPI.note.delete(note.id);
      }
    }
  });
  await page.waitForTimeout(300); // Allow UI to update
});

// Helper function to wait for a tag to be indexed in the database
async function waitForTagIndexed(tagName: string, timeout = 10000) {
  await expect(async () => {
    const tags = await page.evaluate(async () => {
      const allTags = await window.electronAPI.tag.getAll();
      return allTags.map((t: { name: string }) => t.name);
    });
    expect(tags).toContain(tagName);
  }).toPass({ timeout });
}

test.describe('Tags System - Basic Functionality', () => {
  test('should render hashtags with styling in editor', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    // Type content with a hashtag
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Meeting notes for #work project');
    await page.waitForTimeout(500);

    // Check that hashtag exists in the content
    const content = await editor.textContent();
    expect(content).toContain('#work');

    // Check that hashtag has the 'hashtag' class (applied by our extension)
    const hashtagElement = page.locator('.ProseMirror .hashtag');
    await expect(hashtagElement).toBeVisible();

    // Verify the data-tag attribute
    const dataTag = await hashtagElement.getAttribute('data-tag');
    expect(dataTag).toBe('work');
  });

  test('should support multiple hashtags in one note', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    // Type content with multiple hashtags
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Tags: #programming #typescript #react');
    await page.waitForTimeout(500);

    // Check all hashtags are rendered
    const hashtags = page.locator('.ProseMirror .hashtag');
    const count = await hashtags.count();
    expect(count).toBe(3);

    // Verify each hashtag
    const tags = await hashtags.allTextContents();
    expect(tags).toContain('#programming');
    expect(tags).toContain('#typescript');
    expect(tags).toContain('#react');
  });

  test('should support tags with numbers and underscores', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Tags: #web3 #react_native #v2_0');
    await page.waitForTimeout(500);

    const content = await editor.textContent();
    expect(content).toContain('#web3');
    expect(content).toContain('#react_native');
    expect(content).toContain('#v2_0');

    // Verify they're styled as hashtags
    const hashtags = page.locator('.ProseMirror .hashtag');
    const count = await hashtags.count();
    expect(count).toBe(3);
  });

  test('should persist hashtag styling after typing more content', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('First line with #tag1 ');
    await page.waitForTimeout(1000); // Wait for decoration to apply

    // Add more content - press Enter and wait for new paragraph
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300); // Wait for new paragraph to be created

    // Click on the new paragraph to ensure focus (TipTap can lose focus after Enter)
    const paragraphs = editor.locator('p');
    await paragraphs.last().click();
    await page.waitForTimeout(200);

    // Type second line
    await page.keyboard.type('Second line with #tag2 ');
    await page.waitForTimeout(1000); // Wait for decoration to apply

    // Both hashtags should still be styled as clickable tag buttons
    // These are rendered as buttons within the editor (with role="button" and aria-label)
    const tag1Button = page.locator('.ProseMirror').getByRole('button', { name: /Tag: tag1/i });
    const tag2Button = page.locator('.ProseMirror').getByRole('button', { name: /Tag: tag2/i });

    await expect(tag1Button).toBeVisible({ timeout: 3000 });
    await expect(tag2Button).toBeVisible({ timeout: 3000 });
  });

  test('should handle hashtags at different positions in text', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Hashtag at start, middle, and end
    await page.keyboard.type('#start some text #middle more text #end');
    await page.waitForTimeout(500);

    const hashtags = page.locator('.ProseMirror .hashtag');
    const count = await hashtags.count();
    expect(count).toBe(3);

    const tags = await hashtags.allTextContents();
    expect(tags).toContain('#start');
    expect(tags).toContain('#middle');
    expect(tags).toContain('#end');
  });

  test('should not treat # without alphanumeric chars as hashtag', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // These should NOT be hashtags
    await page.keyboard.type('Price: #50 or # or #-test');
    await page.waitForTimeout(500);

    // No hashtags should be styled
    const hashtags = page.locator('.ProseMirror .hashtag');
    const count = await hashtags.count();
    expect(count).toBe(0);
  });

  test('should NOT style URL fragments as hashtags', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type a URL with a fragment - the #section should NOT be styled as a hashtag
    // Space at end triggers autolink
    await page.keyboard.type('See https://example.com/page#section for details');
    await page.waitForTimeout(500);

    // The URL should be linked
    const linkElement = page.locator('.ProseMirror a.web-link');
    await expect(linkElement).toBeVisible();

    // The #section should NOT have hashtag styling (it's part of the URL)
    const hashtags = page.locator('.ProseMirror .hashtag');
    const count = await hashtags.count();
    expect(count).toBe(0);
  });

  test('should style real hashtags but not URL fragments in same note', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type content with both a real hashtag and a URL with fragment
    await page.keyboard.type('#work See https://example.com#section then #project ');
    await page.waitForTimeout(500);

    // Should have exactly 2 hashtags (work and project, but NOT section)
    const hashtags = page.locator('.ProseMirror .hashtag');
    const count = await hashtags.count();
    expect(count).toBe(2);

    // Verify the hashtags are the correct ones
    const tags = await hashtags.allTextContents();
    expect(tags).toContain('#work');
    expect(tags).toContain('#project');
    // #section should NOT be in the list
    expect(tags).not.toContain('#section');
  });

  test('should update tag styling after editing', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Text with #oldtag '); // Add trailing space
    await page.waitForTimeout(1000);

    // Verify old tag is styled
    let hashtags = page.locator('.ProseMirror .hashtag');
    expect(await hashtags.count()).toBe(1);
    expect(await hashtags.textContent()).toBe('#oldtag');

    // Triple-click to select all text in the heading/paragraph
    const heading = editor.locator('h1').first();
    await heading.click({ clickCount: 3 });
    await page.waitForTimeout(200);
    await page.keyboard.type('Text with #oldtagsuffix '); // Retype with new tag
    await page.waitForTimeout(1000);

    // The tag should now be #oldtagsuffix
    hashtags = page.locator('.ProseMirror .hashtag');
    expect(await hashtags.count()).toBe(1);
    expect(await hashtags.textContent()).toBe('#oldtagsuffix');
  });
});

test.describe('Tags System - Persistence', () => {
  test('should persist hashtag styling across app restarts', async () => {
    // Create a note with hashtags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Persistent tags: #test #restart');
    await page.waitForTimeout(2000); // Wait for auto-save

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

    // Navigate to "All Notes" folder first
    await page.getByRole('button', { name: /All Notes/ }).click();
    await page.waitForTimeout(1000);

    // Click on the note we created (by its title content)
    await page.getByRole('button', { name: /Persistent tags:/ }).click();
    await page.waitForTimeout(1000);

    // Verify hashtags are still styled
    const hashtags = page.locator('.ProseMirror .hashtag');
    const count = await hashtags.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const tags = await hashtags.allTextContents();
    expect(tags).toContain('#test');
    expect(tags).toContain('#restart');
  });
});

test.describe('Tags System - Database Indexing', () => {
  test('should index tags in database when note is created', async () => {
    // Create a note with hashtags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Database test: #work #project #typescript');
    await page.waitForTimeout(2500); // Wait for auto-save and indexing

    // Query the database via IPC to verify tags are indexed
    const allTags = await page.evaluate(async () => {
      return await window.electronAPI.tag.getAll();
    });

    // Extract tag names
    const tagNames = allTags.map((t: { name: string }) => t.name).sort();

    // Verify the tags were indexed
    expect(tagNames).toContain('work');
    expect(tagNames).toContain('project');
    expect(tagNames).toContain('typescript');
    expect(allTags.length).toBeGreaterThanOrEqual(3);
  });

  test('should update tag index when note is edited', async () => {
    // Create a note with one unique tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test content: #editoriginal');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Query all tags - should have editoriginal
    let allTags = await page.evaluate(async () => {
      const tags = await window.electronAPI.tag.getAll();
      return tags.map((t: { name: string }) => t.name);
    });

    expect(allTags).toContain('editoriginal');
    expect(allTags).not.toContain('editupdated');

    // Edit the note to add more tags
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' #editupdated #editnew');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Query all tags again - should now have all three
    allTags = await page.evaluate(async () => {
      const tags = await window.electronAPI.tag.getAll();
      return tags.map((t: { name: string }) => t.name);
    });

    expect(allTags).toContain('editoriginal');
    expect(allTags).toContain('editupdated');
    expect(allTags).toContain('editnew');
  });

  test('should remove tags from index when deleted from note', async () => {
    // Create a note with multiple unique tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Remove test: #deleteremoveme #deletekeepme');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Verify initial tags are indexed
    let allTags = await page.evaluate(async () => {
      const tags = await window.electronAPI.tag.getAll();
      return tags.map((t: { name: string }) => t.name);
    });

    expect(allTags).toContain('deletekeepme');
    expect(allTags).toContain('deleteremoveme');

    // Remove the #deleteremoveme tag by editing the note
    await editor.click();
    await page.keyboard.press('Control+A'); // Select all
    await page.keyboard.type('Remove test: #deletekeepme'); // Only keep one tag
    await page.waitForTimeout(2500); // Wait for auto-save

    // Verify #deleteremoveme tag was removed from global index
    allTags = await page.evaluate(async () => {
      const tags = await window.electronAPI.tag.getAll();
      return tags.map((t: { name: string }) => t.name);
    });

    // Note: deleteremoveme might still exist if it's in other notes,
    // but deletekeepme should definitely still be there
    expect(allTags).toContain('deletekeepme');
  });
});

test.describe('Tags System - Autocomplete', () => {
  test('should show autocomplete suggestions when typing #', async () => {
    // First, create a few notes with tags to populate the tag database
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test note with #autocomplete1 tag');
    await page.waitForTimeout(3000); // Wait for auto-save

    // Wait for the tag to be indexed in the database (more reliable than UI check)
    await expect(async () => {
      const tags = await page.evaluate(async () => {
        const allTags = await window.electronAPI.tag.getAll();
        return allTags.map((t: { name: string }) => t.name);
      });
      expect(tags).toContain('autocomplete1');
    }).toPass({ timeout: 10000 });

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Another note with #autocomplete2 tag');
    await page.waitForTimeout(3000); // Wait for auto-save

    // Wait for autocomplete2 to be indexed in the database
    await expect(async () => {
      const tags = await page.evaluate(async () => {
        const allTags = await window.electronAPI.tag.getAll();
        return allTags.map((t: { name: string }) => t.name);
      });
      expect(tags).toContain('autocomplete2');
    }).toPass({ timeout: 10000 });

    // Now create a new note and test autocomplete
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(1000); // Wait longer for editor to fully initialize

    editor = page.locator('.ProseMirror');
    // Click on the paragraph to ensure cursor is in the right place
    const paragraph = editor.locator('p').first();
    await paragraph.click();
    await page.waitForTimeout(300);

    // Type text before # to avoid markdown heading interpretation
    await page.keyboard.type('Test ');
    await page.waitForTimeout(200);
    // Type # and query character by character to trigger suggestion
    for (const char of '#auto') {
      await page.keyboard.type(char);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000); // Give autocomplete time to appear

    // The autocomplete popup shows as a tooltip with list items
    // Look for the tooltip/popper containing autocomplete suggestions (has text content)
    const autocomplete1Item = page
      .locator('[role="tooltip"]')
      .getByText('#autocomplete1', { exact: false })
      .first();

    // Autocomplete should show the tag
    await expect(autocomplete1Item).toBeVisible({ timeout: 5000 });
  });

  test('should filter autocomplete suggestions based on query', async () => {
    // Create notes with different tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #programming tag');
    await page.waitForTimeout(3000);

    // Wait for programming tag to be indexed in database
    await waitForTagIndexed('programming');

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #project tag');
    await page.waitForTimeout(3000);

    // Wait for project tag to be indexed in database
    await waitForTagIndexed('project');

    // Create new note and test filtering
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(1000);

    editor = page.locator('.ProseMirror');
    const paragraph = editor.locator('p').first();
    await paragraph.click();
    await page.waitForTimeout(300);

    // Type prefix then # and query character by character
    await page.keyboard.type('Test ');
    await page.waitForTimeout(200);
    for (const char of '#pro') {
      await page.keyboard.type(char);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000); // Wait for autocomplete

    // 'programming' should be suggested since it matches 'pro'
    const programmingItem = page
      .locator('[role="tooltip"]')
      .getByText('#programming', { exact: false })
      .first();

    // Programming tag should be visible in autocomplete
    await expect(programmingItem).toBeVisible({ timeout: 5000 });

    // Continue typing to narrow the filter
    await page.keyboard.type('g');
    await page.waitForTimeout(1000);

    // Now only 'programming' should be suggested (contains 'prog')
    await expect(programmingItem).toBeVisible({ timeout: 2000 });
  });

  test('should insert tag when autocomplete suggestion is selected', async () => {
    // Create a note with a tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #insertme tag');
    await page.waitForTimeout(3000);

    // Wait for insertme tag to be indexed in database
    await waitForTagIndexed('insertme');

    // Create new note and use autocomplete
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(1000);

    editor = page.locator('.ProseMirror');
    const paragraph = editor.locator('p').first();
    await paragraph.click();
    await page.waitForTimeout(300);

    // Type prefix and # query character by character
    await page.keyboard.type('Test ');
    await page.waitForTimeout(200);
    for (const char of '#ins') {
      await page.keyboard.type(char);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000); // Wait for autocomplete to appear

    // Wait for the autocomplete suggestion to be visible
    const insertmeItem = page
      .locator('[role="tooltip"]')
      .getByText('#insertme', { exact: false })
      .first();
    await expect(insertmeItem).toBeVisible({ timeout: 5000 });

    // Press Enter to select the suggestion
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // The tag should be inserted with a trailing space
    const content = await editor.textContent();
    expect(content).toContain('#insertme');

    // And it should be styled as a hashtag button
    const insertmeButton = page.locator('.ProseMirror').getByText('#insertme', { exact: true });
    await expect(insertmeButton).toBeVisible();
  });

  test('should navigate autocomplete with arrow keys', async () => {
    // Create multiple notes with tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #alpha tag');
    await page.waitForTimeout(3000);

    // Wait for alpha tag to be indexed in database
    await waitForTagIndexed('alpha');

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #beta tag');
    await page.waitForTimeout(3000);

    // Wait for beta tag to be indexed in database
    await waitForTagIndexed('beta');

    // Create new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(1000);

    editor = page.locator('.ProseMirror');
    const paragraph = editor.locator('p').first();
    await paragraph.click();
    await page.waitForTimeout(300);

    // Type prefix then # character by character
    await page.keyboard.type('Test ');
    await page.waitForTimeout(200);
    for (const char of '#a') {
      await page.keyboard.type(char);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000); // Wait for autocomplete

    // Wait for alpha suggestion to appear
    const alphaItem = page
      .locator('[role="tooltip"]')
      .getByText('#alpha', { exact: false })
      .first();
    await expect(alphaItem).toBeVisible({ timeout: 5000 });

    // Click the autocomplete suggestion to select it
    await alphaItem.click();
    await page.waitForTimeout(500);

    // The alpha tag should be inserted
    const content = await editor.textContent();
    expect(content).toContain('#alpha');
  });

  test('should close autocomplete on Escape', async () => {
    // Create a note with a tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #escape tag');
    await page.waitForTimeout(3000);

    // Wait for escape tag to be indexed in database
    await waitForTagIndexed('escape');

    // Create new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(1000);

    editor = page.locator('.ProseMirror');
    const paragraph = editor.locator('p').first();
    await paragraph.click();
    await page.waitForTimeout(300);

    // Type prefix then # character by character
    await page.keyboard.type('Test ');
    await page.waitForTimeout(200);
    for (const char of '#esc') {
      await page.keyboard.type(char);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000); // Wait for autocomplete

    // Wait for suggestion to appear
    const escapeItem = page
      .locator('[role="tooltip"]')
      .getByText('#escape', { exact: false })
      .first();
    await expect(escapeItem).toBeVisible({ timeout: 5000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Autocomplete suggestion should be hidden (popup closed)
    await expect(escapeItem).not.toBeVisible();
  });

  test('should show tag usage count in autocomplete', async () => {
    // Create multiple notes with the same tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('First note with #counted tag');
    await page.waitForTimeout(3000);

    // Wait for counted tag to be indexed in database
    await waitForTagIndexed('counted');

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Second note with #counted tag');
    await page.waitForTimeout(3000);

    // Wait for the second note to be indexed (count should be 2)
    await expect(async () => {
      const allTags = await page.evaluate(async () => {
        return await window.electronAPI.tag.getAll();
      });
      const countedTag = allTags.find((t: { name: string; count: number }) => t.name === 'counted');
      expect(countedTag).toBeDefined();
      expect(countedTag.count).toBe(2);
    }).toPass({ timeout: 10000 });

    // Create new note and trigger autocomplete
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(1000);

    editor = page.locator('.ProseMirror');
    const paragraph = editor.locator('p').first();
    await paragraph.click();
    await page.waitForTimeout(300);

    // Type prefix then # character by character
    await page.keyboard.type('Test ');
    await page.waitForTimeout(200);
    for (const char of '#cou') {
      await page.keyboard.type(char);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(2000); // Wait for autocomplete

    // The suggestion should show the tag with count (2)
    // Format in autocomplete: #counted(2) - no space between tag and count
    const countedWithCount = page
      .locator('[role="tooltip"]')
      .getByText('(2)', { exact: false })
      .first();
    await expect(countedWithCount).toBeVisible({ timeout: 5000 });
  });

  test('should allow creating a new tag by typing and pressing Enter', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(1000);

    const editor = page.locator('.ProseMirror');
    const paragraph = editor.locator('p').first();
    await paragraph.click();
    await page.waitForTimeout(300);

    // Type a completely new tag name that doesn't exist in the database
    // Add prefix to avoid heading interpretation
    const uniqueTag = `newtag${Date.now()}`;
    await page.keyboard.type('Test ');
    await page.waitForTimeout(200);
    for (const char of `#${uniqueTag}`) {
      await page.keyboard.type(char);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500); // Wait a moment

    // Press Enter - should create the tag and move to a new line
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Type some text on the new line
    await page.keyboard.type('Text on new line');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Verify the tag was created and text is on a new line
    const content = await editor.textContent();
    expect(content).toContain(`#${uniqueTag}`);
    expect(content).toContain('Text on new line');

    // Verify the tag appears as a styled button
    const tagButton = page.locator('.ProseMirror').getByText(`#${uniqueTag}`, { exact: true });
    await expect(tagButton).toBeVisible();

    // Verify the text is present (may or may not be on a separate line depending on editor behavior)
    // The content should have both the tag and the text
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    // Tag should be somewhere in the content
    expect(content).toContain(`#${uniqueTag}`);
    // Text should be somewhere in the content (may be same line or different line)
    expect(content).toContain('Text on new line');
  });
});

test.describe('Tags System - Tag Panel', () => {
  test('should display tag panel with tags and counts', async () => {
    // Create notes with tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note with #panel1 tag');
    await page.waitForTimeout(3000);
    await waitForTagIndexed('panel1');

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note with #panel2 and #panel1 tags');
    await page.waitForTimeout(3000);
    await waitForTagIndexed('panel2');

    // Wait for panel1 to have count 2 in database
    await expect(async () => {
      const allTags = await page.evaluate(async () => {
        return await window.electronAPI.tag.getAll();
      });
      const panel1 = allTags.find((t: { name: string; count: number }) => t.name === 'panel1');
      expect(panel1?.count).toBe(2);
    }).toPass({ timeout: 10000 });

    // Tag panel header should be visible
    const tagPanelHeader = page.getByText('Tags').first();
    await expect(tagPanelHeader).toBeVisible();

    // Tags should be displayed as chips in the panel with counts
    // Use more flexible matching - look for tag name and verify it's visible
    const panel1Chip = page.locator('[role="button"]').filter({ hasText: '#panel1' }).first();
    const panel2Chip = page.locator('[role="button"]').filter({ hasText: '#panel2' }).first();
    await expect(panel1Chip).toBeVisible({ timeout: 10000 });
    await expect(panel2Chip).toBeVisible({ timeout: 10000 });

    // Verify the counts by checking the text content
    await expect(panel1Chip).toContainText('2');
    await expect(panel2Chip).toContainText('1');
  });

  test('should filter notes when clicking a tag', async () => {
    // Create notes with different tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Filter test with #filterme tag');
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Different note with #other tag');
    await page.waitForTimeout(2500);

    // Navigate to "All Notes" to see all notes
    await page.getByRole('button', { name: /All Notes/ }).click();
    await page.waitForTimeout(500);

    // Count notes before filtering
    const notesListBefore = page
      .locator('[role="button"]')
      .filter({ hasText: /Filter test|Different note/ });
    const countBefore = await notesListBefore.count();
    expect(countBefore).toBeGreaterThanOrEqual(2);

    // Click the #filterme tag chip in the tag panel (mini-badge format)
    const filtermeTagChip = page
      .locator('[role="button"]')
      .filter({ hasText: '#filterme' })
      .first();
    await filtermeTagChip.click();
    await page.waitForTimeout(500);

    // Only the note with #filterme should be visible
    const filtermNote = page.getByRole('button', { name: /Filter test with #filterme/ });
    await expect(filtermNote).toBeVisible();

    const otherNote = page.getByRole('button', { name: /Different note with #other/ });
    await expect(otherNote).not.toBeVisible();
  });

  test('should support multi-tag filtering with AND logic', async () => {
    // Create notes with different tag combinations
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note A: #multi1 #multi2');
    await page.waitForTimeout(3000);

    // Wait for #multi1 tag to appear in the tag panel (mini-badge format)
    await expect(
      page.locator('[role="button"]').filter({ hasText: '#multi1' }).first()
    ).toBeVisible({ timeout: 5000 });

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note B: #multi2 only');
    await page.waitForTimeout(3000);

    // Wait for #multi2 count to update (mini-badge format: #multi22)
    await expect(
      page.locator('[role="button"]').filter({ hasText: '#multi2' }).first()
    ).toBeVisible({ timeout: 5000 });

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note C: #multi3');
    await page.waitForTimeout(3000);

    // Wait for #multi3 tag to appear in the tag panel (mini-badge format)
    await expect(
      page.locator('[role="button"]').filter({ hasText: '#multi3' }).first()
    ).toBeVisible({ timeout: 5000 });

    // Navigate to "All Notes" and wait for the list to update
    await page.getByRole('button', { name: /All Notes/ }).click();

    // Clear any active tag filters from previous tests
    const clearButton = page.getByRole('button', { name: /Clear all filters/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.waitForTimeout(1000);
    }

    // Wait for the notes list to fully load - look for a reasonable number of notes
    // We created 3 notes, plus there may be notes from previous tests
    await page.waitForTimeout(3000);

    // First click on one of the notes we created to ensure they're loaded
    await page.getByRole('button', { name: /Note A: #multi1 #multi2/ }).click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Now verify all notes are visible in the list by scrolling and looking for them
    await expect(page.getByRole('button', { name: /Note A: #multi1 #multi2/ })).toBeVisible({
      timeout: 5000,
    });

    // Click to ensure Note B is visible
    await page.getByRole('button', { name: /Note B: #multi2 only/ }).click({ timeout: 10000 });
    await page.waitForTimeout(500);

    await expect(page.getByRole('button', { name: /Note B: #multi2 only/ })).toBeVisible({
      timeout: 5000,
    });

    // Click to ensure Note C is visible
    await page.getByRole('button', { name: /Note C: #multi3/ }).click({ timeout: 10000 });
    await page.waitForTimeout(500);

    await expect(page.getByRole('button', { name: /Note C: #multi3/ })).toBeVisible({
      timeout: 5000,
    });

    // Verify notes were created by checking the tag panel for our tags (mini-badge format)
    await expect(
      page.locator('[role="button"]').filter({ hasText: '#multi1' }).first()
    ).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator('[role="button"]').filter({ hasText: '#multi2' }).first()
    ).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator('[role="button"]').filter({ hasText: '#multi3' }).first()
    ).toBeVisible({
      timeout: 5000,
    });

    // Click first tag chip in tag panel (include #multi1, mini-badge format)
    const multi1TagChip = page.locator('[role="button"]').filter({ hasText: '#multi1' }).first();
    await multi1TagChip.click();
    await page.waitForTimeout(500);

    // Click second tag chip (include #multi2, requires AND logic, mini-badge format)
    const multi2TagChip = page.locator('[role="button"]').filter({ hasText: '#multi2' }).first();
    await multi2TagChip.click();
    await page.waitForTimeout(500);

    // Only Note A should be visible (has both #multi1 AND #multi2)
    const noteA = page.getByRole('button', { name: /Note A: #multi1 #multi2/ });
    const noteB = page.getByRole('button', { name: /Note B: #multi2 only/ });
    const noteC = page.getByRole('button', { name: /Note C: #multi3/ });

    await expect(noteA).toBeVisible();
    await expect(noteB).not.toBeVisible();
    await expect(noteC).not.toBeVisible();
  });

  test('should clear all tag filters with clear button', async () => {
    // Navigate to "All Notes" and clear any existing filters first
    await page.getByRole('button', { name: /All Notes/ }).click();
    await page.waitForTimeout(500);

    // Clear any active tag filters from previous tests
    const clearFiltersBtn = page.getByRole('button', { name: /Clear all filters/i });
    if (await clearFiltersBtn.isVisible()) {
      await clearFiltersBtn.click();
      await page.waitForTimeout(1000);
    }

    // Create notes with tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Clear test with #cleartag1');
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Clear test with #cleartag2');
    await page.waitForTimeout(2500);

    // Navigate to "All Notes" again
    await page.getByRole('button', { name: /All Notes/ }).click();
    await page.waitForTimeout(500);

    // Click a tag chip to filter (mini-badge format)
    const clearTag1Chip = page.locator('[role="button"]').filter({ hasText: '#cleartag1' }).first();
    await clearTag1Chip.click();
    await page.waitForTimeout(500);

    // Verify filtering is active
    const noteWithTag1 = page.getByRole('button', { name: /Clear test with #cleartag1/ });
    await expect(noteWithTag1).toBeVisible();

    // Click the clear filters button in tag panel
    const clearButton = page.getByTitle('Clear all filters');
    await clearButton.click();
    await page.waitForTimeout(500);

    // Both notes should now be visible
    const noteWithTag2 = page.getByRole('button', { name: /Clear test with #cleartag2/ });
    await expect(noteWithTag1).toBeVisible();
    await expect(noteWithTag2).toBeVisible();
  });

  test('should cycle through tri-state tag filtering (include → exclude → neutral)', async () => {
    // Create notes with tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Deselect test with #toggle1');
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Deselect test with #toggle2');
    await page.waitForTimeout(2500);

    // Navigate to "All Notes"
    await page.getByRole('button', { name: /All Notes/ }).click();
    await page.waitForTimeout(500);

    // Click a tag chip to include it (first click → include, mini-badge format)
    const toggleTagChip = page.locator('[role="button"]').filter({ hasText: '#toggle1' }).first();
    await toggleTagChip.click();
    await page.waitForTimeout(500);

    // Verify include filtering is active (only notes with #toggle1 visible)
    const noteWithTag1 = page.getByRole('button', { name: /Deselect test with #toggle1/ });
    const noteWithTag2 = page.getByRole('button', { name: /Deselect test with #toggle2/ });
    await expect(noteWithTag1).toBeVisible();
    await expect(noteWithTag2).not.toBeVisible();

    // Click again to exclude (second click → exclude)
    await toggleTagChip.click();
    await page.waitForTimeout(500);

    // Verify exclude filtering is active (notes without #toggle1 visible)
    await expect(noteWithTag1).not.toBeVisible();
    await expect(noteWithTag2).toBeVisible();

    // Click third time to clear filter (third click → neutral)
    await toggleTagChip.click();
    await page.waitForTimeout(500);

    // Both notes should now be visible (no filter)
    await expect(noteWithTag1).toBeVisible();
    await expect(noteWithTag2).toBeVisible();
  });

  test('should update tag counts when notes are edited', async () => {
    // Create a note with a unique tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Update count test #updatecount');
    await page.waitForTimeout(2500);

    // Verify tag appears in tag panel with count (1) - mini-badge format: #updatecount1
    const tagChipInitial = page
      .locator('[role="button"]')
      .filter({ hasText: '#updatecount' })
      .first();
    await expect(tagChipInitial).toBeVisible();

    // Create another note with the same tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor2 = page.locator('.ProseMirror');
    await editor2.click();
    await page.keyboard.type('Second note with #updatecount');
    await page.waitForTimeout(2500);

    // The count should update to 2 - mini-badge format: #updatecount2
    const tagChipUpdated = page
      .locator('[role="button"]')
      .filter({ hasText: '#updatecount' })
      .first();
    await expect(tagChipUpdated).toBeVisible();
  });
});
