/**
 * Storage Directory Version Management Types
 *
 * Types and constants for SD format version checking.
 */

/**
 * Current SD format version supported by this library
 */
export const CURRENT_SD_VERSION = 1;

/**
 * File names for version management
 */
export const VERSION_FILE = 'SD_VERSION';
export const LOCK_FILE = '.migration-lock';

/**
 * SD version check result types
 */
export type VersionCheckResult =
  | { compatible: true; version: number }
  | {
      compatible: false;
      reason: 'too-new' | 'too-old' | 'locked';
      sdVersion?: number;
      appVersion: number;
    };
