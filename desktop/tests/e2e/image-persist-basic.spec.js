const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Image Persistence - Basic', () => {
  let tempDir;
  let notesDir;
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Create a temporary directory for test notes
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notecove-image-persist-test-'));
    notesDir = path.join(tempDir, '.notecove');
    await fs.mkdir(notesDir, { recursive: true });
    console.log('Test notes directory:', notesDir);

    // Launch Electron app instance
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NOTECOVE_NOTES_PATH: notesDir,
        NOTECOVE_INSTANCE_ID: 'test-instance-1'
      }
    });

    window = await electronApp.firstWindow();

    // Capture console logs from the browser
    window.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Editor]') || text.includes('setDocument') || text.includes('saveCurrentNote') || text.includes('SAVE')) {
        console.log('[Browser Console]', text);
      }
    });

    await window.waitForLoadState('domcontentloaded');
    console.log('Instance launched');

    // Wait for app to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test.afterEach(async () => {
    // Close app
    if (electronApp) await electronApp.close();

    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should preserve image when switching notes', async () => {
    console.log('\n=== Starting image persistence test ===');

    // Create first note with image
    await window.click('button[title="New Note"]');
    await window.waitForSelector('.ProseMirror');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Type some content
    await window.locator('.ProseMirror').click();
    await window.keyboard.type('Note with Image');
    await window.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Text typed');

    // Insert image programmatically
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    // Set up a listener for Y.Doc updates BEFORE inserting image
    const updatePromise = window.evaluate(() => {
      return new Promise((resolve) => {
        const yDoc = window.app.syncManager.crdtManager.getContentDoc(window.app.currentNote.id);
        const capturedUpdates = [];

        const handler = (update, origin) => {
          // Convert update to array for inspection
          const updateArray = Array.from(update);
          const updateStr = String.fromCharCode(...updateArray);

          // Check Y.Doc state after update
          const yContent = yDoc.getXmlFragment('default');
          const xmlStr = yContent.toString();

          capturedUpdates.push({
            size: update.length,
            origin: String(origin),
            hasDataImageInBytes: updateStr.includes('data:image'),
            hasPngSignatureInBytes: updateStr.includes('iVBOR'),
            yDocHasImage: xmlStr.includes('<image'),
            yDocHasBase64: xmlStr.includes('data:image')
          });
        };
        yDoc.on('update', handler);

        // Remove handler after 2 seconds
        setTimeout(() => {
          yDoc.off('update', handler);
          resolve({ updates: capturedUpdates });
        }, 2000);
      });
    });

    // Insert image using attachment manager (NEW METHOD)
    await window.evaluate(async (base64) => {
      const editor = window.app.editor.editor;
      const attachmentManager = window.app.syncManager.attachmentManager;
      const noteId = window.app.currentNote.id;

      console.log('[TEST] About to insert image via attachment...');
      console.log('[TEST] AttachmentManager available:', !!attachmentManager);
      console.log('[TEST] Current note ID:', noteId);

      // Convert base64 to Uint8Array (browser-compatible)
      const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // AttachmentManager accepts Buffer or base64 string
      // Pass the full base64 data URL
      const attachment = await attachmentManager.saveAttachment(
        noteId,
        'test-image.png',
        base64  // Pass the base64 string, AttachmentManager will handle conversion
      );

      console.log('[TEST] Saved attachment:', attachment.id);

      // Insert with attachmentId and explicit placeholder src
      // IMPORTANT: src is required by TipTap Image extension - Y.js won't apply defaults during sync
      editor.chain().focus().insertContent({
        type: 'image',
        attrs: {
          attachmentId: attachment.id,
          src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect fill="transparent" width="1" height="1"/></svg>'
        }
      }).run();

      console.log('[TEST] Image insert command completed with attachmentId');
    }, testImageBase64);

    console.log('Image inserted');

    // Wait for update events
    const updateResult = await updatePromise;
    console.log(`\nImage insertion generated ${updateResult.updates.length} Y.Doc update events:`);
    updateResult.updates.forEach((u, i) => {
      console.log(`  Update ${i + 1}: ${u.size} bytes, origin="${u.origin}"`);
      console.log(`    - Update bytes contain "data:image": ${u.hasDataImageInBytes}`);
      console.log(`    - Update bytes contain PNG signature: ${u.hasPngSignatureInBytes}`);
      console.log(`    - Y.Doc has <image> after update: ${u.yDocHasImage}`);
      console.log(`    - Y.Doc has base64 data after update: ${u.yDocHasBase64}`);
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify image exists
    const imageCountBefore = await window.evaluate(() => {
      return document.querySelectorAll('.ProseMirror img').length;
    });

    console.log('Images before switch:', imageCountBefore);
    expect(imageCountBefore).toBeGreaterThanOrEqual(1);

    // Get the note ID
    const noteWithImageId = await window.evaluate(() => window.app.currentNote.id);
    console.log('Note with image ID:', noteWithImageId);

    // Check Y.Doc content before flush
    const yDocBeforeFlush = await window.evaluate(() => {
      const yDoc = window.app.syncManager.crdtManager.getContentDoc(window.app.currentNote.id);
      const yContent = yDoc.getXmlFragment('default');
      return {
        length: yContent.length,
        toString: yContent.toString().substring(0, 300),
        hasImage: yContent.toString().includes('<image')
      };
    });
    console.log('Y.Doc before flush:', yDocBeforeFlush);

    // Flush to ensure image is saved
    await window.evaluate(() => {
      return window.app.syncManager.updateStore.flush(window.app.currentNote.id);
    });

    // Check Y.Doc content after flush
    const yDocAfterFlush = await window.evaluate(() => {
      const yDoc = window.app.syncManager.crdtManager.getContentDoc(window.app.currentNote.id);
      const yContent = yDoc.getXmlFragment('default');
      return {
        length: yContent.length,
        toString: yContent.toString().substring(0, 300),
        hasImage: yContent.toString().includes('<image')
      };
    });
    console.log('Y.Doc after flush:', yDocAfterFlush);

    // Wait a bit longer for flush to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check what's actually on disk
    const notePath = path.join(notesDir, noteWithImageId);
    console.log('Checking note path:', notePath);

    try {
      const noteContents = await fs.readdir(notePath);
      console.log('Note directory contents:', noteContents);

      // NEW: Check for attachments directory
      const attachmentsPath = path.join(notePath, 'attachments');
      const attachmentsExist = await fs.access(attachmentsPath).then(() => true).catch(() => false);
      console.log('Attachments directory exists:', attachmentsExist);

      if (attachmentsExist) {
        const attachmentFiles = await fs.readdir(attachmentsPath);
        console.log('Attachment files:', attachmentFiles);

        // Check for image file and metadata
        const imageFiles = attachmentFiles.filter(f => f.endsWith('.png'));
        const metaFiles = attachmentFiles.filter(f => f.endsWith('.meta.json'));

        console.log('Image files:', imageFiles.length);
        console.log('Metadata files:', metaFiles.length);

        if (metaFiles.length > 0) {
          // Read and verify metadata
          const metaPath = path.join(attachmentsPath, metaFiles[0]);
          const metaData = await fs.readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaData);
          console.log('✓ Attachment metadata:', {
            id: meta.id,
            filename: meta.filename,
            mimeType: meta.mimeType,
            size: meta.size
          });
        }
      } else {
        console.log('⚠️  NO ATTACHMENTS DIRECTORY - using old base64 method?');
      }

      const updatesPath = path.join(notePath, 'updates');
      const updateFiles = await fs.readdir(updatesPath);
      console.log('Update files:', updateFiles);

      // Check ALL update files for image data (DECODE base64 first!)
      let foundImageData = false;
      for (const updateFileName of updateFiles) {
        const updateFile = path.join(updatesPath, updateFileName);
        const updateData = await fs.readFile(updateFile);

        // Parse the JSON
        const packed = JSON.parse(updateData.toString('utf8'));
        console.log(`\n${updateFileName}:`, {
          instance: packed.instance,
          sequence: packed.sequence,
          timestamp: packed.timestamp,
          updateCount: packed.updates?.length
        });

        // Check if any updates contain image data
        if (packed.updates && packed.updates.length > 0) {
          for (let i = 0; i < packed.updates.length; i++) {
            const updateEntry = packed.updates[i];
            // Handle both old (string) and new (object) formats
            const base64Str = typeof updateEntry === 'string' ? updateEntry : updateEntry.data;

            // DECODE from base64 before checking!
            const binaryStr = Buffer.from(base64Str, 'base64').toString('binary');
            const hasImage = binaryStr.includes('image');
            const hasDataImage = binaryStr.includes('data:image');
            const hasPngSig = binaryStr.includes('iVBOR');

            if (hasImage || hasDataImage || hasPngSig) {
              console.log(`  Update ${i}: (decoded from base64)`);
              console.log(`    - has "image": ${hasImage}`);
              console.log(`    - has "data:image": ${hasDataImage}`);
              console.log(`    - has PNG signature: ${hasPngSig}`);
              console.log(`    - decoded size: ${binaryStr.length} bytes`);

              if (hasDataImage) {
                console.log('  ✓✓✓ FOUND IMAGE DATA IN DISK FILE! ✓✓✓');
                foundImageData = true;
              }
            }
          }
        }
      }

      console.log(`\n${foundImageData ? '✓✓✓' : '✗✗✗'} Image data ${foundImageData ? 'IS' : 'IS NOT'} being written to disk properly`);

      if (!foundImageData) {
        console.log('\n⚠️  IMAGE DATA MISSING FROM DISK FILES!');
      }
    } catch (err) {
      console.log('Error reading disk files:', err.message);
      console.log('Stack:', err.stack);
    }

    // Check the Y.Doc state before switching away AND set up a listener
    const yDocBeforeSwitch = await window.evaluate((noteId) => {
      const yDoc = window.app.syncManager.crdtManager.getContentDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');

      // Set up a listener to track ANY changes to this Y.Doc
      const changeHandler = (events) => {
        console.log(`[🚨 MUTATION] Y.Doc ${noteId} was modified!`);
        events.forEach((event, i) => {
          console.log(`[🚨 MUTATION] Event ${i}:`, {
            target: event.target.constructor.name,
            path: event.path?.map(p => p.constructor.name),
          });
        });

        // Check current state
        const current = yContent.toString();
        console.log(`[🚨 MUTATION] Current Y.Doc state:`, {
          hasImage: current.includes('<image'),
          preview: current.substring(0, 200)
        });
      };

      yContent.observeDeep(changeHandler);

      // Store handler for cleanup later
      if (!window._yDocObservers) window._yDocObservers = new Map();
      window._yDocObservers.set(noteId, { fragment: yContent, handler: changeHandler });

      return {
        length: yContent.length,
        toString: yContent.toString().substring(0, 300),
        hasImage: yContent.toString().includes('<image')
      };
    }, noteWithImageId);
    console.log('\nY.Doc BEFORE switching away (listener installed):', yDocBeforeSwitch);

    // Create a second note (to switch away from the image note)
    await window.click('button[title="New Note"]');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await window.keyboard.type('Second Note');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\nSwitched to second note');

    // Check if the Y.Doc for the first note still has the image after switching away
    const yDocAfterSwitchAway = await window.evaluate((noteId) => {
      const yDoc = window.app.syncManager.crdtManager.getContentDoc(noteId);
      const yContent = yDoc.getXmlFragment('default');

      // Check if this is the same instance we were observing
      const observer = window._yDocObservers?.get(noteId);
      const sameFragment = observer && (observer.fragment === yContent);

      return {
        length: yContent.length,
        toString: yContent.toString().substring(0, 300),
        hasImage: yContent.toString().includes('<image'),
        fullXml: yContent.toString(),
        sameFragmentInstance: sameFragment,
        yDocClientID: yDoc.clientID
      };
    }, noteWithImageId);
    console.log('\nY.Doc AFTER switching away:');
    console.log('  length:', yDocAfterSwitchAway.length);
    console.log('  hasImage:', yDocAfterSwitchAway.hasImage);
    console.log('  preview:', yDocAfterSwitchAway.toString);
    console.log('  sameFragmentInstance:', yDocAfterSwitchAway.sameFragmentInstance);
    console.log('  yDocClientID:', yDocAfterSwitchAway.yDocClientID);
    if (!yDocAfterSwitchAway.hasImage) {
      console.log('  ❌ IMAGE LOST! Full XML:', yDocAfterSwitchAway.fullXml);
      if (yDocAfterSwitchAway.sameFragmentInstance) {
        console.log('  ⚠️ SAME fragment instance but content changed WITHOUT mutations!');
      } else {
        console.log('  ⚠️ DIFFERENT fragment instance - Y.Doc or fragment was replaced!');
      }
    }

    // Switch back to the first note (with image)
    const noteItems = await window.locator('.note-item').all();
    console.log('Number of notes:', noteItems.length);

    if (noteItems.length >= 2) {
      // Click on the first note (the one with the image)
      await window.click(`.note-item[data-note-id="${noteWithImageId}"]`);
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Switched back to note with image');

      // Check Y.Doc content after switching back
      const yDocAfterSwitch = await window.evaluate(() => {
        const yDoc = window.app.syncManager.crdtManager.getContentDoc(window.app.currentNote.id);
        const yContent = yDoc.getXmlFragment('default');
        return {
          length: yContent.length,
          toString: yContent.toString().substring(0, 300),
          hasImage: yContent.toString().includes('<image')
        };
      });
      console.log('Y.Doc after switching back:', yDocAfterSwitch);

      // Check if image still exists
      const imageCountAfter = await window.evaluate(() => {
        const prosemirror = document.querySelector('.ProseMirror');
        const images = prosemirror?.querySelectorAll('img');
        console.log('Images found:', images?.length);
        if (images && images.length > 0) {
          console.log('First image src:', images[0].src.substring(0, 50));
        }
        return images?.length || 0;
      });

      console.log('Images after switch back:', imageCountAfter);

      // The image should still be there
      expect(imageCountAfter).toBeGreaterThanOrEqual(1);
      // Should be the same count as before
      expect(imageCountAfter).toBe(imageCountBefore);
    }
  });
});
