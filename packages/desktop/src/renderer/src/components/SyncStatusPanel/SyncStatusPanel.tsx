/**
 * SyncStatusPanel Component
 *
 * A dialog that shows polling group status and sync diagnostics.
 * Displays:
 * - Summary of polling activity (rate, hits/misses, next full repoll)
 * - Table of notes currently in the polling group
 * - Export diagnostics functionality
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tooltip,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { PollingGroupStatus, PollingGroupEntrySerialized } from '@notecove/shared';
import type { ActiveSyncEntry } from '../../../../main/ipc/handlers/types';

export interface SyncStatusPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Format a reason code as a human-readable label
 */
function formatReason(reason: string): {
  label: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
} {
  switch (reason) {
    case 'fast-path-handoff':
      return { label: 'Sync Pending', color: 'warning' };
    case 'open-note':
      return { label: 'Open', color: 'primary' };
    case 'notes-list':
      return { label: 'Visible', color: 'info' };
    case 'recent-edit':
      return { label: 'Recently Edited', color: 'success' };
    case 'full-repoll':
      return { label: 'Full Repoll', color: 'secondary' };
    default:
      return { label: reason, color: 'secondary' };
  }
}

/**
 * Format time ago
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

/**
 * Format time remaining
 */
function formatTimeRemaining(ms: number | null): string {
  if (ms === null) return 'Disabled';
  if (ms <= 0) return 'Now';

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  }
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({ open, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<PollingGroupStatus | null>(null);
  const [activeSyncs, setActiveSyncs] = useState<ActiveSyncEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch polling group status and active syncs
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [pollingStatus, activeStatus] = await Promise.all([
        window.electronAPI.polling.getGroupStatus(),
        window.electronAPI.sync.getActiveSyncs(),
      ]);
      setStatus(pollingStatus);
      setActiveSyncs(activeStatus);
      setError(null);
    } catch (err) {
      console.error('[SyncStatusPanel] Failed to get polling status:', err);
      setError('Failed to get sync status');
    }
    setLoading(false);
  }, []);

  // Set up polling and event listener when dialog is open
  useEffect(() => {
    if (open) {
      void fetchStatus();

      // Poll every 2 seconds while dialog is open
      pollIntervalRef.current = setInterval(() => {
        void fetchStatus();
      }, 2000);

      // Also listen for active syncs changes
      const unsubscribe = window.electronAPI.sync.onActiveSyncsChanged((syncs) => {
        setActiveSyncs(syncs);
      });

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        unsubscribe();
      };
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [open, fetchStatus]);

  // Handle export diagnostics
  const handleExportDiagnostics = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const result = await window.electronAPI.sync.exportDiagnostics();
      if (!result.success && result.error !== 'Export cancelled') {
        setError(result.error ?? 'Failed to export diagnostics');
      }
    } catch (err) {
      console.error('[SyncStatusPanel] Failed to export diagnostics:', err);
      setError('Failed to export diagnostics');
    } finally {
      setExporting(false);
    }
  }, []);

  // Truncate note ID for display
  const truncateId = (id: string): string => {
    if (id.length <= 12) return id;
    return `${id.substring(0, 6)}...${id.substring(id.length - 4)}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth data-testid="sync-status-panel">
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">Sync Status</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => void fetchStatus()} size="small" disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => {
              setError(null);
            }}
          >
            {error}
          </Alert>
        )}

        {/* Active Syncs Section */}
        {activeSyncs.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Active Syncs
              <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                ({activeSyncs.length} {activeSyncs.length === 1 ? 'note' : 'notes'})
              </Typography>
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: 'action.hover',
                borderColor: 'primary.main',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">
                  Syncing changes from other devices...
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {activeSyncs.map((sync) => (
                  <Tooltip key={`${sync.sdId}-${sync.noteId}`} title={sync.noteId}>
                    <Chip
                      label={truncateId(sync.noteId)}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Paper>
          </Box>
        )}

        {/* Summary Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Polling Summary
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 2,
            }}
          >
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Notes Polling
              </Typography>
              <Typography variant="h6">{status?.totalEntries ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary">
                {status?.highPriorityCount ?? 0} high / {status?.normalPriorityCount ?? 0} normal
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Rate (last min)
              </Typography>
              <Typography variant="h6">
                {status?.currentRatePerMinute.toFixed(1) ?? '0'}/min
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {status?.recentHits ?? 0} hits / {status?.recentMisses ?? 0} misses
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Next Full Repoll
              </Typography>
              <Typography variant="h6">
                {formatTimeRemaining(status?.nextFullRepollIn ?? null)}
              </Typography>
            </Paper>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Polling Group Table */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Polling Group
            {status && status.entries.length > 0 && (
              <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                ({status.entries.length} {status.entries.length === 1 ? 'note' : 'notes'})
              </Typography>
            )}
          </Typography>

          {!status || status.entries.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: 'center',
                color: 'text.secondary',
              }}
            >
              <Typography>No notes currently being polled</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Notes are added when they need sync verification or are actively being used.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Note ID</TableCell>
                    <TableCell>SD</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Added</TableCell>
                    <TableCell>Last Polled</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {status.entries.map((entry: PollingGroupEntrySerialized) => {
                    const reasonInfo = formatReason(entry.reason);
                    return (
                      <TableRow key={`${entry.sdId}-${entry.noteId}`}>
                        <TableCell>
                          <Tooltip title={entry.noteId}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {truncateId(entry.noteId)}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={entry.sdId}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {truncateId(entry.sdId)}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={reasonInfo.label}
                            color={reasonInfo.color}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={entry.priority}
                            color={entry.priority === 'high' ? 'primary' : 'default'}
                            size="small"
                            variant={entry.priority === 'high' ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatTimeAgo(entry.addedAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {entry.lastPolledAt > 0 ? formatTimeAgo(entry.lastPolledAt) : 'never'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          startIcon={exporting ? <CircularProgress size={16} /> : <FileDownloadIcon />}
          onClick={() => void handleExportDiagnostics()}
          disabled={exporting}
        >
          Export Diagnostics
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
