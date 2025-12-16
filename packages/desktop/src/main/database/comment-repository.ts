/**
 * Comment Repository
 * Handles comment thread, reply, and reaction operations
 */

import type {
  DatabaseAdapter,
  CommentThreadCache,
  CommentReplyCache,
  CommentReactionCache,
  UUID,
} from '@notecove/shared';

export class CommentRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  // Comment Thread Operations

  async upsertCommentThread(thread: CommentThreadCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO comment_threads (
        id, note_id, anchor_start, anchor_end, original_text,
        author_id, author_name, author_handle, content,
        created, modified, resolved, resolved_by, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        note_id = excluded.note_id,
        anchor_start = excluded.anchor_start,
        anchor_end = excluded.anchor_end,
        original_text = excluded.original_text,
        author_id = excluded.author_id,
        author_name = excluded.author_name,
        author_handle = excluded.author_handle,
        content = excluded.content,
        created = excluded.created,
        modified = excluded.modified,
        resolved = excluded.resolved,
        resolved_by = excluded.resolved_by,
        resolved_at = excluded.resolved_at`,
      [
        thread.id,
        thread.noteId,
        Buffer.from(thread.anchorStart),
        Buffer.from(thread.anchorEnd),
        thread.originalText,
        thread.authorId,
        thread.authorName,
        thread.authorHandle,
        thread.content,
        thread.created,
        thread.modified,
        thread.resolved ? 1 : 0,
        thread.resolvedBy,
        thread.resolvedAt,
      ]
    );
  }

  async getCommentThread(threadId: UUID): Promise<CommentThreadCache | null> {
    const row = await this.adapter.get<{
      id: string;
      note_id: string;
      anchor_start: Buffer;
      anchor_end: Buffer;
      original_text: string;
      author_id: string;
      author_name: string;
      author_handle: string;
      content: string;
      created: number;
      modified: number;
      resolved: number;
      resolved_by: string | null;
      resolved_at: number | null;
    }>('SELECT * FROM comment_threads WHERE id = ?', [threadId]);

    return row ? this.mapCommentThreadRow(row) : null;
  }

  async getCommentThreadsForNote(noteId: UUID): Promise<CommentThreadCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      note_id: string;
      anchor_start: Buffer;
      anchor_end: Buffer;
      original_text: string;
      author_id: string;
      author_name: string;
      author_handle: string;
      content: string;
      created: number;
      modified: number;
      resolved: number;
      resolved_by: string | null;
      resolved_at: number | null;
    }>('SELECT * FROM comment_threads WHERE note_id = ? ORDER BY created ASC', [noteId]);

    return rows.map((row) => this.mapCommentThreadRow(row));
  }

  async deleteCommentThread(threadId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_threads WHERE id = ?', [threadId]);
  }

  async deleteCommentThreadsForNote(noteId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_threads WHERE note_id = ?', [noteId]);
  }

  private mapCommentThreadRow(row: {
    id: string;
    note_id: string;
    anchor_start: Buffer;
    anchor_end: Buffer;
    original_text: string;
    author_id: string;
    author_name: string;
    author_handle: string;
    content: string;
    created: number;
    modified: number;
    resolved: number;
    resolved_by: string | null;
    resolved_at: number | null;
  }): CommentThreadCache {
    return {
      id: row.id,
      noteId: row.note_id,
      anchorStart: new Uint8Array(row.anchor_start),
      anchorEnd: new Uint8Array(row.anchor_end),
      originalText: row.original_text,
      authorId: row.author_id,
      authorName: row.author_name,
      authorHandle: row.author_handle,
      content: row.content,
      created: row.created,
      modified: row.modified,
      resolved: row.resolved === 1,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
    };
  }

  // Comment Reply Operations

  async upsertCommentReply(reply: CommentReplyCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO comment_replies (
        id, thread_id, author_id, author_name, author_handle, content, created, modified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        thread_id = excluded.thread_id,
        author_id = excluded.author_id,
        author_name = excluded.author_name,
        author_handle = excluded.author_handle,
        content = excluded.content,
        created = excluded.created,
        modified = excluded.modified`,
      [
        reply.id,
        reply.threadId,
        reply.authorId,
        reply.authorName,
        reply.authorHandle,
        reply.content,
        reply.created,
        reply.modified,
      ]
    );
  }

  async getCommentReply(replyId: UUID): Promise<CommentReplyCache | null> {
    const row = await this.adapter.get<{
      id: string;
      thread_id: string;
      author_id: string;
      author_name: string;
      author_handle: string;
      content: string;
      created: number;
      modified: number;
    }>('SELECT * FROM comment_replies WHERE id = ?', [replyId]);

    return row ? this.mapCommentReplyRow(row) : null;
  }

  async getRepliesForThread(threadId: UUID): Promise<CommentReplyCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      thread_id: string;
      author_id: string;
      author_name: string;
      author_handle: string;
      content: string;
      created: number;
      modified: number;
    }>('SELECT * FROM comment_replies WHERE thread_id = ? ORDER BY created ASC', [threadId]);

    return rows.map((row) => this.mapCommentReplyRow(row));
  }

  async deleteCommentReply(replyId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_replies WHERE id = ?', [replyId]);
  }

  async deleteRepliesForThread(threadId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_replies WHERE thread_id = ?', [threadId]);
  }

  private mapCommentReplyRow(row: {
    id: string;
    thread_id: string;
    author_id: string;
    author_name: string;
    author_handle: string;
    content: string;
    created: number;
    modified: number;
  }): CommentReplyCache {
    return {
      id: row.id,
      threadId: row.thread_id,
      authorId: row.author_id,
      authorName: row.author_name,
      authorHandle: row.author_handle,
      content: row.content,
      created: row.created,
      modified: row.modified,
    };
  }

  // Comment Reaction Operations

  async upsertCommentReaction(reaction: CommentReactionCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO comment_reactions (
        id, target_type, target_id, emoji, author_id, author_name, created
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        emoji = excluded.emoji,
        author_id = excluded.author_id,
        author_name = excluded.author_name,
        created = excluded.created`,
      [
        reaction.id,
        reaction.targetType,
        reaction.targetId,
        reaction.emoji,
        reaction.authorId,
        reaction.authorName,
        reaction.created,
      ]
    );
  }

  async getCommentReaction(reactionId: UUID): Promise<CommentReactionCache | null> {
    const row = await this.adapter.get<{
      id: string;
      target_type: string;
      target_id: string;
      emoji: string;
      author_id: string;
      author_name: string;
      created: number;
    }>('SELECT * FROM comment_reactions WHERE id = ?', [reactionId]);

    return row ? this.mapCommentReactionRow(row) : null;
  }

  async getReactionsForTarget(
    targetType: 'thread' | 'reply',
    targetId: UUID
  ): Promise<CommentReactionCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      target_type: string;
      target_id: string;
      emoji: string;
      author_id: string;
      author_name: string;
      created: number;
    }>(
      'SELECT * FROM comment_reactions WHERE target_type = ? AND target_id = ? ORDER BY created ASC',
      [targetType, targetId]
    );

    return rows.map((row) => this.mapCommentReactionRow(row));
  }

  async deleteCommentReaction(reactionId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM comment_reactions WHERE id = ?', [reactionId]);
  }

  async deleteReactionsForTarget(targetType: 'thread' | 'reply', targetId: UUID): Promise<void> {
    await this.adapter.exec(
      'DELETE FROM comment_reactions WHERE target_type = ? AND target_id = ?',
      [targetType, targetId]
    );
  }

  private mapCommentReactionRow(row: {
    id: string;
    target_type: string;
    target_id: string;
    emoji: string;
    author_id: string;
    author_name: string;
    created: number;
  }): CommentReactionCache {
    return {
      id: row.id,
      targetType: row.target_type as 'thread' | 'reply',
      targetId: row.target_id,
      emoji: row.emoji,
      authorId: row.author_id,
      authorName: row.author_name,
      created: row.created,
    };
  }
}
