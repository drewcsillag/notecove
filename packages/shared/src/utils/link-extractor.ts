/**
 * Inter-Note Link Extraction Utilities
 *
 * Extracts inter-note links from note content.
 * Pattern: [[note-id]] where note-id is a UUID (full or compact format)
 *
 * Links are stored as note IDs internally, but displayed with note titles in the UI.
 */

import type { UUID } from '../types';

/**
 * Regex pattern for matching inter-note links
 * Pattern: [[ followed by a UUID (full or compact), followed by ]]
 *
 * Supports two formats:
 * - Full UUID: 8-4-4-4-12 hexadecimal characters (36 chars with dashes)
 *   Example: [[550e8400-e29b-41d4-a716-446655440000]]
 * - Compact UUID: 22 base64url characters (A-Za-z0-9_-)
 *   Example: [[VQ6EAOKbQdSnFkRmVUQAAA]]
 */
export const LINK_PATTERN =
  /\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{22})\]\]/gi;

/**
 * Check if a string is a full UUID format (36 chars with dashes)
 */
function isFullUuidFormat(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

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
    const id = match[1];
    // Normalize full UUIDs to lowercase for consistency
    // Compact IDs are case-sensitive (base64url) so keep them as-is
    const normalizedId = isFullUuidFormat(id) ? id.toLowerCase() : id;
    noteIds.add(normalizedId);
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
