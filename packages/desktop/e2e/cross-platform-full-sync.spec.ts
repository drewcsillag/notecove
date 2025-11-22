/**
 * Comprehensive Cross-Platform Sync E2E Test
 *
 * This test verifies bidirectional sync between Desktop and iOS:
 * 1. Desktop creates note → iOS discovers it
 * 2. iOS creates note → Desktop discovers it
 * 3. Desktop edits iOS note → iOS sees changes
 * 4. iOS edits Desktop note → Desktop sees changes
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Shared storage directory that both Desktop and iOS can access
const SHARED_SD_PATH = '/tmp/notecove-cross-platform-e2e-test';

// Test timeout - cross-platform tests need more time
const TEST_TIMEOUT = 120000; // 2 minutes

test.describe('Cross-Platform Full Sync', () => {
  let desktopApp: ElectronApplication;
  let desktopWindow: Page;
  let iosProcess: ChildProcess;
  let desktopInstanceId: string;
  let iosNoteId: string;
  let desktopNoteId: string;

  test.beforeAll(async () => {
    // Clean up shared directory
    await fs.rm(SHARED_SD_PATH, { recursive: true, force: true });
    await fs.mkdir(SHARED_SD_PATH, { recursive: true });

    console.log('[Test] Using shared SD:', SHARED_SD_PATH);
  });

  test.afterAll(async () => {
    // Cleanup
    if (desktopApp) {
      await desktopApp.close();
    }
    if (iosProcess) {
      iosProcess.kill();
    }
    // Keep the directory for debugging - comment out if needed
    // await fs.rm(SHARED_SD_PATH, { recursive: true, force: true });
  });

  test('bidirectional sync between Desktop and iOS', { timeout: TEST_TIMEOUT }, async () => {
    //
    // SETUP: Launch both apps
    //
    console.log('[Test] Setting up Desktop and iOS apps...');

    // Launch Desktop app
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const testDbPath = path.join(os.tmpdir(), `notecove-cross-platform-test-${uniqueId}.db`);
    const testConfigPath = path.join(
      os.tmpdir(),
      `notecove-cross-platform-config-${uniqueId}.json`
    );

    desktopApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_DB_PATH: testDbPath,
        TEST_CONFIG_PATH: testConfigPath,
      },
    });

    desktopWindow = await desktopApp.firstWindow({ timeout: 60000 });
    await desktopWindow.waitForLoadState('domcontentloaded');
    await desktopWindow.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });

    // Add shared storage directory to Desktop
    console.log('[Test] Adding shared SD to Desktop...');

    // Open Settings
    const settingsButton = desktopWindow.locator('button[title="Settings"]');
    await settingsButton.click();
    await desktopWindow.waitForTimeout(500);

    // Click Add Directory
    await desktopWindow.locator('button', { hasText: 'Add Directory' }).click();
    await desktopWindow.waitForTimeout(500);

    // Wait for Add SD dialog
    const addDialog = desktopWindow.locator('[role="dialog"]', {
      hasText: 'Add Storage Directory',
    });
    await expect(addDialog).toBeVisible({ timeout: 5000 });

    // Fill in the form
    await addDialog.getByLabel('Name').fill('Cross-Platform Test SD');
    await addDialog.getByLabel('Path').fill(SHARED_SD_PATH);

    // Click Add button
    await addDialog.locator('button', { hasText: 'Add' }).click();
    await desktopWindow.waitForTimeout(1000);

    // Close settings
    const settingsDialog = desktopWindow.locator('[role="dialog"]', { hasText: 'Settings' });
    const closeButton = settingsDialog.locator('button[aria-label="close"]');
    await closeButton.click();
    await desktopWindow.waitForTimeout(1000);

    // Select the storage directory we just created
    console.log('[Test] Selecting storage directory...');
    const sdItem = desktopWindow.locator('[data-testid^="folder-tree-node-sd:"]').filter({
      hasText: 'Cross-Platform Test SD',
    });
    await expect(sdItem).toBeVisible({ timeout: 10000 });

    // Extract the SD ID from the test ID attribute
    const sdTestId = await sdItem.getAttribute('data-testid');
    const sdId = sdTestId?.replace('folder-tree-node-', '');
    console.log('[Test] Extracted SD ID:', sdId);

    // Click to expand if needed
    await sdItem.click();
    await desktopWindow.waitForTimeout(1000);

    // Click "All Notes" using the exact test ID with extracted SD ID
    const allNotesTestId = sdId ? `folder-tree-node-all-notes:${sdId.replace('sd:', '')}` : '';
    console.log('[Test] Looking for All Notes with testId:', allNotesTestId);
    const allNotesNode = desktopWindow.getByTestId(allNotesTestId);
    await expect(allNotesNode).toBeVisible({ timeout: 5000 });
    await allNotesNode.click();
    await desktopWindow.waitForTimeout(1000);

    console.log('[Test] ✅ Cross-Platform Test SD selected');

    // Create a note to initialize Desktop's activity logger
    console.log('[Test] Initializing Desktop activity logger...');
    const addNoteButton = desktopWindow.getByRole('button', { name: 'create note' });
    await expect(addNoteButton).toBeVisible({ timeout: 5000 });
    await addNoteButton.click();
    await desktopWindow.waitForTimeout(500);

    const editor = desktopWindow.locator('.tiptap.ProseMirror');
    await editor.click();
    await editor.type('init');
    await desktopWindow.waitForTimeout(2000);

    // Go back to list
    await desktopWindow.keyboard.press('Escape');
    await desktopWindow.waitForTimeout(1000);

    // Get Desktop instance ID from activity logs
    console.log('[Test] Getting Desktop instance ID...');
    const activityFiles = await fs.readdir(path.join(SHARED_SD_PATH, '.activity'));
    desktopInstanceId = activityFiles[0].replace('.log', '');
    console.log('[Test] Desktop instance ID:', desktopInstanceId);

    // Launch iOS app (we'll use file system manipulation since UI automation is complex)
    // For now, we'll simulate iOS by directly creating notes as iOS would
    // TODO: Add actual iOS simulator launch and control
    console.log('[Test] iOS simulation via file system (TODO: add actual iOS app launch)');

    //
    // TEST 1: iOS creates note "from ios" → Desktop discovers it
    //
    console.log('[Test] TEST 1: iOS creates note...');

    iosNoteId = await createNoteAsIOS('from ios');
    console.log('[Test] iOS created note:', iosNoteId);

    // Wait for Desktop to discover the note
    await desktopWindow.waitForTimeout(3000); // Give file watcher time to detect

    // Verify note appears in Desktop
    const iosNoteInDesktop = desktopWindow.locator(`[data-testid="note-item"]`, {
      hasText: 'from ios',
    });
    await expect(iosNoteInDesktop).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Desktop discovered iOS note');

    //
    // TEST 2: Desktop creates note "from desktop" → iOS discovers it
    //
    console.log('[Test] TEST 2: Desktop creates note...');

    // Create note in Desktop
    await addNoteButton.click();
    await desktopWindow.waitForTimeout(1000);

    // Type in editor (reusing editor variable from above)
    await editor.click();
    await editor.type('from desktop');
    await desktopWindow.waitForTimeout(2000); // Wait for debounce and save

    // Get the note ID from activity log
    const desktopActivityLog = await fs.readFile(
      path.join(SHARED_SD_PATH, '.activity', `${desktopInstanceId}.log`),
      'utf-8'
    );
    const lastLine = desktopActivityLog.trim().split('\n').pop()!;
    desktopNoteId = lastLine.split('|')[0];
    console.log('[Test] Desktop created note:', desktopNoteId);

    // Go back to list
    await desktopWindow.keyboard.press('Escape');
    await desktopWindow.waitForTimeout(1000);

    // Verify note exists in file system (simulating iOS discovery)
    const desktopNoteDir = path.join(SHARED_SD_PATH, 'notes', desktopNoteId);
    const noteExists = await fs
      .access(desktopNoteDir)
      .then(() => true)
      .catch(() => false);
    expect(noteExists).toBe(true);
    console.log('[Test] ✅ iOS can discover Desktop note (files exist)');

    //
    // TEST 3: Desktop edits iOS note → iOS sees changes
    //
    console.log('[Test] TEST 3: Desktop edits iOS note...');

    // Open iOS note in Desktop
    await iosNoteInDesktop.click();
    await desktopWindow.waitForTimeout(1000);

    // Edit the note
    await editor.click();
    await editor.press('End'); // Move to end
    await editor.type(' hello from desktop');
    await desktopWindow.waitForTimeout(2000);

    // Verify content in file system
    const iosNoteContent = await getNoteContent(iosNoteId);
    expect(iosNoteContent).toContain('from ios');
    expect(iosNoteContent).toContain('hello from desktop');
    console.log('[Test] ✅ Desktop edited iOS note, iOS can see changes');

    // Go back to list
    await desktopWindow.keyboard.press('Escape');
    await desktopWindow.waitForTimeout(1000);

    //
    // TEST 4: iOS edits Desktop note → Desktop sees changes
    //
    console.log('[Test] TEST 4: iOS edits Desktop note...');

    // Simulate iOS editing the Desktop note
    await editNoteAsIOS(desktopNoteId, 'from desktop hello from ios');

    // Wait for Desktop to detect changes
    await desktopWindow.waitForTimeout(3000);

    // Open Desktop note
    const desktopNoteInList = desktopWindow.locator(`[data-testid="note-item"]`, {
      hasText: 'from desktop',
    });
    await desktopNoteInList.click();
    await desktopWindow.waitForTimeout(1000);

    // Verify content includes iOS edit
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('from desktop');
    expect(editorContent).toContain('hello from ios');
    console.log('[Test] ✅ iOS edited Desktop note, Desktop sees changes');

    console.log('[Test] 🎉 All bidirectional sync tests passed!');
  });

  /**
   * Simulate iOS creating a note by directly writing files
   * Returns the note ID
   */
  async function createNoteAsIOS(content: string): Promise<string> {
    const noteId = generateIOSUUID();
    const iosInstanceId = generateIOSUUID();

    // Create note directory structure
    const noteDir = path.join(SHARED_SD_PATH, 'notes', noteId);
    const updatesDir = path.join(noteDir, 'updates');
    await fs.mkdir(updatesDir, { recursive: true });

    // Create CRDT update with content
    const { encodeStateAsUpdate } = await import('yjs');
    const Y = await import('yjs');

    const doc = new Y.Doc({ guid: noteId });
    const fragment = doc.getXmlFragment('content');

    doc.transact(() => {
      const paragraph = new Y.XmlElement('p');
      const text = new Y.XmlText();
      text.insert(0, content);
      paragraph.insert(0, [text]);
      fragment.insert(0, [paragraph]);
    });

    const update = encodeStateAsUpdate(doc);
    doc.destroy();

    // Write update file
    const timestamp = Date.now();
    const updateFilename = `${iosInstanceId}_${noteId}_${timestamp}-0.yjson`;
    await fs.writeFile(path.join(updatesDir, updateFilename), Buffer.from(update));

    // Write activity log
    const activityDir = path.join(SHARED_SD_PATH, '.activity');
    await fs.mkdir(activityDir, { recursive: true });
    const activityLog = path.join(activityDir, `${iosInstanceId}.log`);
    await fs.writeFile(activityLog, `${noteId}|${iosInstanceId}_0\n`);

    return noteId;
  }

  /**
   * Simulate iOS editing a note
   */
  async function editNoteAsIOS(noteId: string, newContent: string): Promise<void> {
    const iosInstanceId = generateIOSUUID();

    const { encodeStateAsUpdate } = await import('yjs');
    const Y = await import('yjs');

    const doc = new Y.Doc({ guid: noteId });
    const fragment = doc.getXmlFragment('content');

    doc.transact(() => {
      // Clear existing content
      if (fragment.length > 0) {
        fragment.delete(0, fragment.length);
      }

      const paragraph = new Y.XmlElement('p');
      const text = new Y.XmlText();
      text.insert(0, newContent);
      paragraph.insert(0, [text]);
      fragment.insert(0, [paragraph]);
    });

    const update = encodeStateAsUpdate(doc);
    doc.destroy();

    // Write update file
    const updatesDir = path.join(SHARED_SD_PATH, 'notes', noteId, 'updates');
    const timestamp = Date.now();
    const updateFilename = `${iosInstanceId}_${noteId}_${timestamp}-1.yjson`;
    await fs.writeFile(path.join(updatesDir, updateFilename), Buffer.from(update));

    // Update activity log
    const activityDir = path.join(SHARED_SD_PATH, '.activity');
    const activityLog = path.join(activityDir, `${iosInstanceId}.log`);
    await fs.appendFile(activityLog, `${noteId}|${iosInstanceId}_1\n`);
  }

  /**
   * Get note content from CRDT files
   */
  async function getNoteContent(noteId: string): Promise<string> {
    const { applyUpdate } = await import('yjs');
    const Y = await import('yjs');

    const doc = new Y.Doc({ guid: noteId });
    const fragment = doc.getXmlFragment('content');

    // Read all update files
    const updatesDir = path.join(SHARED_SD_PATH, 'notes', noteId, 'updates');
    const updateFiles = await fs.readdir(updatesDir);

    for (const file of updateFiles.sort()) {
      const updateData = await fs.readFile(path.join(updatesDir, file));
      applyUpdate(doc, updateData);
    }

    // Extract text content
    const content = extractTextFromFragment(fragment);
    doc.destroy();

    return content;
  }

  /**
   * Extract plain text from Y.XmlFragment
   */
  function extractTextFromFragment(fragment: any): string {
    let text = '';
    for (let i = 0; i < fragment.length; i++) {
      const node = fragment.get(i);
      if (node instanceof (fragment.doc!.constructor as any).XmlText) {
        text += node.toString();
      } else if (node instanceof (fragment.doc!.constructor as any).XmlElement) {
        text += extractTextFromElement(node);
      }
    }
    return text;
  }

  /**
   * Extract plain text from Y.XmlElement
   */
  function extractTextFromElement(element: any): string {
    let text = '';
    for (let i = 0; i < element.length; i++) {
      const node = element.get(i);
      if (node instanceof (element.doc!.constructor as any).XmlText) {
        text += node.toString();
      } else if (node instanceof (element.doc!.constructor as any).XmlElement) {
        text += extractTextFromElement(node);
      }
    }
    return text;
  }

  /**
   * Generate uppercase UUID (iOS style)
   */
  function generateIOSUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
      .replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      })
      .toUpperCase();
  }
});
