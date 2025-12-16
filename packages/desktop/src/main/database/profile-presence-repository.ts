/**
 * Profile Presence Repository
 * Handles profile presence cache operations for Stale Sync UI
 */

import type { DatabaseAdapter, CachedProfilePresence } from '@notecove/shared';

export class ProfilePresenceRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async getProfilePresenceCache(
    profileId: string,
    sdId: string
  ): Promise<CachedProfilePresence | null> {
    const row = await this.adapter.get<{
      profile_id: string;
      instance_id: string | null;
      sd_id: string;
      profile_name: string | null;
      user: string | null;
      username: string | null;
      hostname: string | null;
      platform: string | null;
      app_version: string | null;
      last_updated: number | null;
      cached_at: number;
    }>('SELECT * FROM profile_presence_cache WHERE profile_id = ? AND sd_id = ?', [
      profileId,
      sdId,
    ]);

    if (!row) return null;

    return {
      profileId: row.profile_id,
      instanceId: row.instance_id,
      sdId: row.sd_id,
      profileName: row.profile_name,
      user: row.user,
      username: row.username,
      hostname: row.hostname,
      platform: row.platform,
      appVersion: row.app_version,
      lastUpdated: row.last_updated,
      cachedAt: row.cached_at,
    };
  }

  async getProfilePresenceCacheByInstanceId(
    instanceId: string,
    sdId: string
  ): Promise<CachedProfilePresence | null> {
    const row = await this.adapter.get<{
      profile_id: string;
      instance_id: string | null;
      sd_id: string;
      profile_name: string | null;
      user: string | null;
      username: string | null;
      hostname: string | null;
      platform: string | null;
      app_version: string | null;
      last_updated: number | null;
      cached_at: number;
    }>('SELECT * FROM profile_presence_cache WHERE instance_id = ? AND sd_id = ?', [
      instanceId,
      sdId,
    ]);

    if (!row) return null;

    return {
      profileId: row.profile_id,
      instanceId: row.instance_id,
      sdId: row.sd_id,
      profileName: row.profile_name,
      user: row.user,
      username: row.username,
      hostname: row.hostname,
      platform: row.platform,
      appVersion: row.app_version,
      lastUpdated: row.last_updated,
      cachedAt: row.cached_at,
    };
  }

  async getProfilePresenceCacheBySd(sdId: string): Promise<CachedProfilePresence[]> {
    const rows = await this.adapter.all<{
      profile_id: string;
      instance_id: string | null;
      sd_id: string;
      profile_name: string | null;
      user: string | null;
      username: string | null;
      hostname: string | null;
      platform: string | null;
      app_version: string | null;
      last_updated: number | null;
      cached_at: number;
    }>('SELECT * FROM profile_presence_cache WHERE sd_id = ?', [sdId]);

    return rows.map((row) => ({
      profileId: row.profile_id,
      instanceId: row.instance_id,
      sdId: row.sd_id,
      profileName: row.profile_name,
      user: row.user,
      username: row.username,
      hostname: row.hostname,
      platform: row.platform,
      appVersion: row.app_version,
      lastUpdated: row.last_updated,
      cachedAt: row.cached_at,
    }));
  }

  async upsertProfilePresenceCache(presence: CachedProfilePresence): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO profile_presence_cache (
        profile_id, instance_id, sd_id, profile_name, user, username, hostname,
        platform, app_version, last_updated, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, sd_id) DO UPDATE SET
        instance_id = excluded.instance_id,
        profile_name = excluded.profile_name,
        user = excluded.user,
        username = excluded.username,
        hostname = excluded.hostname,
        platform = excluded.platform,
        app_version = excluded.app_version,
        last_updated = excluded.last_updated,
        cached_at = excluded.cached_at`,
      [
        presence.profileId,
        presence.instanceId,
        presence.sdId,
        presence.profileName,
        presence.user,
        presence.username,
        presence.hostname,
        presence.platform,
        presence.appVersion,
        presence.lastUpdated,
        presence.cachedAt,
      ]
    );
  }

  async deleteProfilePresenceCache(profileId: string, sdId: string): Promise<void> {
    await this.adapter.exec(
      'DELETE FROM profile_presence_cache WHERE profile_id = ? AND sd_id = ?',
      [profileId, sdId]
    );
  }

  async deleteProfilePresenceCacheBySd(sdId: string): Promise<void> {
    await this.adapter.exec('DELETE FROM profile_presence_cache WHERE sd_id = ?', [sdId]);
  }
}
