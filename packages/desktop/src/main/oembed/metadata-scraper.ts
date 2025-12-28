/**
 * Metadata Scraper
 *
 * Fallback for extracting page metadata from HTML when oEmbed is not available.
 * Parses Open Graph tags, Twitter cards, and standard meta tags.
 */

import { net } from 'electron';
import { createLogger } from '../telemetry/logger';

const log = createLogger('oEmbed:MetadataScraper');

/**
 * Scraped metadata from a page
 */
export interface ScrapedMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url?: string;
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

    // Set user agent to avoid being blocked
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

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
          const redirectUrl = Array.isArray(location) ? location[0] : location;
          if (redirectUrl) {
            // Resolve relative URLs
            const absoluteUrl = redirectUrl.startsWith('http')
              ? redirectUrl
              : new URL(redirectUrl, url).href;
            fetchHtml(absoluteUrl, timeoutMs).then(resolve).catch(reject);
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
 * Extract meta tag content from HTML
 */
function getMetaContent(html: string, property: string): string | undefined {
  // Try property attribute (Open Graph style)
  const propertyRegex = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  let match = propertyRegex.exec(html);
  if (match?.[1]) return decodeHtmlEntities(match[1]);

  // Try content before property
  const contentFirstRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    'i'
  );
  match = contentFirstRegex.exec(html);
  if (match?.[1]) return decodeHtmlEntities(match[1]);

  // Try name attribute (Twitter card style)
  const nameRegex = new RegExp(
    `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  match = nameRegex.exec(html);
  if (match?.[1]) return decodeHtmlEntities(match[1]);

  // Try content before name
  const contentNameRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`,
    'i'
  );
  match = contentNameRegex.exec(html);
  if (match?.[1]) return decodeHtmlEntities(match[1]);

  return undefined;
}

/**
 * Extract page title from HTML
 */
function getPageTitle(html: string): string | undefined {
  const titleRegex = /<title[^>]*>([^<]+)<\/title>/i;
  const match = titleRegex.exec(html);
  if (match?.[1]) {
    return decodeHtmlEntities(match[1].trim());
  }
  return undefined;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Scrape metadata from a URL
 *
 * Tries to extract Open Graph, Twitter Card, and standard meta tags.
 *
 * @param url The URL to scrape
 * @returns Scraped metadata or null if failed
 */
export async function scrapeMetadata(url: string): Promise<ScrapedMetadata | null> {
  try {
    log.debug('Scraping metadata for:', { url });

    const html = await fetchHtml(url);

    const metadata: ScrapedMetadata = {};

    // Try Open Graph first (most reliable)
    const ogTitle = getMetaContent(html, 'og:title');
    const ogDescription = getMetaContent(html, 'og:description');
    const ogImage = getMetaContent(html, 'og:image');
    const ogSiteName = getMetaContent(html, 'og:site_name');
    const ogUrl = getMetaContent(html, 'og:url');

    if (ogTitle) metadata.title = ogTitle;
    if (ogDescription) metadata.description = ogDescription;
    if (ogImage) metadata.image = ogImage;
    if (ogSiteName) metadata.siteName = ogSiteName;
    if (ogUrl) metadata.url = ogUrl;

    // Fall back to Twitter cards
    if (!metadata.title) {
      const twitterTitle = getMetaContent(html, 'twitter:title');
      if (twitterTitle) metadata.title = twitterTitle;
    }
    if (!metadata.description) {
      const twitterDescription = getMetaContent(html, 'twitter:description');
      if (twitterDescription) metadata.description = twitterDescription;
    }
    if (!metadata.image) {
      const twitterImage = getMetaContent(html, 'twitter:image');
      if (twitterImage) metadata.image = twitterImage;
    }

    // Fall back to standard meta tags
    if (!metadata.description) {
      const metaDescription = getMetaContent(html, 'description');
      if (metaDescription) metadata.description = metaDescription;
    }

    // Fall back to page title
    if (!metadata.title) {
      const pageTitle = getPageTitle(html);
      if (pageTitle) metadata.title = pageTitle;
    }

    // Make image URL absolute
    if (metadata.image && !metadata.image.startsWith('http')) {
      try {
        metadata.image = new URL(metadata.image, url).href;
      } catch {
        // Invalid URL, leave as-is
      }
    }

    // Check if we got any useful data
    if (!metadata.title && !metadata.description && !metadata.image) {
      log.debug('No metadata found for:', { url });
      return null;
    }

    log.debug('Scraped metadata:', { url, title: metadata.title });
    return metadata;
  } catch (error) {
    log.debug('Failed to scrape metadata:', { url, error: String(error) });
    return null;
  }
}
