/**
 * SyncStatusIndicator Component
 *
 * A subtle indicator that shows when actual sync activity is happening.
 * Only displays when remote changes have been detected and are being loaded.
 * Does NOT show during routine polling or background checks.
 *
 * Features:
 * - Event-driven updates (reacts to sync:activeSyncsChanged)
 * - 1 second minimum display time to prevent flickering
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Tooltip, useTheme } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';

/** Minimum time to show the indicator (prevents flickering for fast syncs) */
const MIN_DISPLAY_TIME_MS = 1000;

export interface SyncStatusIndicatorProps {
  /** Optional: minimum display time in ms (default: 1000) */
  minDisplayTime?: number;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  minDisplayTime = MIN_DISPLAY_TIME_MS,
}) => {
  const theme = useTheme();
  const [activeSyncCount, setActiveSyncCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const mountedRef = useRef(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showStartTimeRef = useRef<number | null>(null);

  // Handle active syncs change
  const handleActiveSyncsChanged = useCallback(
    (activeSyncs: { sdId: string; noteId: string }[]) => {
      if (!mountedRef.current) return;

      const count = activeSyncs.length;
      setActiveSyncCount(count);

      if (count > 0) {
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }

        // Show immediately and record start time
        if (!visible) {
          showStartTimeRef.current = Date.now();
        }
        setVisible(true);
      } else {
        // When syncs finish, respect minimum display time
        const showStartTime = showStartTimeRef.current;
        if (showStartTime && visible) {
          const elapsedTime = Date.now() - showStartTime;
          const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

          if (remainingTime > 0) {
            // Schedule hide after remaining time
            hideTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setVisible(false);
                showStartTimeRef.current = null;
              }
            }, remainingTime);
          } else {
            // Minimum time already passed, hide immediately
            setVisible(false);
            showStartTimeRef.current = null;
          }
        }
      }
    },
    [visible, minDisplayTime]
  );

  useEffect(() => {
    mountedRef.current = true;

    // Get initial state
    void (async () => {
      try {
        const activeSyncs = await window.electronAPI.sync.getActiveSyncs();
        handleActiveSyncsChanged(activeSyncs);
      } catch (error) {
        console.error('[SyncStatusIndicator] Failed to get initial active syncs:', error);
      }
    })();

    // Subscribe to active syncs changes
    const unsubscribe = window.electronAPI.sync.onActiveSyncsChanged(handleActiveSyncsChanged);

    return () => {
      mountedRef.current = false;
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      unsubscribe();
    };
  }, [handleActiveSyncsChanged]);

  // Don't render anything if not visible
  if (!visible) {
    return null;
  }

  // Use the count from when we started showing, or current count
  const displayCount = activeSyncCount > 0 ? activeSyncCount : 1;
  const tooltipContent = `Syncing ${displayCount} note${displayCount > 1 ? 's' : ''}`;

  return (
    <Tooltip title={tooltipContent} placement="right">
      <Box
        data-testid="sync-status-indicator"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 0.75,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          cursor: 'default',
          opacity: 0.8,
          transition: 'opacity 0.2s',
          '&:hover': {
            opacity: 1,
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            animation: 'spin 1.5s linear infinite',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        >
          <SyncIcon
            sx={{
              fontSize: 14,
              color: theme.palette.text.secondary,
            }}
          />
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '0.7rem',
            userSelect: 'none',
          }}
        >
          Syncing {displayCount} note{displayCount > 1 ? 's' : ''}
        </Typography>
      </Box>
    </Tooltip>
  );
};
