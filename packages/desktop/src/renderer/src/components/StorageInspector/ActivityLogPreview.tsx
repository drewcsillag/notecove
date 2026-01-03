/**
 * ActivityLogPreview Component
 *
 * Displays activity log content with both parsed table view and raw text view.
 * Supports virtualized rendering for large logs (up to 1000 entries).
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import TableChartIcon from '@mui/icons-material/TableChart';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import RefreshIcon from '@mui/icons-material/Refresh';

// =============================================================================
// Types
// =============================================================================

export interface ActivityLogEntry {
  noteId: string;
  profileId: string;
  sequenceNumber: number;
  lineNumber: number;
}

export interface ParseResult {
  success: boolean;
  entries: ActivityLogEntry[];
  error?: string;
}

export interface FilenameMetadata {
  profileId: string | null;
  instanceId: string;
}

export interface ActivityLogPreviewProps {
  /** Raw binary data of the activity log */
  data: Uint8Array;
  /** Filename of the activity log (e.g., "profile123.instance456.log") */
  filename: string;
  /** Maximum height of the preview */
  maxHeight?: number;
  /** Callback when refresh is requested */
  onRefresh?: () => void;
  /** Callback when a noteId is clicked */
  onNoteClick?: (noteId: string) => void;
  /** Callback when a profileId is clicked (navigates to profile file) */
  onProfileClick?: (profileId: string) => void;
  /** Function to get note title for hover tooltip */
  getNoteTitle?: (noteId: string) => Promise<string | null>;
  /** Function to get profile data for hover tooltip */
  getProfileData?: (profileId: string) => Promise<string | null>;
}

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Parse activity log content into structured entries.
 *
 * Format: noteId|profileId|sequenceNumber (one per line)
 * Legacy format: noteId_profileId_sequenceNumber (underscore delimiter)
 *
 * Returns success: false if any line is malformed (falls back to raw view).
 */
export function parseActivityLog(content: string): ParseResult {
  const entries: ActivityLogEntry[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue; // Skip empty lines

    // Try pipe delimiter first (new format), then underscore (legacy)
    let parts = line.split('|');
    if (parts.length !== 3) {
      // Try legacy underscore format
      parts = line.split('_');
    }

    if (parts.length !== 3) {
      return {
        success: false,
        entries: [],
        error: `Malformed activity log at line ${i + 1}: expected 3 fields, got ${parts.length}`,
      };
    }

    const [noteId, profileId, seqStr] = parts;
    const sequenceNumber = parseInt(seqStr?.trim() ?? '', 10);

    if (isNaN(sequenceNumber)) {
      return {
        success: false,
        entries: [],
        error: `Malformed activity log at line ${i + 1}: sequence number is not a valid integer`,
      };
    }

    entries.push({
      noteId: noteId?.trim() ?? '',
      profileId: profileId?.trim() ?? '',
      sequenceNumber,
      lineNumber: i + 1,
    });
  }

  return { success: true, entries };
}

/**
 * Parse activity log filename to extract profile and instance IDs.
 *
 * New format: {profileId}.{instanceId}.log
 * Legacy format: {instanceId}.log
 *
 * Returns null if filename doesn't match expected patterns.
 */
export function parseActivityLogFilename(filename: string): FilenameMetadata | null {
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- filename is always string, but we check for empty
  if (!filename || !filename.endsWith('.log')) {
    return null;
  }

  // Remove .log extension
  const base = filename.slice(0, -4);
  if (!base) {
    return null;
  }

  // Split by dots - the last part before .log is instanceId
  // Everything before that (joined by dots) is profileId
  const lastDotIndex = base.lastIndexOf('.');

  if (lastDotIndex === -1) {
    // Legacy format: just instanceId.log
    return {
      profileId: null,
      instanceId: base,
    };
  }

  // New format: profileId.instanceId.log
  // profileId can contain dots, so we take everything before the last dot as profileId
  return {
    profileId: base.slice(0, lastDotIndex),
    instanceId: base.slice(lastDotIndex + 1),
  };
}

/**
 * Decode binary data to text
 */
function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(data);
  } catch {
    return new TextDecoder('latin1').decode(data);
  }
}

// =============================================================================
// Hoverable ID Component (for async tooltip loading)
// =============================================================================

interface HoverableIdProps {
  id: string;
  color: string;
  minWidth: number;
  fetchData: ((id: string) => Promise<string | null>) | undefined;
  onClick?: () => void;
  clickable?: boolean;
  /** Hint text shown when clickable (e.g., "Click to open note", "Click to view profile") */
  clickHint?: string;
}

/**
 * Component that shows an ID with a tooltip that loads async data on hover.
 * Caches fetched data to avoid repeated fetches.
 */
const HoverableId: React.FC<HoverableIdProps> = ({
  id,
  color,
  minWidth,
  fetchData,
  onClick,
  clickable = false,
  clickHint = 'Click to open note',
}) => {
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cacheRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!isHovered || !fetchData) return;

    // Check cache first
    if (cacheRef.current.has(id)) {
      setTooltipContent(cacheRef.current.get(id) ?? null);
      return;
    }

    // Fetch data
    let cancelled = false;
    setIsLoading(true);

    fetchData(id)
      .then((result) => {
        if (!cancelled) {
          cacheRef.current.set(id, result);
          setTooltipContent(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          cacheRef.current.set(id, null);
          setTooltipContent(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isHovered, id, fetchData]);

  const getTooltipTitle = () => {
    if (!fetchData) {
      return clickable ? clickHint : id;
    }
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={12} />
          <span>Loading...</span>
        </Box>
      );
    }
    if (tooltipContent) {
      return (
        <Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 'bold', whiteSpace: 'pre-line' }}
          >
            {tooltipContent}
          </Typography>
          {clickable && (
            <Typography variant="caption" sx={{ display: 'block', color: 'grey.400' }}>
              {clickHint}
            </Typography>
          )}
        </Box>
      );
    }
    return clickable ? clickHint : 'Not found';
  };

  return (
    <Tooltip title={getTooltipTitle()} arrow>
      <Typography
        variant="caption"
        onClick={onClick}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        sx={{
          color,
          fontFamily: 'monospace',
          cursor: clickable ? 'pointer' : 'default',
          minWidth,
          '&:hover': clickable
            ? {
                textDecoration: 'underline',
              }
            : undefined,
        }}
      >
        {id}
      </Typography>
    </Tooltip>
  );
};

// =============================================================================
// Component
// =============================================================================

export const ActivityLogPreview: React.FC<ActivityLogPreviewProps> = ({
  data,
  filename,
  maxHeight = 300,
  onRefresh,
  onNoteClick,
  onProfileClick,
  getNoteTitle,
  getProfileData,
}) => {
  const [viewMode, setViewMode] = useState<'parsed' | 'raw'>('parsed');

  // Parse the content
  const { text, parseResult, filenameMetadata } = useMemo(() => {
    const decodedText = decodeText(data);
    const parsed = parseActivityLog(decodedText);
    const metadata = parseActivityLogFilename(filename);

    return {
      text: decodedText,
      parseResult: parsed,
      filenameMetadata: metadata,
    };
  }, [data, filename]);

  // If parsing failed, force raw view
  const effectiveViewMode = parseResult.success ? viewMode : 'raw';

  const handleViewModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: 'parsed' | 'raw' | null) => {
      if (newMode !== null) {
        setViewMode(newMode);
      }
    },
    []
  );

  const handleNoteClick = useCallback(
    (noteId: string) => {
      onNoteClick?.(noteId);
    },
    [onNoteClick]
  );

  const handleProfileClick = useCallback(
    (profileId: string) => {
      onProfileClick?.(profileId);
    },
    [onProfileClick]
  );

  // Row component for the list
  const EntryRow: React.FC<{ entry: ActivityLogEntry }> = ({ entry }) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 0.5,
        fontFamily: 'monospace',
        fontSize: '12px',
        borderBottom: '1px solid',
        borderColor: 'grey.800',
        '&:hover': {
          bgcolor: 'rgba(74, 144, 217, 0.1)',
        },
      }}
    >
      {/* Line number */}
      <Typography
        variant="caption"
        sx={{ color: 'grey.600', minWidth: 40, fontFamily: 'monospace' }}
      >
        {entry.lineNumber}
      </Typography>

      {/* Note ID - clickable with hover tooltip */}
      <HoverableId
        id={entry.noteId}
        color="#4A90D9"
        minWidth={200}
        fetchData={getNoteTitle}
        onClick={() => {
          handleNoteClick(entry.noteId);
        }}
        clickable={true}
        clickHint="Click to open note"
      />

      {/* Profile ID - clickable with hover tooltip */}
      <HoverableId
        id={entry.profileId}
        color="#50C878"
        minWidth={150}
        fetchData={getProfileData}
        onClick={() => {
          handleProfileClick(entry.profileId);
        }}
        clickable={!!onProfileClick}
        clickHint="Click to view profile file"
      />

      {/* Sequence Number */}
      <Typography
        variant="caption"
        sx={{
          color: '#FFA500',
          fontFamily: 'monospace',
        }}
      >
        seq:{entry.sequenceNumber}
      </Typography>
    </Box>
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        maxHeight,
        overflow: 'hidden',
        bgcolor: 'grey.900',
        display: 'flex',
        flexDirection: 'column',
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
          bgcolor: 'grey.900',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            Activity Log
          </Typography>
          {filenameMetadata && (
            <Typography variant="caption" sx={{ color: 'grey.500' }}>
              {filenameMetadata.profileId
                ? `(profile: ${filenameMetadata.profileId}, instance: ${filenameMetadata.instanceId})`
                : `(instance: ${filenameMetadata.instanceId})`}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Entry count */}
          <Typography variant="caption" sx={{ color: 'grey.500' }}>
            {parseResult.success
              ? `${parseResult.entries.length} entries`
              : `${data.length.toLocaleString()} bytes`}
          </Typography>

          {/* View mode toggle */}
          {parseResult.success && (
            <ToggleButtonGroup
              value={effectiveViewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
              sx={{ height: 24 }}
            >
              <ToggleButton value="parsed" sx={{ px: 1, py: 0 }}>
                <Tooltip title="Parsed view">
                  <TableChartIcon sx={{ fontSize: 16 }} />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="raw" sx={{ px: 1, py: 0 }}>
                <Tooltip title="Raw text">
                  <TextFieldsIcon sx={{ fontSize: 16 }} />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
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

      {/* Parse error message */}
      {!parseResult.success && (
        <Box sx={{ px: 2, py: 1, bgcolor: 'error.dark' }}>
          <Typography variant="caption" sx={{ color: 'error.contrastText' }}>
            Parse error: {parseResult.error} - showing raw view
          </Typography>
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', maxHeight: maxHeight - 60 }}>
        {effectiveViewMode === 'parsed' ? (
          <Box>
            {parseResult.entries.map((entry) => (
              <EntryRow key={entry.lineNumber} entry={entry} />
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              p: 2,
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'grey.300',
            }}
          >
            {text}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ActivityLogPreview;
