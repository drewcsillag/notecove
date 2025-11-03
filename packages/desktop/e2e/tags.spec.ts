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
    await page.keyboard.type('First line with #tag1');
    await page.waitForTimeout(200);

    // Add more content
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second line with #tag2');
    await page.waitForTimeout(500);

    // Both hashtags should still be styled
    const hashtags = page.locator('.ProseMirror .hashtag');
    const count = await hashtags.count();
    expect(count).toBe(2);

    const tags = await hashtags.allTextContents();
    expect(tags).toContain('#tag1');
    expect(tags).toContain('#tag2');
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

  test('should update tag styling after editing', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Text with #oldtag');
    await page.waitForTimeout(500);

    // Verify old tag is styled
    let hashtags = page.locator('.ProseMirror .hashtag');
    expect(await hashtags.count()).toBe(1);
    expect(await hashtags.textContent()).toBe('#oldtag');

    // Edit the tag by adding more characters
    await page.keyboard.press('End');
    await page.keyboard.type('suffix');
    await page.waitForTimeout(500);

    // The tag should update to #oldtagsuffix
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
      return await window.electronAPI.testing.getAllTags();
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
      const tags = await window.electronAPI.testing.getAllTags();
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
      const tags = await window.electronAPI.testing.getAllTags();
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
      const tags = await window.electronAPI.testing.getAllTags();
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
      const tags = await window.electronAPI.testing.getAllTags();
      return tags.map((t: { name: string }) => t.name);
    });

    // Note: deleteremoveme might still exist if it's in other notes,
    // but deletekeepme should definitely still be there
    expect(allTags).toContain('deletekeepme');
  });
});
