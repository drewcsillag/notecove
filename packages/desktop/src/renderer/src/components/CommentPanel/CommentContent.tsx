/**
 * CommentContent component
 *
 * Renders comment text with styled @-mentions.
 * Parses text for @handle patterns and renders them with highlighting.
 */

import React from 'react';
import { Typography, Box } from '@mui/material';

const MENTION_REGEX = /@\w+/g;

interface CommentContentProps {
  /** The comment content text */
  content: string;
  /** Optional variant for typography */
  variant?: 'body1' | 'body2' | 'caption';
}

/**
 * CommentContent - Renders comment text with styled @-mentions
 */
export const CommentContent: React.FC<CommentContentProps> = ({ content, variant = 'body2' }) => {
  // Parse content and extract mentions
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // Add styled mention
    parts.push(
      <Box
        key={`mention-${keyCounter++}`}
        component="span"
        sx={{
          color: 'primary.main',
          fontWeight: 500,
          bgcolor: 'primary.light',
          borderRadius: 0.5,
          px: 0.5,
          py: 0.125,
          // Slightly darker in dark mode
          '.MuiBox-root[data-theme="dark"] &': {
            bgcolor: 'primary.dark',
            color: 'primary.contrastText',
          },
        }}
      >
        {match[0]}
      </Box>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  // If no mentions found, return plain text
  if (parts.length === 0) {
    return <Typography variant={variant}>{content}</Typography>;
  }

  return (
    <Typography variant={variant} component="div" sx={{ whiteSpace: 'pre-wrap' }}>
      {parts}
    </Typography>
  );
};

export default CommentContent;
