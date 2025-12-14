/**
 * E2E tests for Markdown Import feature
 *
 * Tests importing markdown files into NoteCove via File menu.
 *
 * Note: We trigger the import dialog via direct IPC calls rather than keyboard
 * shortcuts because Playwright's keyboard.press() sends events to the renderer
 * process, not to Electron's native menu system. Menu accelerators are handled
 * at the OS level before reaching the renderer.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve } from 'path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Opens the import dialog by triggering the menu event via the main process
 */
async function openImportDialog(electronApp: ElectronApplication, page: Page): Promise<void> {
  // Send the menu:import-markdown event to all windows (since getFocusedWindow may not work in tests)
  await electronApp.evaluate(({ BrowserWindow }) => {
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      win.webContents.send('menu:import-markdown');
    }
  });
  await page.waitForTimeout(500);
}

let electronApp: ElectronApplication;
let page: Page;
let testUserDataDir: string;
let importDir: string;

test.beforeEach(async () => {
  const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

  // Create a unique temporary directory for this test's userData
  testUserDataDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-import-'));
  importDir = mkdtempSync(join(tmpdir(), 'notecove-e2e-import-source-'));
  console.log('[E2E Import] Launching Electron with userData at:', testUserDataDir);
  console.log('[E2E Import] Import source directory:', importDir);

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
}, 60000);

test.afterEach(async () => {
  await electronApp.close();

  // Clean up the temporary directories
  try {
    rmSync(testUserDataDir, { recursive: true, force: true });
    rmSync(importDir, { recursive: true, force: true });
    console.log('[E2E Import] Cleaned up test directories');
  } catch (err) {
    console.error('[E2E Import] Failed to clean up test directories:', err);
  }
});

test.describe('Markdown Import', () => {
  test('should import a single markdown file', async () => {
    // Create a test markdown file
    const testFilePath = join(importDir, 'test-note.md');
    writeFileSync(
      testFilePath,
      `# My Test Note

This is the content of my test note.

- Item 1
- Item 2
- Item 3
`
    );

    // Mock the import file dialog to return our test file
    await electronApp.evaluate(
      ({ dialog }, { filePath }) => {
        dialog.showOpenDialog = async () => {
          return { canceled: false, filePaths: [filePath] };
        };
      },
      { filePath: testFilePath }
    );

    // Open import dialog via IPC
    await openImportDialog(electronApp, page);

    // Wait for import dialog to open
    await page.waitForSelector('text=Import Markdown', { timeout: 5000 });

    // Click "Select File" button
    const selectFileButton = page.locator('button:has-text("Select File")');
    await selectFileButton.click();
    await page.waitForTimeout(1000);

    // Should now be on configure step - verify source info
    await expect(page.locator('text=1 markdown file found')).toBeVisible({ timeout: 5000 });

    // Click Import button
    const importButton = page.locator('button:has-text("Import 1 file")');
    await importButton.click();

    // Wait for import to complete
    await page.waitForSelector('text=Import Complete', { timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Successfully imported 1 note')).toBeVisible();

    // Close dialog
    const doneButton = page.locator('button:has-text("Done")');
    await doneButton.click();

    // Verify note appears in the notes list (use h6 selector to match title specifically)
    await page.waitForTimeout(1000);
    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList.locator('h6:has-text("My Test Note")')).toBeVisible({ timeout: 5000 });
  });

  test('should import a folder with multiple markdown files', async () => {
    // Create test markdown files in the import directory
    writeFileSync(
      join(importDir, 'note1.md'),
      `# First Note

Content of first note.
`
    );
    writeFileSync(
      join(importDir, 'note2.md'),
      `# Second Note

Content of second note.
`
    );
    writeFileSync(
      join(importDir, 'note3.md'),
      `# Third Note

Content of third note.
`
    );
    // Create a non-markdown file that should be ignored
    writeFileSync(join(importDir, 'readme.txt'), 'This should be ignored');

    // Mock the import folder dialog
    await electronApp.evaluate(
      ({ dialog }, { folderPath }) => {
        dialog.showOpenDialog = async () => {
          return { canceled: false, filePaths: [folderPath] };
        };
      },
      { folderPath: importDir }
    );

    // Open import dialog via IPC
    await openImportDialog(electronApp, page);

    // Wait for dialog
    await page.waitForSelector('text=Import Markdown', { timeout: 5000 });

    // Click "Select Folder" button
    const selectFolderButton = page.locator('button:has-text("Select Folder")');
    await selectFolderButton.click();
    await page.waitForTimeout(1000);

    // Should show 3 markdown files found (txt ignored)
    await expect(page.locator('text=3 markdown files found')).toBeVisible({ timeout: 5000 });

    // Click Import button
    const importButton = page.locator('button:has-text("Import 3 files")');
    await importButton.click();

    // Wait for import to complete
    await page.waitForSelector('text=Import Complete', { timeout: 15000 });

    // Verify success message
    await expect(page.locator('text=Successfully imported 3 notes')).toBeVisible();

    // Close dialog
    const doneButton = page.locator('button:has-text("Done")');
    await doneButton.click();

    // Verify notes appear in the notes list (use h6 selector to match title specifically)
    await page.waitForTimeout(1000);
    const notesList = page.locator('[data-testid="notes-list"]');
    await expect(notesList.locator('h6:has-text("First Note")')).toBeVisible({ timeout: 5000 });
    await expect(notesList.locator('h6:has-text("Second Note")')).toBeVisible();
    await expect(notesList.locator('h6:has-text("Third Note")')).toBeVisible();
  });

  test('should preserve folder structure when importing', async () => {
    // Create nested folder structure
    const docsDir = join(importDir, 'docs');
    const guidesDir = join(importDir, 'docs', 'guides');
    mkdirSync(docsDir);
    mkdirSync(guidesDir);

    writeFileSync(join(importDir, 'root.md'), '# Root Note\n\nRoot level note.');
    writeFileSync(join(docsDir, 'intro.md'), '# Introduction\n\nIntro doc.');
    writeFileSync(join(guidesDir, 'setup.md'), '# Setup Guide\n\nSetup instructions.');

    // Mock the import folder dialog
    await electronApp.evaluate(
      ({ dialog }, { folderPath }) => {
        dialog.showOpenDialog = async () => {
          return { canceled: false, filePaths: [folderPath] };
        };
      },
      { folderPath: importDir }
    );

    // Open import dialog via IPC
    await openImportDialog(electronApp, page);

    // Wait for dialog and select folder
    await page.waitForSelector('text=Import Markdown', { timeout: 5000 });
    const selectFolderButton = page.locator('button:has-text("Select Folder")');
    await selectFolderButton.click();
    await page.waitForTimeout(1000);

    // Should show 3 files
    await expect(page.locator('text=3 markdown files found')).toBeVisible({ timeout: 5000 });

    // Verify "Preserve folder structure" is checked by default
    const preserveCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(preserveCheckbox).toBeChecked();

    // Import
    const importButton = page.locator('button:has-text("Import 3 files")');
    await importButton.click();

    // Wait for completion
    await page.waitForSelector('text=Import Complete', { timeout: 15000 });

    // Should have created folders too
    await expect(page.locator('text=/2 folder/')).toBeVisible();

    // Close dialog
    const doneButton = page.locator('button:has-text("Done")');
    await doneButton.click();

    // Verify folders were created in sidebar
    await page.waitForTimeout(1000);
    const foldersList = page.locator('#left-panel');
    await expect(foldersList.locator('text=docs')).toBeVisible({ timeout: 5000 });
  });

  test('should cancel import operation', async () => {
    // Create a test file
    writeFileSync(join(importDir, 'test.md'), '# Test\n\nContent.');

    // Mock dialog
    await electronApp.evaluate(
      ({ dialog }, { filePath }) => {
        dialog.showOpenDialog = async () => {
          return { canceled: false, filePaths: [filePath] };
        };
      },
      { filePath: join(importDir, 'test.md') }
    );

    // Open import dialog via IPC
    await openImportDialog(electronApp, page);
    await page.waitForSelector('text=Import Markdown', { timeout: 5000 });

    // Select file
    const selectFileButton = page.locator('button:has-text("Select File")');
    await selectFileButton.click();
    await page.waitForTimeout(1000);

    // Cancel from configure screen
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Dialog should close
    await expect(page.locator('text=Import Markdown')).not.toBeVisible({ timeout: 3000 });
  });

  test('should handle dialog cancellation gracefully', async () => {
    // Mock dialog to return canceled
    await electronApp.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => {
        return { canceled: true, filePaths: [] };
      };
    });

    // Open import dialog via IPC
    await openImportDialog(electronApp, page);
    await page.waitForSelector('text=Import Markdown', { timeout: 5000 });

    // Click select file (dialog will be canceled)
    const selectFileButton = page.locator('button:has-text("Select File")');
    await selectFileButton.click();
    await page.waitForTimeout(500);

    // Should still be on select step (dialog was canceled)
    await expect(page.locator('text=Select a markdown file or folder')).toBeVisible();
  });
});
