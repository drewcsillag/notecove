/**
 * ReactionDisplay Component
 *
 * Displays aggregated reactions with hover tooltips showing who reacted.
 */

import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { aggregateReactions, type CommentReaction } from '@notecove/shared/comments';

// TODO: Replace with actual user ID from authentication system
const CURRENT_USER_ID = 'current-user';

export interface ReactionDisplayProps {
  noteId: string;
  threadId: string;
  reactions: CommentReaction[];
  targetType: 'thread' | 'reply';
  targetId: string;
  onReactionToggled?: () => void;
}

export const ReactionDisplay: React.FC<ReactionDisplayProps> = ({
  noteId,
  threadId,
  reactions,
  targetType,
  targetId,
  onReactionToggled,
}) => {
  // Filter reactions for this specific target
  const targetReactions = reactions.filter(
    (r) => r.targetType === targetType && r.targetId === targetId
  );

  const aggregated = aggregateReactions(targetReactions, CURRENT_USER_ID);

  if (aggregated.length === 0) {
    return null;
  }

  const handleToggleReaction = async (emoji: string, currentUserReacted: boolean) => {
    try {
      if (currentUserReacted) {
        // Find and remove the user's reaction
        const userReaction = targetReactions.find(
          (r) => r.emoji === emoji && r.authorId === CURRENT_USER_ID
        );
        if (userReaction) {
          await window.electronAPI.comment.removeReaction(noteId, threadId, userReaction.id);
        }
      } else {
        // Add a new reaction
        await window.electronAPI.comment.addReaction(noteId, threadId, {
          targetType,
          targetId,
          emoji,
          authorId: CURRENT_USER_ID,
          authorName: 'You', // TODO: Get actual user name
          created: Date.now(),
        });
      }
      onReactionToggled?.();
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        mt: 0.5,
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {aggregated.map((reaction) => (
        <Tooltip
          key={reaction.emoji}
          title={reaction.users.map((u) => u.name).join(', ')}
          placement="top"
        >
          <Chip
            label={`${reaction.emoji} ${reaction.count}`}
            size="small"
            variant={reaction.currentUserReacted ? 'filled' : 'outlined'}
            onClick={() => {
              void handleToggleReaction(reaction.emoji, reaction.currentUserReacted);
            }}
            sx={{
              cursor: 'pointer',
              height: '22px',
              fontSize: '12px',
              '& .MuiChip-label': {
                px: 0.75,
              },
              ...(reaction.currentUserReacted && {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
              }),
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
};
