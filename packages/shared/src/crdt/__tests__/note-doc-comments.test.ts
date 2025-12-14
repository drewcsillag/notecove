// Jest test file for NoteDoc comment functionality
import * as Y from 'yjs';
import { NoteDoc } from '../note-doc';
import type { CommentThread, CommentReply, CommentReaction } from '../../comments/types';

describe('NoteDoc Comments', () => {
  let noteDoc: NoteDoc;
  const noteId = 'test-note-id';

  beforeEach(() => {
    noteDoc = new NoteDoc(noteId);
    // Initialize with metadata
    noteDoc.initializeNote({
      id: noteId,
      created: Date.now(),
      modified: Date.now(),
      sdId: 'test-sd',
      folderId: null,
      deleted: false,
      pinned: false,
    });
  });

  afterEach(() => {
    noteDoc.destroy();
  });

  describe('comments Y.Map', () => {
    it('should lazily initialize comments map', () => {
      // Accessing comments should create the map if it doesn't exist
      const comments = noteDoc.comments;
      expect(comments).toBeInstanceOf(Y.Map);
      expect(comments.size).toBe(0);
    });

    it('should return same map on subsequent accesses', () => {
      const comments1 = noteDoc.comments;
      const comments2 = noteDoc.comments;
      expect(comments1).toBe(comments2);
    });
  });

  describe('thread CRUD', () => {
    const createTestThread = (): Omit<CommentThread, 'id'> => ({
      noteId,
      anchorStart: new Uint8Array([1, 2, 3]),
      anchorEnd: new Uint8Array([4, 5, 6]),
      originalText: 'selected text',
      authorId: 'author-123',
      authorName: 'Test Author',
      authorHandle: '@testauthor',
      content: 'This is a comment',
      created: Date.now(),
      modified: Date.now(),
      resolved: false,
    });

    it('should add a comment thread', () => {
      const threadData = createTestThread();
      const threadId = noteDoc.addCommentThread(threadData);

      expect(threadId).toBeDefined();
      expect(typeof threadId).toBe('string');
      expect(threadId.length).toBeGreaterThan(0);
    });

    it('should retrieve a comment thread by ID', () => {
      const threadData = createTestThread();
      const threadId = noteDoc.addCommentThread(threadData);

      const retrieved = noteDoc.getCommentThread(threadId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(threadId);
      expect(retrieved!.noteId).toBe(threadData.noteId);
      expect(retrieved!.content).toBe(threadData.content);
      expect(retrieved!.authorId).toBe(threadData.authorId);
      expect(retrieved!.resolved).toBe(false);
    });

    it('should return null for non-existent thread', () => {
      const retrieved = noteDoc.getCommentThread('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should get all comment threads', () => {
      const thread1 = createTestThread();
      const thread2 = { ...createTestThread(), content: 'Second comment' };
      const thread3 = { ...createTestThread(), content: 'Third comment' };

      noteDoc.addCommentThread(thread1);
      noteDoc.addCommentThread(thread2);
      noteDoc.addCommentThread(thread3);

      const threads = noteDoc.getCommentThreads();

      expect(threads).toHaveLength(3);
      expect(threads.map((t) => t.content)).toContain('This is a comment');
      expect(threads.map((t) => t.content)).toContain('Second comment');
      expect(threads.map((t) => t.content)).toContain('Third comment');
    });

    it('should update a comment thread', () => {
      const threadData = createTestThread();
      const threadId = noteDoc.addCommentThread(threadData);

      noteDoc.updateCommentThread(threadId, { content: 'Updated content' });

      const retrieved = noteDoc.getCommentThread(threadId);
      expect(retrieved!.content).toBe('Updated content');
      expect(retrieved!.modified).toBeGreaterThanOrEqual(threadData.modified);
    });

    it('should resolve a comment thread', () => {
      const threadData = createTestThread();
      const threadId = noteDoc.addCommentThread(threadData);

      const resolvedAt = Date.now();
      noteDoc.updateCommentThread(threadId, {
        resolved: true,
        resolvedBy: 'resolver-123',
        resolvedAt,
      });

      const retrieved = noteDoc.getCommentThread(threadId);
      expect(retrieved!.resolved).toBe(true);
      expect(retrieved!.resolvedBy).toBe('resolver-123');
      expect(retrieved!.resolvedAt).toBe(resolvedAt);
    });

    it('should delete a comment thread', () => {
      const threadData = createTestThread();
      const threadId = noteDoc.addCommentThread(threadData);

      expect(noteDoc.getCommentThread(threadId)).not.toBeNull();

      noteDoc.deleteCommentThread(threadId);

      expect(noteDoc.getCommentThread(threadId)).toBeNull();
      expect(noteDoc.getCommentThreads()).toHaveLength(0);
    });

    it('should throw when updating non-existent thread', () => {
      expect(() => {
        noteDoc.updateCommentThread('non-existent', { content: 'new' });
      }).toThrow();
    });
  });

  describe('reply CRUD', () => {
    let threadId: string;

    beforeEach(() => {
      threadId = noteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1, 2, 3]),
        anchorEnd: new Uint8Array([4, 5, 6]),
        originalText: 'selected text',
        authorId: 'author-123',
        authorName: 'Test Author',
        authorHandle: '@testauthor',
        content: 'Parent comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });
    });

    const createTestReply = (): Omit<CommentReply, 'id'> => ({
      threadId,
      authorId: 'reply-author',
      authorName: 'Reply Author',
      authorHandle: '@replyauthor',
      content: 'This is a reply',
      created: Date.now(),
      modified: Date.now(),
    });

    it('should add a reply to a thread', () => {
      const replyData = createTestReply();
      const replyId = noteDoc.addReply(threadId, replyData);

      expect(replyId).toBeDefined();
      expect(typeof replyId).toBe('string');
    });

    it('should get replies for a thread', () => {
      const reply1 = createTestReply();
      const reply2 = { ...createTestReply(), content: 'Second reply' };

      noteDoc.addReply(threadId, reply1);
      noteDoc.addReply(threadId, reply2);

      const replies = noteDoc.getReplies(threadId);

      expect(replies).toHaveLength(2);
      expect(replies.map((r) => r.content)).toContain('This is a reply');
      expect(replies.map((r) => r.content)).toContain('Second reply');
    });

    it('should return empty array for thread with no replies', () => {
      const replies = noteDoc.getReplies(threadId);
      expect(replies).toEqual([]);
    });

    it('should delete a reply', () => {
      const replyId = noteDoc.addReply(threadId, createTestReply());

      expect(noteDoc.getReplies(threadId)).toHaveLength(1);

      noteDoc.deleteReply(threadId, replyId);

      expect(noteDoc.getReplies(threadId)).toHaveLength(0);
    });

    it('should update a reply', () => {
      const replyId = noteDoc.addReply(threadId, createTestReply());

      noteDoc.updateReply(threadId, replyId, { content: 'Updated reply' });

      const replies = noteDoc.getReplies(threadId);
      expect(replies[0].content).toBe('Updated reply');
    });

    it('should throw when adding reply to non-existent thread', () => {
      expect(() => {
        noteDoc.addReply('non-existent', createTestReply());
      }).toThrow();
    });
  });

  describe('reaction CRUD', () => {
    let threadId: string;

    beforeEach(() => {
      threadId = noteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1, 2, 3]),
        anchorEnd: new Uint8Array([4, 5, 6]),
        originalText: 'selected text',
        authorId: 'author-123',
        authorName: 'Test Author',
        authorHandle: '@testauthor',
        content: 'Parent comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });
    });

    const createTestReaction = (): Omit<CommentReaction, 'id'> => ({
      targetType: 'thread',
      targetId: threadId,
      emoji: '👍',
      authorId: 'reactor-123',
      authorName: 'Reactor',
      created: Date.now(),
    });

    it('should add a reaction', () => {
      const reactionData = createTestReaction();
      const reactionId = noteDoc.addReaction(threadId, reactionData);

      expect(reactionId).toBeDefined();
      expect(typeof reactionId).toBe('string');
    });

    it('should get reactions for a thread', () => {
      const reaction1 = createTestReaction();
      const reaction2 = { ...createTestReaction(), emoji: '❤️' };

      noteDoc.addReaction(threadId, reaction1);
      noteDoc.addReaction(threadId, reaction2);

      const reactions = noteDoc.getReactions(threadId);

      expect(reactions).toHaveLength(2);
      expect(reactions.map((r) => r.emoji)).toContain('👍');
      expect(reactions.map((r) => r.emoji)).toContain('❤️');
    });

    it('should remove a reaction', () => {
      const reactionId = noteDoc.addReaction(threadId, createTestReaction());

      expect(noteDoc.getReactions(threadId)).toHaveLength(1);

      noteDoc.removeReaction(threadId, reactionId);

      expect(noteDoc.getReactions(threadId)).toHaveLength(0);
    });
  });

  describe('CRDT sync', () => {
    it('should sync comments between two docs', () => {
      // Create a thread in the first doc
      const threadId = noteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1, 2, 3]),
        anchorEnd: new Uint8Array([4, 5, 6]),
        originalText: 'selected text',
        authorId: 'author-123',
        authorName: 'Test Author',
        authorHandle: '@testauthor',
        content: 'Synced comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      // Create a second doc and apply the update
      const noteDoc2 = new NoteDoc(noteId);
      const update = noteDoc.encodeStateAsUpdate();
      noteDoc2.applyUpdate(update);

      // Verify the comment is in the second doc
      const threads = noteDoc2.getCommentThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe(threadId);
      expect(threads[0].content).toBe('Synced comment');

      noteDoc2.destroy();
    });

    it('should merge concurrent comment additions', () => {
      // Create two separate docs
      const doc1 = new NoteDoc(noteId);
      const doc2 = new NoteDoc(noteId);

      // Add different comments to each
      const thread1Id = doc1.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1]),
        anchorEnd: new Uint8Array([2]),
        originalText: 'text 1',
        authorId: 'author-1',
        authorName: 'Author 1',
        authorHandle: '@author1',
        content: 'Comment from doc1',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      const thread2Id = doc2.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([3]),
        anchorEnd: new Uint8Array([4]),
        originalText: 'text 2',
        authorId: 'author-2',
        authorName: 'Author 2',
        authorHandle: '@author2',
        content: 'Comment from doc2',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      // Merge both ways
      const update1 = doc1.encodeStateAsUpdate();
      const update2 = doc2.encodeStateAsUpdate();

      doc1.applyUpdate(update2);
      doc2.applyUpdate(update1);

      // Both docs should have both comments
      expect(doc1.getCommentThreads()).toHaveLength(2);
      expect(doc2.getCommentThreads()).toHaveLength(2);

      expect(doc1.getCommentThread(thread1Id)).not.toBeNull();
      expect(doc1.getCommentThread(thread2Id)).not.toBeNull();
      expect(doc2.getCommentThread(thread1Id)).not.toBeNull();
      expect(doc2.getCommentThread(thread2Id)).not.toBeNull();

      doc1.destroy();
      doc2.destroy();
    });
  });
});
