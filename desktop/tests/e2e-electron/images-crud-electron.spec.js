import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

test.describe('Image CRUD Operations - Electron Mode (CRDT)', () => {
  let testDir;
  let electronApp;
  let window;

  // Simple 1x1 red pixel PNG as base64
  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  test.beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(os.tmpdir(), 'notecove-images-crud-test-' + Date.now());
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

  test('should persist image across app restarts', async () => {
    // Create a note with an image
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    // Add some text
    await editor.click();
    await window.keyboard.type('Note with Image');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);

    // Insert image programmatically
    const imageInserted = await window.evaluate((base64) => {
      try {
        const inserted = window.app.editor.editor.commands.insertContent({
          type: 'image',
          attrs: { src: base64 }
        });
        return { success: inserted };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, testImageBase64);

    expect(imageInserted.success).toBe(true);
    console.log('[Test] Image inserted:', imageInserted);

    await window.waitForTimeout(2000); // Wait for CRDT sync

    const noteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Verify image exists in editor
    const imageCount = await window.locator('#editor .ProseMirror img').count();
    expect(imageCount).toBe(1);

    console.log('[Test] Created note with image, ID:', noteId);

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

    // Open the note
    await window.click(`.note-item[data-note-id="${noteId}"]`);
    await window.waitForTimeout(1000);

    // Verify image persisted
    const imageCountAfterRestart = await window.locator('#editor .ProseMirror img').count();
    expect(imageCountAfterRestart).toBe(1);

    // Verify image src attribute
    const imageSrc = await window.locator('#editor .ProseMirror img').first().getAttribute('src');
    expect(imageSrc).toBeTruthy();
    expect(imageSrc).toContain('data:image');

    console.log('[Test] Image successfully persisted across restart');
  });

  test('should handle multiple images in a note', async () => {
    // Create note with multiple images
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.click();
    await window.keyboard.type('Multiple Images Test');
    await window.keyboard.press('Enter');

    // Insert first image
    await window.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
    }, testImageBase64);
    await window.waitForTimeout(500);

    await window.keyboard.press('Enter');

    // Insert second image
    await window.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
    }, testImageBase64);
    await window.waitForTimeout(500);

    await window.keyboard.press('Enter');

    // Insert third image
    await window.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
    }, testImageBase64);

    await window.waitForTimeout(2000);

    // Verify all three images exist
    const imageCount = await window.locator('#editor .ProseMirror img').count();
    expect(imageCount).toBe(3);

    console.log('[Test] Three images successfully added to note');
  });

  test('should sync images between instances', async () => {
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

    // Create note with image in instance 1
    await window1.click('#newNoteBtn');
    const editor1 = window1.locator('#editor .ProseMirror');
    await editor1.waitFor({ state: 'visible' });
    await window1.waitForTimeout(500);

    await editor1.click();
    await window1.keyboard.type('Synced Image Note');
    await window1.keyboard.press('Enter');

    await window1.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
    }, testImageBase64);

    await window1.waitForTimeout(2000);

    const noteId = await window1.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    console.log('[Test] Created note with image in instance 1, ID:', noteId);

    // Verify image in instance 1
    const imageCountInstance1 = await window1.locator('#editor .ProseMirror img').count();
    expect(imageCountInstance1).toBe(1);

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

    // Open note in instance 2
    await window2.click(`.note-item[data-note-id="${noteId}"]`);
    await window2.waitForTimeout(1000);

    // Verify image synced to instance 2
    const imageCountInstance2 = await window2.locator('#editor .ProseMirror img').count();
    expect(imageCountInstance2).toBe(1);

    // Verify image src
    const imageSrc2 = await window2.locator('#editor .ProseMirror img').first().getAttribute('src');
    expect(imageSrc2).toBeTruthy();
    expect(imageSrc2).toContain('data:image');

    console.log('[Test] Image successfully synced to instance 2');

    // Close both instances
    await app1.close();
    await app2.close();
  });

  test('should preserve note content when image is present', async () => {
    // Create note with text, image, and more text
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.click();
    await window.keyboard.type('Before Image');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    await window.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
    }, testImageBase64);
    await window.waitForTimeout(300);

    await window.keyboard.press('Enter');
    await window.keyboard.type('After Image');
    await window.waitForTimeout(2000);

    const noteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Verify all content exists
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Before Image');
    expect(editorContent).toContain('After Image');

    const imageCount = await window.locator('#editor .ProseMirror img').count();
    expect(imageCount).toBe(1);

    console.log('[Test] Note has text before and after image');

    // Switch to another note and back
    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    await window.click(`.note-item[data-note-id="${noteId}"]`);
    await window.waitForTimeout(500);

    // Verify content persisted
    const editorContentAfter = await editor.textContent();
    expect(editorContentAfter).toContain('Before Image');
    expect(editorContentAfter).toContain('After Image');

    const imageCountAfter = await window.locator('#editor .ProseMirror img').count();
    expect(imageCountAfter).toBe(1);

    console.log('[Test] Content and image persisted after note switch');
  });

  test('should handle image in note with other rich content', async () => {
    // Create note with various content types
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    await editor.click();
    await window.keyboard.type('Rich Content Note');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Some bold text');
    await window.keyboard.press('Enter');
    await window.keyboard.type('A list item');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    // Insert image
    await window.evaluate((base64) => {
      window.app.editor.editor.commands.insertContent({
        type: 'image',
        attrs: { src: base64 }
      });
    }, testImageBase64);
    await window.waitForTimeout(300);

    await window.keyboard.press('Enter');
    await window.keyboard.type('Text after image with #tag');
    await window.waitForTimeout(2000);

    // Verify image exists
    const imageCount = await window.locator('#editor .ProseMirror img').count();
    expect(imageCount).toBe(1);

    // Verify text content
    const content = await editor.textContent();
    expect(content).toContain('Rich Content Note');
    expect(content).toContain('Some bold text');
    expect(content).toContain('A list item');
    expect(content).toContain('Text after image with #tag');

    console.log('[Test] Image works correctly with other rich content');
  });
});
