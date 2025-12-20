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

  describe('observeComments', () => {
    it('should notify when a thread is added', () => {
      const events: Parameters<Parameters<typeof noteDoc.observeComments>[0]>[0][] = [];
      const unsubscribe = noteDoc.observeComments((event) => {
        events.push(event);
      });

      noteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1, 2, 3]),
        anchorEnd: new Uint8Array([4, 5, 6]),
        originalText: 'selected text',
        authorId: 'author-123',
        authorName: 'Test Author',
        authorHandle: '@testauthor',
        content: 'New comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('thread-add');
      expect(events[0].isRemote).toBe(false); // Local transaction

      unsubscribe();
    });

    it('should notify when a thread is updated', () => {
      const threadId = noteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1, 2, 3]),
        anchorEnd: new Uint8Array([4, 5, 6]),
        originalText: 'selected text',
        authorId: 'author-123',
        authorName: 'Test Author',
        authorHandle: '@testauthor',
        content: 'Original comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      const events: Parameters<Parameters<typeof noteDoc.observeComments>[0]>[0][] = [];
      const unsubscribe = noteDoc.observeComments((event) => {
        events.push(event);
      });

      noteDoc.updateCommentThread(threadId, { content: 'Updated comment' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('thread-update');
      expect(events[0].threadId).toBe(threadId);

      unsubscribe();
    });

    it('should notify when a thread is deleted', () => {
      const threadId = noteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1, 2, 3]),
        anchorEnd: new Uint8Array([4, 5, 6]),
        originalText: 'selected text',
        authorId: 'author-123',
        authorName: 'Test Author',
        authorHandle: '@testauthor',
        content: 'Comment to delete',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      const events: Parameters<Parameters<typeof noteDoc.observeComments>[0]>[0][] = [];
      const unsubscribe = noteDoc.observeComments((event) => {
        events.push(event);
      });

      noteDoc.deleteCommentThread(threadId);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('thread-delete');
      expect(events[0].threadId).toBe(threadId);

      unsubscribe();
    });

    it('should notify when a reply is added', () => {
      const threadId = noteDoc.addCommentThread({
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

      const events: Parameters<Parameters<typeof noteDoc.observeComments>[0]>[0][] = [];
      const unsubscribe = noteDoc.observeComments((event) => {
        events.push(event);
      });

      const replyId = noteDoc.addReply(threadId, {
        threadId,
        authorId: 'reply-author',
        authorName: 'Reply Author',
        authorHandle: '@replyauthor',
        content: 'This is a reply',
        created: Date.now(),
        modified: Date.now(),
      });

      expect(events.length).toBeGreaterThanOrEqual(1);
      const replyEvent = events.find((e) => e.type === 'reply-add');
      expect(replyEvent).toBeDefined();
      expect(replyEvent!.threadId).toBe(threadId);
      expect(replyEvent!.replyId).toBe(replyId);

      unsubscribe();
    });

    it('should detect remote changes from sync', () => {
      // Create a remote document
      const remoteDoc = new NoteDoc(noteId);
      remoteDoc.initializeNote({
        id: noteId,
        created: Date.now(),
        modified: Date.now(),
        sdId: 'test-sd',
        folderId: null,
        deleted: false,
        pinned: false,
      });

      // Set up observer on local doc
      const events: Parameters<Parameters<typeof noteDoc.observeComments>[0]>[0][] = [];
      const unsubscribe = noteDoc.observeComments((event) => {
        events.push(event);
      });

      // Add comment on remote doc
      remoteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1, 2, 3]),
        anchorEnd: new Uint8Array([4, 5, 6]),
        originalText: 'selected text',
        authorId: 'remote-author',
        authorName: 'Remote Author',
        authorHandle: '@remoteauthor',
        content: 'Remote comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      // Sync from remote to local
      const update = remoteDoc.encodeStateAsUpdate();
      noteDoc.applyUpdate(update);

      // Should see a thread-add event with isRemote=true
      expect(events.length).toBeGreaterThanOrEqual(1);
      const addEvent = events.find((e) => e.type === 'thread-add');
      expect(addEvent).toBeDefined();
      expect(addEvent!.isRemote).toBe(true); // Remote transaction from sync

      unsubscribe();
      remoteDoc.destroy();
    });

    it('should stop notifying after unsubscribe', () => {
      const events: Parameters<Parameters<typeof noteDoc.observeComments>[0]>[0][] = [];
      const unsubscribe = noteDoc.observeComments((event) => {
        events.push(event);
      });

      noteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1, 2, 3]),
        anchorEnd: new Uint8Array([4, 5, 6]),
        originalText: 'selected text',
        authorId: 'author-123',
        authorName: 'Test Author',
        authorHandle: '@testauthor',
        content: 'First comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      expect(events).toHaveLength(1);

      unsubscribe();

      noteDoc.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([7, 8, 9]),
        anchorEnd: new Uint8Array([10, 11, 12]),
        originalText: 'more text',
        authorId: 'author-456',
        authorName: 'Another Author',
        authorHandle: '@anotherauthor',
        content: 'Second comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      // Should still be 1 (not notified of second comment)
      expect(events).toHaveLength(1);
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

    it('should preserve both threads when created concurrently on same text range', () => {
      // Simulate two editors creating comments on the exact same text selection
      // This is the race condition scenario
      const doc1 = new NoteDoc(noteId);
      const doc2 = new NoteDoc(noteId);

      // Same anchor positions (same text selection)
      const sameAnchorStart = new Uint8Array([10, 20, 30]);
      const sameAnchorEnd = new Uint8Array([40, 50, 60]);
      const sameOriginalText = 'shared selected text';

      // Editor 1 creates a comment
      const thread1Id = doc1.addCommentThread({
        noteId,
        anchorStart: sameAnchorStart,
        anchorEnd: sameAnchorEnd,
        originalText: sameOriginalText,
        authorId: 'user-alice',
        authorName: 'Alice',
        authorHandle: '@alice',
        content: 'Alice comment on shared text',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      // Editor 2 creates a different comment on the same text (before sync)
      const thread2Id = doc2.addCommentThread({
        noteId,
        anchorStart: sameAnchorStart,
        anchorEnd: sameAnchorEnd,
        originalText: sameOriginalText,
        authorId: 'user-bob',
        authorName: 'Bob',
        authorHandle: '@bob',
        content: 'Bob comment on shared text',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      // Thread IDs should be different (UUIDs)
      expect(thread1Id).not.toBe(thread2Id);

      // Merge both ways
      const update1 = doc1.encodeStateAsUpdate();
      const update2 = doc2.encodeStateAsUpdate();

      doc1.applyUpdate(update2);
      doc2.applyUpdate(update1);

      // CRITICAL: Both docs should have BOTH comments
      // This verifies the race condition is handled correctly
      const doc1Threads = doc1.getCommentThreads();
      const doc2Threads = doc2.getCommentThreads();

      expect(doc1Threads).toHaveLength(2);
      expect(doc2Threads).toHaveLength(2);

      // Verify both threads exist in both docs
      const doc1ThreadIds = doc1Threads.map((t) => t.id);
      const doc2ThreadIds = doc2Threads.map((t) => t.id);

      expect(doc1ThreadIds).toContain(thread1Id);
      expect(doc1ThreadIds).toContain(thread2Id);
      expect(doc2ThreadIds).toContain(thread1Id);
      expect(doc2ThreadIds).toContain(thread2Id);

      // Verify content is preserved correctly
      expect(doc1.getCommentThread(thread1Id)?.content).toBe('Alice comment on shared text');
      expect(doc1.getCommentThread(thread2Id)?.content).toBe('Bob comment on shared text');
      expect(doc2.getCommentThread(thread1Id)?.content).toBe('Alice comment on shared text');
      expect(doc2.getCommentThread(thread2Id)?.content).toBe('Bob comment on shared text');

      doc1.destroy();
      doc2.destroy();
    });

    it('should preserve concurrent replies on the same thread', () => {
      // Create initial doc with a thread
      const doc1 = new NoteDoc(noteId);
      const threadId = doc1.addCommentThread({
        noteId,
        anchorStart: new Uint8Array([1]),
        anchorEnd: new Uint8Array([2]),
        originalText: 'text',
        authorId: 'author-main',
        authorName: 'Main Author',
        authorHandle: '@main',
        content: 'Initial comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      // Sync to doc2
      const doc2 = new NoteDoc(noteId);
      doc2.applyUpdate(doc1.encodeStateAsUpdate());

      // Both editors add replies concurrently
      const reply1Id = doc1.addReply(threadId, {
        threadId,
        authorId: 'user-alice',
        authorName: 'Alice',
        authorHandle: '@alice',
        content: 'Reply from Alice',
        created: Date.now(),
        modified: Date.now(),
      });

      const reply2Id = doc2.addReply(threadId, {
        threadId,
        authorId: 'user-bob',
        authorName: 'Bob',
        authorHandle: '@bob',
        content: 'Reply from Bob',
        created: Date.now(),
        modified: Date.now(),
      });

      // Reply IDs should be different
      expect(reply1Id).not.toBe(reply2Id);

      // Merge both ways
      doc1.applyUpdate(doc2.encodeStateAsUpdate());
      doc2.applyUpdate(doc1.encodeStateAsUpdate());

      // Both docs should have both replies
      const doc1Replies = doc1.getReplies(threadId);
      const doc2Replies = doc2.getReplies(threadId);

      expect(doc1Replies).toHaveLength(2);
      expect(doc2Replies).toHaveLength(2);

      // Verify both replies exist
      const doc1ReplyIds = doc1Replies.map((r) => r.id);
      const doc2ReplyIds = doc2Replies.map((r) => r.id);

      expect(doc1ReplyIds).toContain(reply1Id);
      expect(doc1ReplyIds).toContain(reply2Id);
      expect(doc2ReplyIds).toContain(reply1Id);
      expect(doc2ReplyIds).toContain(reply2Id);

      doc1.destroy();
      doc2.destroy();
    });
  });
});
