/**
 * SD Helper Functions for E2E Tests
 *
 * Provides utilities for dynamically getting SD IDs and constructing
 * data-testid selectors for folder tree nodes.
 *
 * Background: Test SDs are created with dynamic IDs like 'test-sd-1735689123456',
 * NOT 'default'. Tests must use these helpers to get the actual SD ID.
 */

import { Page } from '@playwright/test';

/**
 * Get the first/active SD ID from the running app.
 * This should be called after the app is fully loaded.
 *
 * @param page - Playwright Page object
 * @returns The ID of the first SD
 * @throws Error if no SDs are found
 */
export async function getFirstSdId(page: Page): Promise<string> {
  const sdId = await page.evaluate(async () => {
    const sds = await window.electronAPI.sd.list();
    if (sds.length === 0) {
      throw new Error('[sd-helpers] No SDs found in app');
    }
    return sds[0].id;
  });
  console.log(`[sd-helpers] Got first SD ID: ${sdId}`);
  return sdId;
}

/**
 * Get all SD IDs from the running app.
 *
 * @param page - Playwright Page object
 * @returns Array of SD IDs
 */
export async function getAllSdIds(page: Page): Promise<string[]> {
  const sdIds = await page.evaluate(async () => {
    const sds = await window.electronAPI.sd.list();
    return sds.map((sd: { id: string }) => sd.id);
  });
  console.log(`[sd-helpers] Got ${sdIds.length} SD IDs:`, sdIds);
  return sdIds;
}

/**
 * Get the data-testid for an "All Notes" folder tree node.
 *
 * @param sdId - The SD ID
 * @returns The data-testid string (e.g., "folder-tree-node-all-notes:abc123")
 */
export function getAllNotesTestId(sdId: string): string {
  return `folder-tree-node-all-notes:${sdId}`;
}

/**
 * Get the data-testid for an SD folder tree node.
 *
 * @param sdId - The SD ID
 * @returns The data-testid string (e.g., "folder-tree-node-sd:abc123")
 */
export function getSdTestId(sdId: string): string {
  return `folder-tree-node-sd:${sdId}`;
}

/**
 * Get the data-testid for a "Recently Deleted" folder tree node.
 *
 * @param sdId - The SD ID
 * @returns The data-testid string (e.g., "folder-tree-node-recently-deleted:abc123")
 */
export function getRecentlyDeletedTestId(sdId: string): string {
  return `folder-tree-node-recently-deleted:${sdId}`;
}

/**
 * Get the data-testid for a user folder tree node.
 *
 * @param folderId - The folder ID (UUID)
 * @returns The data-testid string (e.g., "folder-tree-node-abc123-def456")
 */
export function getFolderTestId(folderId: string): string {
  return `folder-tree-node-${folderId}`;
}
