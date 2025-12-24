/**
 * Feature Flag Handlers
 *
 * IPC handlers for managing feature flags.
 * Feature flags control visibility of experimental or optional features.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { HandlerContext } from './types';
import {
  FeatureFlag,
  FeatureFlagConfig,
  FEATURE_FLAG_METADATA,
  getAllFeatureFlags,
  isValidFeatureFlag,
  type FeatureFlagMetadata,
} from '@notecove/shared';

/**
 * Feature flag info returned to renderer
 */
export interface FeatureFlagInfo {
  flag: FeatureFlag;
  enabled: boolean;
  metadata: FeatureFlagMetadata;
}

/**
 * Register all feature flag IPC handlers
 */
export function registerFeatureFlagHandlers(ctx: HandlerContext): void {
  ipcMain.handle('featureFlags:getAll', handleGetAllFeatureFlags(ctx));
  ipcMain.handle('featureFlags:get', handleGetFeatureFlag(ctx));
  ipcMain.handle('featureFlags:set', handleSetFeatureFlag(ctx));
}

/**
 * Unregister all feature flag IPC handlers
 */
export function unregisterFeatureFlagHandlers(): void {
  ipcMain.removeHandler('featureFlags:getAll');
  ipcMain.removeHandler('featureFlags:get');
  ipcMain.removeHandler('featureFlags:set');
}

// =============================================================================
// Handler Factories
// =============================================================================

/**
 * Get all feature flags with their current values and metadata
 */
function handleGetAllFeatureFlags(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<FeatureFlagInfo[]> => {
    const { configManager } = ctx;
    const flags = await configManager.getFeatureFlags();

    return getAllFeatureFlags().map((flag) => ({
      flag,
      enabled: flags[flag],
      metadata: FEATURE_FLAG_METADATA[flag],
    }));
  };
}

/**
 * Get a specific feature flag value
 */
function handleGetFeatureFlag(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, flag: string): Promise<boolean> => {
    const { configManager } = ctx;

    if (!isValidFeatureFlag(flag)) {
      throw new Error(`Invalid feature flag: ${flag}`);
    }

    return await configManager.getFeatureFlag(flag);
  };
}

/**
 * Set a feature flag value and broadcast the change
 */
function handleSetFeatureFlag(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    flag: string,
    enabled: boolean
  ): Promise<{ success: boolean; requiresRestart: boolean }> => {
    const { configManager, broadcastToAll } = ctx;

    if (!isValidFeatureFlag(flag)) {
      throw new Error(`Invalid feature flag: ${flag}`);
    }

    await configManager.setFeatureFlag(flag, enabled);

    // Broadcast the change to all windows
    broadcastToAll('featureFlags:changed', { flag, enabled });

    const metadata = FEATURE_FLAG_METADATA[flag];
    return {
      success: true,
      requiresRestart: metadata.requiresRestart,
    };
  };
}

/**
 * Get all feature flags as a simple config object (for main process use)
 */
export async function getFeatureFlagsConfig(ctx: HandlerContext): Promise<FeatureFlagConfig> {
  return await ctx.configManager.getFeatureFlags();
}
