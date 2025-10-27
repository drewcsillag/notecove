/**
 * Note Switching E2E Tests
 *
 * Tests for bugs found in Phase 2.5.2:
 * 1. Title updates when editing notes
 * 2. Content persists when switching between notes
 * 3. Multi-window: switching away from note in one window doesn't clear it in other windows
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve } from 'path';

let electronApp: ElectronApplication;
let window1: Page;

test.describe('Note Switching', () => {
  test.beforeAll(async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
    console.log('[Note Switching E2E] Launching Electron with main process at:', mainPath);

    electronApp = await electron.launch({
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
      timeout: 60000,
    });

    // Get the first window
    window1 = await electronApp.firstWindow();

    // Listen to console messages
    window1.on('console', (msg) => {
      console.log('[Window1]:', msg.text());
    });

    await window1.waitForSelector('body', { timeout: 10000 });
    console.log('[Note Switching E2E] Window loaded');

    // Wait for app to be ready
    await window1.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    console.log('[Note Switching E2E] Closing Electron app');
    await electronApp.close();
  });

  test('should update note title when editing', async () => {
    console.log('[Test] Starting title update test');

    // Create a new note
    const createButton = window1.getByTitle('Create note');
    await createButton.click();
    await window1.waitForTimeout(500);

    // Type some content with a title
    const editor = window1.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Test Title\nThis is the content');
    await window1.waitForTimeout(1000);

    // Check that the title appears in the notes list
    const middlePanel = window1.locator('#middle-panel');
    const notesList = middlePanel.locator('text=Test Title').first();
    await expect(notesList).toBeVisible({ timeout: 5000 });

    // Edit the title
    await editor.click();
    await window1.keyboard.press('Home'); // Go to start of document
    await window1.keyboard.press('Control+A'); // Select first line
    await editor.fill('Updated Title\nThis is the content');
    await window1.waitForTimeout(1000);

    // Check that the updated title appears in the notes list
    const updatedTitle = middlePanel.locator('text=Updated Title').first();
    await expect(updatedTitle).toBeVisible({ timeout: 5000 });

    console.log('[Test] Title update test passed');
  });

  test('should preserve note content when switching away and back', async () => {
    console.log('[Test] Starting content persistence test');

    // Create first note with content
    const createButton = window1.getByTitle('Create note');
    await createButton.click();
    await window1.waitForTimeout(500);

    const editor = window1.locator('.ProseMirror');
    await editor.click();
    const firstNoteContent = 'First Note Content\nThis should persist';
    await editor.fill(firstNoteContent);
    await window1.waitForTimeout(1000);

    // Create second note
    await createButton.click();
    await window1.waitForTimeout(500);

    await editor.click();
    await editor.fill('Second Note Content');
    await window1.waitForTimeout(1000);

    // Click back to first note
    const firstNoteButton = window1.locator('text=First Note Content').first();
    await firstNoteButton.click();
    await window1.waitForTimeout(1000);

    // Verify first note content is still there
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('First Note Content');
    expect(editorContent).toContain('This should persist');

    console.log('[Test] Content persistence test passed');
  });
});

test.describe('Note Switching - Multi-Window', () => {
  let window2: Page;

  test.beforeAll(async () => {
    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');
    console.log('[Multi-Window E2E] Launching Electron with main process at:', mainPath);

    electronApp = await electron.launch({
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
      timeout: 60000,
    });

    // Get the first window
    window1 = await electronApp.firstWindow();
    window1.on('console', (msg) => {
      console.log('[Window1]:', msg.text());
    });

    await window1.waitForSelector('body', { timeout: 10000 });
    await window1.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    console.log('[Multi-Window E2E] Closing Electron app');
    await electronApp.close();
  });

  test('should not clear content in window 2 when switching away in window 1', async () => {
    console.log('[Test] Starting multi-window content persistence test');

    // Create a note in window 1
    const createButton1 = window1.getByTitle('Create note');
    await createButton1.click();
    await window1.waitForTimeout(500);

    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();
    const noteContent = 'Multi-Window Test Content\nShould persist across windows';
    await editor1.fill(noteContent);
    await window1.waitForTimeout(1000);

    // Open a second window using the test window creation
    await window1.evaluate(() => {
      (window as any).electronAPI.testing.createWindow();
    });
    await window1.waitForTimeout(2000);

    // Get the second window
    const windows = electronApp.windows();
    window2 = windows[windows.length - 1];

    window2.on('console', (msg) => {
      console.log('[Window2]:', msg.text());
    });

    await window2.waitForSelector('body', { timeout: 10000 });
    await window2.waitForTimeout(1000);

    // Click the note in window 2 to load it
    const noteButton2 = window2.locator('text=Multi-Window Test Content').first();
    await noteButton2.click();
    await window2.waitForTimeout(1000);

    // Verify content is visible in window 2
    const editor2 = window2.locator('.ProseMirror');
    let content2 = await editor2.textContent();
    expect(content2).toContain('Multi-Window Test Content');

    // Create another note in window 1 (switches away from the first note)
    await createButton1.click();
    await window1.waitForTimeout(500);
    await editor1.click();
    await editor1.fill('Different Note');
    await window1.waitForTimeout(2000);

    // Verify content is STILL visible in window 2
    content2 = await editor2.textContent();
    expect(content2).toContain('Multi-Window Test Content');
    expect(content2).toContain('Should persist across windows');

    console.log('[Test] Multi-window content persistence test passed');
  });
});
