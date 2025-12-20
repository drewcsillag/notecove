/**
 * ReactionPicker Component
 *
 * Displays quick reaction buttons for adding emoji reactions to comments.
 */

import React, { useState, useEffect } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { AddReaction as AddReactionIcon } from '@mui/icons-material';

const QUICK_REACTIONS = ['👍', '👎', '❤️', '🎉', '😄', '🤔'];

interface UserProfile {
  profileId: string;
  username: string;
  handle: string;
}

export interface ReactionPickerProps {
  noteId: string;
  threadId: string;
  targetType: 'thread' | 'reply';
  targetId: string;
  onReactionAdded?: () => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  noteId,
  threadId,
  targetType,
  targetId,
  onReactionAdded,
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await window.electronAPI.user.getCurrentProfile();
        setUserProfile(profile);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };
    void fetchProfile();
  }, []);

  const handleAddReaction = async (emoji: string) => {
    if (!userProfile) return;

    try {
      await window.electronAPI.comment.addReaction(noteId, threadId, {
        targetType,
        targetId,
        emoji,
        authorId: userProfile.profileId,
        authorName: userProfile.username || userProfile.handle || 'Anonymous',
        created: Date.now(),
      });
      onReactionAdded?.();
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <Tooltip key={emoji} title={`React with ${emoji}`} placement="top">
          <IconButton
            size="small"
            onClick={() => {
              void handleAddReaction(emoji);
            }}
            sx={{
              fontSize: '14px',
              padding: '2px',
              minWidth: '24px',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            {emoji}
          </IconButton>
        </Tooltip>
      ))}
      <Tooltip title="More reactions (Ctrl+Cmd+Space)" placement="top">
        <IconButton
          size="small"
          sx={{
            padding: '2px',
            minWidth: '24px',
          }}
        >
          <AddReactionIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};
