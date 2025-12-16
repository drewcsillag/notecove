/**
 * Tag Repository
 * Handles all tag operations
 */

import { randomUUID } from 'crypto';
import type { DatabaseAdapter, Tag, NoteCache, UUID } from '@notecove/shared';

export class TagRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async createTag(name: string): Promise<Tag> {
    // Try to get existing tag first (case-insensitive)
    const existing = await this.getTagByName(name);
    if (existing) {
      return existing;
    }

    // Generate UUID for new tag
    const id = randomUUID() as UUID;
    await this.adapter.exec('INSERT INTO tags (id, name) VALUES (?, ?)', [id, name]);

    return { id, name };
  }

  async getTag(tagId: UUID): Promise<Tag | null> {
    const row = await this.adapter.get<{ id: string; name: string }>(
      'SELECT * FROM tags WHERE id = ?',
      [tagId]
    );

    return row ? { id: row.id, name: row.name } : null;
  }

  async getTagByName(name: string): Promise<Tag | null> {
    const row = await this.adapter.get<{ id: string; name: string }>(
      'SELECT * FROM tags WHERE name = ? COLLATE NOCASE',
      [name]
    );

    return row ? { id: row.id, name: row.name } : null;
  }

  async getAllTags(): Promise<(Tag & { count: number })[]> {
    const rows = await this.adapter.all<{ id: string; name: string; count: number }>(
      `SELECT t.id, t.name, COUNT(nt.note_id) as count
       FROM tags t
       LEFT JOIN note_tags nt ON t.id = nt.tag_id
       GROUP BY t.id, t.name
       HAVING count > 0
       ORDER BY t.name COLLATE NOCASE`
    );

    return rows;
  }

  async getTagsForNote(noteId: UUID): Promise<Tag[]> {
    const rows = await this.adapter.all<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM tags t
       INNER JOIN note_tags nt ON t.id = nt.tag_id
       WHERE nt.note_id = ?
       ORDER BY t.name COLLATE NOCASE`,
      [noteId]
    );

    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async addTagToNote(noteId: UUID, tagId: UUID): Promise<void> {
    await this.adapter.exec('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)', [
      noteId,
      tagId,
    ]);
  }

  async removeTagFromNote(noteId: UUID, tagId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?', [
      noteId,
      tagId,
    ]);
  }

  async getNotesWithTag(tagId: UUID): Promise<NoteCache[]> {
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
       INNER JOIN note_tags nt ON n.id = nt.note_id
       WHERE nt.tag_id = ? AND n.deleted = 0
       ORDER BY n.modified DESC`,
      [tagId]
    );

    return rows.map((row) => this.mapNoteRow(row));
  }

  async deleteTag(tagId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM tags WHERE id = ?', [tagId]);
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
