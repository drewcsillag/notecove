/**
 * Comment System Types
 *
 * Types for the Google Docs-style commenting feature.
 * Comments are anchored to text selections using Yjs RelativePosition
 * for robust positioning across concurrent edits.
 *
 * @see plans/note-comments/PLAN.md
 */

import type { UUID } from '../types';

/**
 * A comment thread anchored to a text selection in a note.
 *
 * Threads are the top-level comment entity. Each thread can have
 * multiple replies (single-level threading).
 */
export interface CommentThread {
  /** Unique identifier (UUID) */
  id: UUID;

  /** Parent note ID */
  noteId: UUID;

  /** Yjs RelativePosition for selection start (serialized) */
  anchorStart: Uint8Array;

  /** Yjs RelativePosition for selection end (serialized) */
  anchorEnd: Uint8Array;

  /** Original text at time of comment (for orphan detection/display) */
  originalText: string;

  /** Author's profile ID */
  authorId: string;

  /** Author's display name at creation time */
  authorName: string;

  /** Author's @handle at creation time */
  authorHandle: string;

  /** Comment content (may contain @mentions) */
  content: string;

  /** Creation timestamp (ms since epoch) */
  created: number;

  /** Last modification timestamp (ms since epoch) */
  modified: number;

  /** Whether the thread is resolved */
  resolved: boolean;

  /** Profile ID of who resolved (if resolved) */
  resolvedBy?: string;

  /** Timestamp when resolved (if resolved) */
  resolvedAt?: number;
}

/**
 * A reply in a comment thread.
 *
 * Replies are single-level (flat threading, like Google Docs).
 */
export interface CommentReply {
  /** Unique identifier (UUID) */
  id: UUID;

  /** Parent thread ID */
  threadId: UUID;

  /** Author's profile ID */
  authorId: string;

  /** Author's display name at creation time */
  authorName: string;

  /** Author's @handle at creation time */
  authorHandle: string;

  /** Reply content (may contain @mentions) */
  content: string;

  /** Creation timestamp (ms since epoch) */
  created: number;

  /** Last modification timestamp (ms since epoch) */
  modified: number;
}

/**
 * An emoji reaction on a comment thread or reply.
 */
export interface CommentReaction {
  /** Unique identifier (UUID) */
  id: UUID;

  /** Whether this is on a thread or a reply */
  targetType: 'thread' | 'reply';

  /** ID of the thread or reply */
  targetId: UUID;

  /** Emoji character */
  emoji: string;

  /** Author's profile ID */
  authorId: string;

  /** Author's display name at creation time */
  authorName: string;

  /** Creation timestamp (ms since epoch) */
  created: number;
}

/**
 * A thread with its replies and reactions loaded.
 * Used for displaying full thread context.
 */
export interface CommentThreadWithDetails extends CommentThread {
  replies: CommentReply[];
  reactions: CommentReaction[];
}

/**
 * Aggregated reaction for display.
 * Groups reactions by emoji with count and user info.
 */
export interface AggregatedReaction {
  emoji: string;
  count: number;
  users: Array<{ id: string; name: string }>;
  currentUserReacted: boolean;
}

/**
 * Data for creating a new thread (without generated fields).
 */
export type CreateThreadData = Omit<CommentThread, 'id'>;

/**
 * Data for creating a new reply (without generated fields).
 */
export type CreateReplyData = Omit<CommentReply, 'id'>;

/**
 * Data for creating a new reaction (without generated fields).
 */
export type CreateReactionData = Omit<CommentReaction, 'id'>;

/**
 * Generate a UUID for a new comment entity.
 */
export function generateCommentId(): UUID {
  return crypto.randomUUID() as UUID;
}

/**
 * Aggregate reactions by emoji for display.
 *
 * @param reactions - Array of reactions to aggregate
 * @param currentUserId - Current user's profile ID (for highlighting own reactions)
 * @returns Array of aggregated reactions sorted by count
 */
export function aggregateReactions(
  reactions: CommentReaction[],
  currentUserId: string
): AggregatedReaction[] {
  const byEmoji = new Map<string, Map<string, string>>();

  for (const reaction of reactions) {
    if (!byEmoji.has(reaction.emoji)) {
      byEmoji.set(reaction.emoji, new Map());
    }
    byEmoji.get(reaction.emoji)!.set(reaction.authorId, reaction.authorName);
  }

  return Array.from(byEmoji.entries())
    .map(([emoji, users]) => ({
      emoji,
      count: users.size,
      users: Array.from(users.entries()).map(([id, name]) => ({ id, name })),
      currentUserReacted: users.has(currentUserId),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Maximum recommended length for comment/reply content.
 * Shows warning at half this value.
 */
export const COMMENT_MAX_LENGTH = 10000;
export const COMMENT_WARN_LENGTH = 5000;
