/**
 * SD Watcher Helper Functions
 *
 * Shared utility functions for SD watcher operations
 */

import type { Database } from '@notecove/shared';
import { extractTags, extractTextFromFragment } from '@notecove/shared';
import type { CRDTManager } from './crdt';

/**
 * Reindex tags for a set of notes after external sync
 */
export async function reindexTagsForNotes(
  noteIds: Set<string>,
  crdtManager: CRDTManager,
  database: Database
): Promise<void> {
  if (noteIds.size === 0) {
    return;
  }

  console.log(`[TagSync] Reindexing tags for ${noteIds.size} notes after external sync`);

  for (const noteId of noteIds) {
    try {
      // Get the note from database to verify it exists
      const note = await database.getNote(noteId);
      if (!note || note.deleted) {
        console.log(`[TagSync] Skipping deleted or non-existent note: ${noteId}`);
        continue;
      }

      // Get the CRDT document
      const doc = crdtManager.getDocument(noteId);
      if (!doc) {
        console.warn(`[TagSync] No CRDT document found for note ${noteId}`);
        continue;
      }

      // Extract plain text from the document
      const content = doc.getXmlFragment('content');
      const contentText = extractTextFromFragment(content);

      // Extract and update tags
      const tags = extractTags(contentText);
      console.log(`[TagSync] Found ${tags.length} tags in note ${noteId}: ${tags.join(', ')}`);

      // Get existing tags for this note
      const existingTags = await database.getTagsForNote(noteId);
      const existingTagsMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));

      // Build a set of new tag names for O(1) lookup
      const newTagNames = new Set(tags);

      // Determine which tags to remove
      const tagsToRemove = existingTags.filter((tag) => !newTagNames.has(tag.name.toLowerCase()));

      // Determine which tags to add
      const tagsToAdd = tags.filter((tagName) => !existingTagsMap.has(tagName));

      // Process removals
      for (const tag of tagsToRemove) {
        console.log(`[TagSync] Removing tag ${tag.name} from note ${noteId}`);
        await database.removeTagFromNote(noteId, tag.id);
      }

      // Process additions
      for (const tagName of tagsToAdd) {
        let tag = await database.getTagByName(tagName);
        if (!tag) {
          console.log(`[TagSync] Creating new tag: ${tagName}`);
          tag = await database.createTag(tagName);
        }
        console.log(`[TagSync] Adding tag ${tag.name} to note ${noteId}`);
        await database.addTagToNote(noteId, tag.id);
      }
    } catch (err) {
      console.error(`[TagSync] Failed to reindex tags for note ${noteId}:`, err);
      // Continue with other notes even if one fails
    }
  }

  console.log(`[TagSync] Completed tag reindexing for ${noteIds.size} notes`);
}
