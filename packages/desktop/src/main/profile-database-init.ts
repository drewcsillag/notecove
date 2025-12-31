/**
 * Profile Database Initialization
 *
 * Creates the database and initial storage directory for a new profile.
 * This is called during profile creation, before the main app starts.
 */

import { BetterSqliteAdapter, SqliteDatabase } from './database';
import { migrateAndGetSdId } from './sd-id-migration';
import { SyncDirectoryStructure } from '@notecove/shared';
import { NodeFileSystemAdapter } from './storage/node-fs-adapter';

export interface ProfileDatabaseInitResult {
  sdId: string;
  sdUuid: string;
}

/**
 * Initialize the database and create the initial storage directory for a new profile.
 *
 * @param dbPath - Path to the profile's database file
 * @param storagePath - Path to the storage directory
 * @param sdName - Display name for the storage directory (default: "Default")
 * @returns The created SD's id and uuid
 */
export async function initializeProfileDatabase(
  dbPath: string,
  storagePath: string,
  sdName = 'Default'
): Promise<ProfileDatabaseInitResult> {
  // Create and initialize database
  const adapter = new BetterSqliteAdapter(dbPath);
  const db = new SqliteDatabase(adapter);
  await db.initialize();

  try {
    // Get or create UUID for this storage directory
    // This ensures the same SD directory gets the same UUID across machines
    const sdIdResult = await migrateAndGetSdId(storagePath);
    const sdUuid = sdIdResult.id;

    // Use the UUID as the SD id (no more hardcoded 'default')
    const sdId = sdUuid;

    // Create the SD record in database
    await db.createStorageDir(sdId, sdName, storagePath);
    console.log(`[ProfileInit] Created SD "${sdName}" with id ${sdId} at ${storagePath}`);

    // Initialize SD directory structure
    const fsAdapter = new NodeFileSystemAdapter();
    const sdConfig = { id: sdId, path: storagePath, label: sdName };
    const sdStructure = new SyncDirectoryStructure(fsAdapter, sdConfig);
    await sdStructure.initialize();
    console.log(`[ProfileInit] Initialized SD directory structure at ${storagePath}`);

    return { sdId, sdUuid };
  } finally {
    // Close the database - it will be reopened when the main app starts
    await db.close();
  }
}
