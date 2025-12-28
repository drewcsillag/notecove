// Jest test file
import {
  generateCommentId,
  aggregateReactions,
  COMMENT_MAX_LENGTH,
  COMMENT_WARN_LENGTH,
  type CommentReaction,
} from '../types';

describe('Comment Types', () => {
  describe('generateCommentId', () => {
    it('should generate a valid compact UUID', () => {
      const id = generateCommentId();
      // Compact UUID format: 22 base64url characters
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateCommentId();
      const id2 = generateCommentId();
      const id3 = generateCommentId();
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe('aggregateReactions', () => {
    it('should return empty array for no reactions', () => {
      const result = aggregateReactions([], 'user-1');
      expect(result).toEqual([]);
    });

    it('should aggregate reactions by emoji', () => {
      const reactions: CommentReaction[] = [
        {
          id: 'r1',
          targetType: 'thread',
          targetId: 't1',
          emoji: '👍',
          authorId: 'user-1',
          authorName: 'Alice',
          created: Date.now(),
        },
        {
          id: 'r2',
          targetType: 'thread',
          targetId: 't1',
          emoji: '👍',
          authorId: 'user-2',
          authorName: 'Bob',
          created: Date.now(),
        },
        {
          id: 'r3',
          targetType: 'thread',
          targetId: 't1',
          emoji: '❤️',
          authorId: 'user-1',
          authorName: 'Alice',
          created: Date.now(),
        },
      ];

      const result = aggregateReactions(reactions, 'user-1');

      expect(result).toHaveLength(2);

      const thumbsUp = result.find((r) => r.emoji === '👍');
      expect(thumbsUp).toBeDefined();
      expect(thumbsUp!.count).toBe(2);
      expect(thumbsUp!.users).toHaveLength(2);
      expect(thumbsUp!.currentUserReacted).toBe(true);

      const heart = result.find((r) => r.emoji === '❤️');
      expect(heart).toBeDefined();
      expect(heart!.count).toBe(1);
      expect(heart!.currentUserReacted).toBe(true);
    });

    it('should count unique users, not total reactions', () => {
      // Same user reacting twice with same emoji should only count once
      const reactions: CommentReaction[] = [
        {
          id: 'r1',
          targetType: 'thread',
          targetId: 't1',
          emoji: '👍',
          authorId: 'user-1',
          authorName: 'Alice',
          created: Date.now(),
        },
        {
          id: 'r2',
          targetType: 'thread',
          targetId: 't1',
          emoji: '👍',
          authorId: 'user-1',
          authorName: 'Alice', // Same user
          created: Date.now(),
        },
      ];

      const result = aggregateReactions(reactions, 'user-2');

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(1); // Deduplicated by user
      expect(result[0].currentUserReacted).toBe(false);
    });

    it('should correctly detect currentUserReacted', () => {
      const reactions: CommentReaction[] = [
        {
          id: 'r1',
          targetType: 'thread',
          targetId: 't1',
          emoji: '👍',
          authorId: 'other-user',
          authorName: 'Other',
          created: Date.now(),
        },
      ];

      // Current user did not react
      const result1 = aggregateReactions(reactions, 'current-user');
      expect(result1[0].currentUserReacted).toBe(false);

      // Add current user's reaction
      reactions.push({
        id: 'r2',
        targetType: 'thread',
        targetId: 't1',
        emoji: '👍',
        authorId: 'current-user',
        authorName: 'Me',
        created: Date.now(),
      });

      const result2 = aggregateReactions(reactions, 'current-user');
      expect(result2[0].currentUserReacted).toBe(true);
    });

    it('should sort by count descending', () => {
      const reactions: CommentReaction[] = [
        {
          id: 'r1',
          targetType: 'thread',
          targetId: 't1',
          emoji: '😄',
          authorId: 'user-1',
          authorName: 'Alice',
          created: Date.now(),
        },
        {
          id: 'r2',
          targetType: 'thread',
          targetId: 't1',
          emoji: '👍',
          authorId: 'user-1',
          authorName: 'Alice',
          created: Date.now(),
        },
        {
          id: 'r3',
          targetType: 'thread',
          targetId: 't1',
          emoji: '👍',
          authorId: 'user-2',
          authorName: 'Bob',
          created: Date.now(),
        },
        {
          id: 'r4',
          targetType: 'thread',
          targetId: 't1',
          emoji: '👍',
          authorId: 'user-3',
          authorName: 'Carol',
          created: Date.now(),
        },
      ];

      const result = aggregateReactions(reactions, 'user-1');

      expect(result[0].emoji).toBe('👍'); // 3 users
      expect(result[0].count).toBe(3);
      expect(result[1].emoji).toBe('😄'); // 1 user
      expect(result[1].count).toBe(1);
    });
  });

  describe('constants', () => {
    it('should have correct length limits', () => {
      expect(COMMENT_MAX_LENGTH).toBe(10000);
      expect(COMMENT_WARN_LENGTH).toBe(5000);
      expect(COMMENT_WARN_LENGTH).toBeLessThan(COMMENT_MAX_LENGTH);
    });
  });
});
