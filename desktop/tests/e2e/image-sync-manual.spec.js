const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Image Sync - Manual Test', () => {
  let tempDir;
  let notesDir;
  let electronApp1;
  let electronApp2;
  let window1;
  let window2;

  test.beforeEach(async () => {
    // Create a temporary directory for test notes
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-img-test-'));
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

    // Wait for both instances to initialize
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

  test('should sync text content between instances', async () => {
    console.log('\n=== Testing text sync ===');

    // Create a new note in instance 1
    await window1.click('button[title="New Note"]');
    await window1.waitForSelector('.ProseMirror');

    // Type content
    await window1.locator('.ProseMirror').click();
    await window1.keyboard.type('Test note with text content');

    console.log('Text typed in instance 1');

    // Wait for sync (idle flush is 3 seconds)
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Check instance 2
    const noteItems2 = await window2.locator('.note-item').all();
    console.log('Notes in instance 2:', noteItems2.length);

    expect(noteItems2.length).toBeGreaterThan(0);

    // Click on the note in instance 2
    await noteItems2[0].click();
    await window2.waitForSelector('.ProseMirror');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check text content
    const textContent2 = await window2.evaluate(() => {
      return document.querySelector('.ProseMirror')?.textContent || '';
    });

    console.log('Text in instance 2:', textContent2);
    expect(textContent2).toContain('Test note with text content');

    // Verify text still in instance 1
    const textContent1 = await window1.evaluate(() => {
      return document.querySelector('.ProseMirror')?.textContent || '';
    });

    console.log('Text in instance 1 after instance 2 opened note:', textContent1);
    expect(textContent1).toContain('Test note with text content');
  });

  test('should handle image insertion via simulated paste', async () => {
    console.log('\n=== Testing image sync via paste ===');

    // Create a new note in instance 1
    await window1.click('button[title="New Note"]');
    await window1.waitForSelector('.ProseMirror');

    // Type some initial content
    await window1.locator('.ProseMirror').click();
    await window1.keyboard.type('Image test note');
    await window1.keyboard.press('Enter');

    // Create a test image file
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    // Simulate image paste by directly calling the paste handler
    const insertResult = await window1.evaluate((base64) => {
      const editor = window.app.editor.editor;

      // Try using the transaction method directly
      try {
        const { state, view } = editor;
        const { tr } = state;

        console.log('Creating image node...');
        const imageNode = state.schema.nodes.image.create({
          src: base64
        });

        console.log('Inserting image node...');
        tr.replaceSelectionWith(imageNode);
        view.dispatch(tr);

        console.log('Image inserted successfully');
        return { success: true, error: null };
      } catch (error) {
        console.error('Error inserting image:', error);
        return { success: false, error: error.message };
      }
    }, testImageBase64);

    console.log('Insert result:', insertResult);
    expect(insertResult.success).toBe(true);

    // Wait a moment for the transaction to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if image is in the document in instance 1
    const hasImage1Before = await window1.evaluate(() => {
      const imgs = document.querySelectorAll('.ProseMirror img');
      console.log('Images in instance 1:', imgs.length);
      if (imgs.length > 0) {
        console.log('Image src:', imgs[0].src.substring(0, 50) + '...');
      }
      return imgs.length > 0;
    });

    console.log('Image exists in instance 1 before sync:', hasImage1Before);
    expect(hasImage1Before).toBe(true);

    // Check UpdateStore state AND Y.Doc content
    const updateStoreState = await window1.evaluate(() => {
      const noteId = window.app.currentNote.id;
      const state = window.app.syncManager.updateStore.getNoteState(noteId);
      const yDoc = window.app.syncManager.getDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');

      // Try to serialize the content
      let contentString = '';
      try {
        contentString = yContent.toString();
      } catch (e) {
        contentString = 'Error: ' + e.message;
      }

      return {
        noteId,
        pendingUpdates: state.pendingUpdates.length,
        writeCounter: state.writeCounter,
        yContentLength: yContent.length,
        yContentFirstChildType: yContent.length > 0 ? yContent.firstChild?.nodeName : 'no children',
        yContentString: contentString.substring(0, 200)
      };
    });

    console.log('UpdateStore and Y.Doc state in instance 1:', updateStoreState);

    // Manually flush updates
    const flushResult = await window1.evaluate(async () => {
      const noteId = window.app.currentNote.id;
      console.log('[TEST] About to flush noteId:', noteId);
      const result = await window.app.syncManager.updateStore.flush(noteId);
      console.log('[TEST] Flush returned:', result);

      // Check if directory exists and get actual path
      const notesPath = window.app.syncManager.updateStore.fileStorage.notesPath;
      const noteDir = notesPath + '/' + noteId;
      const updatesDir = noteDir + '/updates';
      const dirExists = await window.electronAPI.fileSystem.exists(updatesDir);
      console.log('[TEST] Updates directory exists:', dirExists);
      console.log('[TEST] Notes path from app:', notesPath);
      console.log('[TEST] Updates dir:', updatesDir);

      // List files if directory exists
      let files = [];
      if (dirExists) {
        const listResult = await window.electronAPI.fileSystem.readDir(updatesDir);
        if (listResult.success) {
          files = listResult.files;
        }
      }

      return { flushResult: result, dirExists, notesPath, updatesDir, files };
    });

    console.log('Flush result:', flushResult);

    // Check what's in the packed files
    const noteDir = path.join(notesDir, updateStoreState.noteId);
    const noteUpdatesDir = path.join(noteDir, 'updates');

    try {
      const files = await fs.readdir(noteUpdatesDir);
      console.log('Packed files:', files);

      if (files.length > 0) {
        for (const file of files) {
          const filePath = path.join(noteUpdatesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(content);
          console.log(`File ${file}: ${parsed.updates?.length || 0} updates, seq ${parsed.sequence[0]}-${parsed.sequence[1]}`);
        }
      }
    } catch (error) {
      console.log('Error reading packed files:', error.message);
    }

    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Check instance 2
    const noteItems2 = await window2.locator('.note-item').all();
    console.log('Notes in instance 2:', noteItems2.length);

    if (noteItems2.length > 0) {
      // Click on the note
      await noteItems2[0].click();
      await window2.waitForSelector('.ProseMirror');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // BEFORE opening the note, manually test applying updates to fresh Y.Doc
      const beforeLoadInfo = await window2.evaluate(async () => {
        const noteId = window.app.currentNote.id;
        const updatesDir = window.app.syncManager.updateStore.fileStorage.notesPath + '/' + noteId + '/updates';

        // List files
        const listResult = await window.electronAPI.fileSystem.readDir(updatesDir);
        const files = listResult.success ? listResult.files : [];

        // Try to read all updates
        const allUpdates = await window.app.syncManager.updateStore.readAllUpdates(noteId);

        // Filter updates from test-instance-1 only
        const instance1Updates = allUpdates.filter(u => u.instanceId === 'test-instance-1');

        return {
          noteId,
          filesOnDisk: files,
          allUpdatesCount: allUpdates.length,
          instance1UpdatesCount: instance1Updates.length,
          firstUpdateInstanceId: allUpdates[0]?.instanceId,
          firstUpdateSeq: allUpdates[0]?.sequence
        };
      });

      console.log('Instance 2 applying updates to fresh Y.Doc:', beforeLoadInfo);

      // Check Y.Doc content in instance 2
      const yDocState2 = await window2.evaluate(() => {
        const noteId = window.app.currentNote.id;
        const yDoc = window.app.syncManager.getDoc(noteId);
        const yContent = yDoc.getXmlFragment('default');
        const yMetadata = yDoc.getMap('metadata');

        let contentString = '';
        try {
          contentString = yContent.toString();
        } catch (e) {
          contentString = 'Error: ' + e.message;
        }

        return {
          noteId,
          yContentLength: yContent.length,
          yMetadataSize: yMetadata.size,
          yContentString: contentString.substring(0, 200),
          isDocEmpty: window.app.syncManager.crdtManager.isDocEmpty(noteId)
        };
      });

      console.log('Y.Doc state in instance 2:', yDocState2);

      // Check if image exists
      const hasImage2 = await window2.evaluate(() => {
        const imgs = document.querySelectorAll('.ProseMirror img');
        console.log('Images in instance 2:', imgs.length);
        if (imgs.length > 0) {
          console.log('Image src:', imgs[0].src.substring(0, 50) + '...');
        }
        return imgs.length > 0;
      });

      console.log('Image exists in instance 2:', hasImage2);

      // Check if image still exists in instance 1 AND check Y.Doc state
      const instance1StateAfter = await window1.evaluate(() => {
        const noteId = window.app.currentNote?.id;
        const imgs = document.querySelectorAll('.ProseMirror img');
        console.log('Images in instance 1 after instance 2 opened note:', imgs.length);

        if (!noteId) {
          return { hasImage: false, noteId: 'no current note' };
        }

        const yDoc = window.app.syncManager.getDoc(noteId);
        const yContent = yDoc.getXmlFragment('default');

        let contentString = '';
        try {
          contentString = yContent.toString();
        } catch (e) {
          contentString = 'Error: ' + e.message;
        }

        return {
          hasImage: imgs.length > 0,
          noteId,
          yContentLength: yContent.length,
          yContentString: contentString.substring(0, 200)
        };
      });

      console.log('Instance 1 state after instance 2 opened note:', instance1StateAfter);

      expect(hasImage2).toBe(true);
      expect(instance1StateAfter.hasImage).toBe(true);
    } else {
      throw new Error('Note did not sync to instance 2');
    }
  });
});
