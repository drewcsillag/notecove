/**
 * Inter-Note Link Extraction Utilities
 *
 * Extracts inter-note links from note content.
 * Pattern: [[note-id]] where note-id is a UUID (full or compact format)
 * Also supports: [[note-id#heading-slug]] for linking to headings
 * And: [[#heading-slug]] for same-note heading links
 *
 * Links are stored as note IDs internally, but displayed with note titles in the UI.
 */

import type { UUID } from '../types';

/**
 * Regex pattern for matching inter-note links (backward compatible, no heading support)
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
 * Regex pattern for matching inter-note links with optional heading support
 *
 * Supports these formats:
 * - [[note-id]] - link to note (group 1: note-id, group 2: undefined)
 * - [[note-id#heading-id]] - link to heading (group 1: note-id, group 2: heading-id)
 * - [[#heading-id]] - same-note heading link (group 1: undefined, group 2: heading-id)
 *
 * Heading IDs: short UUIDs using base64url characters (A-Za-z0-9_-)
 * Format: h_XXXXXXXX (8 chars after prefix)
 */
export const LINK_WITH_HEADING_PATTERN =
  /\[\[(?:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{22}))?(?:#(h_[A-Za-z0-9_-]{8}))?\]\]/gi;

/**
 * Check if a string is a full UUID format (36 chars with dashes)
 */
function isFullUuidFormat(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Parsed link result
 */
export interface ParsedLink {
  noteId: string | null;
  headingId: string | null;
}

/**
 * Parse a link string into its components
 * @param linkText The full link text including brackets, e.g., "[[note-id#h_abc12xyz]]"
 * @returns ParsedLink with noteId and headingId, or null if invalid
 */
export function parseLink(linkText: string): ParsedLink | null {
  if (!linkText || typeof linkText !== 'string') {
    return null;
  }

  const regex = new RegExp(LINK_WITH_HEADING_PATTERN.source, LINK_WITH_HEADING_PATTERN.flags);
  const match = regex.exec(linkText);

  if (!match) {
    return null;
  }

  const noteId = match[1];
  const headingId = match[2];

  // Must have at least a note ID or a heading ID
  if (!noteId && !headingId) {
    return null;
  }

  // Normalize note ID (full UUIDs to lowercase, compact UUIDs keep case)
  let normalizedNoteId: string | null = null;
  if (noteId) {
    normalizedNoteId = isFullUuidFormat(noteId) ? noteId.toLowerCase() : noteId;
  }

  // Keep heading ID as-is (base64url is case-sensitive)
  const normalizedHeadingId = headingId ?? null;

  return {
    noteId: normalizedNoteId,
    headingId: normalizedHeadingId,
  };
}

/**
 * Extract heading ID from a link string
 * @param linkText The full link text including brackets
 * @returns The heading ID, or null if no heading
 */
export function extractHeadingFromLink(linkText: string): string | null {
  const parsed = parseLink(linkText);
  return parsed?.headingId ?? null;
}

/**
 * Check if a link is a same-note heading link (no note ID)
 * @param linkText The full link text including brackets
 * @returns true if this is a same-note link like [[#h_abc12xyz]]
 */
export function isSameNoteLink(linkText: string): boolean {
  const parsed = parseLink(linkText);
  return parsed !== null && parsed.noteId === null && parsed.headingId !== null;
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
