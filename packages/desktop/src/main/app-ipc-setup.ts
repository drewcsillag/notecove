/**
 * IPC Handler Registration
 *
 * Registers simple IPC handlers that don't require complex setup.
 * Complex handlers (like SD initialization) remain in index.ts.
 */

import { ipcMain, shell, clipboard } from 'electron';
import type { WebServerManager } from './web-server/manager';
import { getProfileStorage } from './profile-picker';

export interface IPCSetupDependencies {
  selectedProfileId: string | null;
  isPackaged: boolean;
  appVersion: string;
  appDataDir: string;
  webServerManager: WebServerManager | null;
  createMenu: () => void;
}

/**
 * Register basic IPC handlers for profile info, app info, clipboard, etc.
 */
export function registerBasicIPCHandlers(deps: IPCSetupDependencies): void {
  const { selectedProfileId, isPackaged, appVersion, appDataDir, webServerManager, createMenu } =
    deps;

  // Register profile debug IPC handler for DevTools inspection
  ipcMain.handle('profile:getInfo', async () => {
    const profileStorage = getProfileStorage(appDataDir);
    const config = await profileStorage.loadProfiles();
    const currentProfile = config.profiles.find((p) => p.id === selectedProfileId) ?? null;
    return {
      profileId: selectedProfileId,
      profile: currentProfile,
      isDevBuild: !isPackaged,
    };
  });

  // Register app info IPC handler for titlebar and About dialog
  ipcMain.handle('app:getInfo', async () => {
    const profileStorage = getProfileStorage(appDataDir);
    const config = await profileStorage.loadProfiles();
    const currentProfile = config.profiles.find((p) => p.id === selectedProfileId) ?? null;
    return {
      version: appVersion,
      isDevBuild: !isPackaged,
      profileId: selectedProfileId,
      profileName: currentProfile?.name ?? null,
    };
  });

  // Register shell IPC handler for opening external URLs (for About dialog license link)
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Register clipboard IPC handlers (for copy functionality and testing)
  ipcMain.handle('clipboard:writeText', (_event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle('clipboard:readText', () => {
    return clipboard.readText();
  });

  // Register web server IPC handlers
  ipcMain.handle('webServer:start', async (_event, port?: number) => {
    if (!webServerManager) {
      throw new Error('WebServerManager not initialized');
    }
    const status = await webServerManager.start(port);
    createMenu(); // Refresh menu to update label
    return status;
  });

  ipcMain.handle('webServer:stop', async () => {
    if (!webServerManager) {
      throw new Error('WebServerManager not initialized');
    }
    await webServerManager.stop();
    createMenu(); // Refresh menu to update label
  });

  ipcMain.handle('webServer:getStatus', () => {
    if (!webServerManager) {
      return {
        running: false,
        port: 8765,
        url: null,
        token: null,
        connectedClients: 0,
        localhostOnly: false,
        tlsMode: 'self-signed' as const,
        tlsEnabled: true,
      };
    }
    return webServerManager.getStatus();
  });

  ipcMain.handle('webServer:getSettings', () => {
    if (!webServerManager) {
      return {
        port: 8765,
        localhostOnly: false,
        tlsMode: 'self-signed' as const,
        customCertPath: undefined,
        customKeyPath: undefined,
      };
    }
    return webServerManager.getSettings();
  });

  ipcMain.handle(
    'webServer:setSettings',
    async (
      _event,
      settings: {
        port?: number;
        localhostOnly?: boolean;
        tlsMode?: 'off' | 'self-signed' | 'custom';
        customCertPath?: string;
        customKeyPath?: string;
      }
    ) => {
      if (!webServerManager) {
        throw new Error('WebServerManager not initialized');
      }
      await webServerManager.setSettings(settings);
    }
  );

  ipcMain.handle('webServer:regenerateToken', async () => {
    if (!webServerManager) {
      throw new Error('WebServerManager not initialized');
    }
    return await webServerManager.regenerateToken();
  });

  ipcMain.handle('webServer:getConnectedClients', () => {
    if (!webServerManager) {
      return [];
    }
    return webServerManager.getConnectedClients();
  });

  ipcMain.handle('webServer:disconnectClient', (_event, clientId: string) => {
    if (!webServerManager) {
      return false;
    }
    return webServerManager.disconnectClient(clientId);
  });

  ipcMain.handle('webServer:disconnectAllClients', () => {
    if (!webServerManager) {
      return;
    }
    webServerManager.disconnectAllClients();
  });

  ipcMain.handle('webServer:getCertificateInfo', () => {
    if (!webServerManager) {
      return null;
    }
    return webServerManager.getCertificateInfo();
  });
}
