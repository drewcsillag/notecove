/**
 * Text and URL Input Popover Component
 *
 * Displays a popover for entering both link text and URL when creating a new link
 * with no text selected. Used when Cmd+K is pressed with no selection.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Paper, TextField, IconButton, InputAdornment, Box } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

export interface TextAndUrlInputPopoverProps {
  /**
   * Callback when text and URL are submitted
   */
  onSubmit: (text: string, url: string) => void;

  /**
   * Callback when popover is cancelled
   */
  onCancel: () => void;
}

/**
 * TextAndUrlInputPopover provides inputs for both link text and URL
 */
export const TextAndUrlInputPopover: React.FC<TextAndUrlInputPopoverProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Focus text input on mount
  useEffect(() => {
    if (textInputRef.current) {
      textInputRef.current.focus();
    }
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(() => {
    const trimmedText = text.trim();
    const trimmedUrl = url.trim();

    if (trimmedText && trimmedUrl) {
      // Auto-add https:// if no protocol specified
      const finalUrl =
        trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
          ? trimmedUrl
          : `https://${trimmedUrl}`;
      console.log('[TextAndUrlInputPopover] Submitting:', { text: trimmedText, url: finalUrl });
      onSubmit(trimmedText, finalUrl);
    }
  }, [text, url, onSubmit]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  return (
    <Paper
      elevation={4}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        padding: 1,
        gap: 1,
        borderRadius: 1,
        minWidth: 280,
      }}
    >
      <TextField
        inputRef={textInputRef}
        size="small"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Link text"
        fullWidth
        sx={{
          '& .MuiInputBase-input': {
            fontSize: '0.875rem',
            py: 0.5,
          },
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TextField
          size="small"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="URL (e.g., example.com)"
          fullWidth
          sx={{
            '& .MuiInputBase-input': {
              fontSize: '0.875rem',
              py: 0.5,
            },
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleSubmit}
                  aria-label="Save link"
                  disabled={!text.trim() || !url.trim()}
                >
                  <CheckIcon
                    fontSize="small"
                    color={text.trim() && url.trim() ? 'success' : 'disabled'}
                  />
                </IconButton>
                <IconButton size="small" onClick={onCancel} aria-label="Cancel">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Paper>
  );
};
