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
import type { Profile, ProfileMode, ProfilesConfig } from './types';
import { createEmptyProfilesConfig, createProfile } from './types';

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
   * Note: Existing profile IDs are NOT migrated because the profile ID
   * is used as a directory name. New profiles get compact 22-char IDs.
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
      console.error(
        '[ProfileStorage] Failed to load profiles.json, returning empty config:',
        error
      );
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

  /**
   * Create a new profile with the given name, dev status, and optional mode.
   *
   * Creates the profile entry in profiles.json and the profile's data directory.
   *
   * @param name - Display name for the profile
   * @param isDev - Whether this is a development profile
   * @param mode - Profile mode (defaults to 'local' if not specified)
   * @returns The newly created Profile
   */
  async createProfile(name: string, isDev: boolean, mode?: ProfileMode): Promise<Profile> {
    // Create the profile object using the helper from types.ts
    const profile = createProfile(name, isDev, mode);

    // Load existing config and add the new profile
    const config = await this.loadProfiles();
    config.profiles.push(profile);

    // Save the updated config
    await this.saveProfiles(config);

    // Create the profile's data directory
    await this.ensureProfileDataDir(profile.id);

    console.log(`[ProfileStorage] Created profile: ${profile.name} (${profile.id})`);
    return profile;
  }

  /**
   * Delete a profile from the configuration.
   *
   * Note: This only removes the profile entry from profiles.json.
   * The profile's data directory is NOT deleted (per requirements).
   * The user can manually delete the directory if desired.
   *
   * @param profileId - The ID of the profile to delete
   * @throws Error if profile does not exist
   */
  async deleteProfile(profileId: string): Promise<void> {
    const config = await this.loadProfiles();

    // Find the profile
    const profileIndex = config.profiles.findIndex((p) => p.id === profileId);
    if (profileIndex === -1) {
      throw new Error('Profile not found');
    }

    // Remove the profile from the array
    config.profiles.splice(profileIndex, 1);

    // Clear defaultProfileId if we're deleting the default profile
    if (config.defaultProfileId === profileId) {
      config.defaultProfileId = null;
      config.skipPicker = false; // Reset skipPicker since there's no default
    }

    // Save the updated config
    await this.saveProfiles(config);

    console.log(`[ProfileStorage] Deleted profile: ${profileId}`);
  }

  /**
   * Rename a profile.
   *
   * @param profileId - The ID of the profile to rename
   * @param newName - The new display name
   * @throws Error if profile does not exist or name is empty
   */
  async renameProfile(profileId: string, newName: string): Promise<void> {
    // Validate the new name
    if (!newName.trim()) {
      throw new Error('Profile name cannot be empty');
    }

    const config = await this.loadProfiles();

    // Find the profile
    const profile = config.profiles.find((p) => p.id === profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Update the name
    profile.name = newName.trim();

    // Save the updated config
    await this.saveProfiles(config);

    console.log(`[ProfileStorage] Renamed profile ${profileId} to: ${newName}`);
  }

  /**
   * Update the lastUsed timestamp for a profile.
   *
   * @param profileId - The ID of the profile to update
   */
  async updateLastUsed(profileId: string): Promise<void> {
    const config = await this.loadProfiles();

    const profile = config.profiles.find((p) => p.id === profileId);
    if (!profile) {
      // Silently ignore if profile doesn't exist (could be a test scenario)
      return;
    }

    profile.lastUsed = Date.now();

    await this.saveProfiles(config);
    console.log(`[ProfileStorage] Updated lastUsed for profile: ${profileId}`);
  }

  /**
   * Clear the "skip picker" preference.
   *
   * This resets the skipPicker flag to false, forcing the profile picker
   * to be shown on next launch. The defaultProfileId is kept so the user's
   * preferred profile is still pre-selected.
   */
  async clearSkipPicker(): Promise<void> {
    const config = await this.loadProfiles();
    config.skipPicker = false;
    await this.saveProfiles(config);
    console.log('[ProfileStorage] Cleared skipPicker preference');
  }

  /**
   * Clear initialization data from a profile.
   *
   * This removes the initialUsername and initialHandle fields that were set
   * by the wizard. Called after these settings have been applied on first
   * launch to prevent re-application.
   *
   * Note: initialStoragePath was removed - SD is now created during profile creation.
   *
   * @param profileId - The ID of the profile to update
   */
  async clearInitializationData(profileId: string): Promise<void> {
    const config = await this.loadProfiles();

    const profile = config.profiles.find((p) => p.id === profileId);
    if (!profile) {
      // Silently ignore if profile doesn't exist
      return;
    }

    // Remove initialization fields
    delete profile.initialUsername;
    delete profile.initialHandle;

    await this.saveProfiles(config);
    console.log(`[ProfileStorage] Cleared initialization data for profile: ${profileId}`);
  }
}
