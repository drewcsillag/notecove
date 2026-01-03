/**
 * Tag Extraction Utilities
 *
 * Extracts hashtags from note content.
 * Pattern: #tagname (must start with a letter, followed by letters, numbers, or underscores)
 */

import { getUrlRanges, type UrlRange } from './web-link-utils';
import { isValidHeadingId } from './heading-extractor';

/**
 * Maximum allowed length for a tag name (excluding the # prefix)
 * Tags longer than this will be truncated
 */
export const MAX_TAG_LENGTH = 50;

/**
 * Regex pattern for matching hashtags
 * Pattern: # followed by a letter, then zero or more letters/numbers/underscores
 */
export const HASHTAG_PATTERN = /#[a-zA-Z][a-zA-Z0-9_]*/g;

/**
 * Check if a position falls within any URL range
 */
function isPositionInUrl(position: number, urlRanges: UrlRange[]): boolean {
  for (const range of urlRanges) {
    if (position >= range.start && position < range.end) {
      return true;
    }
  }
  return false;
}

/**
 * Extract all hashtags from text
 *
 * Hashtags that appear within URLs (as fragments or query params) are NOT extracted.
 * For example, in "https://example.com/page#section", the "#section" is a URL fragment
 * and will not be returned as a tag.
 *
 * @param text Plain text content
 * @returns Array of unique tag names (lowercase, without # prefix)
 */
export function extractTags(text: string): string[] {
  // Input validation
  if (text === null || text === undefined || typeof text !== 'string') {
    return [];
  }

  // Get all URL ranges first so we can skip hashtags inside URLs
  const urlRanges = getUrlRanges(text);

  const tags = new Set<string>();
  const regex = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);

  let match;
  while ((match = regex.exec(text)) !== null) {
    const matchPosition = match.index;

    // Skip this hashtag if it's inside a URL
    if (isPositionInUrl(matchPosition, urlRanges)) {
      continue;
    }

    // Get the tag without # prefix
    const tagWithoutHash = match[0].slice(1);

    // Skip if this looks like a heading ID (h_XXXXXXXX format)
    // These appear in same-note heading links like [[#h_abc12xyz]]
    if (isValidHeadingId(tagWithoutHash)) {
      continue;
    }

    // Convert to lowercase
    let tag = tagWithoutHash.toLowerCase();

    // Enforce max length
    if (tag.length > MAX_TAG_LENGTH) {
      tag = tag.slice(0, MAX_TAG_LENGTH);
    }

    tags.add(tag);
  }

  return Array.from(tags);
}
