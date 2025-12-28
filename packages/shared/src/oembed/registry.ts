/**
 * oEmbed Provider Registry
 *
 * Provides lookup functionality to match URLs to oEmbed provider endpoints.
 * Uses a bundled copy of the oEmbed provider registry.
 *
 * @see https://oembed.com/providers.json
 */

import type { OEmbedProvider, OEmbedProviderEndpoint } from './types';

/**
 * Result of looking up a provider endpoint for a URL
 */
export interface OEmbedEndpointMatch {
  provider: OEmbedProvider;
  endpoint: OEmbedProviderEndpoint;
}

/**
 * Convert an oEmbed scheme pattern to a regex.
 * Schemes use * as a wildcard matching any sequence of characters.
 *
 * @param scheme The oEmbed scheme pattern (e.g., "https://youtu.be/*")
 * @returns A RegExp that matches URLs conforming to the scheme
 */
export function schemeToRegex(scheme: string): RegExp {
  // Escape regex special characters except *
  const escaped = scheme.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // Replace * with .* (match any characters)
  const pattern = escaped.replace(/\*/g, '.*');

  // Make it a full match (anchored)
  return new RegExp(`^${pattern}$`, 'i');
}

/**
 * Check if a URL matches an oEmbed scheme pattern
 *
 * @param url The URL to check
 * @param scheme The oEmbed scheme pattern
 * @returns true if the URL matches the scheme
 */
export function matchesScheme(url: string, scheme: string): boolean {
  const regex = schemeToRegex(scheme);
  return regex.test(url);
}

/**
 * oEmbed Provider Registry
 *
 * Holds the list of known oEmbed providers and provides
 * lookup functionality to match URLs to endpoints.
 */
export class OEmbedRegistry {
  private providers: OEmbedProvider[];

  constructor(providers: OEmbedProvider[]) {
    this.providers = providers;
  }

  /**
   * Get all registered providers
   */
  getProviders(): readonly OEmbedProvider[] {
    return this.providers;
  }

  /**
   * Get the count of registered providers
   */
  get providerCount(): number {
    return this.providers.length;
  }

  /**
   * Find the provider endpoint that matches a given URL
   *
   * @param url The URL to look up
   * @returns The matching provider and endpoint, or null if no match
   */
  findEndpoint(url: string): OEmbedEndpointMatch | null {
    for (const provider of this.providers) {
      for (const endpoint of provider.endpoints) {
        // If endpoint has schemes, check if URL matches any
        if (endpoint.schemes && endpoint.schemes.length > 0) {
          for (const scheme of endpoint.schemes) {
            if (matchesScheme(url, scheme)) {
              return { provider, endpoint };
            }
          }
        }
        // If no schemes, this endpoint doesn't match URLs directly
        // (would need discovery)
      }
    }
    return null;
  }

  /**
   * Find a provider by name
   *
   * @param name The provider name (case-insensitive)
   * @returns The provider or null if not found
   */
  findProvider(name: string): OEmbedProvider | null {
    const lowerName = name.toLowerCase();
    return this.providers.find((p) => p.provider_name.toLowerCase() === lowerName) ?? null;
  }

  /**
   * Build the full oEmbed API URL for fetching embed data
   *
   * @param endpoint The oEmbed endpoint configuration
   * @param targetUrl The URL to get embed data for
   * @param options Optional parameters for the request
   * @returns The full oEmbed API URL with query parameters
   */
  buildOEmbedUrl(
    endpoint: OEmbedProviderEndpoint,
    targetUrl: string,
    options?: {
      maxWidth?: number;
      maxHeight?: number;
      format?: 'json' | 'xml';
    }
  ): string {
    const baseUrl = endpoint.url;
    const params = new URLSearchParams();

    // Required: the URL to get embed data for
    params.set('url', targetUrl);

    // Prefer JSON format
    const format = options?.format ?? 'json';
    params.set('format', format);

    // Optional size constraints
    if (options?.maxWidth !== undefined) {
      params.set('maxwidth', String(options.maxWidth));
    }
    if (options?.maxHeight !== undefined) {
      params.set('maxheight', String(options.maxHeight));
    }

    // Some endpoints use {format} placeholder in URL
    const finalUrl = baseUrl.replace('{format}', format);

    // Build full URL
    const separator = finalUrl.includes('?') ? '&' : '?';
    return `${finalUrl}${separator}${params.toString()}`;
  }
}

/**
 * Create a registry from the bundled providers JSON
 *
 * @param providersJson The parsed providers.json data
 * @returns An OEmbedRegistry instance
 */
export function createRegistry(providersJson: OEmbedProvider[]): OEmbedRegistry {
  return new OEmbedRegistry(providersJson);
}
