/**
 * HexViewer Component
 *
 * Wireshark-style hex viewer with three columns:
 * - Offset: Hex address (8 digits)
 * - Hex: 16 bytes per row in hex format
 * - ASCII: Printable ASCII representation
 *
 * Features:
 * - Pagination for large files (1000 rows per page = 16KB)
 * - Color coding for different field types (when structure is provided)
 * - Bidirectional highlighting between hex and structure
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Box, Typography, IconButton, Tooltip, Paper } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';

// Constants
const BYTES_PER_ROW = 16;
const ROWS_PER_PAGE = 1000;
const BYTES_PER_PAGE = BYTES_PER_ROW * ROWS_PER_PAGE;

// Color scheme for field types (from PLAN.md)
const FIELD_COLORS: Record<string, string> = {
  magic: '#4A90D9', // Blue - header magic bytes
  version: '#4A90D9', // Blue - version byte
  timestamp: '#50C878', // Green - timestamp fields
  sequence: '#00CED1', // Cyan - sequence numbers
  length: '#FFA500', // Orange - varint lengths
  data: 'inherit', // Default - payload data
  error: '#FF6B6B', // Red - parse errors
  vectorClock: '#DDA0DD', // Plum - vector clock entries
  status: '#FFD700', // Gold - status bytes
};

/**
 * Parsed field with byte offset information
 */
export interface ParsedField {
  name: string;
  value: string | number;
  startOffset: number;
  endOffset: number;
  type: keyof typeof FIELD_COLORS;
  error?: string;
}

export interface HexViewerProps {
  /** Raw binary data to display */
  data: Uint8Array;
  /** Parsed fields for color coding and structure display (optional) */
  fields?: ParsedField[] | undefined;
  /** Currently highlighted byte range */
  highlightRange?: { start: number; end: number } | null | undefined;
  /** Called when user clicks on bytes to highlight */
  onHighlightChange?: ((range: { start: number; end: number } | null) => void) | undefined;
}

/**
 * Get the color for a byte at a specific offset based on parsed fields
 */
function getByteColor(offset: number, fields?: ParsedField[]): string | undefined {
  if (!fields) return undefined;

  for (const field of fields) {
    if (offset >= field.startOffset && offset < field.endOffset) {
      return FIELD_COLORS[field.type] ?? undefined;
    }
  }
  return undefined;
}

/**
 * Check if a byte is within the highlight range
 */
function isHighlighted(offset: number, range?: { start: number; end: number } | null): boolean {
  if (!range) return false;
  return offset >= range.start && offset < range.end;
}

/**
 * Format a byte as a two-digit hex string
 */
function formatHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/**
 * Get ASCII character for a byte (printable or dot)
 */
function getAsciiChar(byte: number): string {
  return byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.';
}

/**
 * Single row in the hex view
 */
interface HexRowProps {
  offset: number;
  bytes: Uint8Array;
  startByteOffset: number;
  fields: ParsedField[] | undefined;
  highlightRange: { start: number; end: number } | null | undefined;
  onByteClick: ((offset: number) => void) | undefined;
}

const HexRow: React.FC<HexRowProps> = ({
  offset,
  bytes,
  startByteOffset,
  fields,
  highlightRange,
  onByteClick,
}) => {
  const hexParts: React.ReactNode[] = [];
  const asciiParts: React.ReactNode[] = [];

  for (let i = 0; i < BYTES_PER_ROW; i++) {
    const byteOffset = startByteOffset + i;
    const byte = i < bytes.length ? bytes[i] : undefined;
    const color = byte !== undefined ? getByteColor(byteOffset, fields) : undefined;
    const highlighted = byte !== undefined && isHighlighted(byteOffset, highlightRange);

    // Add space between groups of 8 bytes
    if (i === 8) {
      hexParts.push(<span key="gap" style={{ width: '8px', display: 'inline-block' }} />);
    }

    if (byte !== undefined) {
      hexParts.push(
        <span
          key={`hex-${i}`}
          onClick={() => onByteClick?.(byteOffset)}
          style={{
            color: color ?? 'inherit',
            backgroundColor: highlighted ? 'rgba(74, 144, 217, 0.3)' : undefined,
            cursor: onByteClick ? 'pointer' : undefined,
            padding: '0 1px',
            borderRadius: '2px',
          }}
        >
          {formatHex(byte)}
        </span>
      );
      hexParts.push(<span key={`space-${i}`}> </span>);

      asciiParts.push(
        <span
          key={`ascii-${i}`}
          onClick={() => onByteClick?.(byteOffset)}
          style={{
            color: color ?? 'inherit',
            backgroundColor: highlighted ? 'rgba(74, 144, 217, 0.3)' : undefined,
            cursor: onByteClick ? 'pointer' : undefined,
          }}
        >
          {getAsciiChar(byte)}
        </span>
      );
    } else {
      // Padding for incomplete rows
      hexParts.push(<span key={`hex-${i}`}> </span>);
      asciiParts.push(<span key={`ascii-${i}`}> </span>);
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: '1.5',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        },
      }}
    >
      {/* Offset column */}
      <Box
        sx={{
          width: '80px',
          flexShrink: 0,
          color: 'grey.500',
          userSelect: 'none',
        }}
      >
        {offset.toString(16).padStart(8, '0')}
      </Box>

      {/* Hex column */}
      <Box
        sx={{
          width: '400px',
          flexShrink: 0,
        }}
      >
        {hexParts}
      </Box>

      {/* ASCII column */}
      <Box
        sx={{
          flexGrow: 1,
          color: 'grey.400',
          pl: 1,
          borderLeft: '1px solid',
          borderColor: 'grey.700',
        }}
      >
        |{asciiParts}|
      </Box>
    </Box>
  );
};

export const HexViewer: React.FC<HexViewerProps> = ({
  data,
  fields,
  highlightRange,
  onHighlightChange,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-navigate to page containing highlighted bytes when highlight changes
  useEffect(() => {
    if (highlightRange) {
      const targetPage = Math.floor(highlightRange.start / BYTES_PER_PAGE);
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
    }
  }, [highlightRange, currentPage]);

  // Scroll to highlighted row within the current page
  useEffect(() => {
    if (highlightRange && scrollContainerRef.current) {
      const pageStartOffset = currentPage * BYTES_PER_PAGE;
      const highlightStartOffset = highlightRange.start;

      // Only scroll if highlight is on current page
      if (
        highlightStartOffset >= pageStartOffset &&
        highlightStartOffset < pageStartOffset + BYTES_PER_PAGE
      ) {
        // Calculate which row contains the start of the highlight
        const rowIndex = Math.floor((highlightStartOffset - pageStartOffset) / BYTES_PER_ROW);
        // Each row is approximately 20px tall (based on the font size and padding)
        const rowHeight = 20;
        const targetScrollTop = rowIndex * rowHeight;

        // Scroll the container to show the highlighted row
        scrollContainerRef.current.scrollTo({
          top: Math.max(0, targetScrollTop - 100), // Offset by 100px to show context above
          behavior: 'smooth',
        });
      }
    }
  }, [highlightRange, currentPage]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(data.length / BYTES_PER_PAGE);
  }, [data.length]);

  // Get bytes for current page
  const pageData = useMemo(() => {
    const startOffset = currentPage * BYTES_PER_PAGE;
    const endOffset = Math.min(startOffset + BYTES_PER_PAGE, data.length);
    return {
      bytes: data.slice(startOffset, endOffset),
      startOffset,
    };
  }, [data, currentPage]);

  // Generate rows for current page
  const rows = useMemo(() => {
    const result: { offset: number; bytes: Uint8Array }[] = [];
    const { bytes, startOffset } = pageData;

    for (let i = 0; i < bytes.length; i += BYTES_PER_ROW) {
      result.push({
        offset: startOffset + i,
        bytes: bytes.slice(i, i + BYTES_PER_ROW),
      });
    }

    return result;
  }, [pageData]);

  // Navigation handlers
  const goToFirstPage = useCallback(() => {
    setCurrentPage(0);
  }, []);
  const goToPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
  }, []);
  const goToNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);
  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages - 1);
  }, [totalPages]);

  // Handle byte click for highlighting
  const handleByteClick = useCallback(
    (offset: number) => {
      if (!onHighlightChange) return;

      // Find field containing this byte
      if (fields) {
        for (const field of fields) {
          if (offset >= field.startOffset && offset < field.endOffset) {
            onHighlightChange({ start: field.startOffset, end: field.endOffset });
            return;
          }
        }
      }

      // No field found, highlight single byte
      onHighlightChange({ start: offset, end: offset + 1 });
    },
    [fields, onHighlightChange]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: 'grey.500',
          borderBottom: '1px solid',
          borderColor: 'grey.700',
          pb: 0.5,
          mb: 0.5,
          userSelect: 'none',
        }}
      >
        <Box sx={{ width: '80px', flexShrink: 0 }}>Offset</Box>
        <Box sx={{ width: '400px', flexShrink: 0 }}>
          00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F
        </Box>
        <Box sx={{ flexGrow: 1, pl: 1, borderLeft: '1px solid', borderColor: 'grey.700' }}>
          ASCII
        </Box>
      </Box>

      {/* Hex content */}
      <Box ref={scrollContainerRef} sx={{ flexGrow: 1, overflow: 'auto' }}>
        {rows.map((row) => (
          <HexRow
            key={row.offset}
            offset={row.offset}
            bytes={row.bytes}
            startByteOffset={row.offset}
            fields={fields}
            highlightRange={highlightRange}
            onByteClick={onHighlightChange ? handleByteClick : undefined}
          />
        ))}
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            py: 0.5,
            borderTop: '1px solid',
            borderColor: 'grey.700',
            backgroundColor: 'transparent',
          }}
        >
          <Tooltip title="First page">
            <span>
              <IconButton size="small" onClick={goToFirstPage} disabled={currentPage === 0}>
                <FirstPageIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Previous page">
            <span>
              <IconButton size="small" onClick={goToPrevPage} disabled={currentPage === 0}>
                <NavigateBeforeIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Typography variant="body2" sx={{ mx: 2, color: 'grey.400' }}>
            Page {currentPage + 1} of {totalPages}
          </Typography>

          <Tooltip title="Next page">
            <span>
              <IconButton
                size="small"
                onClick={goToNextPage}
                disabled={currentPage === totalPages - 1}
              >
                <NavigateNextIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Last page">
            <span>
              <IconButton
                size="small"
                onClick={goToLastPage}
                disabled={currentPage === totalPages - 1}
              >
                <LastPageIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Typography variant="caption" sx={{ ml: 2, color: 'grey.500' }}>
            ({data.length.toLocaleString()} bytes)
          </Typography>
        </Paper>
      )}

      {/* Single page - just show byte count */}
      {totalPages <= 1 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 0.5,
            borderTop: '1px solid',
            borderColor: 'grey.700',
          }}
        >
          <Typography variant="caption" sx={{ color: 'grey.500' }}>
            {data.length.toLocaleString()} bytes
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default HexViewer;
