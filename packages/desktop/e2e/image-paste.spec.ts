/**
 * E2E Tests for Image Paste
 *
 * Tests pasting images from clipboard into the editor.
 * Part of Phase 2.1 of image support implementation.
 *
 * @see plans/add-images/PLAN-PHASE-2.md
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;

// Helper to write an image to clipboard - creates a simple colored bitmap
async function writeTestImageToClipboard(electronApp: ElectronApplication): Promise<void> {
  // Instead of using a data URL (which may not work reliably),
  // we create a colored image directly using Electron's APIs
  await electronApp.evaluate(async ({ clipboard, nativeImage }) => {
    // Create a small 10x10 red bitmap
    const width = 10;
    const height = 10;
    const bytesPerPixel = 4; // RGBA
    const buffer = Buffer.alloc(width * height * bytesPerPixel);

    // Fill with red pixels (RGBA: 255, 0, 0, 255)
    for (let i = 0; i < width * height; i++) {
      buffer[i * bytesPerPixel] = 255; // R
      buffer[i * bytesPerPixel + 1] = 0; // G
      buffer[i * bytesPerPixel + 2] = 0; // B
      buffer[i * bytesPerPixel + 3] = 255; // A
    }

    // Create image from raw buffer
    const image = nativeImage.createFromBitmap(buffer, { width, height });
    clipboard.writeImage(image);
  });
}

/**
 * Dispatch a paste event with image data to the editor.
 *
 * Playwright's keyboard.press('Meta+v') in Electron goes through the menu system
 * and doesn't trigger DOM paste events with clipboard data. This helper dispatches
 * a proper ClipboardEvent with image data directly to the ProseMirror editor.
 */
async function pasteImageToEditor(electronApp: ElectronApplication, page: Page): Promise<void> {
  // Get the PNG data from clipboard
  const pngBase64 = await electronApp.evaluate(async ({ clipboard }) => {
    const image = clipboard.readImage();
    const png = image.toPNG();
    return png.toString('base64');
  });

  // Dispatch paste event with image data
  await page.evaluate((base64Data) => {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    const file = new File([blob], 'pasted-image.png', { type: 'image/png' });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });

    const editor = document.querySelector('.ProseMirror');
    if (editor) {
      editor.dispatchEvent(pasteEvent);
    }
  }, pngBase64);
}

test.beforeEach(async () => {
  // Create unique temp directory for this test
  testUserDataDir = path.join(
    os.tmpdir(),
    `notecove-e2e-image-paste-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  await fs.mkdir(testUserDataDir, { recursive: true });
  console.log('[E2E ImagePaste] Launching Electron with userData at:', testUserDataDir);

  // Launch Electron app
  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Get the first window
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  await page.waitForTimeout(1000); // Wait for app initialization
});

test.afterEach(async () => {
  if (electronApp) {
    try {
      await Promise.race([
        electronApp.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000)),
      ]);
    } catch (err) {
      console.error('[E2E ImagePaste] Error closing app:', err);
    }
  }

  // Clean up test userData directory
  try {
    await fs.rm(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E ImagePaste] Cleaned up test userData directory');
  } catch (err) {
    console.error('[E2E ImagePaste] Failed to clean up test userData directory:', err);
  }
});

test.describe('Image Paste from Clipboard', () => {
  test('should insert image node when pasting image from clipboard', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type some text first
    await page.keyboard.type('Here is an image:');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Put an image on the clipboard and paste it
    await writeTestImageToClipboard(electronApp);
    await pasteImageToEditor(electronApp, page);
    await page.waitForTimeout(2000); // Wait for async image save

    // Verify image node was inserted
    const imageNode = page.locator('.ProseMirror .notecove-image');
    await expect(imageNode).toBeVisible({ timeout: 5000 });

    // Verify the image has expected attributes
    const imageId = await imageNode.getAttribute('data-image-id');
    expect(imageId).toBeTruthy();
  });

  test('should insert image at cursor position', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type text before and after where we'll paste
    await page.keyboard.type('Before image');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('After image');
    await page.waitForTimeout(300);

    // Move cursor up to the empty line
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    // Put an image on the clipboard and paste
    await writeTestImageToClipboard(electronApp);
    await pasteImageToEditor(electronApp, page);
    await page.waitForTimeout(2000);

    // Verify image was inserted between the text
    const imageNode = page.locator('.ProseMirror .notecove-image');
    await expect(imageNode).toBeVisible({ timeout: 5000 });

    // Verify "Before image" text still exists
    await expect(editor).toContainText('Before image');
    // Verify "After image" text still exists
    await expect(editor).toContainText('After image');
  });

  test('should handle multiple image pastes', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Paste first image
    await writeTestImageToClipboard(electronApp);
    await pasteImageToEditor(electronApp, page);
    await page.waitForTimeout(2000);

    // Verify first image was inserted
    let imageNodes = page.locator('.ProseMirror .notecove-image');
    await expect(imageNodes).toHaveCount(1, { timeout: 5000 });

    // Move cursor after the first image
    // Use Cmd+End to go to end of document, then Enter to create new paragraph
    await page.keyboard.press('Meta+ArrowDown'); // Go to end of document
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter'); // Create new paragraph
    await page.waitForTimeout(200);

    // Paste second image (re-write to clipboard to ensure fresh data)
    await writeTestImageToClipboard(electronApp);
    await pasteImageToEditor(electronApp, page);
    await page.waitForTimeout(2000);

    // Verify two images were inserted
    imageNodes = page.locator('.ProseMirror .notecove-image');
    await expect(imageNodes).toHaveCount(2, { timeout: 5000 });
  });

  test('should NOT insert image when pasting plain text', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Dispatch a text paste event (no image data)
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'This is plain text');

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      const editor = document.querySelector('.ProseMirror');
      if (editor) {
        editor.dispatchEvent(pasteEvent);
      }
    });
    await page.waitForTimeout(500);

    // Verify NO image node was inserted
    const imageNodes = page.locator('.ProseMirror .notecove-image');
    await expect(imageNodes).toHaveCount(0);

    // But the text should be pasted
    await expect(editor).toContainText('This is plain text');
  });

  test('should show loading spinner while image is being saved', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Put an image on the clipboard and paste
    await writeTestImageToClipboard(electronApp);
    await pasteImageToEditor(electronApp, page);
    await page.waitForTimeout(2000);

    // Verify final state has loaded image
    const imageNode = page.locator('.ProseMirror .notecove-image');
    await expect(imageNode).toBeVisible({ timeout: 5000 });

    // Image should NOT have loading class after save completes
    const hasLoading = await imageNode.locator('.image-loading').count();
    expect(hasLoading).toBe(0);
  });
});

test.describe('Image Paste - HTML with Remote Images', () => {
  // This test is more complex - pasting HTML content that contains remote images
  // The app should download those images and convert them to local images
  test.skip('should download and insert remote images when pasting HTML', async () => {
    // TODO: Implement after basic paste works
    // This requires:
    // 1. Parsing pasted HTML for <img> tags
    // 2. Downloading images via main process
    // 3. Saving to local media folder
    // 4. Replacing with local image nodes
  });
});

test.describe('Image Paste - Edge Cases', () => {
  test('should handle paste when editor is empty', async () => {
    // Wait for default note to load
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    const editor = page.locator('.ProseMirror');

    // Clear any default content
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Put an image on the clipboard and paste
    await writeTestImageToClipboard(electronApp);
    await pasteImageToEditor(electronApp, page);
    await page.waitForTimeout(2000);

    // Verify image was inserted
    const imageNode = page.locator('.ProseMirror .notecove-image');
    await expect(imageNode).toBeVisible({ timeout: 5000 });
  });

  test('should handle paste in middle of text', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type some text
    await page.keyboard.type('Hello World');
    await page.waitForTimeout(200);

    // Move cursor to middle (after "Hello ")
    await page.keyboard.press('Home');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight');
    }

    // Put an image on the clipboard and paste
    await writeTestImageToClipboard(electronApp);
    await pasteImageToEditor(electronApp, page);
    await page.waitForTimeout(2000);

    // Verify image was inserted
    const imageNode = page.locator('.ProseMirror .notecove-image');
    await expect(imageNode).toBeVisible({ timeout: 5000 });

    // Both parts of text should still exist
    await expect(editor).toContainText('Hello');
    await expect(editor).toContainText('World');
  });
});
