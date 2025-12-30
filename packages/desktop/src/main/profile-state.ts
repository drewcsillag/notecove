/**
 * Profile State Module
 *
 * This module holds the currently selected profile mode in a way that
 * can be imported without side effects. This is important for test isolation.
 */

import type { ProfileMode } from '@notecove/shared';

/**
 * The currently selected profile mode.
 * Set during app initialization from showProfilePicker() result.
 * Default to 'local' for backwards compatibility with profiles created before mode selection.
 */
let selectedProfileMode: ProfileMode = 'local';

/**
 * Get the mode of the currently selected profile.
 * This is used by the renderer to determine what features are available.
 */
export function getSelectedProfileMode(): ProfileMode {
  return selectedProfileMode;
}

/**
 * Set the mode of the currently selected profile.
 * Called during app initialization.
 */
export function setSelectedProfileMode(mode: ProfileMode): void {
  selectedProfileMode = mode;
}
