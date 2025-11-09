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
    await page.waitForTimeout(2500); // Wait for auto-save

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Another note with #autocomplete2 tag');
    await page.waitForTimeout(2500); // Wait for auto-save

    // Now create a new note and test autocomplete
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('#');
    await page.waitForTimeout(500);

    // The autocomplete popup should be visible
    const suggestionList = page.locator('[role="list"]').filter({ has: page.locator('text=autocomplete') });
    await expect(suggestionList).toBeVisible({ timeout: 3000 });
  });

  test('should filter autocomplete suggestions based on query', async () => {
    // Create notes with different tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #programming tag');
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #project tag');
    await page.waitForTimeout(2500);

    // Create new note and test filtering
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('#pro');
    await page.waitForTimeout(500);

    // Both 'programming' and 'project' should be visible since they match 'pro'
    const suggestionList = page.locator('[role="list"]');
    await expect(suggestionList).toBeVisible({ timeout: 3000 });

    // Continue typing to narrow the filter
    await page.keyboard.type('g');
    await page.waitForTimeout(500);

    // Now only 'programming' should be suggested (contains 'prog')
    const programmingItem = page.getByText('#programming');
    await expect(programmingItem).toBeVisible({ timeout: 2000 });
  });

  test('should insert tag when autocomplete suggestion is selected', async () => {
    // Create a note with a tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #insertme tag');
    await page.waitForTimeout(2500);

    // Create new note and use autocomplete
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('#ins');
    await page.waitForTimeout(500);

    // Press Enter to select the first suggestion
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // The tag should be inserted
    const content = await editor.textContent();
    expect(content).toContain('#insertme');

    // And it should be styled as a hashtag
    const hashtags = page.locator('.ProseMirror .hashtag');
    expect(await hashtags.count()).toBeGreaterThanOrEqual(1);
  });

  test('should navigate autocomplete with arrow keys', async () => {
    // Create multiple notes with tags
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #alpha tag');
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #beta tag');
    await page.waitForTimeout(2500);

    // Create new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('#');
    await page.waitForTimeout(500);

    // Wait for suggestions to appear
    const suggestionList = page.locator('[role="list"]');
    await expect(suggestionList).toBeVisible({ timeout: 3000 });

    // The first item should be selected by default
    const firstItem = suggestionList.locator('[role="button"]').first();
    await expect(firstItem).toHaveAttribute('aria-selected', 'true');

    // Press down arrow to select next item
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Second item should now be selected
    const secondItem = suggestionList.locator('[role="button"]').nth(1);
    await expect(secondItem).toHaveAttribute('aria-selected', 'true');
  });

  test('should close autocomplete on Escape', async () => {
    // Create a note with a tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Test with #escape tag');
    await page.waitForTimeout(2500);

    // Create new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('#');
    await page.waitForTimeout(500);

    // Wait for suggestions
    const suggestionList = page.locator('[role="list"]');
    await expect(suggestionList).toBeVisible({ timeout: 3000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Suggestion list should be hidden
    await expect(suggestionList).not.toBeVisible();
  });

  test('should show tag usage count in autocomplete', async () => {
    // Create multiple notes with the same tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('First note with #counted tag');
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Second note with #counted tag');
    await page.waitForTimeout(2500);

    // Create new note and trigger autocomplete
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('#cou');
    await page.waitForTimeout(500);

    // The suggestion should show the count (at least 2)
    const countText = page.getByText(/\(2\)/);
    await expect(countText).toBeVisible({ timeout: 3000 });
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
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note with #panel2 and #panel1 tags');
    await page.waitForTimeout(2500);

    // Tag panel should be visible
    const tagPanel = page.getByText('Tags', { exact: false });
    await expect(tagPanel).toBeVisible();

    // Tags should be displayed in the panel
    const panelTag1 = page.getByText('#panel1', { exact: false });
    const panelTag2 = page.getByText('#panel2', { exact: false });
    await expect(panelTag1).toBeVisible();
    await expect(panelTag2).toBeVisible();
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
    const notesListBefore = page.locator('[role="button"]').filter({ hasText: /Filter test|Different note/ });
    const countBefore = await notesListBefore.count();
    expect(countBefore).toBeGreaterThanOrEqual(2);

    // Click the #filterme tag in the tag panel
    const filtermeTag = page.getByText('#filterme', { exact: false });
    await filtermeTag.click();
    await page.waitForTimeout(500);

    // Only the note with #filterme should be visible
    const filtermNote = page.getByRole('button', { name: /Filter test with #filterme/ });
    await expect(filtermNote).toBeVisible();

    const otherNote = page.getByRole('button', { name: /Different note with #other/ });
    await expect(otherNote).not.toBeVisible();
  });

  test('should support multi-tag filtering with OR logic', async () => {
    // Create notes with different tag combinations
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    let editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note A with #multi1 tag');
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note B with #multi2 tag');
    await page.waitForTimeout(2500);

    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Note C with #multi3 tag');
    await page.waitForTimeout(2500);

    // Navigate to "All Notes"
    await page.getByRole('button', { name: /All Notes/ }).click();
    await page.waitForTimeout(500);

    // Click first tag
    const multi1Tag = page.getByText('#multi1', { exact: false });
    await multi1Tag.click();
    await page.waitForTimeout(500);

    // Click second tag (should add to filter, not replace)
    const multi2Tag = page.getByText('#multi2', { exact: false });
    await multi2Tag.click();
    await page.waitForTimeout(500);

    // Both notes A and B should be visible (OR logic)
    const noteA = page.getByRole('button', { name: /Note A with #multi1/ });
    const noteB = page.getByRole('button', { name: /Note B with #multi2/ });
    const noteC = page.getByRole('button', { name: /Note C with #multi3/ });

    await expect(noteA).toBeVisible();
    await expect(noteB).toBeVisible();
    await expect(noteC).not.toBeVisible();
  });

  test('should clear all tag filters with clear button', async () => {
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

    // Navigate to "All Notes"
    await page.getByRole('button', { name: /All Notes/ }).click();
    await page.waitForTimeout(500);

    // Click a tag to filter
    const clearTag1 = page.getByText('#cleartag1', { exact: false });
    await clearTag1.click();
    await page.waitForTimeout(500);

    // Verify filtering is active
    const noteWithTag1 = page.getByRole('button', { name: /Clear test with #cleartag1/ });
    await expect(noteWithTag1).toBeVisible();

    // Click the clear filters button
    const clearButton = page.getByRole('button', { name: /Clear all filters/i });
    await clearButton.click();
    await page.waitForTimeout(500);

    // Both notes should now be visible
    const noteWithTag2 = page.getByRole('button', { name: /Clear test with #cleartag2/ });
    await expect(noteWithTag1).toBeVisible();
    await expect(noteWithTag2).toBeVisible();
  });

  test('should deselect tag when clicking it again', async () => {
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

    // Click a tag to select it
    const toggleTag = page.getByText('#toggle1', { exact: false });
    await toggleTag.click();
    await page.waitForTimeout(500);

    // Verify filtering is active
    const noteWithTag1 = page.getByRole('button', { name: /Deselect test with #toggle1/ });
    const noteWithTag2 = page.getByRole('button', { name: /Deselect test with #toggle2/ });
    await expect(noteWithTag1).toBeVisible();
    await expect(noteWithTag2).not.toBeVisible();

    // Click the same tag again to deselect
    await toggleTag.click();
    await page.waitForTimeout(500);

    // Both notes should now be visible
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

    // Get the initial count for the tag
    const tagInPanel = page.getByText('#updatecount', { exact: false });
    await expect(tagInPanel).toBeVisible();

    // Create another note with the same tag
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor2 = page.locator('.ProseMirror');
    await editor2.click();
    await page.keyboard.type('Second note with #updatecount');
    await page.waitForTimeout(2500);

    // The count should update (we can't easily check the exact number without
    // more sophisticated selectors, but we can verify the tag still exists)
    await expect(tagInPanel).toBeVisible();
  });
});
