/**
 * Checkbox Settings API: broadcasts for checkbox behavior settings
 */

import { ipcRenderer } from 'electron';

export const checkboxSettingsApi = {
  /**
   * Listen for checkbox settings changes broadcast from main process.
   * Called when any window changes a checkbox setting.
   */
  onChanged: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('checkboxSettings:changed', listener);
    return () => {
      ipcRenderer.removeListener('checkboxSettings:changed', listener);
    };
  },
};
