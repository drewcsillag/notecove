/**
 * Thumbnail Proxy
 *
 * Fetches external thumbnails through the main process to avoid CORS issues.
 * Caches thumbnails locally forever (per user preference).
 */

import { net } from 'electron';
import { createLogger } from '../telemetry/logger';
import type { OEmbedRepository } from '../database/oembed-repository';

const log = createLogger('oEmbed:Thumbnail');

/**
 * Fetch timeout for thumbnails
 */
const FETCH_TIMEOUT_MS = 15000;

/**
 * Maximum thumbnail size to cache (5MB)
 */
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;

/**
 * Thumbnail Proxy
 *
 * Handles fetching and caching of thumbnails for oEmbed unfurl cards.
 */
export class ThumbnailProxy {
  constructor(private readonly repository: OEmbedRepository) {}

  /**
   * Get a proxied thumbnail as a base64 data URL
   *
   * @param url The URL of the thumbnail to fetch
   * @returns The base64 data URL or null if not found
   */
  async getProxiedThumbnail(url: string): Promise<string | null> {
    // Check cache first
    const cached = await this.repository.getThumbnail(url);
    if (cached) {
      log.debug('Cache hit for thumbnail:', { url });
      return cached;
    }

    // Fetch and cache
    log.debug('Fetching thumbnail:', { url });
    const result = await this.fetchThumbnail(url);
    if (result) {
      await this.repository.upsertThumbnail(url, result.dataUrl, result.sizeBytes);
      return result.dataUrl;
    }

    return null;
  }

  /**
   * Clear a cached thumbnail
   */
  async clearThumbnail(url: string): Promise<void> {
    await this.repository.deleteThumbnail(url);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ count: number; totalSizeBytes: number }> {
    return this.repository.getThumbnailStats();
  }

  /**
   * Clear all thumbnails
   */
  async clearAll(): Promise<void> {
    await this.repository.clearThumbnails();
  }

  /**
   * Fetch a thumbnail from the network
   */
  private fetchThumbnail(url: string): Promise<{ dataUrl: string; sizeBytes: number } | null> {
    return new Promise((resolve) => {
      const request = net.request({
        url,
        method: 'GET',
      });

      const chunks: Buffer[] = [];
      let resolved = false;
      let contentType = 'image/jpeg';
      let totalSize = 0;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          request.abort();
          log.debug('Thumbnail fetch timeout:', { url });
          resolve(null);
        }
      }, FETCH_TIMEOUT_MS);

      request.on('response', (response) => {
        // Handle redirect
        if (response.statusCode >= 300 && response.statusCode < 400) {
          const location = response.headers['location'];
          if (location) {
            clearTimeout(timeout);
            resolved = true;
            const redirectUrl = Array.isArray(location) ? location[0] : location;
            if (redirectUrl) {
              this.fetchThumbnail(redirectUrl)
                .then(resolve)
                .catch(() => {
                  resolve(null);
                });
              return;
            }
          }
        }

        // Check for success
        if (response.statusCode !== 200) {
          clearTimeout(timeout);
          resolved = true;
          log.debug('Thumbnail fetch failed:', { url, statusCode: response.statusCode });
          resolve(null);
          return;
        }

        // Get content type
        const ct = response.headers['content-type'];
        if (ct) {
          const ctValue = Array.isArray(ct) ? ct[0] : ct;
          if (ctValue) {
            // Extract just the media type
            const mediaType = ctValue.split(';')[0];
            if (mediaType) {
              contentType = mediaType.trim();
            }
          }
        }

        // Validate it's an image
        if (!contentType.startsWith('image/')) {
          clearTimeout(timeout);
          resolved = true;
          log.debug('Not an image:', { url, contentType });
          resolve(null);
          return;
        }

        response.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;

          // Abort if too large
          if (totalSize > MAX_THUMBNAIL_SIZE) {
            clearTimeout(timeout);
            resolved = true;
            request.abort();
            log.debug('Thumbnail too large:', { url, totalSize });
            resolve(null);
            return;
          }

          chunks.push(chunk);
        });

        response.on('end', () => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;

            if (chunks.length === 0) {
              resolve(null);
              return;
            }

            const buffer = Buffer.concat(chunks);
            const base64 = buffer.toString('base64');
            const dataUrl = `data:${contentType};base64,${base64}`;
            const sizeBytes = dataUrl.length;

            log.debug('Thumbnail fetched:', { url, sizeBytes });
            resolve({ dataUrl, sizeBytes });
          }
        });

        response.on('error', (error) => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            log.debug('Thumbnail fetch error:', { url, error: error.message });
            resolve(null);
          }
        });
      });

      request.on('error', (error) => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          log.debug('Thumbnail request error:', { url, error: error.message });
          resolve(null);
        }
      });

      request.end();
    });
  }
}
