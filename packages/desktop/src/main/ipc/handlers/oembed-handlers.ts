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
    const { oembedService } = ctx;

    if (!oembedService) {
      return {
        success: false,
        error: 'oEmbed service not available',
        errorType: 'PROVIDER_ERROR',
      };
    }

    return oembedService.unfurl(url, options);
  };
}

/**
 * Force refresh - fetch fresh data bypassing cache
 */
function handleRefresh(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, url: string): Promise<OEmbedResult> => {
    const { oembedService } = ctx;

    if (!oembedService) {
      return {
        success: false,
        error: 'oEmbed service not available',
        errorType: 'PROVIDER_ERROR',
      };
    }

    return oembedService.refresh(url);
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
