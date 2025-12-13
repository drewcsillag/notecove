/**
 * ImagePreview Component
 *
 * Displays image files with thumbnail preview and metadata.
 * Shows dimensions, format, and file size.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';

export interface ImagePreviewProps {
  /** Raw binary data of the image */
  data: Uint8Array;
  /** File name for display */
  fileName: string;
  /** Maximum height of the preview container (defaults to 400px) */
  maxHeight?: number | undefined;
}

/**
 * Detect image MIME type from file signature
 */
function detectMimeType(data: Uint8Array): string {
  if (data.length < 4) return 'application/octet-stream';

  // PNG: 89 50 4E 47
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: 47 49 46 38
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return 'image/gif';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data.length > 11 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return 'image/webp';
  }

  // SVG: starts with < (text-based)
  if (data[0] === 0x3c) {
    const text = new TextDecoder().decode(data.slice(0, 100));
    if (text.includes('<svg') || text.includes('<?xml')) {
      return 'image/svg+xml';
    }
  }

  return 'application/octet-stream';
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get human-readable format name
 */
function getFormatName(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'PNG';
    case 'image/jpeg':
      return 'JPEG';
    case 'image/gif':
      return 'GIF';
    case 'image/webp':
      return 'WebP';
    case 'image/svg+xml':
      return 'SVG';
    default:
      return 'Unknown';
  }
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ data, fileName, maxHeight = 400 }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('application/octet-stream');

  // Keep a reference to the blob to prevent garbage collection
  const blobRef = useRef<Blob | null>(null);

  // Create blob URL for the image - use useEffect to handle cleanup properly
  useEffect(() => {
    console.log(
      '[ImagePreview] Data received:',
      data.length,
      'bytes, first 10:',
      Array.from(data.slice(0, 10))
    );
    const mime = detectMimeType(data);
    console.log('[ImagePreview] Detected MIME type:', mime);
    setMimeType(mime);

    // Copy to a regular ArrayBuffer to ensure compatibility with Blob
    const buffer = new ArrayBuffer(data.length);
    new Uint8Array(buffer).set(data);
    const blob = new Blob([buffer], { type: mime });
    blobRef.current = blob; // Keep reference to prevent GC

    const url = URL.createObjectURL(blob);
    console.log('[ImagePreview] Created blob URL:', url);
    setBlobUrl(url);
    setLoading(true);
    setError(null);

    // Cleanup function
    return () => {
      console.log('[ImagePreview] Revoking blob URL:', url);
      URL.revokeObjectURL(url);
      blobRef.current = null;
    };
  }, [data]);

  // Handle image load
  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setLoading(false);
    setError(null);
  };

  // Handle image error
  const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('[ImagePreview] Image load error:', event);
    setLoading(false);
    setError('Failed to load image');
    setDimensions(null);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        maxHeight,
        overflow: 'auto',
        bgcolor: 'grey.900',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'grey.700',
          position: 'sticky',
          top: 0,
          bgcolor: 'grey.900',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ImageIcon fontSize="small" sx={{ color: 'grey.500' }} />
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            Image Preview
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            {getFormatName(mimeType)}
          </Typography>
          {dimensions && (
            <Typography variant="caption" sx={{ color: 'grey.400' }}>
              {dimensions.width} × {dimensions.height}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: 'grey.500' }}>
            {formatBytes(data.length)}
          </Typography>
        </Box>
      </Box>

      {/* Image content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          minHeight: 200,
        }}
      >
        {(loading || !blobUrl) && !error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" sx={{ color: 'grey.400' }}>
              Loading image...
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <BrokenImageIcon sx={{ fontSize: 48, color: 'error.main' }} />
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          </Box>
        )}

        {blobUrl && (
          <img
            src={blobUrl}
            alt={fileName}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              maxWidth: '100%',
              maxHeight: maxHeight - 100,
              objectFit: 'contain',
              display: loading || error ? 'none' : 'block',
              borderRadius: '4px',
            }}
          />
        )}
      </Box>
    </Paper>
  );
};

export default ImagePreview;
