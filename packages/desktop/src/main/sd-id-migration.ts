/**
 * SD ID Migration Module
 *
 * Handles migration from legacy .sd-id files to the new SD_ID standard.
 * Implements the migration strategy from PLAN-PHASE-3.md
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SdUuidManager } from '@notecove/shared';
import { NodeFileSystemAdapter } from './storage/node-fs-adapter';

/**
 * Result of SD ID migration
 */
export interface SdIdMigrationResult {
  id: string;
  migrated: boolean;
  wasGenerated: boolean;
  hadConflict: boolean;
}

const LEGACY_SD_ID_FILENAME = '.sd-id';

// UUID v4 validation regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Delete legacy .sd-id file (best effort - don't fail migration if this fails)
 */
async function deleteLegacyFile(legacyPath: string): Promise<void> {
  try {
    await fs.unlink(legacyPath);
  } catch (error) {
    console.warn(`[SD] Failed to delete .sd-id file at ${legacyPath}:`, error);
    console.warn('[SD] Migration succeeded but legacy file remains. Manual cleanup recommended.');
  }
}

/**
 * Migrate legacy .sd-id to SD_ID and return the unified ID
 *
 * Migration Strategy:
 * Case 1: Only SD_ID exists → Use it (no migration needed)
 * Case 2: Only .sd-id exists → Read .sd-id, create SD_ID, delete .sd-id
 * Case 3: Both exist with SAME ID → Use the ID, delete .sd-id
 * Case 4: Both exist with DIFFERENT IDs → Use .sd-id (what app has been using), overwrite SD_ID, delete .sd-id
 * Case 5: Neither exists → Generate new UUID, write to SD_ID
 */
export async function migrateAndGetSdId(sdPath: string): Promise<SdIdMigrationResult> {
  const fsAdapter = new NodeFileSystemAdapter();
  const uuidManager = new SdUuidManager(fsAdapter);

  const legacyPath = path.join(sdPath, LEGACY_SD_ID_FILENAME);

  // Read legacy .sd-id if it exists and contains valid UUID
  let legacyUuid: string | null = null;
  try {
    const content = await fs.readFile(legacyPath, 'utf-8');
    const trimmedContent = content.trim();

    // Validate UUID format before using it
    if (UUID_V4_REGEX.test(trimmedContent)) {
      legacyUuid = trimmedContent;
    } else {
      console.warn(`[SD] Invalid UUID in legacy .sd-id file at ${legacyPath}: "${trimmedContent}"`);
      // Treat as if .sd-id doesn't exist - will use SD_ID or generate new
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist - this is expected
    } else {
      // Unexpected error - log it but treat as "file doesn't exist"
      console.warn(`[SD] Failed to read legacy .sd-id file at ${legacyPath}:`, error);
    }
  }

  // Read SD_ID if it exists
  const sdIdUuid = await uuidManager.readUuid(sdPath);

  // Case 1: Only SD_ID exists
  if (sdIdUuid && !legacyUuid) {
    return {
      id: sdIdUuid,
      migrated: false,
      wasGenerated: false,
      hadConflict: false,
    };
  }

  // Case 2: Only .sd-id exists
  if (legacyUuid && !sdIdUuid) {
    // Create SD_ID with legacy value
    await uuidManager.writeUuid(sdPath, legacyUuid);
    // Delete legacy file (best effort)
    await deleteLegacyFile(legacyPath);
    console.log(`[SD] Migrated .sd-id to SD_ID: ${legacyUuid}`);

    return {
      id: legacyUuid,
      migrated: true,
      wasGenerated: false,
      hadConflict: false,
    };
  }

  // Case 3 & 4: Both exist
  if (legacyUuid && sdIdUuid) {
    const hadConflict = legacyUuid !== sdIdUuid;

    if (hadConflict) {
      // Use legacy value (what app has been using) and overwrite SD_ID
      await uuidManager.writeUuid(sdPath, legacyUuid);
      console.warn(
        `[SD] Resolved ID conflict: .sd-id=${legacyUuid}, SD_ID=${sdIdUuid}. Using .sd-id value.`
      );
    }

    // Delete legacy file (best effort)
    await deleteLegacyFile(legacyPath);

    return {
      id: legacyUuid,
      migrated: true,
      wasGenerated: false,
      hadConflict,
    };
  }

  // Case 5: Neither exists - generate new UUID
  const result = await uuidManager.initializeUuid(sdPath);

  return {
    id: result.uuid,
    migrated: false,
    wasGenerated: true,
    hadConflict: false,
  };
}
