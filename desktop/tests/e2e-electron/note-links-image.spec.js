import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Test directory for isolated test instances
const TEST_DIR = path.join(os.tmpdir(), 'notecove-electron-image-test-' + Date.now());

test.describe('Note Links with Images - Electron Mode', () => {
  test.beforeAll(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean up test directory:', err);
    }
  });

  test('should preserve images when updating link text', async () => {
    // Launch Electron app
    const electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'dist/main.js'),
        '--user-data-dir=' + path.join(TEST_DIR, 'user-data'),
        '--notes-path=' + path.join(TEST_DIR, 'notes'),
        '--instance=test'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);

    // Create target note
    await window.click('#newNoteBtn');
    const editor = window.locator('#editor .ProseMirror');
    await editor.waitFor({ state: 'visible' });
    await window.waitForTimeout(500);

    // Type target note content
    await editor.fill('Target Note\n\nTarget content here');
    await window.waitForTimeout(1500); // Wait for CRDT sync

    // Get the target note ID
    const targetNoteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Create source note with image and link
    await window.keyboard.press('Control+n');
    await window.waitForTimeout(500);

    // Type the content to trigger input rules
    await editor.type('Source Note with Image');
    await window.keyboard.press('Enter');
    await window.keyboard.press('Enter');

    // Add an image (simulate pasting an image)
    const testImagePath = path.join(process.cwd(), 'tests', 'fixtures', 'test-image.png');

    // Check if test image exists, if not create a simple one
    try {
      await fs.access(testImagePath);
    } catch {
      // Create fixtures directory
      await fs.mkdir(path.join(process.cwd(), 'tests', 'fixtures'), { recursive: true });
      // Create a simple 1x1 PNG (smallest valid PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      await fs.writeFile(testImagePath, pngBuffer);
    }

    // Insert image using the upload button
    const imageFile = await window.evaluateHandle(async (imagePath) => {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const file = new File([blob], 'test-image.png', { type: 'image/png' });
      return file;
    }, `file://${testImagePath}`);

    // Trigger image upload
    await window.evaluate(() => {
      const event = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer()
      });
      document.querySelector('#editor .ProseMirror')?.dispatchEvent(event);
    });

    // Alternative: Insert image via toolbar if available
    const imageButton = window.locator('[data-testid="image-button"], button[title*="Image"], button[title*="image"]');
    const imageButtonExists = await imageButton.count() > 0;

    if (imageButtonExists) {
      await imageButton.click();
      await window.waitForTimeout(500);
      // Handle file picker if it opens
    } else {
      // Manually insert image HTML for testing
      await window.evaluate((imgPath) => {
        const editor = document.querySelector('#editor .ProseMirror');
        if (editor) {
          const img = document.createElement('img');
          img.src = imgPath;
          img.setAttribute('data-test-image', 'true');
          editor.appendChild(img);
        }
      }, `file://${testImagePath}`);
    }

    await window.waitForTimeout(1000);

    // Add link after the image
    await window.keyboard.press('Enter');
    await editor.type('Link to: [[Target Note]]');
    await window.waitForTimeout(1500); // Wait for link creation and CRDT sync

    // Count elements before rename
    const beforeCounts = await window.evaluate(() => {
      const editor = document.querySelector('#editor .ProseMirror');
      return {
        images: editor?.querySelectorAll('img').length || 0,
        links: editor?.querySelectorAll('[data-note-link]').length || 0,
        editorHTML: editor?.innerHTML
      };
    });

    console.log('[Test] Before rename - images:', beforeCounts.images, 'links:', beforeCounts.links);
    console.log('[Test] Editor HTML before:', beforeCounts.editorHTML);

    expect(beforeCounts.images).toBeGreaterThan(0);
    expect(beforeCounts.links).toBe(1);

    // Get source note ID
    const sourceNoteId = await window.evaluate(() => {
      const activeNote = document.querySelector('.note-item.active');
      return activeNote?.getAttribute('data-note-id');
    });

    // Switch to target note and rename it
    await window.click(`.note-item[data-note-id="${targetNoteId}"]`);
    await window.waitForTimeout(500);

    // Rename the target note
    await editor.fill('Renamed Target\n\nTarget content here');
    await window.waitForTimeout(2000); // Wait for CRDT update and link text updates

    console.log('[Test] Target note renamed to "Renamed Target"');

    // Switch back to source note
    await window.click(`.note-item[data-note-id="${sourceNoteId}"]`);
    await window.waitForTimeout(500);

    // Count elements after rename
    const afterCounts = await window.evaluate(() => {
      const editor = document.querySelector('#editor .ProseMirror');
      return {
        images: editor?.querySelectorAll('img').length || 0,
        links: editor?.querySelectorAll('[data-note-link]').length || 0,
        editorHTML: editor?.innerHTML
      };
    });

    console.log('[Test] After rename - images:', afterCounts.images, 'links:', afterCounts.links);
    console.log('[Test] Editor HTML after:', afterCounts.editorHTML);

    // Verify the link text has been updated
    const updatedLinkData = await window.evaluate(() => {
      const link = document.querySelector('#editor span[data-note-link]');
      return link ? {
        text: link.textContent,
        title: link.getAttribute('data-note-title')
      } : null;
    });

    console.log('[Test] Updated link data:', updatedLinkData);

    // Assertions
    expect(updatedLinkData).not.toBeNull();
    expect(updatedLinkData.text).toBe('Renamed Target');
    expect(updatedLinkData.title).toBe('Renamed Target');

    // Critical: Images should still be present
    expect(afterCounts.images).toBe(beforeCounts.images);
    expect(afterCounts.links).toBe(1);

    // Close the app
    await electronApp.close();
  });
});
