/**
 * Profile System Types
 *
 * Types for the profile management system that separates development
 * and production data. Each profile has its own database and can have
 * multiple Storage Directories attached.
 *
 * @see PLAN-profiles.md for full requirements
 */

import { generateCompactId } from '../utils/uuid-encoding';

/**
 * Profile mode determines storage location, privacy settings, and available features.
 *
 * - 'local': Storage at ~/Documents/NoteCove, user info asked, all features available
 * - 'cloud': Storage in cloud provider folder, user info asked, all features available
 * - 'paranoid': Local storage, no user info, secure link mode, no cloud quick-add
 * - 'custom': User-specified storage path, user info asked, all features available
 *
 * Existing profiles without a mode field are treated as 'local' (full permissions).
 */
export type ProfileMode = 'local' | 'cloud' | 'paranoid' | 'custom';

/**
 * Represents a single profile.
 *
 * A profile is an isolated environment with its own database.
 * Profiles can be marked as dev-only to prevent production builds
 * from accidentally accessing development data.
 */
export interface Profile {
  /** Unique identifier for the profile (UUID) */
  id: string;

  /** Display name for the profile (e.g., "Development", "Production", "Work") */
  name: string;

  /** Whether this profile is for development use only */
  isDev: boolean;

  /**
   * Profile mode determining storage, privacy, and feature availability.
   * Optional for backwards compatibility - profiles without mode are treated as 'local'.
   */
  mode?: ProfileMode;

  /** Timestamp when the profile was created (ms since epoch) */
  created: number;

  /** Timestamp when the profile was last used (ms since epoch) */
  lastUsed: number;

  // =========================================================================
  // Initialization fields - set by wizard, consumed on first launch
  // These are cleared after the settings are applied.
  // =========================================================================

  /**
   * Initial storage directory path to set up on first launch.
   * The main app will create an SD at this path when the profile is first used.
   */
  initialStoragePath?: string;

  /**
   * Initial username setting to apply on first launch.
   */
  initialUsername?: string;

  /**
   * Initial handle setting to apply on first launch.
   */
  initialHandle?: string;
}

/**
 * Configuration stored in profiles.json
 *
 * Contains the list of profiles and user preferences for profile selection.
 */
export interface ProfilesConfig {
  /** List of all profiles */
  profiles: Profile[];

  /** ID of the default profile to auto-select (null = always show picker) */
  defaultProfileId: string | null;

  /**
   * Whether to skip the picker on startup (production only).
   * Dev builds always show the picker regardless of this setting.
   */
  skipPicker: boolean;
}

/**
 * Type for the SD-TYPE marker file content
 */
export type SDType = 'dev' | 'prod';

/**
 * Create an empty ProfilesConfig with sensible defaults
 */
export function createEmptyProfilesConfig(): ProfilesConfig {
  return {
    profiles: [],
    defaultProfileId: null,
    skipPicker: false,
  };
}

/**
 * Create a new profile with the given name, dev status, and optional mode
 *
 * @param name Display name for the profile
 * @param isDev Whether this is a development-only profile
 * @param mode Profile mode (defaults to 'local' if not specified)
 */
export function createProfile(name: string, isDev: boolean, mode?: ProfileMode): Profile {
  const now = Date.now();
  return {
    id: generateProfileId(),
    name,
    isDev,
    mode: mode ?? 'local',
    created: now,
    lastUsed: now,
  };
}

/**
 * Generate a unique profile ID in compact format (22-char base64url)
 */
function generateProfileId(): string {
  return generateCompactId();
}

/**
 * Get the effective mode for a profile.
 * Returns 'local' for profiles without a mode field (backwards compatibility).
 */
export function getProfileMode(profile: Profile): ProfileMode {
  return profile.mode ?? 'local';
}

/**
 * Check if a profile mode allows cloud storage quick-add in settings
 */
export function modeAllowsCloudQuickAdd(mode: ProfileMode): boolean {
  return mode !== 'paranoid';
}

/**
 * Check if a profile mode allows changing link preview settings
 */
export function modeAllowsLinkPreviewChanges(mode: ProfileMode): boolean {
  return mode !== 'paranoid';
}

/**
 * Check if a profile mode asks for user info during onboarding
 */
export function modeAsksForUserInfo(mode: ProfileMode): boolean {
  return mode !== 'paranoid';
}

/**
 * Profile Presence - identifies a profile to other devices
 *
 * Each profile writes a presence file to the SD when it connects,
 * enabling the Stale Sync UI to show meaningful device/user names
 * instead of UUIDs.
 *
 * File location: {SD}/profiles/{profileId}.json
 *
 * @see PROFILE-PRESENCE.md for full design
 */
export interface ProfilePresence {
  /** Profile UUID (Profile.id) */
  profileId: string;

  /** Instance UUID (unique per app installation, used in activity logs) */
  instanceId: string;

  /** Display name for the profile (e.g., "Personal", "Work") */
  profileName: string;

  /** @mention handle (e.g., "@drew") */
  user: string;

  /** Display name (e.g., "Drew Colthorp") */
  username: string;

  /** Machine hostname (e.g., "Drews-MacBook-Pro.local") */
  hostname: string;

  /** Operating system platform */
  platform: 'darwin' | 'win32' | 'linux' | 'ios';

  /** App version (e.g., "0.1.2") */
  appVersion: string;

  /** Timestamp when the presence file was last updated (ms since epoch) */
  lastUpdated: number;
}

/**
 * Supported platform types for ProfilePresence
 */
export type ProfilePresencePlatform = ProfilePresence['platform'];
