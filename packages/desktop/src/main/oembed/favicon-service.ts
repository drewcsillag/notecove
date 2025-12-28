/**
 * Favicon Service
 *
 * Fetches and caches favicons for link chips in oEmbed unfurling.
 * Uses Google's public favicon API with fallback to direct site favicon.
 */

import { net } from 'electron';
import { createLogger } from '../telemetry/logger';
import type { OEmbedRepository } from '../database/oembed-repository';

const log = createLogger('oEmbed:Favicon');

/**
 * Default size for favicons (32x32 is crisp on retina)
 */
const FAVICON_SIZE = 32;

/**
 * Fetch timeout for favicons
 */
const FETCH_TIMEOUT_MS = 5000;

/**
 * Favicon Service
 *
 * Handles fetching and caching of favicons for link chips.
 */
export class FaviconService {
  constructor(private readonly repository: OEmbedRepository) {}

  /**
   * Get a favicon for a domain as a base64 data URL
   *
   * @param domain The domain to get the favicon for (e.g., "youtube.com")
   * @returns The base64 data URL or null if not found
   */
  async getFavicon(domain: string): Promise<string | null> {
    // Check cache first
    const cached = await this.repository.getFavicon(domain);
    if (cached) {
      log.debug('Cache hit for favicon:', { domain });
      return cached;
    }

    // Fetch and cache
    log.debug('Fetching favicon for:', { domain });
    const dataUrl = await this.fetchFavicon(domain);
    if (dataUrl) {
      await this.repository.upsertFavicon(domain, dataUrl);
      return dataUrl;
    }

    return null;
  }

  /**
   * Clear a cached favicon
   */
  async clearFavicon(domain: string): Promise<void> {
    await this.repository.deleteFavicon(domain);
  }

  /**
   * Fetch a favicon from the network
   *
   * Tries in order:
   * 1. Google Favicon API (most reliable)
   * 2. Direct favicon.ico from the site
   */
  private async fetchFavicon(domain: string): Promise<string | null> {
    // Try Google's favicon API first
    const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${FAVICON_SIZE}`;
    const result = await this.fetchAsDataUrl(googleUrl);
    if (result) {
      return result;
    }

    // Fall back to direct favicon.ico
    const directUrl = `https://${domain}/favicon.ico`;
    return this.fetchAsDataUrl(directUrl);
  }

  /**
   * Fetch a URL and return as base64 data URL
   */
  private fetchAsDataUrl(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const request = net.request({
        url,
        method: 'GET',
      });

      const chunks: Buffer[] = [];
      let resolved = false;
      let contentType = 'image/png';

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          request.abort();
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
              this.fetchAsDataUrl(redirectUrl)
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

        response.on('data', (chunk: Buffer) => {
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
            resolve(dataUrl);
          }
        });

        response.on('error', () => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            resolve(null);
          }
        });
      });

      request.on('error', () => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          resolve(null);
        }
      });

      request.end();
    });
  }
}
