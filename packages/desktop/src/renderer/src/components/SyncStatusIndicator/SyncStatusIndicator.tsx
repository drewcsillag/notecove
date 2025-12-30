/**
 * SyncStatusIndicator Component
 *
 * A subtle indicator that shows when background sync is in progress.
 * Displays a small spinner and count when:
 * - Fast-path syncs are active (Tier 1)
 * - Polling group has pending entries (Tier 2)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Tooltip, useTheme } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';

interface CombinedSyncStatus {
  /** Fast path pending count */
  fastPathPending: number;
  /** Polling group entry count */
  pollingGroupCount: number;
  /** Whether any sync is actively in progress */
  isSyncing: boolean;
}

export interface SyncStatusIndicatorProps {
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  pollInterval = 2000,
}) => {
  const theme = useTheme();
  const [syncStatus, setSyncStatus] = useState<CombinedSyncStatus | null>(null);
  const mountedRef = useRef(true);

  // Poll for sync status
  const fetchStatus = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      // Get both fast-path status and polling group status
      const [fastPathStatus, pollingStatus] = await Promise.all([
        window.electronAPI.sync.getStatus(),
        window.electronAPI.polling.getGroupStatus(),
      ]);

      const combined: CombinedSyncStatus = {
        fastPathPending: fastPathStatus.pendingCount,
        pollingGroupCount: pollingStatus?.totalEntries ?? 0,
        isSyncing: fastPathStatus.isSyncing || (pollingStatus?.totalEntries ?? 0) > 0,
      };

      setSyncStatus(combined);
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
    const unsubscribe = window.electronAPI.sync.onStatusChanged(() => {
      void fetchStatus();
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

  // Calculate total and tooltip
  const totalCount = syncStatus.fastPathPending + syncStatus.pollingGroupCount;
  const tooltipLines: string[] = [];

  if (syncStatus.fastPathPending > 0) {
    tooltipLines.push(
      `${syncStatus.fastPathPending} note${syncStatus.fastPathPending > 1 ? 's' : ''} syncing (fast)`
    );
  }

  if (syncStatus.pollingGroupCount > 0) {
    tooltipLines.push(
      `${syncStatus.pollingGroupCount} note${syncStatus.pollingGroupCount > 1 ? 's' : ''} being polled`
    );
  }

  const tooltipContent = tooltipLines.join('\n') || 'Syncing...';

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
          Syncing {totalCount} note{totalCount > 1 ? 's' : ''}
        </Typography>
      </Box>
    </Tooltip>
  );
};
