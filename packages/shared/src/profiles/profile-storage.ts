/**
 * Profile Storage
 *
 * Manages loading and saving of profile configuration from profiles.json.
 * Uses a FileSystemAdapter for cross-platform compatibility.
 *
 * File location: ~/Library/Application Support/NoteCove/profiles.json
 * Profile data: ~/Library/Application Support/NoteCove/profiles/<profile-id>/
 */

import type { FileSystemAdapter } from '../storage/types';
import type { ProfilesConfig } from './types';
import { createEmptyProfilesConfig } from './types';

/** Filename for the profiles configuration */
const PROFILES_CONFIG_FILENAME = 'profiles.json';

/** Directory name for profile data */
const PROFILES_DIR = 'profiles';

/** Database filename within each profile directory */
const DATABASE_FILENAME = 'notecove.db';

/**
 * ProfileStorage handles reading and writing profile configuration.
 *
 * The configuration is stored in a JSON file at the app data directory level,
 * while each profile's database and data are stored in subdirectories.
 */
export class ProfileStorage {
  /** Path to profiles.json */
  private readonly configPath: string;

  /** Path to profiles directory */
  private readonly profilesDir: string;

  constructor(
    private readonly fs: FileSystemAdapter,
    private readonly appDataDir: string
  ) {
    this.configPath = fs.joinPath(appDataDir, PROFILES_CONFIG_FILENAME);
    this.profilesDir = fs.joinPath(appDataDir, PROFILES_DIR);
  }

  /**
   * Load profiles configuration from disk.
   *
   * Returns an empty config if:
   * - The file doesn't exist (first run)
   * - The file is corrupted (recovery)
   *
   * @returns The loaded ProfilesConfig or empty config
   */
  async loadProfiles(): Promise<ProfilesConfig> {
    try {
      // Check if file exists
      const exists = await this.fs.exists(this.configPath);
      if (!exists) {
        console.log('[ProfileStorage] profiles.json not found, returning empty config');
        return createEmptyProfilesConfig();
      }

      // Read and parse the file
      const data = await this.fs.readFile(this.configPath);
      const content = new TextDecoder().decode(data);
      const config = JSON.parse(content) as ProfilesConfig;

      console.log(`[ProfileStorage] Loaded ${config.profiles.length} profiles`);
      return config;
    } catch (error) {
      // File corrupted or other error - return empty config for recovery
      console.error('[ProfileStorage] Failed to load profiles.json, returning empty config:', error);
      return createEmptyProfilesConfig();
    }
  }

  /**
   * Save profiles configuration to disk.
   *
   * Creates the app data directory if it doesn't exist.
   * Writes atomically to prevent corruption.
   *
   * @param config - The ProfilesConfig to save
   */
  async saveProfiles(config: ProfilesConfig): Promise<void> {
    try {
      // Ensure the app data directory exists
      await this.fs.mkdir(this.appDataDir);

      // Serialize to JSON with pretty formatting for debugging
      const content = JSON.stringify(config, null, 2);
      const data = new TextEncoder().encode(content);

      // Write to disk (FileSystemAdapter handles atomic write)
      await this.fs.writeFile(this.configPath, data);

      console.log(`[ProfileStorage] Saved ${config.profiles.length} profiles`);
    } catch (error) {
      console.error('[ProfileStorage] Failed to save profiles.json:', error);
      throw error;
    }
  }

  /**
   * Get the path to a profile's database file.
   *
   * @param profileId - The profile's unique ID
   * @returns Path to the profile's notecove.db file
   */
  getProfileDatabasePath(profileId: string): string {
    return this.fs.joinPath(this.profilesDir, profileId, DATABASE_FILENAME);
  }

  /**
   * Get the path to a profile's data directory.
   *
   * This directory contains the profile's database and any other profile-specific data.
   *
   * @param profileId - The profile's unique ID
   * @returns Path to the profile's data directory
   */
  getProfileDataDir(profileId: string): string {
    return this.fs.joinPath(this.profilesDir, profileId);
  }

  /**
   * Ensure a profile's data directory exists.
   *
   * Creates the directory structure if needed.
   *
   * @param profileId - The profile's unique ID
   */
  async ensureProfileDataDir(profileId: string): Promise<void> {
    const profileDir = this.getProfileDataDir(profileId);
    await this.fs.mkdir(profileDir);
    console.log(`[ProfileStorage] Ensured profile directory exists: ${profileDir}`);
  }
}
