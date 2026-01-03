/**
 * RecordList Component
 *
 * Displays a list of records from a CRDT log file.
 * Allows clicking records to highlight their bytes in the hex viewer.
 */

import React from 'react';
import { Box, Typography, List, ListItemButton, ListItemText, Chip, Paper, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/**
 * Record information for display
 */
export interface RecordInfo {
  index: number;
  timestamp: number;
  sequence: number;
  dataSize: number;
  startOffset: number;
  endOffset: number;
  /** Start offset of the Yjs update data (after length, timestamp, sequence) */
  dataStartOffset: number;
}

export interface RecordListProps {
  /** Records to display */
  records: RecordInfo[];
  /** Currently selected record index */
  selectedIndex?: number | null | undefined;
  /** Called when a record is clicked */
  onRecordSelect?: ((record: RecordInfo) => void) | undefined;
  /** Maximum height of the list (defaults to 200px) */
  maxHeight?: number | undefined;
  /** Called when refresh is requested */
  onRefresh?: (() => void) | undefined;
  /** Note ID (for "Open Note" button) */
  noteId?: string | undefined;
  /** Whether the note exists in the database */
  noteExists?: boolean | undefined;
  /** Called when "Open Note" is clicked */
  onOpenNote?: ((noteId: string) => void) | undefined;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const RecordList: React.FC<RecordListProps> = ({
  records,
  selectedIndex,
  onRecordSelect,
  maxHeight = 200,
  onRefresh,
  noteId,
  noteExists = true,
  onOpenNote,
}) => {
  if (records.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No records in this file
        </Typography>
      </Box>
    );
  }

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
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            Records ({records.length})
          </Typography>
          <Typography variant="caption" sx={{ color: 'grey.500' }}>
            Click to highlight in hex view
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Open Note button */}
          {noteId && onOpenNote && (
            <Tooltip title={noteExists ? 'Open note in new window' : 'Note not found'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => {
                    onOpenNote(noteId);
                  }}
                  disabled={!noteExists}
                  sx={{ p: 0.5 }}
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {/* Refresh button */}
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={onRefresh} sx={{ p: 0.5 }}>
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Record list */}
      <List dense disablePadding>
        {records.map((record) => (
          <ListItemButton
            key={record.index}
            selected={selectedIndex === record.index}
            onClick={() => onRecordSelect?.(record)}
            sx={{
              py: 0.5,
              '&:hover': {
                bgcolor: 'rgba(74, 144, 217, 0.1)',
              },
              '&.Mui-selected': {
                bgcolor: 'rgba(74, 144, 217, 0.2)',
                '&:hover': {
                  bgcolor: 'rgba(74, 144, 217, 0.3)',
                },
              },
            }}
          >
            <ListItemText
              primary={
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                >
                  <Chip
                    label={`#${record.index}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      bgcolor: 'grey.800',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#50C878', fontFamily: 'monospace' }}>
                    {formatTimestamp(record.timestamp)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#00CED1', fontFamily: 'monospace' }}>
                    seq:{record.sequence}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'grey.500', fontFamily: 'monospace' }}>
                    {formatBytes(record.dataSize)}
                  </Typography>
                </Box>
              }
              secondary={
                <Typography
                  variant="caption"
                  sx={{ color: 'grey.600', fontFamily: 'monospace', fontSize: '10px' }}
                >
                  offset: 0x{record.startOffset.toString(16).padStart(6, '0')} - 0x
                  {record.endOffset.toString(16).padStart(6, '0')}
                </Typography>
              }
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
};

export default RecordList;
