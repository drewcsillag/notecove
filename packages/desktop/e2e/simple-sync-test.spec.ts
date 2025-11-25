/**
 * Simple sync test with a fresh (non-welcome) note
 * to isolate the snapshot/vector clock bug
 */

import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const mainPath = path.join(__dirname, '../dist-electron/main/index.js');

test.describe('Simple sync test - fresh note', () => {
  let sd1: string;
  let sd2: string;
  let userDataDir1: string;
  let userDataDir2: string;
  let instance1: ElectronApplication;
  let instance2: ElectronApplication;
  let window1: Page;
  let window2: Page;

  test.beforeEach(async () => {
    const testId = Date.now();
    sd1 = fs.mkdtempSync(path.join(os.tmpdir(), `notecove-sd1-${testId}-`));
    sd2 = fs.mkdtempSync(path.join(os.tmpdir(), `notecove-sd2-${testId}-`));
    userDataDir1 = fs.mkdtempSync(path.join(os.tmpdir(), `notecove-userdata1-${testId}-`));
    userDataDir2 = fs.mkdtempSync(path.join(os.tmpdir(), `notecove-userdata2-${testId}-`));

    console.log('[Simple Test] SD1:', sd1);
    console.log('[Simple Test] SD2:', sd2);
  });

  test.afterEach(async () => {
    try {
      if (instance1) await instance1.close();
    } catch (e) {
      console.error('Error closing instance1:', e);
    }
    try {
      if (instance2) await instance2.close();
    } catch (e) {
      console.error('Error closing instance2:', e);
    }

    // Clean up temp directories
    try {
      fs.rmSync(sd1, { recursive: true, force: true });
      fs.rmSync(sd2, { recursive: true, force: true });
      fs.rmSync(userDataDir1, { recursive: true, force: true });
      fs.rmSync(userDataDir2, { recursive: true, force: true });
    } catch (e) {
      console.error('Error cleaning up:', e);
    }
  });

  test('should sync a fresh note between instances', async () => {
    // === Phase 1: Instance 1 creates a fresh note and types content ===
    console.log('[Simple Test] Launching instance 1...');
    instance1 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir1}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd1,
        INSTANCE_ID: 'simple-instance-1',
      },
      timeout: 60000,
    });

    instance1.on('console', (msg) => {
      console.log('[Instance1]:', msg.text());
    });

    window1 = await instance1.firstWindow();
    window1.on('console', (msg) => {
      console.log('[Instance1 Renderer]:', msg.text());
    });

    await window1.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window1.waitForTimeout(2000);

    console.log('[Simple Test] Typing in instance 1 (clearing welcome, typing fresh content)...');

    // Clear welcome content and type fresh content
    const editor1 = window1.locator('.ProseMirror');
    await editor1.click();
    await window1.keyboard.press('Meta+a'); // Select all
    await window1.keyboard.press('Backspace'); // Delete
    await window1.waitForTimeout(500);

    await editor1.type('Test content from instance 1');
    await window1.waitForTimeout(2000);

    console.log('[Simple Test] Instance 1 typed content, copying files to SD2...');

    // Manually copy ALL files from SD1 to SD2 (simulating perfect sync)
    copyDirectory(sd1, sd2);

    console.log('[Simple Test] Files copied, closing instance 1...');
    await instance1.close();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // === Phase 2: Instance 2 loads and should see the content ===
    console.log('[Simple Test] Launching instance 2...');
    instance2 = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir2}`],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_STORAGE_DIR: sd2,
        INSTANCE_ID: 'simple-instance-2',
      },
      timeout: 60000,
    });

    instance2.on('console', (msg) => {
      console.log('[Instance2]:', msg.text());
    });

    window2 = await instance2.firstWindow();
    window2.on('console', (msg) => {
      console.log('[Instance2 Renderer]:', msg.text());
    });

    await window2.waitForSelector('.ProseMirror', { timeout: 15000 });
    await window2.waitForTimeout(5000);

    console.log('[Simple Test] Checking instance 2 content...');
    const editor2 = window2.locator('.ProseMirror');
    await expect(editor2).toContainText('Test content from instance 1', { timeout: 10000 });

    console.log('[Simple Test] ✅ SUCCESS - Instance 2 sees instance 1 content!');
  });
});

/**
 * Recursively copy directory contents
 */
function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
