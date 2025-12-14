/**
 * ReactionPicker Component
 *
 * Displays quick reaction buttons for adding emoji reactions to comments.
 */

import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { AddReaction as AddReactionIcon } from '@mui/icons-material';

const QUICK_REACTIONS = ['👍', '👎', '❤️', '🎉', '😄', '🤔'];

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
  const handleAddReaction = async (emoji: string) => {
    try {
      await window.electronAPI.comment.addReaction(noteId, threadId, {
        targetType,
        targetId,
        emoji,
        authorId: 'current-user', // TODO: Get actual user ID
        authorName: 'You', // TODO: Get actual user name
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
