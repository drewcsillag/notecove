/**
 * ImagePropertiesDialog - Dialog for editing image properties
 *
 * Allows editing:
 * - Alt text (for accessibility)
 * - Caption (displayed below images)
 * - Link URL (makes image clickable)
 *
 * @see plans/add-images/PLAN-PHASE-4.md
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
} from '@mui/material';
import type { ImageNodeAttrs } from './extensions/Image';

/** Props for ImagePropertiesDialog */
export interface ImagePropertiesDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed (cancel or backdrop click) */
  onClose: () => void;
  /** Callback when properties are saved */
  onSave: (attrs: Partial<ImageNodeAttrs>) => void;
  /** Current image attributes */
  attrs: ImageNodeAttrs;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (no link)
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * ImagePropertiesDialog component
 */
export function ImagePropertiesDialog({
  open,
  onClose,
  onSave,
  attrs,
}: ImagePropertiesDialogProps): React.JSX.Element | null {
  // Form state
  const [alt, setAlt] = useState(attrs.alt);
  const [caption, setCaption] = useState(attrs.caption);
  const [linkHref, setLinkHref] = useState(attrs.linkHref ?? '');
  const [linkError, setLinkError] = useState<string | null>(null);

  // Reset form when dialog opens with new attrs
  useEffect(() => {
    if (open) {
      setAlt(attrs.alt);
      setCaption(attrs.caption);
      setLinkHref(attrs.linkHref ?? '');
      setLinkError(null);
    }
  }, [open, attrs]);

  // Validate link URL on blur
  const handleLinkBlur = useCallback(() => {
    if (linkHref && !isValidUrl(linkHref)) {
      setLinkError('Invalid URL. Must start with http:// or https://');
    } else {
      setLinkError(null);
    }
  }, [linkHref]);

  // Handle save
  const handleSave = useCallback(() => {
    // Validate link before saving
    if (linkHref && !isValidUrl(linkHref)) {
      setLinkError('Invalid URL. Must start with http:// or https://');
      return;
    }

    onSave({
      alt,
      caption,
      linkHref: linkHref.trim() || null,
    });
    onClose();
  }, [alt, caption, linkHref, onSave, onClose]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="image-properties-dialog-title"
    >
      <DialogTitle id="image-properties-dialog-title">Image Properties</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Alt Text */}
          <TextField
            id="image-alt-text"
            label="Alt Text"
            value={alt}
            onChange={(e) => {
              setAlt(e.target.value);
            }}
            fullWidth
            helperText="Describes the image for accessibility and when image can't be displayed"
            inputProps={{
              'aria-label': 'Alt Text',
            }}
          />

          {/* Caption */}
          <TextField
            id="image-caption"
            label="Caption"
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
            }}
            fullWidth
            helperText="Displayed below the image"
            inputProps={{
              'aria-label': 'Caption',
            }}
          />

          {/* Link URL */}
          <TextField
            id="image-link-url"
            label="Link URL"
            value={linkHref}
            onChange={(e) => {
              setLinkHref(e.target.value);
              if (linkError) setLinkError(null);
            }}
            onBlur={handleLinkBlur}
            fullWidth
            placeholder="https://example.com"
            error={!!linkError}
            helperText={linkError ?? 'Click on the image will open this URL'}
            inputProps={{
              'aria-label': 'Link URL',
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ImagePropertiesDialog;
