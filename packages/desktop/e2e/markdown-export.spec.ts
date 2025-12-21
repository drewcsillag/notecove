/**
 * E2E tests for Markdown Export feature
 *
 * Tests exporting notes to markdown format via context menu.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve } from 'path';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;
let exportDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-export-'));
  exportDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-export-output-'));
  console.log('[E2E Export] Launching Electron with userData at:', testUserDataDir);
  console.log('[E2E Export] Export directory:', exportDir);

  electronApp = await electron.launch({
    args: [mainPath, `--user-data-dir=${testUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  page = await electronApp.firstWindow();

  // Capture renderer console logs
  page.on('console', (msg) => {
    console.log('[Renderer Console]:', msg.text());
  });

  // Wait for app to be ready
  await page.waitForSelector('text=Folders', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Mock Electron dialogs at the main process level
  await electronApp.evaluate(
    ({ dialog }, { exportPath }) => {
      // Mock showOpenDialog to auto-select our export directory
      dialog.showOpenDialog = async () => {
        return { canceled: false, filePaths: [exportPath] };
      };
      // Mock showMessageBox to auto-dismiss completion messages
      dialog.showMessageBox = async () => {
        return { response: 0, checkboxChecked: false };
      };
    },
    { exportPath: exportDir }
  );
}, 60000);

test.afterEach(async () => {
  await electronApp.close();

  // Clean up the temporary directories
  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    rmSync(exportDir, { recursive: true, force: true });
    console.log('[E2E Export] Cleaned up test directories');
  } catch (err) {
    console.error('[E2E Export] Failed to clean up test directories:', err);
  }
});

test.describe('Markdown Export - Context Menu', () => {
  test('should show "Export to Markdown" option in context menu', async () => {
    // Create a note first
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Right-click the note
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Look for "Export to Markdown" option
    const exportOption = page.locator('[role="menuitem"]:has-text("Export to Markdown")');
    await expect(exportOption).toBeVisible();

    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should export single note to markdown file via context menu', async () => {
    // Create a note with specific content
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    // Add content to the note
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Test Export Note');
    await editor.press('Enter');
    await editor.type('This is the content of my test note.');
    await page.waitForTimeout(1500); // Wait for title extraction

    // Right-click and export
    const notesList = page.locator('#middle-panel [data-testid="notes-list"]');
    const firstNote = notesList.locator('li').first();
    await firstNote.click({ button: 'right' });
    await page.waitForTimeout(500);

    const exportOption = page.locator('[role="menuitem"]:has-text("Export to Markdown")');
    await exportOption.click();

    // Wait for export to complete
    await page.waitForTimeout(3000);

    // Verify file was created
    const files = readdirSync(exportDir).filter((f) => f.endsWith('.md'));
    console.log('[E2E Export] Files created:', files);
    expect(files.length).toBeGreaterThanOrEqual(1);

    // Verify content
    const content = readFileSync(join(exportDir, files[0]), 'utf-8');
    expect(content).toContain('Test Export Note');
    expect(content).toContain('This is the content of my test note.');
  });

  test('should show multi-note export option when multiple notes selected', async () => {
    // Create first note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(500);

    let editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('First Note Title');
    await page.waitForTimeout(1000);

    // Create second note
    await createButton.click();
    await page.waitForTimeout(500);

    editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Second Note Title');
    await page.waitForTimeout(1000);

    // Multi-select both notes using Cmd/Ctrl+Click on each
    const notesList = page.locator('[data-testid="notes-list"]');
    const notes = notesList.locator('.MuiListItemButton-root');

    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

    // Cmd/Ctrl+Click first note
    await notes.nth(0).click({ modifiers: [modifier] });
    await page.waitForTimeout(300);

    // Cmd/Ctrl+Click second note
    await notes.nth(1).click({ modifiers: [modifier] });
    await page.waitForTimeout(500);

    // Should show selection badge
    const selectionBadge = page.locator('text=/2 notes selected/');
    await expect(selectionBadge).toBeVisible({ timeout: 5000 });

    // Right-click to see context menu
    await notes.first().click({ button: 'right' });
    await page.waitForTimeout(500);

    // Menu should show "Export 2 notes to Markdown"
    const exportOption = page.locator('[role="menuitem"]:has-text("Export 2 notes to Markdown")');
    await expect(exportOption).toBeVisible();

    // Close menu
    await page.keyboard.press('Escape');
  });

  test('should export multiple selected notes', async () => {
    // Create first note
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(500);

    let editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('First Export Note');
    await page.waitForTimeout(1000);

    // Create second note
    await createButton.click();
    await page.waitForTimeout(500);

    editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Second Export Note');
    await page.waitForTimeout(1000);

    // Multi-select both notes
    const notesList = page.locator('[data-testid="notes-list"]');
    const notes = notesList.locator('.MuiListItemButton-root');
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

    await notes.nth(0).click({ modifiers: [modifier] });
    await page.waitForTimeout(300);
    await notes.nth(1).click({ modifiers: [modifier] });
    await page.waitForTimeout(500);

    // Right-click and export
    await notes.first().click({ button: 'right' });
    await page.waitForTimeout(500);

    const exportOption = page.locator('[role="menuitem"]:has-text("Export")').first();
    await exportOption.click();

    // Wait for export to complete
    await page.waitForTimeout(3000);

    // Verify files were created
    const files = readdirSync(exportDir).filter((f) => f.endsWith('.md'));
    console.log('[E2E Export] Files created:', files);
    expect(files.length).toBeGreaterThanOrEqual(2);

    // Verify both notes were exported
    const allContent = files.map((f) => readFileSync(join(exportDir, f), 'utf-8')).join('\n');
    expect(allContent).toContain('First Export Note');
    expect(allContent).toContain('Second Export Note');
  });
});

test.describe('Markdown Export - File Menu', () => {
  test('should export all notes via File menu "Export All Notes to Markdown..."', async () => {
    // Create first note with specific content
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    let editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('First Menu Export Note');
    await editor.press('Enter');
    await editor.type('Content of the first note.');
    await page.waitForTimeout(1500);

    // Create second note with specific content
    await createButton.click();
    await page.waitForTimeout(1000);

    editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Second Menu Export Note');
    await editor.press('Enter');
    await editor.type('Content of the second note.');
    await page.waitForTimeout(1500);

    // Click "Export All Notes to Markdown..." from File menu
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      if (!menu) throw new Error('No application menu found');
      const fileMenu = menu.items.find((item) => item.label === 'File');
      if (!fileMenu || !fileMenu.submenu) throw new Error('File menu not found');
      const exportAllItem = fileMenu.submenu.items.find(
        (item) => item.label === 'Export All Notes to Markdown...'
      );
      if (!exportAllItem) throw new Error('Export All Notes menu item not found');
      if (exportAllItem.click) {
        exportAllItem.click({}, undefined as any, undefined as any);
      }
    });

    // Wait for export to complete
    await page.waitForTimeout(4000);

    // Verify files were created
    const files = readdirSync(exportDir).filter((f) => f.endsWith('.md'));
    console.log('[E2E Export] Files created via File menu:', files);
    expect(files.length).toBeGreaterThanOrEqual(2);

    // Verify both notes were exported
    const allContent = files.map((f) => readFileSync(join(exportDir, f), 'utf-8')).join('\n');
    expect(allContent).toContain('First Menu Export Note');
    expect(allContent).toContain('Second Menu Export Note');
    expect(allContent).toContain('Content of the first note.');
    expect(allContent).toContain('Content of the second note.');
  });

  test('should export notes from folder when viewing a specific folder', async () => {
    // Create a folder first
    const folderPanel = page.locator('#left-panel');
    const createFolderButton = folderPanel.locator('button[title="Create folder"]');
    await createFolderButton.click();
    await page.waitForTimeout(500);

    // Name the folder
    const folderNameInput = page.locator('input[placeholder*="folder"]').first();
    await folderNameInput.fill('Test Export Folder');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Click on the folder to select it
    const testFolder = folderPanel.locator('text=Test Export Folder');
    await testFolder.click();
    await page.waitForTimeout(500);

    // Create a note in this folder
    const createButton = page.locator('#middle-panel button[title="Create note"]');
    await createButton.click();
    await page.waitForTimeout(1000);

    const editor = page.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('Note in Folder');
    await editor.press('Enter');
    await editor.type('This note is inside the Test Export Folder.');
    await page.waitForTimeout(1500);

    // Click "Export All Notes to Markdown..." from File menu
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      if (!menu) throw new Error('No application menu found');
      const fileMenu = menu.items.find((item) => item.label === 'File');
      if (!fileMenu || !fileMenu.submenu) throw new Error('File menu not found');
      const exportAllItem = fileMenu.submenu.items.find(
        (item) => item.label === 'Export All Notes to Markdown...'
      );
      if (!exportAllItem) throw new Error('Export All Notes menu item not found');
      if (exportAllItem.click) {
        exportAllItem.click({}, undefined as any, undefined as any);
      }
    });

    // Wait for export to complete
    await page.waitForTimeout(4000);

    // Verify files were created (should include the note in folder)
    const files = readdirSync(exportDir).filter((f) => f.endsWith('.md'));
    console.log('[E2E Export] Files created via File menu from folder view:', files);
    expect(files.length).toBeGreaterThanOrEqual(1);

    // Check that folder structure was created
    const exportDirContents = readdirSync(exportDir);
    console.log('[E2E Export] Export directory contents:', exportDirContents);

    // The note should be exported (either in folder or at root depending on implementation)
    const allContent = files.map((f) => readFileSync(join(exportDir, f), 'utf-8')).join('\n');
    expect(allContent).toContain('Note in Folder');
    expect(allContent).toContain('This note is inside the Test Export Folder.');
  });
});
