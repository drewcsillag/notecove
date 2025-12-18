/**
 * Web Link Utilities
 *
 * Utilities for detecting, validating, and extracting web links (http/https URLs).
 * These utilities are shared between desktop and iOS platforms.
 */

/**
 * Regex pattern for matching web URLs (http:// or https://)
 *
 * Matches URLs that:
 * - Start with http:// or https://
 * - Have a valid domain (letters, numbers, dots, hyphens)
 * - May have optional port, path, query string, and fragment
 *
 * Note: This is a simplified pattern. For production use, consider using
 * a more comprehensive URL validation library.
 */
export const WEB_LINK_PATTERN = /https?:\/\/[^\s<>]+/gi;

/**
 * Regex pattern for matching markdown-style links: [text](url)
 *
 * Captures:
 * - Group 1: Link text (anything except [ and ])
 * - Group 2: URL (must start with http:// or https://)
 *
 * Note: This pattern handles URLs with parentheses (like Wikipedia) by matching
 * greedily. Use balanceUrlParentheses() to clean up trailing unbalanced parens.
 */
export const MARKDOWN_LINK_PATTERN = /\[([^[\]]+)\]\((https?:\/\/[^\s<>]*)\)/;

/**
 * Balance parentheses in a URL by trimming trailing ) if unbalanced
 * Handles Wikipedia-style URLs like: https://en.wikipedia.org/wiki/Test_(disambiguation)
 *
 * @param url The URL to balance
 * @returns URL with balanced parentheses
 */
export function balanceUrlParentheses(url: string): string {
  let openCount = 0;
  let closeCount = 0;

  for (const char of url) {
    if (char === '(') openCount++;
    else if (char === ')') closeCount++;
  }

  // If we have more closing parens than opening, trim trailing parens
  while (closeCount > openCount && url.endsWith(')')) {
    url = url.slice(0, -1);
    closeCount--;
  }

  return url;
}

/**
 * Extract all web link URLs from text
 *
 * @param text Plain text content
 * @returns Array of unique URLs found in the text
 */
export function extractWebLinks(text: string): string[] {
  // Input validation
  if (text === null || text === undefined || typeof text !== 'string') {
    return [];
  }

  if (text.length === 0) {
    return [];
  }

  const urls = new Set<string>();
  const regex = new RegExp(WEB_LINK_PATTERN.source, WEB_LINK_PATTERN.flags);

  let match;
  while ((match = regex.exec(text)) !== null) {
    // Clean up the URL (remove trailing punctuation that's not part of URL)
    let url = match[0];

    // Remove common trailing punctuation that's unlikely to be part of URL
    url = url.replace(/[.,;:!?'")\]}>]+$/, '');

    // Balance parentheses (for Wikipedia-style URLs)
    url = balanceUrlParentheses(url);

    if (url.length > 0) {
      urls.add(url);
    }
  }

  return Array.from(urls);
}

/**
 * Check if a string is a valid web URL (http/https)
 *
 * @param url String to validate
 * @returns true if the string is a valid http/https URL
 */
export function isValidWebUrl(url: string): boolean {
  // Input validation
  if (url === null || url === undefined || typeof url !== 'string') {
    return false;
  }

  if (url.length === 0) {
    return false;
  }

  // Must start with http:// or https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  // Basic URL structure validation
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if text contains any web links
 *
 * @param text Plain text content
 * @returns true if text contains at least one web link
 */
export function hasWebLinks(text: string): boolean {
  if (text === null || text === undefined || typeof text !== 'string') {
    return false;
  }

  const regex = new RegExp(WEB_LINK_PATTERN.source, WEB_LINK_PATTERN.flags);
  return regex.test(text);
}

/**
 * Represents a character range in text where a URL is located
 */
export interface UrlRange {
  /** Start index (inclusive) */
  start: number;
  /** End index (exclusive) */
  end: number;
}

/**
 * Get the character ranges of all URLs in text
 *
 * This is useful for determining if other patterns (like hashtags) fall
 * within a URL and should be ignored.
 *
 * @param text Plain text content
 * @returns Array of {start, end} ranges for each URL found
 */
export function getUrlRanges(text: string): UrlRange[] {
  // Input validation
  if (text === null || text === undefined || typeof text !== 'string') {
    return [];
  }

  if (text.length === 0) {
    return [];
  }

  const ranges: UrlRange[] = [];
  const regex = new RegExp(WEB_LINK_PATTERN.source, WEB_LINK_PATTERN.flags);

  let match;
  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    let url = match[0];

    // Clean up trailing punctuation (same logic as extractWebLinks)
    url = url.replace(/[.,;:!?'")\]}>]+$/, '');

    // Balance parentheses (for Wikipedia-style URLs)
    url = balanceUrlParentheses(url);

    const end = start + url.length;

    if (url.length > 0) {
      ranges.push({ start, end });
    }
  }

  return ranges;
}

/**
 * Recognized top-level domains for URL detection
 * Includes common gTLDs and country code TLDs
 */
const RECOGNIZED_TLDS = new Set([
  // Common gTLDs
  'com',
  'org',
  'net',
  'edu',
  'gov',
  'io',
  'dev',
  'co',
  'ai',
  'app',
  'me',
  'info',
  'biz',
  'xyz',
  'tech',
  'online',
  'site',
  'blog',
  'cloud',
  'store',
  // Country code TLDs
  'uk',
  'de',
  'fr',
  'jp',
  'cn',
  'au',
  'ca',
  'us',
  'in',
  'br',
  'ru',
  'nl',
  'es',
  'it',
  'pl',
  'se',
  'no',
  'fi',
  'dk',
  'ch',
  'at',
  'be',
  'nz',
]);

/**
 * Pattern for IPv4 addresses (e.g., 192.168.1.1)
 */
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Check if a string is a valid IPv4 address
 */
function isIPv4Address(text: string): boolean {
  // Extract just the IP part (before any port/path)
  const ipPart = text.split(/[:/]/)[0];
  const match = ipPart.match(IPV4_PATTERN);
  if (!match) return false;

  // Validate each octet is 0-255
  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i], 10);
    if (octet < 0 || octet > 255) return false;
  }
  return true;
}

/**
 * Extract the TLD from a hostname
 * Returns null if no valid TLD structure found
 */
function extractTld(hostname: string): string | null {
  // Remove any path, query, or fragment
  const hostPart = hostname.split(/[/?#]/)[0];

  // Remove any port
  const hostWithoutPort = hostPart.split(':')[0];

  // Split by dots and get the last part
  const parts = hostWithoutPort.split('.');
  if (parts.length < 2) return null;

  return parts[parts.length - 1].toLowerCase();
}

/**
 * Detect if selected text looks like a URL or hostname and format it
 *
 * This function is used to auto-populate the URL field when creating a link
 * from selected text that looks like a URL or hostname.
 *
 * @param selection The selected text from the editor
 * @returns A formatted URL string, or null if the text doesn't look like a URL
 *
 * Detection rules:
 * - Full URLs (http:// or https://) are returned as-is
 * - Bare hostnames with recognized TLDs get https:// prepended
 * - localhost (with optional port/path) gets https:// prepended
 * - IP addresses get http:// prepended (typically used for local dev)
 * - Text with internal spaces is rejected
 * - Email addresses are rejected
 */
export function detectUrlFromSelection(selection: string): string | null {
  // Input validation
  if (selection === null || selection === undefined || typeof selection !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = selection.trim();

  // Empty string after trimming
  if (trimmed.length === 0) {
    return null;
  }

  // Reject if contains internal spaces (not a single URL/hostname)
  if (/\s/.test(trimmed)) {
    return null;
  }

  // Reject email addresses
  if (trimmed.includes('@')) {
    return null;
  }

  // If already has http:// or https://, return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Check for localhost
  if (
    trimmed === 'localhost' ||
    trimmed.startsWith('localhost:') ||
    trimmed.startsWith('localhost/')
  ) {
    return `https://${trimmed}`;
  }

  // Check for IP address
  if (isIPv4Address(trimmed)) {
    return `http://${trimmed}`;
  }

  // Check for recognized TLD
  const tld = extractTld(trimmed);
  if (tld && RECOGNIZED_TLDS.has(tld)) {
    return `https://${trimmed}`;
  }

  // Not recognized as a URL or hostname
  return null;
}
