/**
 * Sync Handlers
 *
 * IPC handlers for sync status and app state operations.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, dialog, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs/promises';
import * as os from 'os';
import type { HandlerContext } from './types';
import type { SyncStatus, StaleSyncEntry } from '../types';

/**
 * Register all sync-related IPC handlers
 */
export function registerSyncHandlers(ctx: HandlerContext): void {
  // App state operations
  ipcMain.handle('appState:get', handleGetAppState(ctx));
  ipcMain.handle('appState:set', handleSetAppState(ctx));

  // Sync status operations
  ipcMain.handle('sync:getStatus', handleGetSyncStatus(ctx));
  ipcMain.handle('sync:getStaleSyncs', handleGetStaleSyncs(ctx));
  ipcMain.handle('sync:skipStaleEntry', handleSkipStaleEntry(ctx));
  ipcMain.handle('sync:retryStaleEntry', handleRetryStaleEntry(ctx));
  ipcMain.handle('sync:exportDiagnostics', handleExportSyncDiagnostics(ctx));
}

/**
 * Unregister all sync-related IPC handlers
 */
export function unregisterSyncHandlers(): void {
  ipcMain.removeHandler('appState:get');
  ipcMain.removeHandler('appState:set');
  ipcMain.removeHandler('sync:getStatus');
  ipcMain.removeHandler('sync:getStaleSyncs');
  ipcMain.removeHandler('sync:skipStaleEntry');
  ipcMain.removeHandler('sync:retryStaleEntry');
  ipcMain.removeHandler('sync:exportDiagnostics');
}

// =============================================================================
// App State Handler Factories
// =============================================================================

function handleGetAppState(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, key: string): Promise<string | null> => {
    return await ctx.database.getState(key);
  };
}

function handleSetAppState(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, key: string, value: string): Promise<void> => {
    const { database, onUserSettingsChanged, broadcastToAll, profileId } = ctx;

    await database.setState(key, value);

    // Notify if user settings changed (for profile presence updates and UI reactivity)
    if (key === 'username' || key === 'userHandle') {
      // Update profile presence files on disk
      if (onUserSettingsChanged) {
        await onUserSettingsChanged(key, value);
      }

      // Broadcast to all renderer windows so they can update their UI
      // Fetch the current profile to send complete data
      const username = (await database.getState('username')) ?? '';
      const handle = (await database.getState('userHandle')) ?? '';
      console.log('[User Settings] Broadcasting profile change');
      broadcastToAll('user:profileChanged', { profileId, username, handle });
    }
  };
}

// =============================================================================
// Sync Status Handler Factories
// =============================================================================

function handleGetSyncStatus(ctx: HandlerContext) {
  return async (): Promise<SyncStatus> => {
    if (!ctx.getSyncStatus) {
      return {
        pendingCount: 0,
        perSd: [],
        isSyncing: false,
      };
    }
    return ctx.getSyncStatus();
  };
}

function handleGetStaleSyncs(ctx: HandlerContext) {
  return async (): Promise<StaleSyncEntry[]> => {
    if (!ctx.getStaleSyncs) {
      return [];
    }
    return ctx.getStaleSyncs();
  };
}

function handleSkipStaleEntry(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    noteId: string,
    sourceInstanceId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!ctx.skipStaleEntry) {
      return { success: false, error: 'Skip stale entry not available' };
    }
    return ctx.skipStaleEntry(sdId, noteId, sourceInstanceId);
  };
}

function handleRetryStaleEntry(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    noteId: string,
    sourceInstanceId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!ctx.retryStaleEntry) {
      return { success: false, error: 'Retry stale entry not available' };
    }
    return ctx.retryStaleEntry(sdId, noteId, sourceInstanceId);
  };
}

function handleExportSyncDiagnostics(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    const { database, getStaleSyncs } = ctx;

    try {
      // Show save dialog
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFilename = `notecove-sync-diagnostics-${timestamp}.json`;

      const dialogOptions = {
        title: 'Export Sync Diagnostics',
        defaultPath: defaultFilename,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      };

      const { filePath, canceled } = focusedWindow
        ? await dialog.showSaveDialog(focusedWindow, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (canceled || !filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      // Collect diagnostics data
      const { app } = await import('electron');
      const diagnostics: {
        exportedAt: string;
        appVersion: string;
        platform: string;
        osVersion: string;
        staleEntries: StaleSyncEntry[];
        storageDirs: { id: string; name: string; path: string }[];
      } = {
        exportedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
        platform: os.platform(),
        osVersion: os.release(),
        staleEntries: getStaleSyncs ? await getStaleSyncs() : [],
        storageDirs: (await database.getAllStorageDirs()).map((sd) => ({
          id: sd.id,
          name: sd.name,
          path: sd.path,
        })),
      };

      // Write to file
      await fs.writeFile(filePath, JSON.stringify(diagnostics, null, 2), 'utf-8');

      return { success: true, filePath };
    } catch (err) {
      console.error('[IPCHandlers] Failed to export sync diagnostics:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };
}
