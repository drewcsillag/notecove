/**
 * StaleSyncToast Component
 *
 * A toast notification that appears when stale sync entries are detected.
 * Shows which device/profile has pending syncs that may never arrive.
 *
 * @see plans/stale-sync-ux/PLAN.md - Step 9
 * @see plans/stale-sync-ux/STALE-SYNC-UI.md
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, IconButton, Button, useTheme, Slide } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

interface StaleSyncEntry {
  sdId: string;
  sdName: string;
  noteId: string;
  noteTitle?: string;
  sourceInstanceId: string;
  expectedSequence: number;
  highestSequenceFromInstance: number;
  gap: number;
  detectedAt: number;
  sourceProfile?: {
    profileId: string;
    profileName: string;
    hostname: string;
    lastSeen: number;
  };
}

export interface StaleSyncToastProps {
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Auto-dismiss timeout in milliseconds (default: 30000) */
  autoDismissTimeout?: number;
  /** Callback when "View Details" is clicked */
  onViewDetails?: () => void;
}

export const StaleSyncToast: React.FC<StaleSyncToastProps> = ({
  pollInterval = 2000,
  autoDismissTimeout = 30000,
  onViewDetails,
}) => {
  const theme = useTheme();
  const [staleEntries, setStaleEntries] = useState<StaleSyncEntry[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const mountedRef = useRef(true);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastEntriesCountRef = useRef(0);

  // Fetch stale sync entries
  const fetchStaleEntries = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const entries = await window.electronAPI.sync.getStaleSyncs();
      setStaleEntries(entries);

      // If entries resolved (went from >0 to 0), start auto-dismiss timer
      if (lastEntriesCountRef.current > 0 && entries.length === 0) {
        if (autoDismissTimerRef.current) {
          clearTimeout(autoDismissTimerRef.current);
        }
        autoDismissTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setVisible(false);
          }
        }, autoDismissTimeout);
      }

      // If new entries appeared, show toast and reset dismissed state
      if (entries.length > 0 && lastEntriesCountRef.current === 0) {
        setDismissed(false);
        setVisible(true);
        if (autoDismissTimerRef.current) {
          clearTimeout(autoDismissTimerRef.current);
          autoDismissTimerRef.current = null;
        }
      }

      lastEntriesCountRef.current = entries.length;
    } catch (error) {
      console.error('[StaleSyncToast] Failed to get stale syncs:', error);
    }
  }, [autoDismissTimeout]);

  // Set up polling and event listeners
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    void fetchStaleEntries();

    // Set up polling interval
    const intervalId = setInterval(() => {
      void fetchStaleEntries();
    }, pollInterval);

    // Also listen for stale entries change events
    const unsubscribe = window.electronAPI.sync.onStaleEntriesChanged((entries) => {
      if (mountedRef.current) {
        setStaleEntries(entries);

        // Show toast if there are entries and not dismissed
        if (entries.length > 0) {
          setDismissed(false);
          setVisible(true);
        }
      }
    });

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      unsubscribe();
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, [fetchStaleEntries, pollInterval]);

  // Update visibility based on entries and dismissed state
  useEffect(() => {
    if (staleEntries.length > 0 && !dismissed) {
      setVisible(true);
    } else if (dismissed) {
      setVisible(false);
    }
  }, [staleEntries.length, dismissed]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
  }, []);

  const handleViewDetails = useCallback(() => {
    // Open sync status window via IPC
    void window.electronAPI.sync.openWindow();
    // Also call the legacy callback if provided (for backwards compatibility)
    if (onViewDetails) {
      onViewDetails();
    }
  }, [onViewDetails]);

  // Don't render anything if no entries or dismissed
  if (!visible || staleEntries.length === 0) {
    return null;
  }

  // Group entries by source profile/instance
  const groupedBySource = staleEntries.reduce<
    Record<
      string,
      {
        sourceProfile?: StaleSyncEntry['sourceProfile'];
        sourceInstanceId: string;
        noteCount: number;
      }
    >
  >((acc, entry) => {
    const key = entry.sourceProfile
      ? `${entry.sourceProfile.profileName}|${entry.sourceProfile.hostname}`
      : entry.sourceInstanceId;

    acc[key] ??= {
      sourceProfile: entry.sourceProfile,
      sourceInstanceId: entry.sourceInstanceId,
      noteCount: 0,
    };
    acc[key].noteCount++;
    return acc;
  }, {});

  // Get the first source for display (most common case is single source)
  const sources = Object.values(groupedBySource);
  const totalNotes = staleEntries.length;
  const primarySource = sources[0];

  // Should not happen since we check staleEntries.length > 0 above
  if (!primarySource) {
    return null;
  }

  // Format source name
  const getSourceName = (source: NonNullable<typeof primarySource>): string => {
    if (source.sourceProfile) {
      const { profileName, hostname } = source.sourceProfile;
      // Use @user format if available, otherwise just hostname
      return `@${profileName}'s ${hostname.replace('.local', '')}`;
    }
    // Fallback to truncated instance ID
    return source.sourceInstanceId.substring(0, 8) + '...';
  };

  const sourceName = getSourceName(primarySource);
  const otherSourcesCount = sources.length - 1;

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Box
        data-testid="stale-sync-toast"
        sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: theme.zIndex.snackbar,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: theme.palette.mode === 'dark' ? '#3d3d3d' : '#424242',
          color: '#fff',
          boxShadow: theme.shadows[8],
          minWidth: 300,
          maxWidth: 500,
        }}
      >
        <HourglassEmptyIcon sx={{ fontSize: 20, color: '#ffb74d' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Waiting for sync from {sourceName}
            {otherSourcesCount > 0 && ` +${otherSourcesCount} more`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {totalNotes} note{totalNotes !== 1 ? 's' : ''} pending
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={handleViewDetails}
          sx={{
            color: '#90caf9',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: 'rgba(144, 202, 249, 0.1)',
            },
          }}
        >
          View Details
        </Button>
        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{
            color: 'rgba(255,255,255,0.7)',
            '&:hover': {
              color: '#fff',
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
          aria-label="Dismiss"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Slide>
  );
};
