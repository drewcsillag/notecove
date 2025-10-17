import { test, expect } from '@playwright/test';

test.describe('Backlinks Panel - Electron Compatibility', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and set empty notes array to prevent sample notes from loading
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('notecove-notes', JSON.stringify([]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for sync manager to initialize
  });

  test('should detect backlinks in Electron mode via CRDT', async ({ page }) => {
    // Check if we're in Electron mode
    const isElectron = await page.evaluate(() => {
      return window.electronAPI?.isElectron || false;
    });

    console.log('Running in Electron mode:', isElectron);

    // Create target note
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Target Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This is the target note content');
    await page.waitForTimeout(1500);

    console.log('Created target note');

    // Create source note with link to target
    await page.keyboard.press('Control+n');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Source Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This note links to ');
    await page.keyboard.type('[[Target Note]]');
    await page.waitForTimeout(2000); // Wait for save

    console.log('Created source note with link');

    // Verify the link was created
    const link = page.locator('#editor span[data-note-link]');
    await expect(link).toBeVisible();
    console.log('Link is visible');

    // Click on the target note in the notes list
    const targetNoteItem = page.locator('.note-item').filter({ has: page.locator('.note-title:has-text("Target Note")') }).first();
    await targetNoteItem.click();
    await page.waitForTimeout(1000);

    console.log('Switched to target note');

    // Check backlinks via page.evaluate to see what getBacklinks returns
    const backlinkInfo = await page.evaluate(() => {
      const app = window.app;
      if (!app || !app.noteManager || !app.currentNote) {
        return { error: 'App not ready', app: !!app, noteManager: !!app?.noteManager, currentNote: !!app?.currentNote };
      }

      const backlinks = app.noteManager.getBacklinks(app.currentNote.id);
      return {
        count: backlinks.length,
        backlinks: backlinks.map(bl => ({
          noteId: bl.note.id,
          noteTitle: bl.note.title,
          context: bl.context
        })),
        mode: app.noteManager.isElectron ? 'Electron' : 'Web'
      };
    });

    console.log('Backlink info:', backlinkInfo);

    // Should find 1 backlink
    expect(backlinkInfo.count).toBe(1);
    expect(backlinkInfo.backlinks[0].noteTitle).toBe('Source Note');

    // Now check if the UI shows it
    const backlinksPanel = page.locator('#backlinksPanel');
    await expect(backlinksPanel).toBeVisible({ timeout: 2000 });

    // Check backlinks count
    const backlinksCount = page.locator('#backlinksCount');
    await expect(backlinksCount).toHaveText('1');

    // Check backlink item exists
    const backlinkItem = page.locator('.backlink-item');
    await expect(backlinkItem).toBeVisible();

    // Check backlink shows source note title
    const backlinkTitle = backlinkItem.locator('.backlink-item-title');
    await expect(backlinkTitle).toHaveText('Source Note');
  });

  test('should verify getBacklinks works with CRDT content', async ({ page }) => {
    // This test specifically verifies that getBacklinks can read content from CRDT in Electron mode

    // Create a note
    await page.locator('#newNoteBtn').click();
    const editor = page.locator('#editor .ProseMirror');
    await expect(editor).toBeFocused({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.keyboard.type('Test Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Content with [[Link to Other]]');
    await page.waitForTimeout(1500);

    // Check that the note's content is properly stored
    const noteInfo = await page.evaluate(() => {
      const app = window.app;
      if (!app || !app.noteManager || !app.currentNote) {
        return { error: 'App not ready' };
      }

      const note = app.currentNote;
      let crdtContent = null;

      // Try to get CRDT content if in Electron mode
      if (app.noteManager.isElectron && app.syncManager) {
        try {
          const yDoc = app.syncManager.crdtManager.getContentDoc(note.id);
          const yContent = yDoc.getXmlFragment('default');
          crdtContent = yContent.toString();
        } catch (e) {
          crdtContent = 'Error: ' + e.message;
        }
      }

      return {
        mode: app.noteManager.isElectron ? 'Electron' : 'Web',
        noteId: note.id,
        noteTitle: note.title,
        contentLength: note.content?.length || 0,
        contentPreview: note.content?.substring(0, 100),
        crdtContentLength: crdtContent?.length || 0,
        crdtContentPreview: crdtContent?.substring(0, 200),
        hasLink: crdtContent?.includes('data-note-link') || note.content?.includes('data-note-link')
      };
    });

    console.log('Note info:', noteInfo);

    // Verify that either note.content or CRDT content contains the link
    expect(noteInfo.hasLink).toBe(true);

    // In Electron mode, CRDT should have more content than note.content
    if (noteInfo.mode === 'Electron') {
      expect(noteInfo.crdtContentLength).toBeGreaterThan(noteInfo.contentLength);
    }
  });
});
