/**
 * Link Input Popover Component
 *
 * Displays a popover for entering a URL when creating a new link.
 * Used when text is selected and user clicks the link toolbar button or uses Cmd+K.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Paper, TextField, IconButton, InputAdornment } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

export interface LinkInputPopoverProps {
  /**
   * Initial URL value (empty for new links)
   */
  initialUrl?: string;

  /**
   * Callback when URL is submitted
   */
  onSubmit: (url: string) => void;

  /**
   * Callback when popover is cancelled
   */
  onCancel: () => void;
}

/**
 * LinkInputPopover provides a simple input for entering a URL
 */
export const LinkInputPopover: React.FC<LinkInputPopoverProps> = ({
  initialUrl = '',
  onSubmit,
  onCancel,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (initialUrl) {
        inputRef.current.select();
      }
    }
  }, [initialUrl]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(() => {
    const trimmedUrl = url.trim();
    if (trimmedUrl) {
      // Auto-add https:// if no protocol specified
      const finalUrl =
        trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
          ? trimmedUrl
          : `https://${trimmedUrl}`;
      console.log('[LinkInputPopover] Submitting URL:', finalUrl);
      onSubmit(finalUrl);
    }
  }, [url, onSubmit]);

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
        alignItems: 'center',
        padding: 0.5,
        gap: 0.5,
        borderRadius: 1,
      }}
    >
      <TextField
        inputRef={inputRef}
        size="small"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Enter URL (e.g., example.com)"
        sx={{
          minWidth: 250,
          '& .MuiInputBase-input': {
            fontSize: '0.875rem',
            py: 0.5,
          },
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleSubmit} aria-label="Save link">
                <CheckIcon fontSize="small" color="success" />
              </IconButton>
              <IconButton size="small" onClick={onCancel} aria-label="Cancel">
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Paper>
  );
};
