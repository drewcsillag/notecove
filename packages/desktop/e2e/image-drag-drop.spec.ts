/**
 * E2E Tests for Image Drag and Drop
 *
 * Tests dragging image files from the file system into the editor.
 * Part of Phase 2.2 of image support implementation.
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
let testImageDir: string;

/**
 * Create a test PNG image file in the test directory.
 * Creates a simple 10x10 red bitmap as a PNG file.
 */
async function createTestImageFile(
  electronApp: ElectronApplication,
  filename: string
): Promise<string> {
  const imagePath = path.join(testImageDir, filename);

  // Create image using Electron's nativeImage
  const pngBuffer = await electronApp.evaluate(async ({ nativeImage }) => {
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

    // Create image from raw buffer and convert to PNG
    const image = nativeImage.createFromBitmap(buffer, { width, height });
    return image.toPNG().toString('base64');
  });

  // Write the PNG file
  const pngData = Buffer.from(pngBuffer, 'base64');
  await fs.writeFile(imagePath, pngData);

  return imagePath;
}

/**
 * Dispatch a drop event with file data to the editor.
 *
 * Playwright doesn't support native file drag-drop into Electron windows,
 * so we simulate it by dispatching a DragEvent with file data.
 *
 * We dispatch the full drag sequence (dragenter, dragover, drop) because
 * some browsers and ProseMirror may require the proper lifecycle.
 */
async function dropImageToEditor(page: Page, imagePath: string, imageData: Buffer): Promise<void> {
  const filename = path.basename(imagePath);
  const base64Data = imageData.toString('base64');

  await page.evaluate(
    ({ base64, name }) => {
      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create a File object
      const blob = new Blob([bytes], { type: 'image/png' });
      const file = new File([blob], name, { type: 'image/png' });

      // Create a DataTransfer
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const editor = document.querySelector('.ProseMirror');
      if (!editor) {
        console.error('[Test] Editor not found');
        return;
      }

      // Dispatch drag sequence: dragenter -> dragover -> drop
      // Some browsers/frameworks require the full sequence

      const dragEnterEvent = new DragEvent('dragenter', {
        dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(dragEnterEvent);

      const dragOverEvent = new DragEvent('dragover', {
        dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(dragOverEvent);

      // Small delay to let dragover complete, then dispatch drop
      setTimeout(() => {
        const dropEvent = new DragEvent('drop', {
          dataTransfer,
          bubbles: true,
          cancelable: true,
        });
        console.log('[Test] Dispatching drop event with file:', name, 'type:', file.type);
        editor.dispatchEvent(dropEvent);
      }, 50);
    },
    { base64: base64Data, name: filename }
  );

  // Wait for the timeout inside evaluate to complete
  await page.waitForTimeout(100);
}

test.beforeEach(async () => {
  // Create unique temp directory for this test
  testUserDataDir = path.join(
    os.tmpdir(),
    `notecove-e2e-image-drop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  testImageDir = path.join(testUserDataDir, 'test-images');
  await fs.mkdir(testImageDir, { recursive: true });
  console.log('[E2E ImageDragDrop] Launching Electron with userData at:', testUserDataDir);

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
      console.error('[E2E ImageDragDrop] Error closing app:', err);
    }
  }

  // Clean up test directories
  try {
    await fs.rm(testUserDataDir, { recursive: true, force: true });
    console.log('[E2E ImageDragDrop] Cleaned up test directories');
  } catch (err) {
    console.error('[E2E ImageDragDrop] Failed to clean up test directories:', err);
  }
});

test.describe('Image Drag and Drop from File System', () => {
  test('should insert image node when dropping image file into editor', async () => {
    // Capture console logs from the page
    page.on('console', (msg) => {
      console.log('[PAGE]', msg.type(), msg.text());
    });

    // Create a test image file
    const imagePath = await createTestImageFile(electronApp, 'test-drop.png');
    const imageData = await fs.readFile(imagePath);

    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Type some text first
    await page.keyboard.type('Here is a dropped image:');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Drop the image
    await dropImageToEditor(page, imagePath, imageData);
    await page.waitForTimeout(2000); // Wait for async image save

    // Verify image node was inserted
    const imageNode = page.locator('.ProseMirror .notecove-image');
    await expect(imageNode).toBeVisible({ timeout: 5000 });

    // Verify the image has expected attributes
    const imageId = await imageNode.getAttribute('data-image-id');
    expect(imageId).toBeTruthy();
  });

  test('should handle multiple dropped images', async () => {
    // Create test image files
    const imagePath1 = await createTestImageFile(electronApp, 'test-drop-1.png');
    const imagePath2 = await createTestImageFile(electronApp, 'test-drop-2.png');
    const imageData1 = await fs.readFile(imagePath1);
    const imageData2 = await fs.readFile(imagePath2);

    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Drop first image
    await dropImageToEditor(page, imagePath1, imageData1);
    await page.waitForTimeout(2000);

    // Verify first image was inserted
    let imageNodes = page.locator('.ProseMirror .notecove-image');
    await expect(imageNodes).toHaveCount(1, { timeout: 5000 });

    // Move cursor after first image
    await page.keyboard.press('Meta+ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Drop second image
    await dropImageToEditor(page, imagePath2, imageData2);
    await page.waitForTimeout(2000);

    // Verify two images were inserted
    imageNodes = page.locator('.ProseMirror .notecove-image');
    await expect(imageNodes).toHaveCount(2, { timeout: 5000 });
  });

  test('should NOT insert image when dropping non-image file', async () => {
    // Create a new note
    await page.click('button[title="Create note"]');
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Drop a non-image file (simulate text file)
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      const textFile = new File(['This is plain text content'], 'test.txt', {
        type: 'text/plain',
      });
      dataTransfer.items.add(textFile);

      const dropEvent = new DragEvent('drop', {
        dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      const editorEl = document.querySelector('.ProseMirror');
      if (editorEl) {
        editorEl.dispatchEvent(dropEvent);
      }
    });
    await page.waitForTimeout(500);

    // Verify NO image node was inserted
    const imageNodes = page.locator('.ProseMirror .notecove-image');
    await expect(imageNodes).toHaveCount(0);
  });

  test('should handle drop when editor is empty', async () => {
    // Create a test image file
    const imagePath = await createTestImageFile(electronApp, 'test-empty-drop.png');
    const imageData = await fs.readFile(imagePath);

    // Wait for default note to load
    await page.waitForSelector('.ProseMirror', { timeout: 10000 });
    const editor = page.locator('.ProseMirror');

    // Clear any default content
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Drop the image
    await dropImageToEditor(page, imagePath, imageData);
    await page.waitForTimeout(2000);

    // Verify image was inserted
    const imageNode = page.locator('.ProseMirror .notecove-image');
    await expect(imageNode).toBeVisible({ timeout: 5000 });
  });

  test('should handle drop in middle of text', async () => {
    // Create a test image file
    const imagePath = await createTestImageFile(electronApp, 'test-middle-drop.png');
    const imageData = await fs.readFile(imagePath);

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

    // Drop the image
    await dropImageToEditor(page, imagePath, imageData);
    await page.waitForTimeout(2000);

    // Verify image was inserted
    const imageNode = page.locator('.ProseMirror .notecove-image');
    await expect(imageNode).toBeVisible({ timeout: 5000 });

    // Both parts of text should still exist
    await expect(editor).toContainText('Hello');
    await expect(editor).toContainText('World');
  });
});

test.describe('Image Drag and Drop - Visual Feedback', () => {
  test.skip('should show drag-over visual feedback', async () => {
    // TODO: This test requires implementing visual drag feedback
    // Currently skipped until CSS drag-over styles are added
  });
});
