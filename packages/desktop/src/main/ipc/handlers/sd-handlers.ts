/**
 * Storage Directory (SD) Handlers
 *
 * IPC handlers for storage directory operations: list, create, delete, rename, etc.
 */

import { ipcMain, dialog, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { HandlerContext } from './types';

/**
 * Register all SD-related IPC handlers
 */
export function registerSDHandlers(ctx: HandlerContext): void {
  ipcMain.handle('sd:list', handleListStorageDirs(ctx));
  ipcMain.handle('sd:create', handleCreateStorageDir(ctx));
  ipcMain.handle('sd:setActive', handleSetActiveStorageDir(ctx));
  ipcMain.handle('sd:getActive', handleGetActiveStorageDir(ctx));
  ipcMain.handle('sd:delete', handleDeleteStorageDir(ctx));
  ipcMain.handle('sd:rename', handleRenameStorageDir(ctx));
  ipcMain.handle('sd:selectPath', handleSelectSDPath(ctx));
  ipcMain.handle('sd:getCloudStoragePaths', handleGetCloudStoragePaths(ctx));
}

/**
 * Unregister all SD-related IPC handlers
 */
export function unregisterSDHandlers(): void {
  ipcMain.removeHandler('sd:list');
  ipcMain.removeHandler('sd:create');
  ipcMain.removeHandler('sd:setActive');
  ipcMain.removeHandler('sd:getActive');
  ipcMain.removeHandler('sd:delete');
  ipcMain.removeHandler('sd:rename');
  ipcMain.removeHandler('sd:selectPath');
  ipcMain.removeHandler('sd:getCloudStoragePaths');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleListStorageDirs(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent
  ): Promise<{ id: string; name: string; path: string; created: number; isActive: boolean }[]> => {
    return await ctx.database.getAllStorageDirs();
  };
}

function handleCreateStorageDir(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, name: string, sdPath: string): Promise<string> => {
    const { database, onStorageDirCreated, broadcastToAll } = ctx;

    // Use unified SD ID system (SD_ID file, with .sd-id migration)
    const { migrateAndGetSdId } = await import('../../sd-id-migration');
    const result = await migrateAndGetSdId(sdPath);

    const id = result.id;
    if (result.wasGenerated) {
      console.log(`[SD] Created new SD_ID in ${sdPath}: ${id}`);
    } else if (result.migrated) {
      console.log(`[SD] Migrated legacy .sd-id to SD_ID in ${sdPath}: ${id}`);
    } else {
      console.log(`[SD] Using existing SD_ID in ${sdPath}: ${id}`);
    }

    await database.createStorageDir(id, name, sdPath);

    // Initialize the new SD (register with UpdateManager, set up watchers, etc.)
    if (onStorageDirCreated) {
      await onStorageDirCreated(id, sdPath);
    }

    // Broadcast SD update to all windows
    broadcastToAll('sd:updated', { operation: 'create', sdId: id });

    return id;
  };
}

function handleSetActiveStorageDir(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<void> => {
    await ctx.database.setActiveStorageDir(sdId);
    ctx.broadcastToAll('sd:updated', { operation: 'setActive', sdId });
  };
}

function handleGetActiveStorageDir(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<string | null> => {
    const activeSD = await ctx.database.getActiveStorageDir();
    return activeSD ? activeSD.id : null;
  };
}

function handleDeleteStorageDir(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<void> => {
    await ctx.database.deleteStorageDir(sdId);
    ctx.broadcastToAll('sd:updated', { operation: 'delete', sdId });
  };
}

function handleRenameStorageDir(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string, newName: string): Promise<void> => {
    await ctx.database.updateStorageDirName(sdId, newName);
    ctx.broadcastToAll('sd:updated', { operation: 'rename', sdId });
  };
}

function handleSelectSDPath(ctx: HandlerContext) {
  return async (event: IpcMainInvokeEvent, defaultPath?: string): Promise<string | null> => {
    void ctx; // unused but part of handler pattern

    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return null;
    }

    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Storage Directory Location',
      buttonLabel: 'Select Folder',
    };

    if (defaultPath) {
      dialogOptions.defaultPath = defaultPath;
    }

    const result = await dialog.showOpenDialog(window, dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0] ?? null;
  };
}

function handleGetCloudStoragePaths(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<Record<string, string>> => {
    void ctx; // unused but part of handler pattern

    const homeDir = os.homedir();
    const platform = os.platform();
    const candidatePaths: Record<string, string> = {};

    if (platform === 'darwin') {
      candidatePaths['iCloudDrive'] = path.join(
        homeDir,
        'Library/Mobile Documents/com~apple~CloudDocs'
      );
      candidatePaths['Dropbox'] = path.join(homeDir, 'Dropbox');
      candidatePaths['GoogleDrive'] = path.join(homeDir, 'Google Drive');
      candidatePaths['OneDrive'] = path.join(homeDir, 'OneDrive');
    } else if (platform === 'win32') {
      candidatePaths['iCloudDrive'] = path.join(homeDir, 'iCloudDrive');
      candidatePaths['Dropbox'] = path.join(homeDir, 'Dropbox');
      candidatePaths['GoogleDrive'] = path.join(homeDir, 'Google Drive');
      candidatePaths['OneDrive'] = path.join(homeDir, 'OneDrive');
    } else {
      candidatePaths['Dropbox'] = path.join(homeDir, 'Dropbox');
      candidatePaths['GoogleDrive'] = path.join(homeDir, 'Google Drive');
    }

    // Check which paths actually exist
    const existingPaths: Record<string, string> = {};
    for (const [name, dirPath] of Object.entries(candidatePaths)) {
      try {
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
          existingPaths[name] = dirPath;
        }
      } catch {
        // Directory doesn't exist, skip it
      }
    }

    return existingPaths;
  };
}
