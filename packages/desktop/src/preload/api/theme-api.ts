/**
 * Theme API: theme change broadcasts and settings
 */

import { ipcRenderer } from 'electron';

export type ThemeMode = 'light' | 'dark';

export const themeApi = {
  /**
   * Set the theme mode. This saves to database and broadcasts to all windows.
   * Use this from Settings dialog to ensure all windows update.
   */
  set: (theme: ThemeMode): Promise<void> => ipcRenderer.invoke('theme:set', theme) as Promise<void>,

  /**
   * Listen for theme changes broadcast from main process.
   * Called when any window changes the theme (via menu or Settings).
   */
  onChanged: (callback: (theme: ThemeMode) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: ThemeMode): void => {
      callback(theme);
    };
    ipcRenderer.on('theme:changed', listener);
    return () => {
      ipcRenderer.removeListener('theme:changed', listener);
    };
  },
};
