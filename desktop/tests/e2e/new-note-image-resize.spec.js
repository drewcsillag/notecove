const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('New Note Image Resize', () => {
  let tempDir;
  let notesDir;

  test.beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-new-note-'));
    notesDir = path.join(tempDir, '.notecove');
    await fs.mkdir(notesDir, { recursive: true });
  });

  test.afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should allow image resize in newly created note without switching notes', async () => {
    // ========== INSTANCE 1: Create new note, add image, resize immediately ==========
    const electronApp1 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'new-note-test-1'
      }
    });

    const window1 = await electronApp1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create NEW note via button click
    await window1.click('button[title="New Note"]');
    await window1.waitForSelector('.ProseMirror');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Type some text
    await window1.locator('.ProseMirror').click();
    await window1.keyboard.type('New note with immediate image resize');
    await window1.keyboard.press('Enter');

    // Insert image programmatically
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    await window1.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
    }, testImageBase64);

    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the note ID
    const noteId = await window1.evaluate(() => window.app.currentNote.id);
    console.log('New note ID:', noteId);

    // Click on image to show handles
    await window1.click('.ProseMirror img');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify handles are visible
    const handlesVisible = await window1.evaluate(() => {
      const container = document.querySelector('.image-container.selected');
      return !!container;
    });
    console.log('Handles visible:', handlesVisible);
    expect(handlesVisible).toBe(true);

    // Resize the image (WITHOUT switching notes first!)
    const resizeResult = await window1.evaluate(() => {
      const editor = window.app.editor.editor;

      // Find the image node position
      let imagePos = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
          imagePos = pos;
          return false;
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
          width: 300,
          height: 300,
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
    expect(resizeResult.attrs.width).toBe(300);
    expect(resizeResult.attrs.height).toBe(300);

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
        hasWidth: contentStr.includes('width="300"'),
        hasHeight: contentStr.includes('height="300"')
      };
    });
    console.log('After resize Y.Doc in instance 1:', afterResize);

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
        NOTECOVE_INSTANCE_ID: 'new-note-test-2'
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
        hasWidth: contentStr.includes('width="300"'),
        hasHeight: contentStr.includes('height="300"'),
        imageNodeAttrs: imageNode?.attrs,
        domWidth: imgElement?.width,
        domHeight: imgElement?.height
      };
    });

    console.log('Instance 2 check:', instance2Check);

    // All of these should be true if resize synced correctly
    expect(instance2Check.hasWidth).toBe(true);
    expect(instance2Check.hasHeight).toBe(true);
    expect(instance2Check.imageNodeAttrs?.width).toBe(300);
    expect(instance2Check.imageNodeAttrs?.height).toBe(300);
    expect(instance2Check.domWidth).toBe(300);
    expect(instance2Check.domHeight).toBe(300);

    await electronApp2.close();
  });
});
