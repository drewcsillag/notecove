/**
 * Profile System Types
 *
 * Types for the profile management system that separates development
 * and production data. Each profile has its own database and can have
 * multiple Storage Directories attached.
 *
 * @see PLAN-profiles.md for full requirements
 */

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

  /** Timestamp when the profile was created (ms since epoch) */
  created: number;

  /** Timestamp when the profile was last used (ms since epoch) */
  lastUsed: number;
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
 * Create a new profile with the given name and dev status
 */
export function createProfile(name: string, isDev: boolean): Profile {
  const now = Date.now();
  return {
    id: generateProfileId(),
    name,
    isDev,
    created: now,
    lastUsed: now,
  };
}

/**
 * Generate a unique profile ID
 */
function generateProfileId(): string {
  // Simple UUID v4-like generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
