/**
 * ReactionDisplay Component
 *
 * Displays aggregated reactions with hover tooltips showing who reacted.
 */

import React, { useState, useEffect } from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { aggregateReactions, type CommentReaction } from '@notecove/shared/comments';

/**
 * User profile for reaction authorship
 */
interface UserProfile {
  profileId: string;
  username: string;
  handle: string;
}

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
  // Current user profile for reaction authorship
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Fetch current user profile on mount and subscribe to changes
  useEffect(() => {
    window.electronAPI.user
      .getCurrentProfile()
      .then((profile) => {
        setUserProfile(profile);
      })
      .catch((err) => {
        console.error('[ReactionDisplay] Failed to get user profile:', err);
        // Use fallback values if profile fetch fails
        setUserProfile({
          profileId: 'unknown',
          username: 'Anonymous',
          handle: '@anonymous',
        });
      });

    // Subscribe to profile changes
    const unsubscribe = window.electronAPI.user.onProfileChanged((profile) => {
      setUserProfile(profile);
    });

    return unsubscribe;
  }, []);

  // Filter reactions for this specific target
  const targetReactions = reactions.filter(
    (r) => r.targetType === targetType && r.targetId === targetId
  );

  const currentUserId = userProfile?.profileId ?? '';
  const aggregated = aggregateReactions(targetReactions, currentUserId);

  if (aggregated.length === 0) {
    return null;
  }

  const handleToggleReaction = async (emoji: string, currentUserReacted: boolean) => {
    if (!userProfile) return;

    try {
      if (currentUserReacted) {
        // Find and remove the user's reaction
        const userReaction = targetReactions.find(
          (r) => r.emoji === emoji && r.authorId === userProfile.profileId
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
          authorId: userProfile.profileId,
          authorName: userProfile.username || 'Anonymous',
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
