/**
 * oEmbed Discovery
 *
 * Implements the oEmbed discovery mechanism by looking for <link> tags
 * in HTML pages that point to oEmbed endpoints.
 *
 * @see https://oembed.com/#section4
 */

import { net } from 'electron';
import { createLogger } from '../telemetry/logger';

const log = createLogger('oEmbed:Discovery');

/**
 * Discovery result
 */
export interface DiscoveryResult {
  endpointUrl: string;
  format: 'json' | 'xml';
}

/**
 * Fetch HTML content from a URL using Electron's net module
 */
async function fetchHtml(url: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url,
      method: 'GET',
    });

    let data = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        request.abort();
        reject(new Error(`Timeout fetching ${url}`));
      }
    }, timeoutMs);

    request.on('response', (response) => {
      // Check for redirect
      if (response.statusCode >= 300 && response.statusCode < 400) {
        const location = response.headers['location'];
        if (location) {
          clearTimeout(timeout);
          resolved = true;
          // Follow redirect
          const redirectUrl = Array.isArray(location) ? location[0] : location;
          if (redirectUrl) {
            fetchHtml(redirectUrl, timeoutMs).then(resolve).catch(reject);
          }
          return;
        }
      }

      // Check for success
      if (response.statusCode !== 200) {
        clearTimeout(timeout);
        resolved = true;
        reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
        return;
      }

      // Check content type
      const contentType = response.headers['content-type'];
      const contentTypeStr = Array.isArray(contentType) ? contentType[0] : contentType;
      if (contentTypeStr && !contentTypeStr.includes('text/html')) {
        clearTimeout(timeout);
        resolved = true;
        reject(new Error(`Not HTML: ${contentTypeStr}`));
        return;
      }

      response.on('data', (chunk: Buffer) => {
        data += chunk.toString();
        // Stop after we have enough data (we only need the head)
        if (data.length > 100000) {
          clearTimeout(timeout);
          resolved = true;
          resolve(data);
          request.abort();
        }
      });

      response.on('end', () => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          resolve(data);
        }
      });

      response.on('error', (error) => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          reject(error);
        }
      });
    });

    request.on('error', (error) => {
      if (!resolved) {
        clearTimeout(timeout);
        resolved = true;
        reject(error);
      }
    });

    request.end();
  });
}

/**
 * Parse oEmbed link tags from HTML
 *
 * Looking for:
 * <link rel="alternate" type="application/json+oembed" href="...">
 * <link rel="alternate" type="text/xml+oembed" href="...">
 */
function parseOEmbedLinks(html: string): DiscoveryResult[] {
  const results: DiscoveryResult[] = [];

  // Match <link> tags - simplified regex that handles common cases
  const linkRegex =
    /<link\s+[^>]*rel\s*=\s*["']alternate["'][^>]*>|<link\s+[^>]*type\s*=\s*["'][^"']*oembed[^"']*["'][^>]*>/gi;
  const matches = html.match(linkRegex);

  if (!matches) return results;

  const typeRegex = /type\s*=\s*["']([^"']+)["']/i;
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/i;

  for (const match of matches) {
    // Check if it's an oEmbed link
    const typeMatch = typeRegex.exec(match);
    if (!typeMatch?.[1]) continue;

    const type = typeMatch[1].toLowerCase();
    let format: 'json' | 'xml' | null = null;

    if (type === 'application/json+oembed') {
      format = 'json';
    } else if (type === 'text/xml+oembed') {
      format = 'xml';
    }

    if (!format) continue;

    // Extract href
    const hrefMatch = hrefRegex.exec(match);
    if (!hrefMatch?.[1]) continue;

    const href = hrefMatch[1];

    // Decode HTML entities
    const decodedHref = href
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    results.push({
      endpointUrl: decodedHref,
      format,
    });
  }

  return results;
}

/**
 * Discover oEmbed endpoint for a URL by fetching its HTML and looking for link tags
 *
 * @param url The URL to discover oEmbed endpoint for
 * @returns The discovery result or null if no endpoint found
 */
export async function discoverOEmbedEndpoint(url: string): Promise<DiscoveryResult | null> {
  try {
    log.debug('Attempting discovery for URL:', { url });

    const html = await fetchHtml(url);
    const links = parseOEmbedLinks(html);

    if (links.length === 0) {
      log.debug('No oEmbed links found for:', { url });
      return null;
    }

    // Prefer JSON over XML
    const jsonLink = links.find((l) => l.format === 'json');
    const result = jsonLink ?? links[0];

    if (result) {
      log.debug('Discovered oEmbed endpoint:', { endpointUrl: result.endpointUrl });
      return result;
    }
    return null;
  } catch (err) {
    log.debug('Discovery failed for:', { url, error: String(err) });
    return null;
  }
}

// Export for testing
export { parseOEmbedLinks };
