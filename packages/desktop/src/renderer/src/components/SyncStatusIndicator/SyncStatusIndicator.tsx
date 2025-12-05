/**
 * SyncStatusIndicator Component
 *
 * A subtle indicator that shows when background sync is in progress.
 * Displays a small spinner and pending count when syncs are active.
 *
 * @see plans/stale-sync-ux/PLAN.md - Step 2
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Tooltip, useTheme } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';

interface SyncStatus {
  pendingCount: number;
  perSd: {
    sdId: string;
    sdName: string;
    pendingCount: number;
    pendingNoteIds: string[];
  }[];
  isSyncing: boolean;
}

export interface SyncStatusIndicatorProps {
  /** Polling interval in milliseconds (default: 1000) */
  pollInterval?: number;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  pollInterval = 1000,
}) => {
  const theme = useTheme();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const mountedRef = useRef(true);

  // Poll for sync status
  const fetchStatus = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const status = await window.electronAPI.sync.getStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('[SyncStatusIndicator] Failed to get sync status:', error);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    void fetchStatus();

    // Set up polling interval
    const intervalId = setInterval(() => {
      void fetchStatus();
    }, pollInterval);

    // Also listen for sync status change events
    const unsubscribe = window.electronAPI.sync.onStatusChanged((status) => {
      if (mountedRef.current) {
        setSyncStatus(status);
      }
    });

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [fetchStatus, pollInterval]);

  // Don't render anything if no sync is in progress
  if (!syncStatus?.isSyncing) {
    return null;
  }

  const tooltipContent = syncStatus.perSd
    .filter((sd) => sd.pendingCount > 0)
    .map((sd) => `${sd.sdName}: ${sd.pendingCount} note${sd.pendingCount > 1 ? 's' : ''} syncing`)
    .join('\n');

  return (
    <Tooltip title={tooltipContent || 'Syncing...'} placement="right">
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
          Syncing {syncStatus.pendingCount} note{syncStatus.pendingCount > 1 ? 's' : ''}
        </Typography>
      </Box>
    </Tooltip>
  );
};
