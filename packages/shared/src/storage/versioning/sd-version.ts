/**
 * Storage Directory Version Management
 *
 * Platform-agnostic SD format version checking and migration coordination.
 * Uses FileSystemAdapter for cross-platform compatibility.
 */

import type { FileSystemAdapter } from '../types.js';
import { CURRENT_SD_VERSION, VERSION_FILE, LOCK_FILE, type VersionCheckResult } from './types.js';

/**
 * Text encoder/decoder for converting between strings and Uint8Array
 */
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Check SD version and return compatibility status
 */
export async function checkSDVersion(
  sdPath: string,
  fs: FileSystemAdapter
): Promise<VersionCheckResult> {
  const versionPath = fs.joinPath(sdPath, VERSION_FILE);
  const lockPath = fs.joinPath(sdPath, LOCK_FILE);

  // Check for migration lock
  const isLocked = await fs.exists(lockPath);
  if (isLocked) {
    return {
      compatible: false,
      reason: 'locked',
      appVersion: CURRENT_SD_VERSION,
    };
  }

  // Read version file
  let sdVersion: number;
  try {
    const data = await fs.readFile(versionPath);
    const content = textDecoder.decode(data);
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
export async function writeSDVersion(
  sdPath: string,
  version: number,
  fs: FileSystemAdapter
): Promise<void> {
  const versionPath = fs.joinPath(sdPath, VERSION_FILE);
  const content = `${version}\n`;
  const data = textEncoder.encode(content);
  await fs.writeFile(versionPath, data);
}

/**
 * Create migration lock file
 */
export async function createMigrationLock(sdPath: string, fs: FileSystemAdapter): Promise<void> {
  const lockPath = fs.joinPath(sdPath, LOCK_FILE);
  const lockData = {
    timestamp: new Date().toISOString(),
    // Note: process.pid is Node.js-specific, so we omit it here for cross-platform compatibility
    // Platform-specific implementations can add additional metadata if needed
  };
  const content = JSON.stringify(lockData, null, 2);
  const data = textEncoder.encode(content);
  await fs.writeFile(lockPath, data);
}

/**
 * Remove migration lock file
 */
export async function removeMigrationLock(sdPath: string, fs: FileSystemAdapter): Promise<void> {
  const lockPath = fs.joinPath(sdPath, LOCK_FILE);
  try {
    await fs.deleteFile(lockPath);
  } catch {
    // Ignore if already removed
  }
}

/**
 * Check if migration is in progress
 */
export async function isMigrationLocked(sdPath: string, fs: FileSystemAdapter): Promise<boolean> {
  const lockPath = fs.joinPath(sdPath, LOCK_FILE);
  return await fs.exists(lockPath);
}
