/**
 * Pick Next Note Utility
 *
 * Selects the most recently modified note from a list, optionally excluding
 * specific note IDs. Used when auto-selecting a note after deletion.
 */

import type { NoteCache } from '@notecove/shared';

/**
 * Picks the next note to select based on most recent modification time.
 *
 * @param notes - Array of note cache entries to choose from
 * @param excludeIds - Optional array of note IDs to exclude from selection
 * @returns The ID of the most recently modified note, or null if no notes available
 */
export function pickNextNote(notes: NoteCache[], excludeIds: string[] = []): string | null {
  const excludeSet = new Set(excludeIds);

  // Filter out excluded notes and deleted notes
  const candidates = notes.filter((note) => !excludeSet.has(note.id) && !note.deleted);

  if (candidates.length === 0) {
    return null;
  }

  // Sort by modified timestamp descending (most recent first)
  candidates.sort((a, b) => b.modified - a.modified);

  return candidates[0]?.id ?? null;
}
