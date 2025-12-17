/**
 * Storage Directory Initialization
 *
 * Handles SD marker files, structure initialization, and registration
 * of storage directories with the app.
 */

import { join } from 'path';
import { SDMarker, SyncDirectoryStructure, type SDType } from '@notecove/shared';
import type { AppendLogManager, Database } from '@notecove/shared';
import type { NodeFileSystemAdapter } from './storage/node-fs-adapter';

export interface SDConfig {
  id: string;
  path: string;
  label: string;
}

/**
 * Initialize the default storage directory and ensure it has proper structure
 */
export async function initializeDefaultSD(
  storageDir: string,
  fsAdapter: NodeFileSystemAdapter,
  sdMarker: SDMarker,
  currentSDType: SDType,
  skipMarker = false
): Promise<void> {
  // Initialize SD structure with config
  const sdConfig: SDConfig = {
    id: 'default',
    path: storageDir,
    label: 'Default Storage',
  };
  const sdStructure = new SyncDirectoryStructure(fsAdapter, sdConfig);

  // Initialize SD directory structure
  await sdStructure.initialize();

  // Ensure SD has a marker file (for dev/prod safety)
  // Skip for test mode to avoid breaking E2E tests
  if (!skipMarker) {
    await sdMarker.ensureMarker(storageDir, currentSDType);
  }

  // Ensure folders/logs directory exists BEFORE creating CRDT manager
  // This prevents ENOENT errors when demo folders are created
  const folderLogsPath = join(storageDir, 'folders', 'logs');
  await fsAdapter.mkdir(folderLogsPath);
}

/**
 * Load and register all storage directories from database
 */
export async function loadAndRegisterSDs(
  database: Database,
  storageManager: AppendLogManager,
  sdMarker: SDMarker,
  currentSDType: SDType,
  isDevBuild: boolean,
  skipMarker = false
): Promise<void> {
  const allSDs = await database.getAllStorageDirs();

  for (const sd of allSDs) {
    if (sd.id !== 'default') {
      // Check SD marker for safety (skip in test mode)
      if (!skipMarker) {
        const existingMarker = await sdMarker.readSDMarker(sd.path);

        // Production build: refuse to load dev SDs
        if (!isDevBuild && existingMarker === 'dev') {
          console.warn(`[Init] Skipping dev SD in production: ${sd.name} at ${sd.path}`);
          continue;
        }

        // Ensure marker exists (will write current build type if missing)
        await sdMarker.ensureMarker(sd.path, currentSDType);
      }

      // Register with storage manager (default is already registered)
      storageManager.registerSD(sd.id, sd.path);
      console.log(`[Init] Registered SD: ${sd.name} at ${sd.path}`);
    }
  }
}
