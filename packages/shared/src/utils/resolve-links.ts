/**
 * Link Resolution Utility
 *
 * Resolves [[uuid]] inter-note links to [[title]] for display.
 * Used when extracting titles and snippets for the notes list.
 */

import { LINK_PATTERN } from './link-extractor';
import { isFullUuid } from './uuid-encoding';

/**
 * Function type for resolving a note ID to its title.
 * Returns null if the note doesn't exist or is deleted.
 */
export type NoteTitleResolver = (noteId: string) => Promise<string | null>;

/**
 * Resolve all [[uuid]] links in text to [[title]].
 *
 * - Replaces each [[uuid]] with [[title]] where title is looked up via resolver
 * - Broken links (deleted/non-existent) become [[deleted note]]
 * - Only resolves one level deep (doesn't recurse into resolved titles)
 *
 * @param text - Text containing [[uuid]] links
 * @param resolver - Function to look up note title by ID
 * @returns Text with links resolved to titles
 */
export async function resolveLinks(text: string, resolver: NoteTitleResolver): Promise<string> {
  // Handle null/undefined input
  if (!text) {
    return '';
  }

  // Find all unique link IDs to resolve
  const regex = new RegExp(LINK_PATTERN.source, 'gi');
  const matches = text.matchAll(regex);
  const linkIds = new Set<string>();

  for (const match of matches) {
    // Only lowercase full UUIDs for consistency - compact UUIDs are case-sensitive
    const rawId = match[1];
    linkIds.add(isFullUuid(rawId) ? rawId.toLowerCase() : rawId);
  }

  if (linkIds.size === 0) {
    return text;
  }

  // Resolve all titles in parallel
  const titleMap = new Map<string, string>();
  await Promise.all(
    Array.from(linkIds).map(async (noteId) => {
      const title = await resolver(noteId);
      titleMap.set(noteId, title ?? 'deleted note');
    })
  );

  // Replace all links with resolved titles
  const result = text.replace(new RegExp(LINK_PATTERN.source, 'gi'), (_match, uuid: string) => {
    // Only lowercase full UUIDs - compact UUIDs are case-sensitive
    const normalizedId = isFullUuid(uuid) ? uuid.toLowerCase() : uuid;
    const title = titleMap.get(normalizedId) ?? 'deleted note';
    return `[[${title}]]`;
  });

  return result;
}
