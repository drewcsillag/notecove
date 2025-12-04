/**
 * ProfilePresenceReader
 *
 * Reads profile presence files from SDs and caches them in the local database.
 * When presence files are corrupt or missing, falls back to cached values.
 *
 * File location: {SD}/profiles/{profileId}.json
 *
 * @see plans/stale-sync-ux/PROFILE-PRESENCE.md
 */

import type { FileSystemAdapter, ProfilePresence, CachedProfilePresence } from '@notecove/shared';

/**
 * Database operations needed by ProfilePresenceReader
 */
export interface ProfilePresenceDatabase {
  getProfilePresenceCache(profileId: string, sdId: string): Promise<CachedProfilePresence | null>;
  getProfilePresenceCacheBySd(sdId: string): Promise<CachedProfilePresence[]>;
  upsertProfilePresenceCache(presence: CachedProfilePresence): Promise<void>;
}

/**
 * ProfilePresenceReader handles reading profile presence files from SDs
 * and caching them in the local database for fast access.
 */
export class ProfilePresenceReader {
  constructor(
    private readonly fs: Pick<FileSystemAdapter, 'readFile' | 'exists' | 'joinPath' | 'listFiles'>,
    private readonly db: ProfilePresenceDatabase
  ) {}

  /**
   * Read a single presence file and cache it in the database.
   * Falls back to cached value if file is missing or corrupt.
   *
   * @param sdPath Path to the storage directory
   * @param sdId ID of the storage directory
   * @param profileId ID of the profile to read
   * @returns The presence data, or null if not found and not cached
   */
  async readAndCachePresence(
    sdPath: string,
    sdId: string,
    profileId: string
  ): Promise<CachedProfilePresence | null> {
    const presenceFilePath = this.fs.joinPath(sdPath, 'profiles', `${profileId}.json`);

    try {
      // Try to read the presence file
      const content = await this.fs.readFile(presenceFilePath);
      const text = new TextDecoder().decode(content);
      const presence = JSON.parse(text) as ProfilePresence;

      // Cache the presence data
      const cachedPresence: CachedProfilePresence = {
        profileId: presence.profileId,
        sdId,
        profileName: presence.profileName,
        user: presence.user,
        username: presence.username,
        hostname: presence.hostname,
        platform: presence.platform,
        appVersion: presence.appVersion,
        lastUpdated: presence.lastUpdated,
        cachedAt: Date.now(),
      };

      await this.db.upsertProfilePresenceCache(cachedPresence);
      return cachedPresence;
    } catch {
      // File is missing, corrupt, or unreadable - fall back to cache
      console.log(`[ProfilePresence] Could not read presence file for ${profileId}, using cache`);
      return this.db.getProfilePresenceCache(profileId, sdId);
    }
  }

  /**
   * Read all presence files from an SD's profiles directory.
   * Skips corrupt files but uses cached values for them if available.
   *
   * @param sdPath Path to the storage directory
   * @param sdId ID of the storage directory
   * @returns Array of presence data (from files or cache)
   */
  async readAllPresenceFiles(sdPath: string, sdId: string): Promise<CachedProfilePresence[]> {
    const profilesDir = this.fs.joinPath(sdPath, 'profiles');

    // Check if profiles directory exists
    if (!(await this.fs.exists(profilesDir))) {
      return [];
    }

    try {
      // List all .json files in the profiles directory
      const entries = await this.fs.listFiles(profilesDir);
      const jsonFiles = entries.filter((name) => name.endsWith('.json'));

      // Read each presence file
      const results: CachedProfilePresence[] = [];
      for (const filename of jsonFiles) {
        const profileId = filename.replace('.json', '');
        const presence = await this.readAndCachePresence(sdPath, sdId, profileId);
        if (presence) {
          results.push(presence);
        }
      }

      return results;
    } catch (error: unknown) {
      console.error(`[ProfilePresence] Error reading profiles directory:`, error);
      // Fall back to cached presences for this SD
      return this.db.getProfilePresenceCacheBySd(sdId);
    }
  }

  /**
   * Get all cached presences for an SD (without reading files).
   * Useful when the SD is not currently connected.
   *
   * @param sdId ID of the storage directory
   * @returns Array of cached presence data
   */
  async getCachedPresenceForSd(sdId: string): Promise<CachedProfilePresence[]> {
    return this.db.getProfilePresenceCacheBySd(sdId);
  }

  /**
   * Get cached presence for a specific profile (without reading files).
   *
   * @param profileId ID of the profile
   * @param sdId ID of the storage directory
   * @returns Cached presence data, or null if not cached
   */
  async getCachedPresence(profileId: string, sdId: string): Promise<CachedProfilePresence | null> {
    return this.db.getProfilePresenceCache(profileId, sdId);
  }
}
