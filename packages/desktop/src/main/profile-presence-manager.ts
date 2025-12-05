/**
 * ProfilePresenceManager
 *
 * Manages writing profile presence files to SDs. Each profile that connects
 * to an SD writes a presence file identifying itself, enabling the Stale Sync UI
 * to show meaningful device/user names instead of UUIDs.
 *
 * File location: {SD}/profiles/{profileId}.json
 *
 * @see plans/stale-sync-ux/PROFILE-PRESENCE.md
 */

import type {
  FileSystemAdapter,
  ProfilePresence,
  ProfilePresencePlatform,
  Database,
} from '@notecove/shared';
import { AppStateKey } from '@notecove/shared';

/**
 * Configuration for the ProfilePresenceManager
 */
export interface ProfilePresenceConfig {
  profileId: string;
  instanceId: string;
  profileName: string;
  hostname: string;
  platform: ProfilePresencePlatform;
  appVersion: string;
}

/**
 * Changes that might trigger a presence update
 */
export interface PresenceChangeEvent {
  userHandle?: string;
  username?: string;
  profileName?: string;
  hostname?: string;
  appVersion?: string;
  [key: string]: unknown;
}

/**
 * ProfilePresenceManager handles writing profile presence files to SDs.
 *
 * Write triggers (from PROFILE-PRESENCE.md):
 * 1. First connect to SD - Profile mounts an SD it hasn't seen before
 * 2. @user changes - User updates their mention handle in settings
 * 3. username changes - User updates their display name in settings
 * 4. profileName changes - User renames the profile
 * 5. hostname changes - Detected on app startup (compare to cached value)
 * 6. appVersion changes - App upgrade detected on startup
 */
export class ProfilePresenceManager {
  private config: ProfilePresenceConfig;

  constructor(
    private readonly fs: Pick<FileSystemAdapter, 'writeFile' | 'mkdir' | 'exists' | 'joinPath'>,
    private readonly db: Database,
    config: ProfilePresenceConfig
  ) {
    this.config = { ...config };
  }

  /**
   * Write the presence file to a specific SD
   */
  async writePresence(sdPath: string): Promise<void> {
    const profilesDir = this.fs.joinPath(sdPath, 'profiles');
    const presenceFilePath = this.fs.joinPath(profilesDir, `${this.config.profileId}.json`);

    // Ensure profiles directory exists
    if (!(await this.fs.exists(profilesDir))) {
      await this.fs.mkdir(profilesDir);
    }

    // Get user settings from database
    const userHandle = (await this.db.getState(AppStateKey.UserHandle)) ?? '';
    const username = (await this.db.getState(AppStateKey.Username)) ?? '';

    const presence: ProfilePresence = {
      profileId: this.config.profileId,
      instanceId: this.config.instanceId,
      profileName: this.config.profileName,
      user: userHandle,
      username: username,
      hostname: this.config.hostname,
      platform: this.config.platform,
      appVersion: this.config.appVersion,
      lastUpdated: Date.now(),
    };

    const content = JSON.stringify(presence, null, 2);
    const encoder = new TextEncoder();
    await this.fs.writeFile(presenceFilePath, encoder.encode(content));

    console.log(`[ProfilePresence] Wrote presence file to ${presenceFilePath}`);
  }

  /**
   * Write presence to all connected SDs
   */
  async writePresenceToAllSDs(sdPaths: string[]): Promise<void> {
    await Promise.all(sdPaths.map((sdPath) => this.writePresence(sdPath)));
  }

  /**
   * Check if a change event should trigger a presence update
   */
  shouldUpdatePresence(changes: PresenceChangeEvent): boolean {
    const relevantKeys = ['userHandle', 'username', 'profileName', 'hostname', 'appVersion'];
    return relevantKeys.some((key) => key in changes && changes[key] !== undefined);
  }

  /**
   * Update the manager's config (call when settings change)
   */
  updateConfig(updates: Partial<ProfilePresenceConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get the current config (for testing)
   */
  getConfig(): ProfilePresenceConfig {
    return { ...this.config };
  }
}
