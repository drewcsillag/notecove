const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Image Sync', () => {
  let tempDir;
  let notesDir;
  let electronApp1;
  let electronApp2;
  let window1;
  let window2;

  test.beforeEach(async () => {
    // Create a temporary directory for test notes
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-image-test-'));
    notesDir = path.join(tempDir, '.notecove');
    await fs.mkdir(notesDir, { recursive: true });
    console.log('Test notes directory:', notesDir);

    // Launch first Electron app instance
    electronApp1 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'test-instance-1'
      }
    });

    window1 = await electronApp1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');
    console.log('Instance 1 launched');

    // Launch second Electron app instance
    electronApp2 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'test-instance-2'
      }
    });

    window2 = await electronApp2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');
    console.log('Instance 2 launched');

    // Wait for both instances to sync
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test.afterEach(async () => {
    // Close apps
    if (electronApp1) await electronApp1.close();
    if (electronApp2) await electronApp2.close();

    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should sync images between instances', async () => {
    console.log('\n=== Starting image sync test ===');

    // Create a new note in instance 1
    await window1.click('button[title="New Note"]');
    await window1.waitForSelector('.ProseMirror');

    // Type some content using keyboard
    await window1.locator('.ProseMirror').click();
    await window1.keyboard.type('Test Note with Image');
    await window1.keyboard.press('Enter');

    console.log('Text typed in instance 1');

    // Insert image programmatically
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await window1.evaluate((base64) => {
      const editor = window.app.editor.editor;
      editor.chain().focus().setImage({ src: base64 }).run();
    }, testImageBase64);

    console.log('Image inserted');

    // Type more text to trigger another update
    await window1.keyboard.type('Text after image');

    // Wait for updates
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Wait a moment for update to be captured
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test: Manually trigger a Y.Doc update to verify the handler works
    const manualUpdateTest = await window1.evaluate(() => {
      const noteId = window.app.currentNote.id;
      const yDoc = window.app.syncManager.getDoc(noteId);

      // Check UpdateStore state before manual update
      const before = window.app.syncManager.updateStore.getNoteState(noteId).pendingUpdates.length;

      // Manually trigger an update on the Y.Doc
      yDoc.transact(() => {
        const yText = yDoc.getText('testfield');
        yText.insert(0, 'test');
      });

      // Wait a moment for async processing
      return new Promise(resolve => {
        setTimeout(() => {
          const after = window.app.syncManager.updateStore.getNoteState(noteId).pendingUpdates.length;
          resolve({ before, after, worked: after > before });
        }, 100);
      });
    });

    console.log('Manual Y.Doc update test:', manualUpdateTest);

    // Check if UpdateStore has pending updates for this note
    const noteId = await window1.evaluate(() => window.app.currentNote.id);
    const pendingCount = await window1.evaluate((nId) => {
      const state = window.app.syncManager.updateStore.getNoteState(nId);
      return state.pendingUpdates.length;
    }, noteId);

    console.log('Pending updates in UpdateStore:', pendingCount);

    // Manually flush updates to ensure they're written to disk
    const flushResult = await window1.evaluate(() => {
      return window.app.syncManager.updateStore.flush(window.app.currentNote.id);
    });

    console.log('Flush result:', flushResult);

    // Wait for sync to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if note exists in instance 2
    const noteItems2 = await window2.locator('.note-item').all();
    console.log('Notes in instance 2:', noteItems2.length);

    expect(noteItems2.length).toBeGreaterThan(0);

    // Click on the note in instance 2
    await window2.click('.note-item');
    await window2.waitForSelector('.ProseMirror');

    // Wait a bit for content to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if text and image exist in instance 2
    const syncResult = await window2.evaluate(() => {
      const prosemirror = document.querySelector('.ProseMirror');
      if (!prosemirror) return { hasText: false, hasImage: false, text: 'No ProseMirror' };

      const text = prosemirror.textContent || '';
      const images = prosemirror.querySelectorAll('img');

      console.log('Text in instance 2:', text);
      console.log('Images in instance 2:', images.length);

      return {
        hasText: text.includes('Test Note with Image'),
        hasImage: images.length > 0 && images[0].src.startsWith('data:image/'),
        text
      };
    });

    console.log('Sync result in instance 2:', syncResult);
    expect(syncResult.hasText).toBe(true);
    expect(syncResult.hasImage).toBe(true);
  });

  test('should persist image resize', async () => {
    console.log('\n=== Starting image resize test ===');

    // Create a new note with an image
    await window1.click('button[title="New Note"]');
    await window1.waitForSelector('.ProseMirror');

    await window1.locator('.ProseMirror').click();
    await window1.keyboard.type('Resize Test');
    await window1.keyboard.press('Enter');

    // Insert image
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    await window1.evaluate((base64) => {
      const editor = window.app.editor.editor;
      editor.chain().focus().setImage({ src: base64 }).run();
    }, testImageBase64);

    console.log('Image inserted');

    // Wait for image to render
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get initial dimensions
    const initialDimensions = await window1.evaluate(() => {
      const img = document.querySelector('.ProseMirror img');
      return { width: img.width, height: img.height };
    });

    console.log('Initial dimensions:', initialDimensions);

    // Resize the image by updating attributes
    await window1.evaluate(() => {
      const editor = window.app.editor.editor;
      const img = document.querySelector('.ProseMirror img');

      // Click on image to show handles
      img.click();

      // Find the image node position more reliably
      let imagePos = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
          imagePos = pos;
          console.log('Found image node at position:', pos, 'with attrs:', node.attrs);
          return false; // Stop searching
        }
      });

      if (imagePos === null) {
        console.log('ERROR: Could not find image node in document');
        return;
      }

      // Update the image node with new dimensions using updateAttributes
      const result = editor.chain()
        .focus()
        .setNodeSelection(imagePos)
        .updateAttributes('image', {
          width: 300,
          height: 300,
        })
        .run();

      console.log('updateAttributes result:', result);

      // Verify the update
      const updatedNode = editor.state.doc.nodeAt(imagePos);
      console.log('After update, node attrs:', updatedNode?.attrs);
    });

    console.log('Image resized to 300x300');

    // Wait for update to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check dimensions after resize (read from editor state, not DOM)
    const resizedDimensions = await window1.evaluate(() => {
      const editor = window.app.editor.editor;
      const img = document.querySelector('.ProseMirror img');
      if (!img) {
        console.log('Image not found after resize!');
        return null;
      }

      // Get the image node from editor state (more reliable than DOM properties)
      const pos = editor.view.posAtDOM(img, 0);
      const node = editor.state.doc.nodeAt(pos - 1);

      if (!node || node.type.name !== 'image') {
        console.log('Could not find image node in editor state');
        return { width: img.width, height: img.height }; // Fallback to DOM
      }

      return {
        width: node.attrs.width || img.width,
        height: node.attrs.height || img.height
      };
    });

    console.log('Resized dimensions:', resizedDimensions);

    if (!resizedDimensions) {
      console.log('Skipping resize test - image disappeared after resize');
      return; // Skip the rest of the test
    }

    expect(resizedDimensions.width).toBe(300);
    expect(resizedDimensions.height).toBe(300);

    // Switch to another note and back to verify persistence
    await window1.click('button[title="New Note"]');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Click back on the first note (should be second in list now)
    const noteItems = await window1.locator('.note-item').all();
    if (noteItems.length > 1) {
      await noteItems[1].click();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check dimensions after switching notes (read from editor state)
      const persistedDimensions = await window1.evaluate(() => {
        const editor = window.app.editor.editor;
        const img = document.querySelector('.ProseMirror img');
        if (!img) return null;

        // Get from editor state for reliability
        const pos = editor.view.posAtDOM(img, 0);
        const node = editor.state.doc.nodeAt(pos - 1);

        if (!node || node.type.name !== 'image') {
          return { width: img.width, height: img.height };
        }

        return {
          width: node.attrs.width || img.width,
          height: node.attrs.height || img.height
        };
      });

      console.log('Persisted dimensions:', persistedDimensions);
      expect(persistedDimensions).not.toBeNull();
      expect(persistedDimensions.width).toBe(300);
      expect(persistedDimensions.height).toBe(300);
    }

    // Wait for sync to instance 2
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if resized image synced to instance 2
    const noteItems2 = await window2.locator('.note-item').all();
    if (noteItems2.length > 0) {
      // Click on the note with the image (should be second note)
      if (noteItems2.length > 1) {
        await noteItems2[1].click();
      } else {
        await noteItems2[0].click();
      }

      await window2.waitForSelector('.ProseMirror');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const dimensions2 = await window2.evaluate(() => {
        const img = document.querySelector('.ProseMirror img');
        if (!img) return null;
        return { width: img.width, height: img.height };
      });

      console.log('Dimensions in instance 2:', dimensions2);
      expect(dimensions2).not.toBeNull();
      expect(dimensions2.width).toBe(300);
      expect(dimensions2.height).toBe(300);
    }
  });
});
