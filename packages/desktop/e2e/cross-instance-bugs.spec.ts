/**
 * E2E Tests for Cross-Instance Bugs
 *
 * Tests for bugs reported in Phase 2.5.2:
 * 1. Welcome note content duplication when opening same storage in two instances
 * 2. Notes list not syncing when creating note in one instance
 * 3. Title update inconsistency
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import { resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

test.describe('Cross-Instance Bugs', () => {
  let instance1: ElectronApplication;
  let instance2: ElectronApplication;
  let window1: Page;
  let window2: Page;
  let testStorageDir: string;

  test('should not duplicate welcome note content when opening two instances with same storage', async () => {
    console.log('[Test] Testing welcome note duplication bug...');

    // Create a shared temporary storage directory for both instances
    testStorageDir = mkdtempSync(join(tmpdir(), 'notecove-cross-instance-'));
    console.log('[Cross-Instance] Shared storage directory:', testStorageDir);

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Create separate user data directories for each instance
    const userData1 = mkdtempSync(join(tmpdir(), 'notecove-e2e-instance1-'));
    const userData2 = mkdtempSync(join(tmpdir(), 'notecove-e2e-instance2-'));

    // Launch first instance
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: testStorageDir,
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1 Console]:', msg.text());
    });

    window1 = await instance1.firstWindow();
    window1.on('console', (msg) => {
      console.log('[Window1]:', msg.text());
    });

    await window1.waitForSelector('.ProseMirror', { timeout: 10000 });
    await window1.waitForTimeout(1000);

    // Get initial content from first instance
    const content1Initial = await window1.locator('.ProseMirror').textContent();
    console.log('[Test] Instance 1 initial content:', content1Initial);

    expect(content1Initial).toContain('Welcome to NoteCove');

    // Count welcome messages in instance 1 (should be 1)
    const welcomeCount1 = (content1Initial?.match(/Welcome to NoteCove/g) || []).length;
    expect(welcomeCount1).toBe(1);

    // Launch second instance with SAME storage directory but DIFFERENT userData
    console.log('[Test] Launching second instance with same storage...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: testStorageDir,
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2 Console]:', msg.text());
    });

    window2 = await instance2.firstWindow();
    window2.on('console', (msg) => {
      console.log('[Window2]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 10000 });
    await window2.waitForTimeout(2000); // Wait for any sync to complete

    // Get content from second instance
    const content2 = await window2.locator('.ProseMirror').textContent();
    console.log('[Test] Instance 2 content:', content2);

    // Instance 2 should also have exactly 1 welcome message
    const welcomeCount2 = (content2?.match(/Welcome to NoteCove/g) || []).length;
    expect(welcomeCount2).toBe(1);

    // Check that instance 1 still has no duplication
    const content1After = await window1.locator('.ProseMirror').textContent();
    const welcomeCount1After = (content1After?.match(/Welcome to NoteCove/g) || []).length;
    expect(welcomeCount1After).toBe(1);

    console.log('[Test] ✅ Welcome note duplication test completed');

    // Cleanup
    await instance1.close();
    await instance2.close();

    // Clean up temporary directories
    try {
      rmSync(testStorageDir, { recursive: true, force: true });
      rmSync(userData1, { recursive: true, force: true });
      rmSync(userData2, { recursive: true, force: true });
      console.log('[Cross-Instance] Cleaned up test directories');
    } catch (error) {
      console.error('[Cross-Instance] Failed to clean up test directories:', error);
    }
  }, 120000);

  test('should sync notes list when creating note in one instance', async () => {
    console.log('[Test] Testing cross-instance notes list sync...');

    // Create a shared temporary storage directory for both instances
    testStorageDir = mkdtempSync(join(tmpdir(), 'notecove-cross-instance-'));
    console.log('[Cross-Instance] Shared storage directory:', testStorageDir);

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Create separate user data directories for each instance
    const userData1 = mkdtempSync(join(tmpdir(), 'notecove-e2e-instance1-'));
    const userData2 = mkdtempSync(join(tmpdir(), 'notecove-e2e-instance2-'));

    console.log('[Test] Instance 1 userData:', userData1);
    console.log('[Test] Instance 2 userData:', userData2);

    // Launch first instance with separate userData
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: testStorageDir,
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1 Console]:', msg.text());
    });

    window1 = await instance1.firstWindow();
    window1.on('console', (msg) => {
      console.log('[Window1]:', msg.text());
    });

    await window1.waitForSelector('.ProseMirror', { timeout: 10000 });

    // Launch second instance with SAME storage directory but DIFFERENT userData
    console.log('[Test] Launching second instance...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: testStorageDir,
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2 Console]:', msg.text());
    });

    window2 = await instance2.firstWindow();
    window2.on('console', (msg) => {
      console.log('[Window2]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 10000 });
    await window2.waitForTimeout(1000);

    // Get initial note count in instance 2
    const middlePanel2 = window2.locator('#middle-panel');
    const initialNotes2 = await middlePanel2.locator('.MuiListItemButton-root').count();
    console.log('[Test] Instance 2 initial note count:', initialNotes2);

    // Create a note in instance 1
    console.log('[Test] Creating note in instance 1...');
    const createButton1 = window1.getByTitle('Create note');
    await createButton1.click();
    await window1.waitForTimeout(500);

    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();
    const testTitle = `Cross-Instance Test Note ${Date.now()}`;
    await editor1.fill(`${testTitle}\nTest content`);
    await window1.waitForTimeout(600); // Wait for title to be saved (debounced 300ms + buffer)

    console.log('[Test] Created note with title:', testTitle);

    // Verify note appears in instance 1 notes list
    const middlePanel1 = window1.locator('#middle-panel');
    const noteInList1 = middlePanel1.locator(`text=${testTitle}`).first();
    await expect(noteInList1).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Note appears in instance 1 notes list');

    // Wait for sync (activity sync polls every 2 seconds)
    console.log('[Test] Waiting for cross-instance sync...');
    await window2.waitForTimeout(5000);

    // Check if note appears in instance 2 notes list
    const noteInList2 = middlePanel2.locator(`text=${testTitle}`).first();
    await expect(noteInList2).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Note synced to instance 2 notes list');

    // Verify note count increased in instance 2
    const finalNotes2 = await middlePanel2.locator('.MuiListItemButton-root').count();
    expect(finalNotes2).toBe(initialNotes2 + 1);

    console.log('[Test] ✅ Cross-instance notes list sync test completed');

    // Cleanup
    await instance1.close();
    await instance2.close();

    // Clean up temporary directories
    try {
      rmSync(testStorageDir, { recursive: true, force: true });
      rmSync(userData1, { recursive: true, force: true });
      rmSync(userData2, { recursive: true, force: true });
      console.log('[Cross-Instance] Cleaned up test directories');
    } catch (error) {
      console.error('[Cross-Instance] Failed to clean up test directories:', error);
    }
  }, 120000);

  test('should consistently update note title when editing', async () => {
    console.log('[Test] Testing title update consistency...');

    // Create a temporary storage directory for this test
    testStorageDir = mkdtempSync(join(tmpdir(), 'notecove-cross-instance-'));
    console.log('[Cross-Instance] Shared storage directory:', testStorageDir);

    const mainPath = resolve(__dirname, '..', 'dist-electron', 'main', 'index.js');

    // Create a user data directory for this instance
    const userData1 = mkdtempSync(join(tmpdir(), 'notecove-e2e-instance1-'));

    // Launch instance
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userData1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: testStorageDir,
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance Console]:', msg.text());
    });

    window1 = await instance1.firstWindow();
    window1.on('console', (msg) => {
      console.log('[Window]:', msg.text());
    });

    await window1.waitForSelector('.ProseMirror', { timeout: 10000 });

    const middlePanel = window1.locator('#middle-panel');

    // Test title updates multiple times to check consistency
    for (let i = 1; i <= 3; i++) {
      console.log(`[Test] Title update attempt ${i}/3...`);

      // Create a note
      const createButton = window1.getByTitle('Create note');
      await createButton.click();
      await window1.waitForTimeout(500);

      const editor = window1.locator('.ProseMirror');
      await editor.click();

      // Type initial title
      const initialTitle = `Title Test ${i} - ${Date.now()}`;
      await editor.fill(`${initialTitle}\nContent ${i}`);
      await window1.waitForTimeout(600); // Wait for debounced title update

      // Verify initial title appears in notes list
      let noteInList = middlePanel.locator(`text=${initialTitle}`).first();
      await expect(noteInList).toBeVisible({ timeout: 5000 });
      console.log(`[Test] ✅ Initial title "${initialTitle}" appears in notes list`);

      // Update the title
      await editor.click();
      await window1.keyboard.press('Home');
      await window1.keyboard.press('Control+A');
      const updatedTitle = `Updated Title ${i} - ${Date.now()}`;
      await editor.fill(`${updatedTitle}\nContent ${i}`);
      await window1.waitForTimeout(600); // Wait for debounced title update

      // Verify updated title appears in notes list
      noteInList = middlePanel.locator(`text=${updatedTitle}`).first();
      await expect(noteInList).toBeVisible({ timeout: 5000 });
      console.log(`[Test] ✅ Updated title "${updatedTitle}" appears in notes list`);

      // Verify old title is gone
      const oldTitleInList = middlePanel.locator(`text=${initialTitle}`).first();
      await expect(oldTitleInList).not.toBeVisible({ timeout: 2000 });
      console.log(`[Test] ✅ Old title "${initialTitle}" removed from notes list`);
    }

    console.log('[Test] ✅ Title update consistency test completed (3/3 successful)');

    // Cleanup
    await instance1.close();

    // Clean up temporary directories
    try {
      rmSync(testStorageDir, { recursive: true, force: true });
      rmSync(userData1, { recursive: true, force: true });
      console.log('[Cross-Instance] Cleaned up test directories');
    } catch (error) {
      console.error('[Cross-Instance] Failed to clean up test directories:', error);
    }
  }, 180000);
});
