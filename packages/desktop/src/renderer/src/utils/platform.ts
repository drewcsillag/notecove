/**
 * Platform Detection Utilities
 *
 * Provides functions to detect the runtime environment (Electron vs browser)
 * and determine which features are available.
 */

/**
 * Check if running in Electron environment
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}

/**
 * Check if running in browser environment (connected via web server)
 */
export function isBrowser(): boolean {
  return !isElectron();
}

/**
 * Features that require Electron and are not available in browser mode.
 * These features need native OS dialogs or direct filesystem access.
 */
export const ELECTRON_ONLY_FEATURES = {
  /** Export notes to files (requires file save dialog) */
  export: true,
  /** Storage directory management (requires folder picker) */
  storageDirectoryManagement: true,
  /** Database settings (requires filesystem access) */
  databaseSettings: true,
  /** Recovery settings (requires database access) */
  recoverySettings: true,
  /** Web server settings (browser is already a web client) */
  webServerSettings: true,
  /** Telemetry settings (config stored via Electron) */
  telemetrySettings: true,
  /** Profile switching (Electron app-level feature) */
  profileSwitching: true,
} as const;

/**
 * Check if a specific feature is available in the current environment.
 * Returns true if the feature is available, false if it's gated.
 */
export function isFeatureAvailable(feature: keyof typeof ELECTRON_ONLY_FEATURES): boolean {
  if (isElectron()) {
    return true; // All features available in Electron
  }
  // In browser, Electron-only features are not available
  return !ELECTRON_ONLY_FEATURES[feature];
}
