/**
 * oEmbed API
 *
 * Preload API for oEmbed link unfurling functionality.
 */

import { ipcRenderer } from 'electron';
import type { OEmbedResult, UnfurlOptions } from '@notecove/shared';

/**
 * Cache statistics
 */
export interface OEmbedCacheStats {
  fetchCacheCount: number;
  faviconCount: number;
  thumbnailCount: number;
  thumbnailTotalSizeBytes: number;
  providerCount: number;
}

/**
 * Cached favicon entry
 */
export interface CachedFavicon {
  domain: string;
  dataUrl: string;
  fetchedAt: number;
}

/**
 * Cached thumbnail entry
 */
export interface CachedThumbnail {
  url: string;
  dataUrl: string;
  sizeBytes: number;
  fetchedAt: number;
}

/**
 * Cached fetch entry
 */
export interface CachedFetch {
  url: string;
  rawJson: string;
  fetchedAt: number;
}

export const oembedApi = {
  /**
   * Unfurl a URL - fetch oEmbed data with caching
   */
  unfurl: (url: string, options?: UnfurlOptions): Promise<OEmbedResult> =>
    ipcRenderer.invoke('oembed:unfurl', url, options) as Promise<OEmbedResult>,

  /**
   * Force refresh - fetch fresh data bypassing cache
   */
  refresh: (url: string): Promise<OEmbedResult> =>
    ipcRenderer.invoke('oembed:refresh', url) as Promise<OEmbedResult>,

  /**
   * Clear cache - optionally for a specific URL or all
   */
  clearCache: (url?: string): Promise<void> =>
    ipcRenderer.invoke('oembed:clearCache', url) as Promise<void>,

  /**
   * Get cache statistics
   */
  getCacheStats: (): Promise<OEmbedCacheStats | null> =>
    ipcRenderer.invoke('oembed:getCacheStats') as Promise<OEmbedCacheStats | null>,

  // Debug methods
  debug: {
    /**
     * List all cached favicons
     */
    listFavicons: (): Promise<CachedFavicon[]> =>
      ipcRenderer.invoke('oembed:debug:listFavicons') as Promise<CachedFavicon[]>,

    /**
     * List all cached thumbnails
     */
    listThumbnails: (): Promise<CachedThumbnail[]> =>
      ipcRenderer.invoke('oembed:debug:listThumbnails') as Promise<CachedThumbnail[]>,

    /**
     * List all fetch cache entries
     */
    listFetchCache: (): Promise<CachedFetch[]> =>
      ipcRenderer.invoke('oembed:debug:listFetchCache') as Promise<CachedFetch[]>,

    /**
     * Delete a specific cached favicon
     */
    deleteFavicon: (domain: string): Promise<void> =>
      ipcRenderer.invoke('oembed:debug:deleteFavicon', domain) as Promise<void>,

    /**
     * Delete a specific cached thumbnail
     */
    deleteThumbnail: (url: string): Promise<void> =>
      ipcRenderer.invoke('oembed:debug:deleteThumbnail', url) as Promise<void>,

    /**
     * Clear all cached favicons
     */
    clearAllFavicons: (): Promise<void> =>
      ipcRenderer.invoke('oembed:debug:clearAllFavicons') as Promise<void>,

    /**
     * Clear all cached thumbnails
     */
    clearAllThumbnails: (): Promise<void> =>
      ipcRenderer.invoke('oembed:debug:clearAllThumbnails') as Promise<void>,
  },
};
