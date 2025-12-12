/**
 * ImagePropertiesDialog - Dialog for editing image properties
 *
 * Allows editing:
 * - Alt text (for accessibility)
 * - Caption (displayed below block images)
 * - Alignment (left, center, right)
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
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Checkbox,
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
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(attrs.alignment);
  const [linkHref, setLinkHref] = useState(attrs.linkHref ?? '');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [wrap, setWrap] = useState(attrs.wrap);

  // Reset form when dialog opens with new attrs
  useEffect(() => {
    if (open) {
      setAlt(attrs.alt);
      setCaption(attrs.caption);
      setAlignment(attrs.alignment);
      setLinkHref(attrs.linkHref ?? '');
      setLinkError(null);
      setWrap(attrs.wrap);
    }
  }, [open, attrs]);

  // Wrap is only available for block images with left/right alignment
  const isWrapDisabled = attrs.display === 'inline' || alignment === 'center';

  // Auto-disable wrap when alignment changes to center
  useEffect(() => {
    if (alignment === 'center') {
      setWrap(false);
    }
  }, [alignment]);

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
      alignment,
      linkHref: linkHref.trim() || null,
      wrap,
    });
    onClose();
  }, [alt, caption, alignment, linkHref, wrap, onSave, onClose]);

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
            helperText="Displayed below the image (block images only)"
            inputProps={{
              'aria-label': 'Caption',
            }}
          />

          {/* Alignment - only applicable to block images */}
          <FormControl component="fieldset" disabled={attrs.display === 'inline'}>
            <FormLabel component="legend">Alignment</FormLabel>
            <RadioGroup
              row
              value={alignment}
              onChange={(e) => {
                setAlignment(e.target.value as 'left' | 'center' | 'right');
              }}
            >
              <FormControlLabel value="left" control={<Radio />} label="Left" />
              <FormControlLabel value="center" control={<Radio />} label="Center" />
              <FormControlLabel value="right" control={<Radio />} label="Right" />
            </RadioGroup>
            {attrs.display === 'inline' && (
              <Box sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.75rem' }}>
                Alignment only applies to block images
              </Box>
            )}
          </FormControl>

          {/* Text Wrapping - only for block images with left/right alignment */}
          <FormControlLabel
            control={
              <Checkbox
                checked={wrap}
                onChange={(e) => {
                  setWrap(e.target.checked);
                }}
                disabled={isWrapDisabled}
                inputProps={{
                  'aria-label': 'Wrap text around image',
                }}
              />
            }
            label="Wrap text around image"
            disabled={isWrapDisabled}
          />
          {isWrapDisabled && (
            <Box sx={{ ml: 4, mt: -1, color: 'text.secondary', fontSize: '0.75rem' }}>
              {attrs.display === 'inline'
                ? 'Text wrapping only applies to block images'
                : 'Text wrapping requires left or right alignment'}
            </Box>
          )}

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
