/**
 * Link Popover Component
 *
 * Displays a popover with link actions when a web link is clicked.
 * Actions: Visit (open in browser), Copy (copy URL to clipboard), Edit, Remove
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Paper,
  Snackbar,
  TextField,
  InputAdornment,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

export interface LinkPopoverProps {
  /**
   * The URL of the link
   */
  href: string;

  /**
   * Callback when the popover should close
   */
  onClose: () => void;

  /**
   * Callback to remove the link (unlink text)
   */
  onRemove?: () => void;

  /**
   * Callback to edit the link URL
   */
  onEdit?: (newHref: string) => void;
}

/**
 * LinkPopover displays quick actions for a web link
 *
 * Supports:
 * - Visit: Opens the link in the default browser
 * - Copy: Copies the URL to clipboard
 * - Edit: Change the link URL (inline input)
 * - Remove: Remove the link but keep the text
 */
export const LinkPopover: React.FC<LinkPopoverProps> = ({ href, onClose, onRemove, onEdit }) => {
  const [showCopiedSnackbar, setShowCopiedSnackbar] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(href);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  /**
   * Handle visit action - opens link in default browser
   */
  const handleVisit = useCallback(() => {
    console.log('[LinkPopover] Opening URL in browser:', href);
    void window.electronAPI.shell.openExternal(href);
    onClose();
  }, [href, onClose]);

  /**
   * Handle copy action - copies URL to clipboard
   */
  const handleCopy = useCallback(() => {
    console.log('[LinkPopover] Copying URL to clipboard:', href);
    void navigator.clipboard.writeText(href).then(() => {
      setShowCopiedSnackbar(true);
      // Don't close immediately so user sees the feedback
      setTimeout(() => {
        onClose();
      }, 500);
    });
  }, [href, onClose]);

  /**
   * Handle entering edit mode
   */
  const handleStartEdit = useCallback(() => {
    console.log('[LinkPopover] Entering edit mode');
    setEditValue(href);
    setIsEditing(true);
  }, [href]);

  /**
   * Handle saving the edited URL
   */
  const handleSaveEdit = useCallback(() => {
    const newUrl = editValue.trim();
    if (newUrl && newUrl !== href) {
      console.log('[LinkPopover] Saving new URL:', newUrl);
      onEdit?.(newUrl);
    }
    setIsEditing(false);
    onClose();
  }, [editValue, href, onEdit, onClose]);

  /**
   * Handle canceling edit mode
   */
  const handleCancelEdit = useCallback(() => {
    console.log('[LinkPopover] Canceling edit');
    setIsEditing(false);
    setEditValue(href);
  }, [href]);

  /**
   * Handle remove action - removes link but keeps text
   */
  const handleRemove = useCallback(() => {
    console.log('[LinkPopover] Removing link');
    onRemove?.();
    onClose();
  }, [onRemove, onClose]);

  /**
   * Handle keyboard events in edit mode
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  return (
    <>
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
        {isEditing ? (
          // Edit mode: show input field
          <>
            <TextField
              inputRef={inputRef}
              size="small"
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL"
              sx={{
                minWidth: 200,
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                  py: 0.5,
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleSaveEdit} aria-label="Save link">
                      <CheckIcon fontSize="small" color="success" />
                    </IconButton>
                    <IconButton size="small" onClick={handleCancelEdit} aria-label="Cancel edit">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        ) : (
          // View mode: show URL and action buttons
          <>
            {/* URL display (truncated) */}
            <Box
              sx={{
                px: 1,
                py: 0.5,
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.875rem',
                color: 'text.secondary',
              }}
            >
              {href}
            </Box>

            {/* Visit button */}
            <Tooltip title="Open in browser">
              <IconButton size="small" onClick={handleVisit} aria-label="Open link in browser">
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Copy button */}
            <Tooltip title="Copy URL">
              <IconButton size="small" onClick={handleCopy} aria-label="Copy link URL">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Edit button */}
            {onEdit && (
              <Tooltip title="Edit URL">
                <IconButton size="small" onClick={handleStartEdit} aria-label="Edit link URL">
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {/* Remove button */}
            {onRemove && (
              <Tooltip title="Remove link">
                <IconButton size="small" onClick={handleRemove} aria-label="Remove link">
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </Paper>

      {/* Copied feedback snackbar */}
      <Snackbar
        open={showCopiedSnackbar}
        autoHideDuration={1500}
        onClose={() => {
          setShowCopiedSnackbar(false);
        }}
        message="Link copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};
