/**
 * Feature flags for NoteCove
 *
 * Feature flags control visibility of experimental or optional features.
 * When a feature is flagged off, it's hidden entirely from the UI
 * (menus, settings tabs, keyboard shortcuts).
 */

/**
 * Available feature flags
 */
export enum FeatureFlag {
  /** Telemetry/metrics collection and settings tab */
  Telemetry = 'telemetry',

  /** View History panel and menu item */
  ViewHistory = 'viewHistory',

  /** Web server for browser access */
  WebServer = 'webServer',
}

/**
 * Feature flag configuration - maps flags to their enabled state
 */
export type FeatureFlagConfig = {
  [K in FeatureFlag]: boolean;
};

/**
 * Default values for all feature flags.
 * These can be overridden by user preferences stored in config.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  [FeatureFlag.Telemetry]: false,
  [FeatureFlag.ViewHistory]: false,
  [FeatureFlag.WebServer]: false,
};

/**
 * Human-readable metadata for each feature flag
 */
export interface FeatureFlagMetadata {
  name: string;
  description: string;
  requiresRestart: boolean;
}

/**
 * Metadata for all feature flags
 */
export const FEATURE_FLAG_METADATA: Record<FeatureFlag, FeatureFlagMetadata> = {
  [FeatureFlag.Telemetry]: {
    name: 'Telemetry',
    description: 'Enable metrics collection and telemetry settings',
    requiresRestart: false,
  },
  [FeatureFlag.ViewHistory]: {
    name: 'View History',
    description: 'Enable note history panel and revision viewing',
    requiresRestart: true,
  },
  [FeatureFlag.WebServer]: {
    name: 'Web Server',
    description: 'Enable web server for browser access to notes',
    requiresRestart: true,
  },
};

/**
 * Get all feature flag names
 */
export function getAllFeatureFlags(): FeatureFlag[] {
  return Object.values(FeatureFlag);
}

/**
 * Check if a string is a valid feature flag
 */
export function isValidFeatureFlag(flag: string): flag is FeatureFlag {
  return Object.values(FeatureFlag).includes(flag as FeatureFlag);
}
