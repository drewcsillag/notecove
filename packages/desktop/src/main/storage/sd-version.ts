/**
 * Storage Directory Version Management
 *
 * Manages SD format version checking and migration coordination.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Current SD format version supported by this app
 */
export const CURRENT_SD_VERSION = 1;

/**
 * File names
 */
const VERSION_FILE = 'SD_VERSION';
const LOCK_FILE = '.migration-lock';

/**
 * Check SD version and return compatibility status
 */
export async function checkSDVersion(
  sdPath: string
): Promise<
  | { compatible: true; version: number }
  | {
      compatible: false;
      reason: 'too-new' | 'too-old' | 'locked';
      sdVersion?: number;
      appVersion: number;
    }
> {
  const versionPath = join(sdPath, VERSION_FILE);
  const lockPath = join(sdPath, LOCK_FILE);

  // Check for migration lock
  try {
    await fs.access(lockPath);
    return {
      compatible: false,
      reason: 'locked',
      appVersion: CURRENT_SD_VERSION,
    };
  } catch {
    // No lock, continue
  }

  // Read version file
  let sdVersion: number;
  try {
    const content = await fs.readFile(versionPath, 'utf-8');
    sdVersion = parseInt(content.trim(), 10);

    if (isNaN(sdVersion) || sdVersion < 0) {
      throw new Error('Invalid version number');
    }
  } catch {
    // Missing or invalid version file - treat as version 0
    sdVersion = 0;
  }

  if (sdVersion > CURRENT_SD_VERSION) {
    return {
      compatible: false,
      reason: 'too-new',
      sdVersion,
      appVersion: CURRENT_SD_VERSION,
    };
  }

  if (sdVersion < CURRENT_SD_VERSION) {
    return {
      compatible: false,
      reason: 'too-old',
      sdVersion,
      appVersion: CURRENT_SD_VERSION,
    };
  }

  return {
    compatible: true,
    version: sdVersion,
  };
}

/**
 * Write SD version file
 */
export async function writeSDVersion(sdPath: string, version: number): Promise<void> {
  const versionPath = join(sdPath, VERSION_FILE);
  await fs.writeFile(versionPath, `${version}\n`, 'utf-8');
}

/**
 * Create migration lock file
 */
export async function createMigrationLock(sdPath: string): Promise<void> {
  const lockPath = join(sdPath, LOCK_FILE);
  const lockData = {
    timestamp: new Date().toISOString(),
    pid: process.pid,
  };
  await fs.writeFile(lockPath, JSON.stringify(lockData, null, 2), 'utf-8');
}

/**
 * Remove migration lock file
 */
export async function removeMigrationLock(sdPath: string): Promise<void> {
  const lockPath = join(sdPath, LOCK_FILE);
  try {
    await fs.unlink(lockPath);
  } catch {
    // Ignore if already removed
  }
}

/**
 * Check if migration is in progress
 */
export async function isMigrationLocked(sdPath: string): Promise<boolean> {
  const lockPath = join(sdPath, LOCK_FILE);
  try {
    await fs.access(lockPath);
    return true;
  } catch {
    return false;
  }
}
