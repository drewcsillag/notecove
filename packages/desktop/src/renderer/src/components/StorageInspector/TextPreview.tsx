/**
 * TextPreview Component
 *
 * Displays text content for activity logs, profile JSON files, and identity files.
 * Supports plain text and formatted JSON display.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Paper } from '@mui/material';

export interface TextPreviewProps {
  /** Raw binary data to display as text */
  data: Uint8Array;
  /** File type for determining display format */
  fileType: 'activity' | 'profile' | 'identity' | 'unknown';
  /** Maximum height of the preview (defaults to 300px) */
  maxHeight?: number | undefined;
}

/**
 * Decode binary data to text
 */
function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(data);
  } catch {
    // Fallback to latin1 for non-UTF8 data
    return new TextDecoder('latin1').decode(data);
  }
}

/**
 * Try to parse and format JSON
 */
function formatJson(text: string): { formatted: string; isValid: boolean } {
  try {
    const parsed = JSON.parse(text) as unknown;
    return {
      formatted: JSON.stringify(parsed, null, 2),
      isValid: true,
    };
  } catch {
    return {
      formatted: text,
      isValid: false,
    };
  }
}

export const TextPreview: React.FC<TextPreviewProps> = ({ data, fileType, maxHeight = 300 }) => {
  const content = useMemo(() => {
    const text = decodeText(data);

    // For profile files, try to format as JSON
    if (fileType === 'profile') {
      const { formatted, isValid } = formatJson(text);
      return { text: formatted, isJson: isValid };
    }

    return { text, isJson: false };
  }, [data, fileType]);

  const getTitle = (): string => {
    switch (fileType) {
      case 'activity':
        return 'Activity Log';
      case 'profile':
        return 'Profile Data';
      case 'identity':
        return 'Identity File';
      default:
        return 'Text Content';
    }
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
        <Typography variant="caption" color="text.secondary">
          {getTitle()}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {data.length.toLocaleString()} bytes
        </Typography>
      </Box>

      {/* Content */}
      <Box
        sx={{
          p: 2,
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: content.isJson ? '#50C878' : 'grey.300',
        }}
      >
        {content.text}
      </Box>
    </Paper>
  );
};

export default TextPreview;
