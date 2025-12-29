/**
 * Application-level API: appState, config, telemetry, shell, clipboard, profile, app
 */

import { ipcRenderer } from 'electron';

export const appStateApi = {
  get: (key: string): Promise<string | null> =>
    ipcRenderer.invoke('appState:get', key) as Promise<string | null>,
  set: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('appState:set', key, value) as Promise<void>,
};

export const configApi = {
  getDatabasePath: (): Promise<string> =>
    ipcRenderer.invoke('config:getDatabasePath') as Promise<string>,
  setDatabasePath: (path: string): Promise<void> =>
    ipcRenderer.invoke('config:setDatabasePath', path) as Promise<void>,
};

export const telemetryApi = {
  getSettings: (): Promise<{
    consoleMetricsEnabled: boolean;
    remoteMetricsEnabled: boolean;
    datadogApiKey?: string;
  }> =>
    ipcRenderer.invoke('telemetry:getSettings') as Promise<{
      consoleMetricsEnabled: boolean;
      remoteMetricsEnabled: boolean;
      datadogApiKey?: string;
    }>,
  updateSettings: (settings: {
    consoleMetricsEnabled?: boolean;
    remoteMetricsEnabled?: boolean;
    datadogApiKey?: string;
  }): Promise<void> => ipcRenderer.invoke('telemetry:updateSettings', settings) as Promise<void>,
};

export const shellApi = {
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
};

export const clipboardApi = {
  writeText: (text: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:writeText', text) as Promise<void>,
  readText: (): Promise<string> => ipcRenderer.invoke('clipboard:readText') as Promise<string>,
  /**
   * Write rich format to clipboard (HTML + plain text fallback)
   * This allows pasting as formatted content in rich text editors
   * while falling back to plain text in plain text contexts.
   */
  writeRich: (html: string, text: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:writeRich', html, text) as Promise<void>,
};

export const profileApi = {
  getInfo: (): Promise<{
    profileId: string | null;
    profile: { id: string; name: string; isDev: boolean } | null;
    isDevBuild: boolean;
  }> => ipcRenderer.invoke('profile:getInfo'),
};

export const appApi = {
  getInfo: (): Promise<{
    version: string;
    isDevBuild: boolean;
    profileId: string | null;
    profileName: string | null;
    instanceId: string;
  }> => ipcRenderer.invoke('app:getInfo'),
};
