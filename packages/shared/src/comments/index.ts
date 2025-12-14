/**
 * Comment System
 *
 * Google Docs-style commenting on text selections.
 */

export {
  type CommentThread,
  type CommentReply,
  type CommentReaction,
  type CommentThreadWithDetails,
  type AggregatedReaction,
  type CreateThreadData,
  type CreateReplyData,
  type CreateReactionData,
  generateCommentId,
  aggregateReactions,
  COMMENT_MAX_LENGTH,
  COMMENT_WARN_LENGTH,
} from './types';
