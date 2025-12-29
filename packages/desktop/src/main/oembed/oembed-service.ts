/**
 * oEmbed Service
 *
 * Main service for fetching and caching oEmbed data.
 * Uses the bundled registry for known providers and falls back
 * to HTML discovery for unknown URLs.
 */

import { createHash } from 'crypto';
import { net } from 'electron';
import {
  type OEmbedResponse,
  type OEmbedResult,
  OEmbedRegistry,
  createRegistry,
  type OEmbedProvider,
  oembedProviders,
  isRetryableError,
} from '@notecove/shared';
import { createLogger } from '../telemetry/logger';
import type { OEmbedRepository } from '../database/oembed-repository';
import { discoverOEmbedEndpoint } from './oembed-discovery';
import { FaviconService } from './favicon-service';
import { scrapeMetadata } from './metadata-scraper';

const log = createLogger('oEmbed:Service');

/**
 * URL for fetching the oEmbed provider registry
 */
const OEMBED_REGISTRY_URL = 'https://oembed.com/providers.json';

/**
 * How often to check for registry updates (1 week in ms)
 */
const REGISTRY_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Options for unfurling a URL
 */
export interface UnfurlOptions {
  maxWidth?: number;
  maxHeight?: number;
  skipCache?: boolean;
  skipDiscovery?: boolean;
}

/**
 * Session cache TTL - 5 minutes
 */
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch timeout - 10 seconds
 */
const FETCH_TIMEOUT_MS = 10000;

/**
 * Maximum retry attempts
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff (ms)
 */
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * oEmbed Service
 *
 * Handles fetching oEmbed data for URLs using the registry or discovery.
 */
export class OEmbedService {
  private registry: OEmbedRegistry;
  private faviconService: FaviconService;

  constructor(private readonly repository: OEmbedRepository) {
    this.registry = createRegistry(oembedProviders as OEmbedProvider[]);
    this.faviconService = new FaviconService(repository);
    log.info(`Initialized with ${this.registry.providerCount} providers`);
  }

  /**
   * Get the registry (for debugging/testing)
   */
  getRegistry(): OEmbedRegistry {
    return this.registry;
  }

  /**
   * Unfurl a URL - fetch oEmbed data with caching
   *
   * @param url The URL to unfurl
   * @param options Optional parameters
   * @returns The oEmbed result
   */
  async unfurl(url: string, options?: UnfurlOptions): Promise<OEmbedResult> {
    try {
      // Check if we're online
      if (!net.isOnline()) {
        log.debug('Offline - cannot unfurl:', { url });
        return {
          success: false,
          error: 'Device is offline',
          errorType: 'OFFLINE',
        };
      }

      // Check session cache first (unless skipCache is set)
      if (!options?.skipCache) {
        const cached = await this.repository.getRecentFetch(url, SESSION_CACHE_TTL_MS);
        if (cached) {
          log.debug('Cache hit for:', { url });
          return {
            success: true,
            data: cached,
            fromCache: true,
          };
        }
      }

      // Try registry lookup first
      const match = this.registry.findEndpoint(url);
      if (match) {
        log.debug('Registry match:', { provider: match.provider.provider_name });
        const buildOptions: { maxWidth?: number; maxHeight?: number } = {};
        if (options?.maxWidth !== undefined) {
          buildOptions.maxWidth = options.maxWidth;
        }
        if (options?.maxHeight !== undefined) {
          buildOptions.maxHeight = options.maxHeight;
        }
        const oembedUrl = this.registry.buildOEmbedUrl(match.endpoint, url, buildOptions);
        const result = await this.fetchOEmbedWithRetry(oembedUrl);
        if (result.success && result.data) {
          await this.repository.cacheFetch(url, result.data);
        }
        return result;
      }

      // Fall back to discovery (unless skipDiscovery is set)
      if (!options?.skipDiscovery) {
        log.debug('No registry match, trying discovery for:', { url });
        const discovered = await discoverOEmbedEndpoint(url);
        if (discovered) {
          log.debug('Discovery found endpoint:', { endpointUrl: discovered.endpointUrl });
          const result = await this.fetchOEmbedWithRetry(discovered.endpointUrl);
          if (result.success && result.data) {
            await this.repository.cacheFetch(url, result.data);
          }
          return result;
        }
      }

      // Fall back to metadata scraping (Open Graph, Twitter cards, etc.)
      log.debug('No oEmbed endpoint found, trying metadata scraping for:', { url });
      const scraped = await scrapeMetadata(url);
      if (scraped && (scraped.title || scraped.description || scraped.image)) {
        log.debug('Metadata scraping succeeded:', { url, title: scraped.title });
        // Convert scraped metadata to oEmbed-like response
        // Build response with only defined properties
        const response: OEmbedResponse = {
          type: 'link',
          version: '1.0',
          ...(scraped.title ? { title: scraped.title } : {}),
          ...(scraped.description ? { description: scraped.description } : {}),
          ...(scraped.image ? { thumbnail_url: scraped.image } : {}),
          ...(scraped.siteName ? { provider_name: scraped.siteName } : {}),
          ...(scraped.url ? { provider_url: scraped.url } : {}),
        };
        await this.repository.cacheFetch(url, response);
        return {
          success: true,
          data: response,
          fromCache: false,
        };
      }

      // No metadata available
      log.debug('No metadata found for:', { url });
      return {
        success: false,
        error: 'No metadata found',
        errorType: 'NOT_FOUND',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Unfurl failed for ${url}: ${message}`);
      return {
        success: false,
        error: message,
        errorType: 'PROVIDER_ERROR',
      };
    }
  }

  /**
   * Force refresh - fetch fresh data bypassing cache
   *
   * @param url The URL to refresh
   * @returns The oEmbed result
   */
  async refresh(url: string): Promise<OEmbedResult> {
    return this.unfurl(url, { skipCache: true });
  }

  /**
   * Clear cache for a specific URL
   */
  clearCache(url: string): void {
    // For now, we just clear the session cache
    // The actual oEmbed data is in the document CRDT
    log.debug('Clearing cache for:', { url });
    // We could implement a per-URL clear, but for now just log
  }

  /**
   * Clear all caches
   */
  async clearAllCache(): Promise<void> {
    log.info('Clearing all oEmbed caches');
    await this.repository.clearFetchCache();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    fetchCacheCount: number;
    faviconCount: number;
    thumbnailCount: number;
    thumbnailTotalSizeBytes: number;
    providerCount: number;
  }> {
    const dbStats = await this.repository.getCacheStats();
    return {
      ...dbStats,
      providerCount: this.registry.providerCount,
    };
  }

  /**
   * Get a favicon for a domain
   *
   * Fetches from cache or network and returns as a base64 data URL.
   * Uses Google's favicon API with fallback to direct site favicon.
   *
   * @param domain The domain to get the favicon for (e.g., "youtube.com")
   * @returns The base64 data URL or null if not found
   */
  async getFavicon(domain: string): Promise<string | null> {
    return this.faviconService.getFavicon(domain);
  }

  // ==========================================================================
  // Debug Methods
  // ==========================================================================

  /**
   * Get all cached favicons (for debugging)
   */
  async debugListFavicons(): Promise<{ domain: string; dataUrl: string; fetchedAt: number }[]> {
    return this.repository.getAllFavicons();
  }

  /**
   * Get all cached thumbnails (for debugging)
   */
  async debugListThumbnails(): Promise<
    { url: string; dataUrl: string; sizeBytes: number; fetchedAt: number }[]
  > {
    return this.repository.getAllThumbnails();
  }

  /**
   * Get all fetch cache entries (for debugging)
   */
  async debugListFetchCache(): Promise<{ url: string; rawJson: string; fetchedAt: number }[]> {
    return this.repository.getAllFetchCacheEntries();
  }

  /**
   * Delete a specific cached favicon
   */
  async debugDeleteFavicon(domain: string): Promise<void> {
    log.debug('Deleting favicon for:', { domain });
    await this.repository.deleteFavicon(domain);
  }

  /**
   * Delete a specific cached thumbnail
   */
  async debugDeleteThumbnail(url: string): Promise<void> {
    log.debug('Deleting thumbnail for:', { url });
    await this.repository.deleteThumbnail(url);
  }

  /**
   * Clear all favicons
   */
  async debugClearAllFavicons(): Promise<void> {
    log.info('Clearing all favicons');
    // Get all and delete each
    const all = await this.repository.getAllFavicons();
    for (const f of all) {
      await this.repository.deleteFavicon(f.domain);
    }
  }

  /**
   * Clear all thumbnails
   */
  async debugClearAllThumbnails(): Promise<void> {
    log.info('Clearing all thumbnails');
    await this.repository.clearThumbnails();
  }

  // ==========================================================================
  // Registry Update Methods
  // ==========================================================================

  /**
   * Result of a registry update check
   */
  public static readonly RegistryUpdateResult = {
    UPDATED: 'UPDATED',
    NO_CHANGE: 'NO_CHANGE',
    OFFLINE: 'OFFLINE',
    ERROR: 'ERROR',
    SKIPPED: 'SKIPPED',
  } as const;

  /**
   * Check if the registry should be updated (based on last check time)
   */
  async shouldCheckForRegistryUpdate(): Promise<boolean> {
    const lastCheck = await this.repository.getRegistryLastCheck();
    if (lastCheck === null) {
      // Never checked before, should check
      return true;
    }
    const timeSinceLastCheck = Date.now() - lastCheck;
    return timeSinceLastCheck >= REGISTRY_CHECK_INTERVAL_MS;
  }

  /**
   * Get registry update status
   */
  async getRegistryUpdateStatus(): Promise<{
    lastCheck: number | null;
    storedHash: string | null;
    storedProviderCount: number | null;
    currentProviderCount: number;
    needsCheck: boolean;
  }> {
    const metadata = await this.repository.getRegistryMetadata();
    const needsCheck = await this.shouldCheckForRegistryUpdate();
    return {
      lastCheck: metadata.lastCheck,
      storedHash: metadata.hash,
      storedProviderCount: metadata.providerCount,
      currentProviderCount: this.registry.providerCount,
      needsCheck,
    };
  }

  /**
   * Check for registry updates and merge new providers
   *
   * @param force If true, check even if within the check interval
   * @returns The result of the update check
   */
  async checkForRegistryUpdate(force = false): Promise<{
    result: (typeof OEmbedService.RegistryUpdateResult)[keyof typeof OEmbedService.RegistryUpdateResult];
    newProviders?: number;
    totalProviders?: number;
    error?: string;
  }> {
    // Check if we should actually check
    if (!force) {
      const shouldCheck = await this.shouldCheckForRegistryUpdate();
      if (!shouldCheck) {
        log.debug('Skipping registry update check - within check interval');
        return { result: OEmbedService.RegistryUpdateResult.SKIPPED };
      }
    }

    // Check if online
    if (!net.isOnline()) {
      log.debug('Offline - cannot check for registry updates');
      return { result: OEmbedService.RegistryUpdateResult.OFFLINE };
    }

    log.info('Checking for oEmbed registry updates...');

    try {
      // Fetch the remote registry
      const remoteProviders = await this.fetchRemoteRegistry();
      if (!remoteProviders) {
        return {
          result: OEmbedService.RegistryUpdateResult.ERROR,
          error: 'Failed to fetch remote registry',
        };
      }

      // Calculate hash of remote registry
      const remoteHash = this.calculateRegistryHash(remoteProviders);
      const storedHash = await this.repository.getRegistryHash();

      // Check if there are changes
      if (storedHash === remoteHash) {
        log.info('Registry is up to date');
        // Update the last check time even if no changes
        await this.repository.setRegistryMetadata(remoteHash, remoteProviders.length);
        return { result: OEmbedService.RegistryUpdateResult.NO_CHANGE };
      }

      // Merge new providers into the registry
      const newCount = this.mergeProviders(remoteProviders);

      log.info(`Registry updated: ${newCount} new providers, ${this.registry.providerCount} total`);

      // Save metadata
      await this.repository.setRegistryMetadata(remoteHash, this.registry.providerCount);

      return {
        result: OEmbedService.RegistryUpdateResult.UPDATED,
        newProviders: newCount,
        totalProviders: this.registry.providerCount,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error('Registry update check failed', err);
      return {
        result: OEmbedService.RegistryUpdateResult.ERROR,
        error: err.message,
      };
    }
  }

  /**
   * Fetch the remote oEmbed provider registry
   */
  private async fetchRemoteRegistry(): Promise<OEmbedProvider[] | null> {
    return new Promise((resolve) => {
      log.debug(`Fetching remote registry from ${OEMBED_REGISTRY_URL}`);

      const request = net.request({
        url: OEMBED_REGISTRY_URL,
        method: 'GET',
      });

      let data = '';
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          request.abort();
          log.error('Registry fetch timeout');
          resolve(null);
        }
      }, FETCH_TIMEOUT_MS);

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          clearTimeout(timeout);
          resolved = true;
          log.error(`Registry fetch failed: HTTP ${response.statusCode}`);
          resolve(null);
          return;
        }

        response.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });

        response.on('end', () => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;

            try {
              const providers = JSON.parse(data) as unknown;
              if (!Array.isArray(providers)) {
                log.error('Invalid registry format: not an array');
                resolve(null);
                return;
              }
              log.debug(`Fetched ${providers.length} providers from remote registry`);
              resolve(providers as OEmbedProvider[]);
            } catch {
              log.error('Failed to parse registry JSON');
              resolve(null);
            }
          }
        });

        response.on('error', (error) => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            log.error(`Registry fetch error: ${error.message}`);
            resolve(null);
          }
        });
      });

      request.on('error', (error) => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          log.error(`Registry request error: ${error.message}`);
          resolve(null);
        }
      });

      request.end();
    });
  }

  /**
   * Calculate a hash of the provider registry for change detection
   */
  private calculateRegistryHash(providers: OEmbedProvider[]): string {
    // Sort providers by name for consistent hashing
    const sorted = [...providers].sort((a, b) => a.provider_name.localeCompare(b.provider_name));
    const json = JSON.stringify(sorted);
    return createHash('sha256').update(json).digest('hex');
  }

  /**
   * Merge remote providers into the current registry
   * Only adds new providers, doesn't remove or update existing ones
   *
   * @returns The number of new providers added
   */
  private mergeProviders(remoteProviders: OEmbedProvider[]): number {
    const currentProviders = this.registry.getProviders();
    const currentNames = new Set(currentProviders.map((p) => p.provider_name.toLowerCase()));

    const newProviders: OEmbedProvider[] = [];
    for (const provider of remoteProviders) {
      if (!currentNames.has(provider.provider_name.toLowerCase())) {
        newProviders.push(provider);
      }
    }

    if (newProviders.length > 0) {
      // Create a new registry with all providers
      const allProviders = [...currentProviders, ...newProviders];
      this.registry = createRegistry(allProviders);
      log.debug(`Added ${newProviders.length} new providers`, {
        providers: newProviders.map((p) => p.provider_name).join(', '),
      });
    }

    return newProviders.length;
  }

  /**
   * Fetch oEmbed data with retry logic for transient errors
   */
  private async fetchOEmbedWithRetry(oembedUrl: string, attempt = 1): Promise<OEmbedResult> {
    const result = await this.fetchOEmbed(oembedUrl);

    // If successful or not retryable, return immediately
    if (result.success || !isRetryableError(result.errorType)) {
      return result;
    }

    // If we've exhausted retries, return the error
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      log.warn('Max retries reached for oEmbed fetch:', { oembedUrl, attempts: attempt });
      return result;
    }

    // Wait with exponential backoff before retrying
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    log.debug('Retrying oEmbed fetch:', { oembedUrl, attempt: attempt + 1, delay });
    await sleep(delay);

    return this.fetchOEmbedWithRetry(oembedUrl, attempt + 1);
  }

  /**
   * Fetch oEmbed data from an endpoint URL
   */
  private async fetchOEmbed(oembedUrl: string): Promise<OEmbedResult> {
    return new Promise((resolve) => {
      log.debug('Fetching oEmbed:', { oembedUrl });

      const request = net.request({
        url: oembedUrl,
        method: 'GET',
      });

      let data = '';
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          request.abort();
          resolve({
            success: false,
            error: 'Request timeout',
            errorType: 'NETWORK_ERROR',
          });
        }
      }, FETCH_TIMEOUT_MS);

      request.on('response', (response) => {
        // Check for redirect
        if (response.statusCode >= 300 && response.statusCode < 400) {
          const location = response.headers['location'];
          if (location) {
            clearTimeout(timeout);
            resolved = true;
            const redirectUrl = Array.isArray(location) ? location[0] : location;
            if (redirectUrl) {
              this.fetchOEmbed(redirectUrl)
                .then(resolve)
                .catch(() => {
                  resolve({
                    success: false,
                    error: 'Redirect fetch failed',
                    errorType: 'NETWORK_ERROR',
                  });
                });
              return;
            }
          }
        }

        // Check for success
        if (response.statusCode !== 200) {
          clearTimeout(timeout);
          resolved = true;
          resolve({
            success: false,
            error: `HTTP ${response.statusCode}`,
            errorType: 'PROVIDER_ERROR',
          });
          return;
        }

        response.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });

        response.on('end', () => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;

            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;

              // Validate required fields - only 'type' is truly required
              // Many providers (like Reddit) don't include 'version'
              if (typeof parsed['type'] !== 'string') {
                resolve({
                  success: false,
                  error: 'Invalid oEmbed response: missing type field',
                  errorType: 'INVALID_RESPONSE',
                });
                return;
              }

              // Default version if not provided (spec says 1.0)
              if (typeof parsed['version'] !== 'string') {
                parsed['version'] = '1.0';
              }

              log.debug('Successfully fetched oEmbed:', { oembedType: parsed['type'] });
              resolve({
                success: true,
                data: parsed as unknown as OEmbedResponse,
                fromCache: false,
              });
            } catch {
              resolve({
                success: false,
                error: 'Failed to parse oEmbed response',
                errorType: 'INVALID_RESPONSE',
              });
            }
          }
        });

        response.on('error', (error) => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            resolve({
              success: false,
              error: error.message,
              errorType: 'NETWORK_ERROR',
            });
          }
        });
      });

      request.on('error', (error) => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          resolve({
            success: false,
            error: error.message,
            errorType: 'NETWORK_ERROR',
          });
        }
      });

      request.end();
    });
  }
}
