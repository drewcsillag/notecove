const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Image Sync - Simple loadNote Test', () => {
  let tempDir;
  let notesDir;

  test.beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-img-simple-'));
    notesDir = path.join(tempDir, '.notecove');
    await fs.mkdir(notesDir, { recursive: true });
  });

  test.afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('loadNote should correctly load image from updates', async () => {
    // Create instance 1: create note with image and flush
    const electronApp1 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'test-instance-1'
      }
    });

    const window1 = await electronApp1.firstWindow();
    await window1.waitForLoadState('domcontentloaded');

    // Capture console logs for debugging
    const consoleLogs = [];
    window1.on('console', msg => {
      const text = msg.text();
      if (text.includes('[CRDT]') || text.includes('[SyncManager]') || text.includes('[UpdateStore]')) {
        consoleLogs.push(text);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create note with image
    await window1.click('button[title="New Note"]');
    await window1.waitForSelector('.ProseMirror');

    // IMPORTANT: Wait for setDocument() to complete and Collaboration to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    await window1.locator('.ProseMirror').click();
    await window1.keyboard.type('Test note');

    // Check Y.Doc after typing
    const afterTyping = await window1.evaluate(() => {
      const noteId = window.app.currentNote.id;
      const yDoc = window.app.syncManager.getDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');
      return {
        yContentString: yContent.toString().substring(0, 200)
      };
    });
    console.log('Y.Doc after typing:', afterTyping);

    await window1.keyboard.press('Enter');

    // Check Y.Doc after pressing Enter
    const afterEnter = await window1.evaluate(() => {
      const noteId = window.app.currentNote.id;
      const yDoc = window.app.syncManager.getDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');
      return {
        yContentString: yContent.toString().substring(0, 200)
      };
    });
    console.log('Y.Doc after Enter:', afterEnter);

    // Insert image using direct node creation (not HTML parsing)
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const insertResult = await window1.evaluate((base64) => {
      try {
        const editor = window.app.editor.editor;

        // Create image node using the schema
        const imageNode = editor.schema.nodes.image.create({
          src: base64
        });

        // Insert using a command that directly inserts the node
        const inserted = editor.commands.insertContent({
          type: 'image',
          attrs: {
            src: base64
          }
        });

        // Check if image appears in the UI
        const imgs = document.querySelectorAll('.ProseMirror img');

        // Also check the editor state
        const editorHtml = editor.getHTML();

        return {
          success: true,
          imageCount: imgs.length,
          insertedResult: inserted,
          editorHtml: editorHtml.substring(0, 300)
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, testImageBase64);

    console.log('Image insert result:', insertResult);

    // Check Y.Doc immediately after image insertion
    const afterImageInsert = await window1.evaluate(() => {
      const noteId = window.app.currentNote.id;
      const yDoc = window.app.syncManager.getDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');
      return {
        yContentLength: yContent.length,
        yContentString: yContent.toString().substring(0, 400)
      };
    });
    console.log('Y.Doc after image insert:', afterImageInsert);

    // Wait for updates to be captured by UpdateStore before flush
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get noteId and check if Collaboration extension is properly bound
    const noteId = await window1.evaluate(() => window.app.currentNote.id);
    const collaborationState = await window1.evaluate(() => {
      const editor = window.app.editor.editor;
      const yDocBound = window.app.editor.yDoc ? true : false;

      // Check if Collaboration extension exists
      const hasCollaboration = editor.extensionManager.extensions.some(ext => ext.name === 'collaboration');

      return {
        yDocBound,
        hasCollaboration,
        editorExtensions: editor.extensionManager.extensions.map(e => e.name)
      };
    });
    console.log('Collaboration state:', collaborationState);
    const beforeFlush = await window1.evaluate(() => {
      const noteId = window.app.currentNote.id;
      const yDoc = window.app.syncManager.getDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');
      return {
        yContentLength: yContent.length,
        yContentString: yContent.toString().substring(0, 300),
        hasImage: yContent.toString().includes('<image')
      };
    });
    console.log('Instance 1 Y.Doc before flush:', beforeFlush);

    const flushInfo = await window1.evaluate(async () => {
      const noteId = window.app.currentNote.id;

      // Check BOTH CRDTManager and UpdateStore pendingUpdates
      const crdtManagerPending = window.app.syncManager.crdtManager.pendingUpdates.has(noteId)
        ? window.app.syncManager.crdtManager.pendingUpdates.get(noteId).length
        : 0;
      const updateStorePending = window.app.syncManager.updateStore.getNoteState(noteId).pendingUpdates.length;

      await window.app.syncManager.updateStore.flush(noteId);

      const pendingAfter = window.app.syncManager.updateStore.getNoteState(noteId).pendingUpdates.length;

      return {
        crdtManagerPending,
        updateStorePending,
        pendingAfter
      };
    });

    console.log('Flush info:', flushInfo);

    // Print captured console logs
    console.log('\n=== CAPTURED CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));
    console.log('=== END CONSOLE LOGS ===\n');

    await electronApp1.close();

    // Now create instance 2 and directly call loadNote
    const electronApp2 = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'test-instance-2'
      }
    });

    const window2 = await electronApp2.firstWindow();
    await window2.waitForLoadState('domcontentloaded');

    // Capture console logs for instance 2
    const consoleLogs2 = [];
    window2.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Test]') || text.includes('[SyncManager]') || text.includes('UpdateStore') || text.includes('[CRDT]')) {
        consoleLogs2.push(text);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Call loadNote and check result
    const loadResult = await window2.evaluate(async (nId) => {
      // Load the note using the actual loadNote method
      const note = await window.app.syncManager.loadNote(nId);

      if (!note) {
        return { success: false, error: 'loadNote returned null' };
      }

      // Check Y.Doc content
      const yDoc = window.app.syncManager.getDoc(nId);
      const yContent = yDoc.getXmlFragment('default');
      const contentStr = yContent.toString();

      console.log(`[Test] Loaded note: ${note.title}`);
      console.log(`[Test] Y.Doc length: ${yContent.length}`);
      console.log(`[Test] Has image: ${contentStr.includes('<image')}`);

      return {
        success: true,
        noteId: note.id,
        noteTitle: note.title,
        yContentLength: yContent.length,
        yContentString: contentStr.substring(0, 400),
        hasImageInYDoc: contentStr.includes('<image'),
        noteContent: note.content?.substring(0, 200)
      };
    }, noteId);

    console.log('loadNote result:', JSON.stringify(loadResult, null, 2));

    // Print captured console logs from instance 2
    console.log('\n=== INSTANCE 2 CONSOLE LOGS ===');
    consoleLogs2.forEach(log => console.log(log));
    console.log('=== END INSTANCE 2 LOGS ===\n');

    expect(loadResult.success).toBe(true);
    expect(loadResult.hasImageInYDoc).toBe(true);

    await electronApp2.close();
  });
});
