const { test, expect, _electron } = require('@playwright/test');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const path = require('path');
const os = require('os');
const fs = require('fs');

test.describe('Title Update Debug', () => {
  let electronApp;
  let window;
  let testDir;

  test.beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `notecove-title-debug-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Launch Electron app
    electronApp = await _electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        `--notes-path=${testDir}/.notecove`,
        `--instance=test-instance`,
      ],
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000); // Wait for app initialization
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should update title when typing', async () => {
    // Create new note - use sidebar button
    await window.locator('#newNoteBtn').click();
    await window.waitForTimeout(1000);

    // Get app state BEFORE typing
    const stateBefore = await window.evaluate(() => {
      return {
        isSettingContent: window.app.isSettingContent,
        currentNoteId: window.app.currentNote?.id,
        currentNoteTitle: window.app.currentNote?.title,
        editorReady: window.app.editor ? true : false
      };
    });
    console.log('State before typing:', stateBefore);

    // Type in editor
    const editor = window.locator('#editor .ProseMirror');
    await editor.click();
    await window.keyboard.type('My Test Title');

    // Wait for debounce
    await window.waitForTimeout(500);

    // Get app state AFTER typing
    const stateAfter = await window.evaluate(() => {
      return {
        isSettingContent: window.app.isSettingContent,
        currentNoteId: window.app.currentNote?.id,
        currentNoteTitle: window.app.currentNote?.title,
        editorText: window.app.editor ? window.app.editor.getText() : 'no editor',
        notesArrayTitle: window.app.notes.find(n => n.id === window.app.currentNote?.id)?.title
      };
    });
    console.log('State after typing:', stateAfter);

    // Check if title was updated
    expect(stateAfter.currentNoteTitle).toBe('My Test Title');
    expect(stateAfter.notesArrayTitle).toBe('My Test Title');

    // Check if sidebar shows updated title
    await expect(window.locator('.note-item .note-title').first()).toContainText('My Test Title');
  });
});
