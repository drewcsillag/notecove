const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Image Sync - Full UI Flow', () => {
  let tempDir;
  let notesDir;

  test.beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-img-ui-'));
    notesDir = path.join(tempDir, '.notecove');
    await fs.mkdir(notesDir, { recursive: true });
  });

  test.afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should sync image through actual UI flow', async () => {
    // ========== INSTANCE 1: Create note with image ==========
    const electronApp1 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'ui-test-instance-1'
      }
    });

    const window1 = await electronApp1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create note with image
    await window1.click('button[title="New Note"]');
    await window1.waitForSelector('.ProseMirror');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await window1.locator('.ProseMirror').click();
    await window1.keyboard.type('Image test note');
    await window1.keyboard.press('Enter');

    // Insert image
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await window1.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
    }, testImageBase64);

    // Wait for content to be captured
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get note ID and verify image is in Y.Doc
    const instance1Check = await window1.evaluate(() => {
      const noteId = window.app.currentNote.id;
      const yDoc = window.app.syncManager.getDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');
      const editorHtml = window.app.editor.getContent();

      return {
        noteId,
        noteTitle: window.app.currentNote.title,
        yDocLength: yContent.length,
        yDocString: yContent.toString(),
        editorHtml,
        hasImageInYDoc: yContent.toString().includes('<image'),
        hasImageInEditor: editorHtml.includes('<img')
      };
    });

    console.log('Instance 1 state:', instance1Check);

    expect(instance1Check.hasImageInYDoc).toBe(true);
    expect(instance1Check.hasImageInEditor).toBe(true);

    // Manually flush to ensure updates are written
    await window1.evaluate(() => {
      return window.app.syncManager.updateStore.flush(window.app.currentNote.id);
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    const noteId = instance1Check.noteId;

    await electronApp1.close();

    // ========== INSTANCE 2: Open note through UI ==========
    const electronApp2 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'ui-test-instance-2'
      }
    });

    const window2 = await electronApp2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find and click on the note in the list
    console.log('Looking for note with title:', instance1Check.noteTitle);

    // Click on the note item in the list
    await window2.click(`.note-item[data-note-id="${noteId}"]`);

    // Wait for editor to load
    await window2.waitForSelector('.ProseMirror');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if image appears in the editor
    const instance2Check = await window2.evaluate(() => {
      const noteId = window.app.currentNote?.id;
      if (!noteId) {
        return { error: 'No current note' };
      }

      const yDoc = window.app.syncManager.getDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');
      const editorHtml = window.app.editor.getContent();

      // Check actual DOM for image element
      const editorImages = document.querySelectorAll('.ProseMirror img');

      return {
        noteId,
        noteTitle: window.app.currentNote.title,
        yDocLength: yContent.length,
        yDocString: yContent.toString().substring(0, 300),
        editorHtml: editorHtml.substring(0, 300),
        hasImageInYDoc: yContent.toString().includes('<image'),
        hasImageInEditor: editorHtml.includes('<img'),
        imageCountInDOM: editorImages.length
      };
    });

    console.log('Instance 2 state:', instance2Check);

    // These should all be true if images sync correctly
    expect(instance2Check.hasImageInYDoc).toBe(true);
    expect(instance2Check.hasImageInEditor).toBe(true);
    expect(instance2Check.imageCountInDOM).toBeGreaterThan(0);

    await electronApp2.close();
  });
});
