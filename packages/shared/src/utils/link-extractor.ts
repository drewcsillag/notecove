/**
 * Inter-Note Link Extraction Utilities
 *
 * Extracts inter-note links from note content.
 * Pattern: [[note-id]] where note-id is a UUID
 *
 * Links are stored as note IDs internally, but displayed with note titles in the UI.
 */

import type { UUID } from '../types';

/**
 * Regex pattern for matching inter-note links
 * Pattern: [[ followed by a UUID, followed by ]]
 *
 * UUID format: 8-4-4-4-12 hexadecimal characters
 * Example: [[550e8400-e29b-41d4-a716-446655440000]]
 */
export const LINK_PATTERN =
  /\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/gi;

/**
 * Extract all inter-note link note IDs from text
 * @param text Plain text content
 * @returns Array of unique note IDs that are linked to
 */
export function extractLinks(text: string): UUID[] {
  // Input validation
  if (text === null || text === undefined || typeof text !== 'string') {
    return [];
  }

  const noteIds = new Set<UUID>();
  const regex = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);

  let match;
  while ((match = regex.exec(text)) !== null) {
    // Extract the UUID from the capture group (match[1])
    // Convert to lowercase for consistency
    noteIds.add(match[1].toLowerCase());
  }

  return Array.from(noteIds);
}

/**
 * Check if text contains any inter-note links
 * @param text Plain text content
 * @returns true if text contains at least one inter-note link
 */
export function hasLinks(text: string): boolean {
  if (text === null || text === undefined || typeof text !== 'string') {
    return false;
  }

  const regex = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);
  return regex.test(text);
}
