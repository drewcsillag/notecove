/**
 * E2E tests for SD (Storage Directory) Reordering
 *
 * Tests drag-and-drop reordering of Storage Directories in the folder panel.
 * Phase 3: SD Header Reordering
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let window: Page;
let testUserDataDir: string;

test.beforeEach(async () => {
  // Create a unique temporary directory for this test
  testUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-test-sd-reorder-'));

  electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../dist-electron/main/index.js'),
      `--user-data-dir=${testUserDataDir}`,
    ],
    env: {
      NODE_ENV: 'test',
    },
    timeout: 60000,
  });

  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Wait for app to be ready
  await window.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
  await window.waitForTimeout(500);
});

test.afterEach(async () => {
  await electronApp.close();

  // Clean up temporary directory
  if (testUserDataDir && fs.existsSync(testUserDataDir)) {
    fs.rmSync(testUserDataDir, { recursive: true, force: true });
  }
});

/**
 * Helper to create a second SD via settings
 */
async function createSecondSD(name: string): Promise<string> {
  // Open settings
  await window.locator('[title="Settings"]').click();
  await window.waitForTimeout(500);

  // Click Add Directory
  const addSDButton = window.locator('button:has-text("Add Directory")');
  await addSDButton.click();
  await window.waitForTimeout(500);

  // Fill in name and path
  const dialog = window.locator('div[role="dialog"]');
  await dialog.locator('input[type="text"]').first().fill(name);
  const testPath = path.join(os.tmpdir(), `notecove-sd-${name}-${Date.now()}`);
  await dialog.locator('input[type="text"]').last().fill(testPath);

  // Add
  await dialog.locator('button:has-text("Add")').last().click();
  await window.waitForTimeout(1000);

  // Close settings
  await window.locator('button:has-text("Close")').click();
  await window.waitForTimeout(500);

  return testPath;
}

test.describe('SD Reordering - Setup Verification', () => {
  test('should display two SDs in folder tree after creating second SD', async () => {
    // Create second SD
    await createSecondSD('Second SD');

    // Get SD list
    const sds = await window.evaluate(async () => {
      return await window.electronAPI.sd.list();
    });

    expect(sds).toHaveLength(2);

    // Verify both SD nodes are visible
    const sd1Node = window.getByTestId(`folder-tree-node-sd:${sds[0].id}`);
    const sd2Node = window.getByTestId(`folder-tree-node-sd:${sds[1].id}`);

    await expect(sd1Node).toBeVisible();
    await expect(sd2Node).toBeVisible();

    // Log the SD names and order
    console.log(
      'SD order:',
      sds.map((sd: { name: string }) => sd.name)
    );
  });

  test('should have spacer nodes for SD reordering drop targets', async () => {
    // Create second SD
    await createSecondSD('Second SD');

    // Wait a bit for re-render
    await window.waitForTimeout(500);

    // Check if spacer nodes exist in the tree data
    const hasSpacers = await window.evaluate(() => {
      // Access the tree data via DOM or check for specific elements
      const topSpacer = document.querySelector('[data-testid="folder-tree-node-sd-spacer-top"]');
      const bottomSpacer = document.querySelector(
        '[data-testid="folder-tree-node-sd-spacer-bottom"]'
      );
      return {
        hasTopSpacer: !!topSpacer,
        hasBottomSpacer: !!bottomSpacer,
      };
    });

    console.log('Spacer nodes:', hasSpacers);

    // Note: Spacers might not have visible test IDs if they return early with empty Box
    // Let's check the tree structure instead
    const treeNodes = await window.evaluate(() => {
      const nodes = document.querySelectorAll('[data-testid^="folder-tree-node-"]');
      return Array.from(nodes).map((n) => n.getAttribute('data-testid'));
    });

    console.log('Tree node test IDs:', treeNodes);

    // Also check all elements with any data-testid
    const allTestIds = await window.evaluate(() => {
      const elements = document.querySelectorAll('[data-testid]');
      return Array.from(elements)
        .map((e) => e.getAttribute('data-testid'))
        .filter((id) => id?.includes('folder') || id?.includes('sd') || id?.includes('spacer'));
    });
    console.log('All relevant test IDs:', allTestIds);

    // Check that spacers ARE in the treeData
    expect(hasSpacers.hasTopSpacer || hasSpacers.hasBottomSpacer).toBe(true);
  });
});

/**
 * Drag and Drop tests are skipped due to Playwright limitations with react-dnd.
 * See note-drag-drop.spec.ts for details.
 *
 * Alternative Testing Strategy:
 * - Unit tests for handleDrop logic in FolderTree.test.tsx
 * - Manual QA verification of SD reordering
 */
test.describe('SD Reordering - Drag and Drop', () => {
  // Skip due to Playwright + react-dnd limitations
  test.skip('should be able to drag SD header', async () => {
    // Create second SD
    await createSecondSD('Second SD');

    // Get SD list
    const sds = await window.evaluate(async () => {
      return await window.electronAPI.sd.list();
    });

    expect(sds).toHaveLength(2);

    const sd1Node = window.getByTestId(`folder-tree-node-sd:${sds[0].id}`);
    const sd2Node = window.getByTestId(`folder-tree-node-sd:${sds[1].id}`);

    // Get bounding boxes
    const sd1Box = await sd1Node.boundingBox();
    const sd2Box = await sd2Node.boundingBox();

    console.log('SD1 bounding box:', sd1Box);
    console.log('SD2 bounding box:', sd2Box);

    if (!sd1Box || !sd2Box) {
      throw new Error('Could not get bounding boxes for SD nodes');
    }

    // Try to drag SD2 above SD1
    // Start drag from center of SD2
    const startX = sd2Box.x + sd2Box.width / 2;
    const startY = sd2Box.y + sd2Box.height / 2;

    // Drop above SD1 (before it)
    const endX = sd1Box.x + sd1Box.width / 2;
    const endY = sd1Box.y - 5; // Above SD1

    console.log(`Dragging from (${startX}, ${startY}) to (${endX}, ${endY})`);

    // Perform drag
    await window.mouse.move(startX, startY);
    await window.mouse.down();
    await window.waitForTimeout(100);
    await window.mouse.move(endX, endY, { steps: 10 });
    await window.waitForTimeout(100);
    await window.mouse.up();
    await window.waitForTimeout(500);

    // Check if order changed
    const newSds = await window.evaluate(async () => {
      return await window.electronAPI.sd.list();
    });

    console.log(
      'New SD order:',
      newSds.map((sd: { name: string }) => sd.name)
    );

    // Check the saved SD order in appState
    const savedOrder = await window.evaluate(async () => {
      return await window.electronAPI.appState.get('sdOrder');
    });
    console.log('Saved SD order in appState:', savedOrder);
  });

  // Skip due to Playwright + react-dnd limitations
  test.skip('should reorder SDs by dragging to bottom spacer', async () => {
    // Create second SD
    await createSecondSD('Second SD');

    // Wait for tree to re-render with new SD
    await window.waitForTimeout(500);

    // Get initial SD list
    const initialSds = await window.evaluate(async () => {
      return await window.electronAPI.sd.list();
    });

    expect(initialSds).toHaveLength(2);
    const firstSdId = initialSds[0].id;

    console.log(
      'Initial order:',
      initialSds.map((sd: { name: string }) => sd.name)
    );

    // Find the first SD node and the bottom spacer
    const sd1Node = window.getByTestId(`folder-tree-node-sd:${initialSds[0].id}`);
    const bottomSpacer = window.getByTestId('folder-tree-node-sd-spacer-bottom');

    const sd1Box = await sd1Node.boundingBox();
    const spacerBox = await bottomSpacer.boundingBox();
    console.log('SD1 bounding box:', sd1Box);
    console.log('Bottom spacer bounding box:', spacerBox);

    if (!sd1Box || !spacerBox) {
      throw new Error('Could not get bounding boxes');
    }

    // Drag SD1 to the bottom spacer
    const startX = sd1Box.x + sd1Box.width / 2;
    const startY = sd1Box.y + sd1Box.height / 2;
    const endX = spacerBox.x + spacerBox.width / 2;
    const endY = spacerBox.y + spacerBox.height / 2;

    console.log(`Dragging SD1 from (${startX}, ${startY}) to bottom spacer at (${endX}, ${endY})`);

    // Perform drag with more deliberate steps
    await window.mouse.move(startX, startY);
    await window.waitForTimeout(100);
    await window.mouse.down();
    await window.waitForTimeout(200);
    // Move in steps to trigger drag detection
    await window.mouse.move(startX, startY + 50, { steps: 5 });
    await window.waitForTimeout(100);
    await window.mouse.move(endX, endY, { steps: 20 });
    await window.waitForTimeout(300);
    await window.mouse.up();
    await window.waitForTimeout(500);

    // Check the saved SD order in appState
    const savedOrder = await window.evaluate(async () => {
      return await window.electronAPI.appState.get('sdOrder');
    });
    console.log('Saved SD order in appState:', savedOrder);

    // If savedOrder exists, the first SD should be at position 1 (index 1)
    if (savedOrder) {
      const order = JSON.parse(savedOrder) as string[];
      console.log('Parsed order:', order);
      expect(order.indexOf(firstSdId)).toBe(1);
    } else {
      // If no order saved, drag didn't work - fail the test
      throw new Error('SD order was not saved - drag operation failed');
    }
  });
});
