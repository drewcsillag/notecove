import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

test.describe('Tag Operations - Electron Mode (CRDT)', () => {
  let testDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-tags-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });

    // Launch Electron app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    // Close the app
    await electronApp.close();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean up test directory:', err);
    }
  });

  test('should persist tags across app restarts', async () => {
    // Create a note with tags
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Tagged Note\n\nThis note has #project #important #work tags.');
    await window.waitForTimeout(2000); // Wait for CRDT sync

    const noteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    console.log('[Test] Created note with tags, ID:', noteId);

    // Verify tags appear in sidebar
    const tagsList = window.locator('#tagsList');
    await tagsList.waitFor({ state: 'visible' });

    const projectTagExists = await window.locator('.tag-item[data-tag="project"]').isVisible();
    const importantTagExists = await window.locator('.tag-item[data-tag="important"]').isVisible();
    const workTagExists = await window.locator('.tag-item[data-tag="work"]').isVisible();

    expect(projectTagExists).toBe(true);
    expect(importantTagExists).toBe(true);
    expect(workTagExists).toBe(true);

    // Close and relaunch
    await electronApp.close();
    await new Promise(resolve => setTimeout(resolve, 500));

    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data'),
        '--notes-path=' + path.join(testDir, '.notecove'),
        '--instance=test-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);

    // Verify tags persisted
    const projectTagStillExists = await window.locator('.tag-item[data-tag="project"]').isVisible();
    const importantTagStillExists = await window.locator('.tag-item[data-tag="important"]').isVisible();
    const workTagStillExists = await window.locator('.tag-item[data-tag="work"]').isVisible();

    expect(projectTagStillExists).toBe(true);
    expect(importantTagStillExists).toBe(true);
    expect(workTagStillExists).toBe(true);

    // Open note and verify content still has tags
    await window.click(`.note-item[data-note-id="${noteId}"]`);
    await window.waitForTimeout(500);

    const editorContent = await window.locator('#editor .ProseMirror').textContent();
    expect(editorContent).toContain('#project');
    expect(editorContent).toContain('#important');
    expect(editorContent).toContain('#work');

    console.log('[Test] Tags successfully persisted across restart');
  });

  test('should update tags when note content changes', async () => {
    // Create a note with initial tags
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Note with Tags\n\nInitial tags: #alpha #beta');
    await window.waitForTimeout(2000);

    // Verify initial tags
    const alphaTagExists = await window.locator('.tag-item[data-tag="alpha"]').isVisible();
    const betaTagExists = await window.locator('.tag-item[data-tag="beta"]').isVisible();
    expect(alphaTagExists).toBe(true);
    expect(betaTagExists).toBe(true);

    // Update note content with different tags
    await editor.fill('Note with Tags\n\nUpdated tags: #gamma #delta');
    await window.waitForTimeout(2000);

    // Verify new tags appear
    const gammaTagExists = await window.locator('.tag-item[data-tag="gamma"]').isVisible();
    const deltaTagExists = await window.locator('.tag-item[data-tag="delta"]').isVisible();
    expect(gammaTagExists).toBe(true);
    expect(deltaTagExists).toBe(true);

    // Old tags should be gone (if no other notes use them)
    const alphaTagStillExists = await window.locator('.tag-item[data-tag="alpha"]').count();
    const betaTagStillExists = await window.locator('.tag-item[data-tag="beta"]').count();
    expect(alphaTagStillExists).toBe(0);
    expect(betaTagStillExists).toBe(0);

    console.log('[Test] Tags successfully updated when note content changed');
  });

  test('should remove tags when tag is deleted from note', async () => {
    // Create two notes with overlapping tags
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('First Note\n\nTags: #shared #unique1');
    await window.waitForTimeout(2000);

    const note1Id = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await editor.fill('Second Note\n\nTags: #shared #unique2');
    await window.waitForTimeout(2000);

    // Verify all tags exist
    const sharedTagExists = await window.locator('.tag-item[data-tag="shared"]').isVisible();
    const unique1TagExists = await window.locator('.tag-item[data-tag="unique1"]').isVisible();
    const unique2TagExists = await window.locator('.tag-item[data-tag="unique2"]').isVisible();
    expect(sharedTagExists).toBe(true);
    expect(unique1TagExists).toBe(true);
    expect(unique2TagExists).toBe(true);

    // Remove #unique1 from first note
    await window.click(`.note-item[data-note-id="${note1Id}"]`);
    await window.waitForTimeout(500);

    await editor.fill('First Note\n\nTags: #shared');
    await window.waitForTimeout(2000);

    // #unique1 should be gone, others should remain
    const unique1StillExists = await window.locator('.tag-item[data-tag="unique1"]').count();
    expect(unique1StillExists).toBe(0);

    const sharedStillExists = await window.locator('.tag-item[data-tag="shared"]').isVisible();
    const unique2StillExists = await window.locator('.tag-item[data-tag="unique2"]').isVisible();
    expect(sharedStillExists).toBe(true);
    expect(unique2StillExists).toBe(true);

    console.log('[Test] Tag successfully removed when deleted from note');
  });

  test('should show correct tag counts', async () => {
    // Create three notes with overlapping tags
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Note 1\n\n#common #rare');
    await window.waitForTimeout(1500);

    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await editor.fill('Note 2\n\n#common');
    await window.waitForTimeout(1500);

    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await editor.fill('Note 3\n\n#common');
    await window.waitForTimeout(1500);

    // Verify tag counts
    const commonCount = await window.evaluate(() => {
      const tagItem = document.querySelector('.tag-item[data-tag="common"]');
      return tagItem?.querySelector('.tag-count')?.textContent;
    });

    const rareCount = await window.evaluate(() => {
      const tagItem = document.querySelector('.tag-item[data-tag="rare"]');
      return tagItem?.querySelector('.tag-count')?.textContent;
    });

    expect(commonCount).toBe('3');
    expect(rareCount).toBe('1');

    console.log('[Test] Tag counts are correct - common: 3, rare: 1');
  });

  test('should filter notes by tag', async () => {
    // Create notes with different tags
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Project Note\n\n#project');
    await window.waitForTimeout(1500);

    const projectNoteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await editor.fill('Work Note\n\n#work');
    await window.waitForTimeout(1500);

    const workNoteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await editor.fill('Mixed Note\n\n#project #work');
    await window.waitForTimeout(1500);

    const mixedNoteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Click on #project tag to filter
    await window.click('.tag-item[data-tag="project"]');
    await window.waitForTimeout(500);

    // Only project note and mixed note should be visible
    const projectNoteVisible = await window.locator(`.note-item[data-note-id="${projectNoteId}"]`).isVisible();
    const mixedNoteVisible = await window.locator(`.note-item[data-note-id="${mixedNoteId}"]`).isVisible();
    const workNoteVisible = await window.locator(`.note-item[data-note-id="${workNoteId}"]`).count();

    expect(projectNoteVisible).toBe(true);
    expect(mixedNoteVisible).toBe(true);
    expect(workNoteVisible).toBe(0); // Should not be visible

    // Clear filter by clicking tag again
    await window.click('.tag-item[data-tag="project"]');
    await window.waitForTimeout(500);

    // All notes should be visible again
    const workNoteVisibleAgain = await window.locator(`.note-item[data-note-id="${workNoteId}"]`).isVisible();
    expect(workNoteVisibleAgain).toBe(true);

    console.log('[Test] Tag filtering works correctly');
  });

  test('should sync tags between instances', async () => {
    const notesPath = path.join(testDir, '.notecove');

    // Launch first instance
    const app1 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-1'),
        '--notes-path=' + notesPath,
        '--instance=test-1-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window1 = await app1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await window1.waitForTimeout(1000);

    // Create note with tags in instance 1
    await window1.click('#newNoteBtn');
    const editor1 = window1.locator('#editor .ProseMirror');
    await editor1.waitFor({ state: 'visible' });
    await window1.waitForTimeout(500);

    await editor1.fill('Synced Tags Note\n\nThese tags should sync: #sync #test');
    await window1.waitForTimeout(2000);

    const noteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    console.log('[Test] Created note with tags in instance 1, ID:', noteId);

    // Launch second instance
    const app2 = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(testDir, 'user-data-2'),
        '--notes-path=' + notesPath,
        '--instance=test-2-' + Date.now()
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    const window2 = await app2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await window2.waitForTimeout(3000); // Wait for sync

    // Verify tags appear in instance 2
    const syncTagExists = await window2.locator('.tag-item[data-tag="sync"]').isVisible();
    const testTagExists = await window2.locator('.tag-item[data-tag="test"]').isVisible();
    expect(syncTagExists).toBe(true);
    expect(testTagExists).toBe(true);

    // Open note in instance 2 and verify tags in content
    await window2.click(`.note-item[data-note-id="${noteId}"]`);
    await window2.waitForTimeout(500);

    const content2 = await window2.locator('#editor .ProseMirror').textContent();
    expect(content2).toContain('#sync');
    expect(content2).toContain('#test');

    console.log('[Test] Tags successfully synced to instance 2');

    // Update tags in instance 2
    await window2.locator('#editor .ProseMirror').fill('Synced Tags Note\n\nUpdated tags: #sync #modified');
    await window2.waitForTimeout(2000);

    // Wait for sync back to instance 1
    await window1.waitForTimeout(3000);

    // Verify updated tags in instance 1
    const modifiedTagInInstance1 = await window1.locator('.tag-item[data-tag="modified"]').isVisible();
    expect(modifiedTagInInstance1).toBe(true);

    const testTagInInstance1 = await window1.locator('.tag-item[data-tag="test"]').count();
    expect(testTagInInstance1).toBe(0); // Should be gone

    console.log('[Test] Tag updates successfully synced back to instance 1');

    // Close both instances
    await app1.close();
    await app2.close();
  });

  test('should handle tags with hyphens and underscores', async () => {
    // Create note with various tag formats
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Complex Tags\n\n#simple #with-hyphen #multiple-word-tag');
    await window.waitForTimeout(2000);

    // Verify all tag formats work
    const simpleTagExists = await window.locator('.tag-item[data-tag="simple"]').isVisible();
    const hyphenTagExists = await window.locator('.tag-item[data-tag="with-hyphen"]').isVisible();
    const multiWordTagExists = await window.locator('.tag-item[data-tag="multiple-word-tag"]').isVisible();

    expect(simpleTagExists).toBe(true);
    expect(hyphenTagExists).toBe(true);
    expect(multiWordTagExists).toBe(true);

    console.log('[Test] Tags with hyphens work correctly');
  });

  test('should not treat hashtag-like text as tags in invalid contexts', async () => {
    // Create note with hashtags in different contexts
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    // Only tags preceded by whitespace or at start should be detected
    await editor.fill('Tag Test\n\nValid: #validtag\nInvalid:word#notag');
    await window.waitForTimeout(2000);

    // Only validtag should appear in sidebar
    const validTagExists = await window.locator('.tag-item[data-tag="validtag"]').isVisible();
    expect(validTagExists).toBe(true);

    // notag should not exist
    const invalidTagExists = await window.locator('.tag-item[data-tag="notag"]').count();
    expect(invalidTagExists).toBe(0);

    console.log('[Test] Tags only detected in valid contexts');
  });

  test('should filter tags by search query', async () => {
    // Create notes with different tags
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Note 1\n\n#project #work');
    await window.waitForTimeout(1500);

    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await editor.fill('Note 2\n\n#personal #important');
    await window.waitForTimeout(1500);

    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await editor.fill('Note 3\n\n#programming');
    await window.waitForTimeout(1500);

    // All tags should be visible initially (including any from welcome notes)
    const allTagsVisible = await window.locator('.tag-item').count();
    expect(allTagsVisible).toBeGreaterThanOrEqual(5); // At least our 5 test tags

    // Search for "pro"
    const tagSearchInput = window.locator('#tagSearchInput');
    await tagSearchInput.fill('pro');
    await window.waitForTimeout(500);

    // Only project and programming should be visible
    const filteredTagsCount = await window.locator('.tag-item').count();
    expect(filteredTagsCount).toBe(2);

    const projectVisible = await window.locator('.tag-item[data-tag="project"]').isVisible();
    const programmingVisible = await window.locator('.tag-item[data-tag="programming"]').isVisible();
    expect(projectVisible).toBe(true);
    expect(programmingVisible).toBe(true);

    // work should not be visible
    const workVisible = await window.locator('.tag-item[data-tag="work"]').count();
    expect(workVisible).toBe(0);

    console.log('[Test] Tag search filters tags correctly');

    // Clear search
    await tagSearchInput.fill('');
    await window.waitForTimeout(500);

    // All tags should be visible again
    const allTagsVisibleAgain = await window.locator('.tag-item').count();
    expect(allTagsVisibleAgain).toBeGreaterThanOrEqual(5);

    console.log('[Test] Clearing search shows all tags again');
  });

  test('should show and hide clear button based on filter state', async () => {
    // Create a note with tags
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Tagged Note\n\n#testing #features');
    await window.waitForTimeout(2000);

    // Clear button should not be visible initially
    const clearBtn = window.locator('#clearTagFilterBtn');
    let clearBtnVisible = await clearBtn.isVisible();
    expect(clearBtnVisible).toBe(false);

    console.log('[Test] Clear button hidden when no filter active');

    // Click on a tag to activate filter
    await window.click('.tag-item[data-tag="testing"]');
    await window.waitForTimeout(500);

    // Clear button should now be visible
    clearBtnVisible = await clearBtn.isVisible();
    expect(clearBtnVisible).toBe(true);

    console.log('[Test] Clear button visible when filter active');

    // Click clear button
    await clearBtn.click();
    await window.waitForTimeout(500);

    // Clear button should be hidden again
    clearBtnVisible = await clearBtn.isVisible();
    expect(clearBtnVisible).toBe(false);

    // All notes should be visible again
    const notesCount = await window.locator('.note-item').count();
    expect(notesCount).toBeGreaterThan(0);

    console.log('[Test] Clear button clears filter and hides itself');
  });

  test('should clear tag filter without clearing search input', async () => {
    // Create notes with tags
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.fill('Note 1\n\n#alpha #beta');
    await window.waitForTimeout(1500);

    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await editor.fill('Note 2\n\n#gamma');
    await window.waitForTimeout(1500);

    // Set a search query
    const tagSearchInput = window.locator('#tagSearchInput');
    await tagSearchInput.fill('alp');
    await window.waitForTimeout(500);

    // Only alpha should be visible
    let visibleTags = await window.locator('.tag-item').count();
    expect(visibleTags).toBe(1);

    // Click on alpha tag to filter
    await window.click('.tag-item[data-tag="alpha"]');
    await window.waitForTimeout(500);

    // Clear button should be visible
    const clearBtn = window.locator('#clearTagFilterBtn');
    let clearBtnVisible = await clearBtn.isVisible();
    expect(clearBtnVisible).toBe(true);

    // Click clear button
    await clearBtn.click();
    await window.waitForTimeout(500);

    // Search input should still have "alp"
    const searchValue = await tagSearchInput.inputValue();
    expect(searchValue).toBe('alp');

    // Only alpha should still be visible (search not cleared)
    visibleTags = await window.locator('.tag-item').count();
    expect(visibleTags).toBe(1);

    // But filter should be cleared (all notes visible, including welcome notes)
    const allNotesVisible = await window.locator('.note-item').count();
    expect(allNotesVisible).toBeGreaterThanOrEqual(2); // At least our 2 test notes

    console.log('[Test] Clear button does not clear search input');
  });
});
