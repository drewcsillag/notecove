import * as Y from 'yjs';
import type { UUID, NoteMetadata } from '../types';
import {
  type CommentThread,
  type CommentReply,
  type CommentReaction,
  generateCommentId,
} from '../comments/types';

/**
 * CRDT document for a single note
 * Uses Y.XmlFragment for rich text content (compatible with TipTap/ProseMirror)
 */
export class NoteDoc {
  readonly doc: Y.Doc;
  readonly metadata: Y.Map<unknown>;
  readonly content: Y.XmlFragment;

  constructor(noteId: UUID, existingDoc?: Y.Doc) {
    this.doc = existingDoc ?? new Y.Doc({ guid: noteId });
    this.metadata = this.doc.getMap('metadata');
    this.content = this.doc.getXmlFragment('content');
  }

  /**
   * Initialize a new note with metadata and empty content structure
   */
  initializeNote(meta: NoteMetadata): void {
    this.doc.transact(() => {
      // Set metadata
      this.metadata.set('id', meta.id);
      this.metadata.set('created', meta.created);
      this.metadata.set('modified', meta.modified);
      this.metadata.set('sdId', meta.sdId);
      this.metadata.set('folderId', meta.folderId);
      this.metadata.set('deleted', meta.deleted);
      this.metadata.set('pinned', meta.pinned);

      // Initialize empty ProseMirror structure
      // This ensures iOS can extract a title (even if empty) instead of "Untitled"
      if (this.content.length === 0) {
        const paragraph = new Y.XmlElement('paragraph');
        this.content.insert(0, [paragraph]);
      }
    });
  }

  /**
   * Get current note metadata
   *
   * Provides defensive fallbacks for fields that may be undefined when loading
   * notes from another instance's CRDT (cross-machine sync scenario).
   * This prevents NOT NULL constraint failures in SQLite.
   *
   * Note: id and sdId do not have fallbacks as they are critical identifiers
   * that must be set during note initialization.
   */
  getMetadata(): NoteMetadata {
    const now = Date.now();
    return {
      id: this.metadata.get('id') as UUID,
      // Fallback to current time if created/modified are undefined (partial sync)
      created: (this.metadata.get('created') as number | undefined) ?? now,
      modified: (this.metadata.get('modified') as number | undefined) ?? now,
      sdId: this.metadata.get('sdId') as UUID,
      folderId: (this.metadata.get('folderId') as UUID | null) ?? null,
      // Fallback to false if deleted is undefined (common during cross-instance sync)
      deleted: (this.metadata.get('deleted') as boolean | undefined) ?? false,
      // Fallback to false if pinned is undefined (common during cross-instance sync)
      pinned: (this.metadata.get('pinned') as boolean | undefined) ?? false,
    };
  }

  /**
   * Check if this note has been initialized with metadata.
   * Returns false if any required metadata fields are missing.
   */
  hasMetadata(): boolean {
    return (
      this.metadata.has('id') &&
      this.metadata.has('sdId') &&
      this.metadata.has('created') &&
      this.metadata.has('modified')
    );
  }

  /**
   * Update note metadata (e.g., move to different folder)
   */
  updateMetadata(updates: Partial<Omit<NoteMetadata, 'id' | 'created'>>): void {
    this.doc.transact(() => {
      if (updates.modified !== undefined) {
        this.metadata.set('modified', updates.modified);
      }
      if (updates.sdId !== undefined) {
        this.metadata.set('sdId', updates.sdId);
      }
      if (updates.folderId !== undefined) {
        this.metadata.set('folderId', updates.folderId);
      }
      if (updates.deleted !== undefined) {
        this.metadata.set('deleted', updates.deleted);
      }
      if (updates.pinned !== undefined) {
        this.metadata.set('pinned', updates.pinned);
      }
    });
  }

  /**
   * Mark note as deleted (soft delete)
   */
  markDeleted(): void {
    this.updateMetadata({
      deleted: true,
      modified: Date.now(),
    });
  }

  /**
   * Mark note as restored (undelete)
   */
  markRestored(): void {
    this.updateMetadata({
      deleted: false,
      modified: Date.now(),
    });
  }

  /**
   * Get the current state as an update
   */
  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  /**
   * Apply an update from another instance
   */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }

  /**
   * Load from existing state
   */
  static fromUpdate(noteId: UUID, update: Uint8Array): NoteDoc {
    const noteDoc = new NoteDoc(noteId);
    noteDoc.applyUpdate(update);
    return noteDoc;
  }

  /**
   * Destroy the document and free resources
   */
  destroy(): void {
    this.doc.destroy();
  }

  // ============================================================================
  // COMMENTS
  // ============================================================================

  /**
   * Get the comments Y.Map (lazily initialized).
   * Structure: Map<threadId, Y.Map with thread data + replies + reactions>
   */
  get comments(): Y.Map<Y.Map<unknown>> {
    return this.doc.getMap('comments');
  }

  /**
   * Get all comment threads for this note.
   */
  getCommentThreads(): CommentThread[] {
    const threads: CommentThread[] = [];
    this.comments.forEach((threadMap, id) => {
      threads.push(this.mapToThread(id, threadMap));
    });
    return threads;
  }

  /**
   * Get a single comment thread by ID.
   */
  getCommentThread(threadId: string): CommentThread | null {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) return null;
    return this.mapToThread(threadId, threadMap);
  }

  /**
   * Add a new comment thread.
   * @returns The new thread ID
   */
  addCommentThread(thread: Omit<CommentThread, 'id'>): string {
    const id = generateCommentId();

    this.doc.transact(() => {
      const threadMap = new Y.Map<unknown>();

      threadMap.set('noteId', thread.noteId);
      threadMap.set('anchorStart', thread.anchorStart);
      threadMap.set('anchorEnd', thread.anchorEnd);
      threadMap.set('originalText', thread.originalText);
      threadMap.set('authorId', thread.authorId);
      threadMap.set('authorName', thread.authorName);
      threadMap.set('authorHandle', thread.authorHandle);
      threadMap.set('content', thread.content);
      threadMap.set('created', thread.created);
      threadMap.set('modified', thread.modified);
      threadMap.set('resolved', thread.resolved);
      if (thread.resolvedBy !== undefined) {
        threadMap.set('resolvedBy', thread.resolvedBy);
      }
      if (thread.resolvedAt !== undefined) {
        threadMap.set('resolvedAt', thread.resolvedAt);
      }

      // Initialize empty arrays for replies and reactions
      threadMap.set('replies', new Y.Array<Y.Map<unknown>>());
      threadMap.set('reactions', new Y.Array<Y.Map<unknown>>());

      this.comments.set(id, threadMap);
    });

    return id;
  }

  /**
   * Update a comment thread.
   */
  updateCommentThread(
    threadId: string,
    updates: Partial<Pick<CommentThread, 'content' | 'resolved' | 'resolvedBy' | 'resolvedAt'>>
  ): void {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) {
      throw new Error(`Thread ${threadId} not found`);
    }

    this.doc.transact(() => {
      if (updates.content !== undefined) {
        threadMap.set('content', updates.content);
      }
      if (updates.resolved !== undefined) {
        threadMap.set('resolved', updates.resolved);
      }
      if (updates.resolvedBy !== undefined) {
        threadMap.set('resolvedBy', updates.resolvedBy);
      }
      if (updates.resolvedAt !== undefined) {
        threadMap.set('resolvedAt', updates.resolvedAt);
      }
      threadMap.set('modified', Date.now());
    });
  }

  /**
   * Delete a comment thread.
   */
  deleteCommentThread(threadId: string): void {
    this.comments.delete(threadId);
  }

  /**
   * Get all replies for a thread.
   */
  getReplies(threadId: string): CommentReply[] {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) return [];

    const repliesArray = threadMap.get('replies') as Y.Array<Y.Map<unknown>> | undefined;
    if (!repliesArray) return [];

    return repliesArray.toArray().map((replyMap) => this.mapToReply(replyMap));
  }

  /**
   * Add a reply to a thread.
   * @returns The new reply ID
   */
  addReply(threadId: string, reply: Omit<CommentReply, 'id'>): string {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const id = generateCommentId();

    this.doc.transact(() => {
      let repliesArray = threadMap.get('replies') as Y.Array<Y.Map<unknown>> | undefined;
      if (!repliesArray) {
        repliesArray = new Y.Array<Y.Map<unknown>>();
        threadMap.set('replies', repliesArray);
      }

      const replyMap = new Y.Map<unknown>();
      replyMap.set('id', id);
      replyMap.set('threadId', reply.threadId);
      replyMap.set('authorId', reply.authorId);
      replyMap.set('authorName', reply.authorName);
      replyMap.set('authorHandle', reply.authorHandle);
      replyMap.set('content', reply.content);
      replyMap.set('created', reply.created);
      replyMap.set('modified', reply.modified);

      repliesArray.push([replyMap]);
    });

    return id;
  }

  /**
   * Update a reply.
   */
  updateReply(
    threadId: string,
    replyId: string,
    updates: Partial<Pick<CommentReply, 'content'>>
  ): void {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) return;

    const repliesArray = threadMap.get('replies') as Y.Array<Y.Map<unknown>> | undefined;
    if (!repliesArray) return;

    this.doc.transact(() => {
      for (let i = 0; i < repliesArray.length; i++) {
        const replyMap = repliesArray.get(i);
        if (replyMap.get('id') === replyId) {
          if (updates.content !== undefined) {
            replyMap.set('content', updates.content);
          }
          replyMap.set('modified', Date.now());
          break;
        }
      }
    });
  }

  /**
   * Delete a reply.
   */
  deleteReply(threadId: string, replyId: string): void {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) return;

    const repliesArray = threadMap.get('replies') as Y.Array<Y.Map<unknown>> | undefined;
    if (!repliesArray) return;

    for (let i = 0; i < repliesArray.length; i++) {
      const replyMap = repliesArray.get(i);
      if (replyMap.get('id') === replyId) {
        repliesArray.delete(i, 1);
        break;
      }
    }
  }

  /**
   * Get all reactions for a thread (includes reactions on thread and its replies).
   */
  getReactions(threadId: string): CommentReaction[] {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) return [];

    const reactionsArray = threadMap.get('reactions') as Y.Array<Y.Map<unknown>> | undefined;
    if (!reactionsArray) return [];

    return reactionsArray.toArray().map((reactionMap) => this.mapToReaction(reactionMap));
  }

  /**
   * Add a reaction.
   * @returns The new reaction ID
   */
  addReaction(threadId: string, reaction: Omit<CommentReaction, 'id'>): string {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const id = generateCommentId();

    this.doc.transact(() => {
      let reactionsArray = threadMap.get('reactions') as Y.Array<Y.Map<unknown>> | undefined;
      if (!reactionsArray) {
        reactionsArray = new Y.Array<Y.Map<unknown>>();
        threadMap.set('reactions', reactionsArray);
      }

      const reactionMap = new Y.Map<unknown>();
      reactionMap.set('id', id);
      reactionMap.set('targetType', reaction.targetType);
      reactionMap.set('targetId', reaction.targetId);
      reactionMap.set('emoji', reaction.emoji);
      reactionMap.set('authorId', reaction.authorId);
      reactionMap.set('authorName', reaction.authorName);
      reactionMap.set('created', reaction.created);

      reactionsArray.push([reactionMap]);
    });

    return id;
  }

  /**
   * Remove a reaction.
   */
  removeReaction(threadId: string, reactionId: string): void {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) return;

    const reactionsArray = threadMap.get('reactions') as Y.Array<Y.Map<unknown>> | undefined;
    if (!reactionsArray) return;

    for (let i = 0; i < reactionsArray.length; i++) {
      const reactionMap = reactionsArray.get(i);
      if (reactionMap.get('id') === reactionId) {
        reactionsArray.delete(i, 1);
        break;
      }
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private mapToThread(id: string, map: Y.Map<unknown>): CommentThread {
    const thread: CommentThread = {
      id,
      noteId: map.get('noteId') as UUID,
      anchorStart: map.get('anchorStart') as Uint8Array,
      anchorEnd: map.get('anchorEnd') as Uint8Array,
      originalText: map.get('originalText') as string,
      authorId: map.get('authorId') as string,
      authorName: map.get('authorName') as string,
      authorHandle: map.get('authorHandle') as string,
      content: map.get('content') as string,
      created: map.get('created') as number,
      modified: map.get('modified') as number,
      resolved: map.get('resolved') as boolean,
    };
    // Only set optional properties if they have values (exactOptionalPropertyTypes)
    const resolvedBy = map.get('resolvedBy') as string | undefined;
    const resolvedAt = map.get('resolvedAt') as number | undefined;
    if (resolvedBy !== undefined) {
      thread.resolvedBy = resolvedBy;
    }
    if (resolvedAt !== undefined) {
      thread.resolvedAt = resolvedAt;
    }
    return thread;
  }

  private mapToReply(map: Y.Map<unknown>): CommentReply {
    return {
      id: map.get('id') as UUID,
      threadId: map.get('threadId') as UUID,
      authorId: map.get('authorId') as string,
      authorName: map.get('authorName') as string,
      authorHandle: map.get('authorHandle') as string,
      content: map.get('content') as string,
      created: map.get('created') as number,
      modified: map.get('modified') as number,
    };
  }

  private mapToReaction(map: Y.Map<unknown>): CommentReaction {
    return {
      id: map.get('id') as UUID,
      targetType: map.get('targetType') as 'thread' | 'reply',
      targetId: map.get('targetId') as UUID,
      emoji: map.get('emoji') as string,
      authorId: map.get('authorId') as string,
      authorName: map.get('authorName') as string,
      created: map.get('created') as number,
    };
  }
}
