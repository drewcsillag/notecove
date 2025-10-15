const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Image Resize Sync', () => {
  let tempDir;
  let notesDir;

  test.beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-resize-'));
    notesDir = path.join(tempDir, '.notecove');
    await fs.mkdir(notesDir, { recursive: true });
  });

  test.afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should sync resized image dimensions to second instance', async () => {
    // ========== INSTANCE 1: Create note with image and resize it ==========
    const electronApp1 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'resize-test-1'
      }
    });

    const window1 = await electronApp1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create note
    await window1.click('button[title="New Note"]');
    await window1.waitForSelector('.ProseMirror');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await window1.locator('.ProseMirror').click();
    await window1.keyboard.type('Resizable image test');
    await window1.keyboard.press('Enter');

    // Insert image programmatically (simpler than file picker for tests)
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    const insertResult = await window1.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
      return { success: true };
    }, testImageBase64);

    console.log('Image inserted:', insertResult);

    // Wait for image to be inserted
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the note ID before resizing
    const noteId = await window1.evaluate(() => window.app.currentNote.id);
    console.log('Note ID:', noteId);

    // Check initial state
    const beforeResize = await window1.evaluate(() => {
      const yDoc = window.app.syncManager.getDoc(window.app.currentNote.id);
      const yContent = yDoc.getXmlFragment('default');
      return {
        yDocLength: yContent.length,
        yDocString: yContent.toString().substring(0, 300)
      };
    });
    console.log('Before resize:', beforeResize);

    // Click on the image to show handles
    await window1.click('.ProseMirror img');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify handles are visible
    const handlesVisible = await window1.evaluate(() => {
      const container = document.querySelector('.image-container.selected');
      return !!container;
    });
    console.log('Handles visible:', handlesVisible);
    expect(handlesVisible).toBe(true);

    // Resize the image by programmatically updating attributes
    // (Simulating drag is complex in Playwright, so we'll update attributes directly)
    const resizeResult = await window1.evaluate(() => {
      const editor = window.app.editor.editor;

      // Find the image node position
      let imagePos = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
          imagePos = pos;
          return false; // Stop searching
        }
      });

      if (imagePos === null) {
        return { success: false, error: 'Image not found' };
      }

      console.log('[Test] Found image at position:', imagePos);

      // Update the image with new dimensions
      editor.chain()
        .setNodeSelection(imagePos)
        .updateAttributes('image', {
          width: 200,
          height: 200,
        })
        .run();

      // Verify the update
      const updatedNode = editor.state.doc.nodeAt(imagePos);
      console.log('[Test] Updated node attrs:', updatedNode?.attrs);

      return {
        success: true,
        attrs: updatedNode?.attrs
      };
    });

    console.log('Resize result:', resizeResult);
    expect(resizeResult.success).toBe(true);
    expect(resizeResult.attrs.width).toBe(200);
    expect(resizeResult.attrs.height).toBe(200);

    // Wait for update to be captured
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check Y.Doc after resize
    const afterResize = await window1.evaluate(() => {
      const yDoc = window.app.syncManager.getDoc(window.app.currentNote.id);
      const yContent = yDoc.getXmlFragment('default');
      const contentStr = yContent.toString();

      return {
        yDocLength: yContent.length,
        yDocString: contentStr.substring(0, 400),
        hasWidth: contentStr.includes('width="200"'),
        hasHeight: contentStr.includes('height="200"')
      };
    });
    console.log('After resize Y.Doc:', afterResize);

    // The Y.Doc should contain width and height attributes
    expect(afterResize.hasWidth).toBe(true);
    expect(afterResize.hasHeight).toBe(true);

    // Flush to disk
    await window1.evaluate(() => {
      return window.app.syncManager.updateStore.flush(window.app.currentNote.id);
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    await electronApp1.close();

    // ========== INSTANCE 2: Open note and verify resized dimensions ==========
    const electronApp2 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'resize-test-2'
      }
    });

    const window2 = await electronApp2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click on the note
    await window2.click(`.note-item[data-note-id="${noteId}"]`);
    await window2.waitForSelector('.ProseMirror');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if image has correct dimensions
    const instance2Check = await window2.evaluate(() => {
      const yDoc = window.app.syncManager.getDoc(window.app.currentNote.id);
      const yContent = yDoc.getXmlFragment('default');
      const contentStr = yContent.toString();

      // Find the image node
      let imageNode = null;
      window.app.editor.editor.state.doc.descendants((node) => {
        if (node.type.name === 'image') {
          imageNode = node;
          return false;
        }
      });

      // Check DOM for actual rendered dimensions
      const imgElement = document.querySelector('.ProseMirror img');

      return {
        yDocString: contentStr.substring(0, 400),
        hasWidth: contentStr.includes('width="200"'),
        hasHeight: contentStr.includes('height="200"'),
        imageNodeAttrs: imageNode?.attrs,
        domWidth: imgElement?.width,
        domHeight: imgElement?.height
      };
    });

    console.log('Instance 2 check:', instance2Check);

    // All of these should be true if resize synced correctly
    expect(instance2Check.hasWidth).toBe(true);
    expect(instance2Check.hasHeight).toBe(true);
    expect(instance2Check.imageNodeAttrs?.width).toBe(200);
    expect(instance2Check.imageNodeAttrs?.height).toBe(200);
    expect(instance2Check.domWidth).toBe(200);
    expect(instance2Check.domHeight).toBe(200);

    await electronApp2.close();
  });
});
