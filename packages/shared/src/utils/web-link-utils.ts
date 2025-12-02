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
