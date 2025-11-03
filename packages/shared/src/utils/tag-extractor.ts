/**
 * Tag Extraction Utilities
 *
 * Extracts hashtags from note content.
 * Pattern: #tagname (must start with a letter, followed by letters, numbers, or underscores)
 */

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
 * Extract all hashtags from text
 * @param text Plain text content
 * @returns Array of unique tag names (lowercase, without # prefix)
 */
export function extractTags(text: string): string[] {
  // Input validation
  if (text === null || text === undefined || typeof text !== 'string') {
    return [];
  }

  const tags = new Set<string>();
  const regex = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);

  let match;
  while ((match = regex.exec(text)) !== null) {
    // Remove # prefix and convert to lowercase
    let tag = match[0].slice(1).toLowerCase();

    // Enforce max length
    if (tag.length > MAX_TAG_LENGTH) {
      tag = tag.slice(0, MAX_TAG_LENGTH);
    }

    tags.add(tag);
  }

  return Array.from(tags);
}
