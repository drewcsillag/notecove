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
import type { SyncStatus } from '../types';
import {
  AppStateKey,
  type PollingGroupStoredSettings,
  type PollingGroupStatus,
} from '@notecove/shared';

/**
 * Register all sync-related IPC handlers
 */
export function registerSyncHandlers(ctx: HandlerContext): void {
  // App state operations
  ipcMain.handle('appState:get', handleGetAppState(ctx));
  ipcMain.handle('appState:set', handleSetAppState(ctx));

  // Sync status operations
  ipcMain.handle('sync:getStatus', handleGetSyncStatus(ctx));
  ipcMain.handle('sync:exportDiagnostics', handleExportSyncDiagnostics(ctx));

  // Polling group settings operations
  ipcMain.handle('polling:getSettings', handleGetPollingSettings(ctx));
  ipcMain.handle('polling:setSettings', handleSetPollingSettings(ctx));
  ipcMain.handle('polling:getSettingsForSd', handleGetPollingSettingsForSd(ctx));
  ipcMain.handle('polling:setSettingsForSd', handleSetPollingSettingsForSd(ctx));
  ipcMain.handle('polling:getGroupStatus', handleGetPollingGroupStatus(ctx));
}

/**
 * Unregister all sync-related IPC handlers
 */
export function unregisterSyncHandlers(): void {
  ipcMain.removeHandler('appState:get');
  ipcMain.removeHandler('appState:set');
  ipcMain.removeHandler('sync:getStatus');
  ipcMain.removeHandler('sync:exportDiagnostics');
  ipcMain.removeHandler('polling:getSettings');
  ipcMain.removeHandler('polling:setSettings');
  ipcMain.removeHandler('polling:getSettingsForSd');
  ipcMain.removeHandler('polling:setSettingsForSd');
  ipcMain.removeHandler('polling:getGroupStatus');
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

function handleExportSyncDiagnostics(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    const { database } = ctx;

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
        storageDirs: { id: string; name: string; path: string }[];
      } = {
        exportedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
        platform: os.platform(),
        osVersion: os.release(),
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

// =============================================================================
// Polling Group Settings Handler Factories
// =============================================================================

/**
 * Key prefix for per-SD polling settings
 */
const POLLING_SETTINGS_SD_PREFIX = 'pollingSettings:';

/**
 * Get global polling settings from app state
 */
function handleGetPollingSettings(ctx: HandlerContext) {
  return async (): Promise<PollingGroupStoredSettings> => {
    const { database } = ctx;

    const settings: PollingGroupStoredSettings = {};

    // Load each setting from app state
    const pollRate = await database.getState(AppStateKey.PollingRatePerMinute);
    if (pollRate !== null) settings.pollRatePerMinute = Number(pollRate);

    const hitMultiplier = await database.getState(AppStateKey.PollingHitMultiplier);
    if (hitMultiplier !== null) settings.hitRateMultiplier = Number(hitMultiplier);

    const maxBurst = await database.getState(AppStateKey.PollingMaxBurstPerSecond);
    if (maxBurst !== null) settings.maxBurstPerSecond = Number(maxBurst);

    const priorityReserve = await database.getState(AppStateKey.PollingNormalPriorityReserve);
    if (priorityReserve !== null) settings.normalPriorityReserve = Number(priorityReserve);

    const recentEdit = await database.getState(AppStateKey.RecentEditWindowMinutes);
    if (recentEdit !== null) settings.recentEditWindowMinutes = Number(recentEdit);

    const fullRepoll = await database.getState(AppStateKey.FullRepollIntervalMinutes);
    if (fullRepoll !== null) settings.fullRepollIntervalMinutes = Number(fullRepoll);

    const fastPath = await database.getState(AppStateKey.FastPathMaxDelaySeconds);
    if (fastPath !== null) settings.fastPathMaxDelaySeconds = Number(fastPath);

    return settings;
  };
}

/**
 * Set global polling settings in app state
 */
function handleSetPollingSettings(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    settings: Partial<PollingGroupStoredSettings>
  ): Promise<void> => {
    const { database } = ctx;

    // Save each setting to app state
    if (settings.pollRatePerMinute !== undefined) {
      await database.setState(AppStateKey.PollingRatePerMinute, String(settings.pollRatePerMinute));
    }
    if (settings.hitRateMultiplier !== undefined) {
      await database.setState(AppStateKey.PollingHitMultiplier, String(settings.hitRateMultiplier));
    }
    if (settings.maxBurstPerSecond !== undefined) {
      await database.setState(
        AppStateKey.PollingMaxBurstPerSecond,
        String(settings.maxBurstPerSecond)
      );
    }
    if (settings.normalPriorityReserve !== undefined) {
      await database.setState(
        AppStateKey.PollingNormalPriorityReserve,
        String(settings.normalPriorityReserve)
      );
    }
    if (settings.recentEditWindowMinutes !== undefined) {
      await database.setState(
        AppStateKey.RecentEditWindowMinutes,
        String(settings.recentEditWindowMinutes)
      );
    }
    if (settings.fullRepollIntervalMinutes !== undefined) {
      await database.setState(
        AppStateKey.FullRepollIntervalMinutes,
        String(settings.fullRepollIntervalMinutes)
      );
    }
    if (settings.fastPathMaxDelaySeconds !== undefined) {
      await database.setState(
        AppStateKey.FastPathMaxDelaySeconds,
        String(settings.fastPathMaxDelaySeconds)
      );
    }
  };
}

/**
 * Get per-SD polling settings overrides
 */
function handleGetPollingSettingsForSd(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<PollingGroupStoredSettings> => {
    const { database } = ctx;

    const key = `${POLLING_SETTINGS_SD_PREFIX}${sdId}`;
    const json = await database.getState(key);

    if (!json) {
      return {};
    }

    try {
      return JSON.parse(json) as PollingGroupStoredSettings;
    } catch {
      return {};
    }
  };
}

/**
 * Set per-SD polling settings overrides
 */
function handleSetPollingSettingsForSd(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    settings: Partial<PollingGroupStoredSettings>
  ): Promise<void> => {
    const { database } = ctx;

    const key = `${POLLING_SETTINGS_SD_PREFIX}${sdId}`;

    // Get existing settings and merge
    const existingJson = await database.getState(key);
    let existing: PollingGroupStoredSettings = {};
    if (existingJson) {
      try {
        existing = JSON.parse(existingJson) as PollingGroupStoredSettings;
      } catch {
        // Ignore parse errors, start fresh
      }
    }

    // Merge settings (spread only copies defined properties)
    const cleaned: PollingGroupStoredSettings = { ...existing, ...settings };

    // Save or delete if empty
    if (Object.keys(cleaned).length === 0) {
      // No settings, could delete the key (but for simplicity, just save empty object)
      await database.setState(key, '{}');
    } else {
      await database.setState(key, JSON.stringify(cleaned));
    }
  };
}

/**
 * Get polling group status
 */
function handleGetPollingGroupStatus(ctx: HandlerContext) {
  return async (): Promise<PollingGroupStatus | null> => {
    if (!ctx.getPollingGroupStatus) {
      return null;
    }
    return ctx.getPollingGroupStatus();
  };
}
