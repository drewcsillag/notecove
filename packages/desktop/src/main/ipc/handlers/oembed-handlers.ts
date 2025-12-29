/**
 * oEmbed Handlers
 *
 * IPC handlers for oEmbed link unfurling functionality.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { HandlerContext } from './types';
import type { OEmbedResult, UnfurlOptions } from '../../oembed';

/**
 * Cache statistics returned to renderer
 */
export interface OEmbedCacheStats {
  fetchCacheCount: number;
  faviconCount: number;
  thumbnailCount: number;
  thumbnailTotalSizeBytes: number;
  providerCount: number;
}

/**
 * Registry update status returned to renderer
 */
export interface OEmbedRegistryStatus {
  lastCheck: number | null;
  storedHash: string | null;
  storedProviderCount: number | null;
  currentProviderCount: number;
  needsCheck: boolean;
}

/**
 * Result of a registry update check
 */
export interface OEmbedRegistryUpdateResult {
  result: 'UPDATED' | 'NO_CHANGE' | 'OFFLINE' | 'ERROR' | 'SKIPPED';
  newProviders?: number;
  totalProviders?: number;
  error?: string;
}

/**
 * Cached favicon entry for debug UI
 */
export interface CachedFavicon {
  domain: string;
  dataUrl: string;
  fetchedAt: number;
}

/**
 * Cached thumbnail entry for debug UI
 */
export interface CachedThumbnail {
  url: string;
  dataUrl: string;
  sizeBytes: number;
  fetchedAt: number;
}

/**
 * Cached fetch entry for debug UI
 */
export interface CachedFetch {
  url: string;
  rawJson: string;
  fetchedAt: number;
}

/**
 * Register all oEmbed IPC handlers
 */
export function registerOEmbedHandlers(ctx: HandlerContext): void {
  ipcMain.handle('oembed:unfurl', handleUnfurl(ctx));
  ipcMain.handle('oembed:refresh', handleRefresh(ctx));
  ipcMain.handle('oembed:clearCache', handleClearCache(ctx));
  ipcMain.handle('oembed:getCacheStats', handleGetCacheStats(ctx));
  ipcMain.handle('oembed:getFavicon', handleGetFavicon(ctx));

  // Registry update handlers
  ipcMain.handle('oembed:getRegistryStatus', handleGetRegistryStatus(ctx));
  ipcMain.handle('oembed:checkRegistryUpdate', handleCheckRegistryUpdate(ctx));

  // Debug handlers
  ipcMain.handle('oembed:debug:listFavicons', handleDebugListFavicons(ctx));
  ipcMain.handle('oembed:debug:listThumbnails', handleDebugListThumbnails(ctx));
  ipcMain.handle('oembed:debug:listFetchCache', handleDebugListFetchCache(ctx));
  ipcMain.handle('oembed:debug:deleteFavicon', handleDebugDeleteFavicon(ctx));
  ipcMain.handle('oembed:debug:deleteThumbnail', handleDebugDeleteThumbnail(ctx));
  ipcMain.handle('oembed:debug:clearAllFavicons', handleDebugClearAllFavicons(ctx));
  ipcMain.handle('oembed:debug:clearAllThumbnails', handleDebugClearAllThumbnails(ctx));
}

/**
 * Unregister all oEmbed IPC handlers
 */
export function unregisterOEmbedHandlers(): void {
  ipcMain.removeHandler('oembed:unfurl');
  ipcMain.removeHandler('oembed:refresh');
  ipcMain.removeHandler('oembed:clearCache');
  ipcMain.removeHandler('oembed:getCacheStats');
  ipcMain.removeHandler('oembed:getFavicon');

  // Registry update handlers
  ipcMain.removeHandler('oembed:getRegistryStatus');
  ipcMain.removeHandler('oembed:checkRegistryUpdate');

  // Debug handlers
  ipcMain.removeHandler('oembed:debug:listFavicons');
  ipcMain.removeHandler('oembed:debug:listThumbnails');
  ipcMain.removeHandler('oembed:debug:listFetchCache');
  ipcMain.removeHandler('oembed:debug:deleteFavicon');
  ipcMain.removeHandler('oembed:debug:deleteThumbnail');
  ipcMain.removeHandler('oembed:debug:clearAllFavicons');
  ipcMain.removeHandler('oembed:debug:clearAllThumbnails');
}

// =============================================================================
// Handler Factories
// =============================================================================

/**
 * Unfurl a URL - fetch oEmbed data with caching
 */
function handleUnfurl(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    url: string,
    options?: UnfurlOptions
  ): Promise<OEmbedResult> => {
    const { oembedService, database } = ctx;

    if (!oembedService) {
      return {
        success: false,
        error: 'oEmbed service not available',
        errorType: 'PROVIDER_ERROR',
      };
    }

    // Check discovery preference from app state
    let effectiveOptions = options;
    if (!options?.skipDiscovery) {
      try {
        const discoveryPref = await database.getState('oembedDiscoveryEnabled');
        // If explicitly set to 'false', skip discovery
        if (discoveryPref === 'false') {
          effectiveOptions = { ...options, skipDiscovery: true };
        }
      } catch {
        // Ignore errors, proceed with default
      }
    }

    return oembedService.unfurl(url, effectiveOptions);
  };
}

/**
 * Force refresh - fetch fresh data bypassing cache
 */
function handleRefresh(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, url: string): Promise<OEmbedResult> => {
    const { oembedService, database } = ctx;

    if (!oembedService) {
      return {
        success: false,
        error: 'oEmbed service not available',
        errorType: 'PROVIDER_ERROR',
      };
    }

    // Check discovery preference from app state
    let skipDiscovery = false;
    try {
      const discoveryPref = await database.getState('oembedDiscoveryEnabled');
      if (discoveryPref === 'false') {
        skipDiscovery = true;
      }
    } catch {
      // Ignore errors, proceed with default
    }

    return oembedService.unfurl(url, { skipCache: true, skipDiscovery });
  };
}

/**
 * Clear cache - optionally for a specific URL or all
 */
function handleClearCache(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, url?: string): Promise<void> => {
    const { oembedService } = ctx;

    if (!oembedService) {
      return;
    }

    if (url) {
      oembedService.clearCache(url);
    } else {
      await oembedService.clearAllCache();
    }
  };
}

/**
 * Get cache statistics
 */
function handleGetCacheStats(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<OEmbedCacheStats | null> => {
    const { oembedService } = ctx;

    if (!oembedService) {
      return null;
    }

    return oembedService.getCacheStats();
  };
}

/**
 * Get a favicon for a domain
 */
function handleGetFavicon(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, domain: string): Promise<string | null> => {
    const { oembedService } = ctx;

    if (!oembedService) {
      return null;
    }

    return oembedService.getFavicon(domain);
  };
}

// =============================================================================
// Registry Update Handler Factories
// =============================================================================

/**
 * Get registry update status
 */
function handleGetRegistryStatus(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<OEmbedRegistryStatus | null> => {
    const { oembedService } = ctx;

    if (!oembedService) {
      return null;
    }

    return oembedService.getRegistryUpdateStatus();
  };
}

/**
 * Check for registry updates
 */
function handleCheckRegistryUpdate(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    force?: boolean
  ): Promise<OEmbedRegistryUpdateResult> => {
    const { oembedService } = ctx;

    if (!oembedService) {
      return {
        result: 'ERROR',
        error: 'oEmbed service not available',
      };
    }

    return oembedService.checkForRegistryUpdate(force ?? false);
  };
}

// =============================================================================
// Debug Handler Factories
// =============================================================================

/**
 * List all cached favicons
 */
function handleDebugListFavicons(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<CachedFavicon[]> => {
    const { oembedService } = ctx;
    if (!oembedService) return [];
    return oembedService.debugListFavicons();
  };
}

/**
 * List all cached thumbnails
 */
function handleDebugListThumbnails(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<CachedThumbnail[]> => {
    const { oembedService } = ctx;
    if (!oembedService) return [];
    return oembedService.debugListThumbnails();
  };
}

/**
 * List all fetch cache entries
 */
function handleDebugListFetchCache(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<CachedFetch[]> => {
    const { oembedService } = ctx;
    if (!oembedService) return [];
    return oembedService.debugListFetchCache();
  };
}

/**
 * Delete a specific cached favicon
 */
function handleDebugDeleteFavicon(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, domain: string): Promise<void> => {
    const { oembedService } = ctx;
    if (!oembedService) return;
    await oembedService.debugDeleteFavicon(domain);
  };
}

/**
 * Delete a specific cached thumbnail
 */
function handleDebugDeleteThumbnail(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, url: string): Promise<void> => {
    const { oembedService } = ctx;
    if (!oembedService) return;
    await oembedService.debugDeleteThumbnail(url);
  };
}

/**
 * Clear all cached favicons
 */
function handleDebugClearAllFavicons(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<void> => {
    const { oembedService } = ctx;
    if (!oembedService) return;
    await oembedService.debugClearAllFavicons();
  };
}

/**
 * Clear all cached thumbnails
 */
function handleDebugClearAllThumbnails(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<void> => {
    const { oembedService } = ctx;
    if (!oembedService) return;
    await oembedService.debugClearAllThumbnails();
  };
}
