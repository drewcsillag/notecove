/**
 * Link Repository
 * Handles all inter-note link operations
 */

import type { DatabaseAdapter, NoteCache, UUID } from '@notecove/shared';

export class LinkRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  /**
   * Add a link from source note to target note
   * @param sourceNoteId Note containing the link
   * @param targetNoteId Note being linked to
   * @returns true if link was added, false if target note doesn't exist yet
   */
  async addLink(sourceNoteId: UUID, targetNoteId: UUID): Promise<boolean> {
    try {
      await this.adapter.exec(
        'INSERT OR IGNORE INTO note_links (source_note_id, target_note_id) VALUES (?, ?)',
        [sourceNoteId, targetNoteId]
      );
      return true;
    } catch (error: unknown) {
      // Handle FOREIGN KEY constraint failure gracefully
      // This happens when the target note hasn't been discovered/synced yet
      if (
        error instanceof Error &&
        error.message.includes('FOREIGN KEY constraint failed')
      ) {
        console.log(
          `[LinkRepository] Skipping link ${sourceNoteId} -> ${targetNoteId}: target note not yet in database`
        );
        return false;
      }
      throw error;
    }
  }

  /**
   * Remove a link from source note to target note
   * @param sourceNoteId Note containing the link
   * @param targetNoteId Note being linked to
   */
  async removeLink(sourceNoteId: UUID, targetNoteId: UUID): Promise<void> {
    await this.adapter.exec(
      'DELETE FROM note_links WHERE source_note_id = ? AND target_note_id = ?',
      [sourceNoteId, targetNoteId]
    );
  }

  /**
   * Get all links from a specific note (outgoing links)
   * @param sourceNoteId Note to get links from
   * @returns Array of target note IDs
   */
  async getLinksFromNote(sourceNoteId: UUID): Promise<UUID[]> {
    const rows = await this.adapter.all<{ target_note_id: string }>(
      'SELECT target_note_id FROM note_links WHERE source_note_id = ?',
      [sourceNoteId]
    );

    return rows.map((row) => row.target_note_id);
  }

  /**
   * Get all links to a specific note (incoming links/backlinks)
   * @param targetNoteId Note to get backlinks to
   * @returns Array of source note IDs
   */
  async getLinksToNote(targetNoteId: UUID): Promise<UUID[]> {
    const rows = await this.adapter.all<{ source_note_id: string }>(
      'SELECT source_note_id FROM note_links WHERE target_note_id = ?',
      [targetNoteId]
    );

    return rows.map((row) => row.source_note_id);
  }

  /**
   * Get all notes that link to a specific note (with full note details)
   * @param targetNoteId Note to get backlinks to
   * @returns Array of note cache entries
   */
  async getBacklinks(targetNoteId: UUID): Promise<NoteCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      title: string;
      sd_id: string;
      folder_id: string | null;
      created: number;
      modified: number;
      deleted: number;
      pinned: number;
      content_preview: string;
      content_text: string;
    }>(
      `SELECT n.* FROM notes n
       INNER JOIN note_links nl ON n.id = nl.source_note_id
       WHERE nl.target_note_id = ? AND n.deleted = 0
       ORDER BY n.modified DESC`,
      [targetNoteId]
    );

    return rows.map((row) => this.mapNoteRow(row));
  }

  /**
   * Remove all links from a note (useful when deleting a note)
   * @param noteId Note to remove all links from
   */
  async removeAllLinksFromNote(noteId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM note_links WHERE source_note_id = ?', [noteId]);
  }

  /**
   * Remove all links to a note (useful when deleting a note)
   * @param noteId Note to remove all links to
   */
  async removeAllLinksToNote(noteId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM note_links WHERE target_note_id = ?', [noteId]);
  }

  private mapNoteRow(row: {
    id: string;
    title: string;
    sd_id: string;
    folder_id: string | null;
    created: number;
    modified: number;
    deleted: number;
    pinned: number;
    content_preview: string;
    content_text: string;
  }): NoteCache {
    return {
      id: row.id,
      title: row.title,
      sdId: row.sd_id,
      folderId: row.folder_id,
      created: row.created,
      modified: row.modified,
      deleted: row.deleted === 1,
      pinned: row.pinned === 1,
      contentPreview: row.content_preview,
      contentText: row.content_text,
    };
  }
}
