/**
 * SyncStatusPanel Component
 *
 * A dialog that shows detailed sync status information and allows
 * users to take action on stale sync entries (skip or retry).
 *
 * @see plans/stale-sync-ux/PLAN.md - Steps 10-12
 * @see plans/stale-sync-ux/STALE-SYNC-UI.md
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ReplayIcon from '@mui/icons-material/Replay';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

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

export interface SyncStatusPanelProps {
  open: boolean;
  onClose: () => void;
}

// Skip confirmation dialog
interface SkipConfirmDialogProps {
  open: boolean;
  entry: StaleSyncEntry | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const SkipConfirmDialog: React.FC<SkipConfirmDialogProps> = ({
  open,
  entry,
  onConfirm,
  onCancel,
}) => {
  if (!entry) return null;

  const sourceName = entry.sourceProfile
    ? `@${entry.sourceProfile.profileName}'s ${entry.sourceProfile.hostname.replace('.local', '')}`
    : entry.sourceInstanceId.substring(0, 8) + '...';

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        Skip sync for &ldquo;{entry.noteTitle ?? 'Unknown Note'}&rdquo;?
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" paragraph>
          This note is waiting for {entry.gap} updates from {sourceName} that may never arrive.
        </Typography>
        <Typography variant="body2" paragraph>
          Skipping will:
        </Typography>
        <Box component="ul" sx={{ pl: 2, mb: 2 }}>
          <Typography component="li" variant="body2">
            Use the data currently available (may be incomplete)
          </Typography>
          <Typography component="li" variant="body2">
            Stop waiting for the missing updates
          </Typography>
          <Typography component="li" variant="body2" color="error">
            Cannot be undone
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} color="warning" variant="contained">
          Skip and Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({ open, onClose }) => {
  const [staleEntries, setStaleEntries] = useState<StaleSyncEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [skipConfirmEntry, setSkipConfirmEntry] = useState<StaleSyncEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const mountedRef = useRef(true);

  // Fetch stale entries
  const fetchEntries = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);
    try {
      const entries = await window.electronAPI.sync.getStaleSyncs();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (mountedRef.current) {
        setStaleEntries(entries);
      }
    } catch (err) {
      console.error('[SyncStatusPanel] Failed to get stale syncs:', err);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (mountedRef.current) {
        setError('Failed to load sync status');
      }
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch and set up polling
  useEffect(() => {
    mountedRef.current = true;

    if (open) {
      void fetchEntries();

      // Poll every 2 seconds while open
      const intervalId = setInterval(() => {
        void fetchEntries();
      }, 2000);

      return () => {
        clearInterval(intervalId);
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [open, fetchEntries]);

  // Handle skip action
  const handleSkip = useCallback((entry: StaleSyncEntry) => {
    setSkipConfirmEntry(entry);
  }, []);

  const handleSkipConfirm = useCallback(async () => {
    if (!skipConfirmEntry) return;

    const entryKey = `${skipConfirmEntry.sdId}:${skipConfirmEntry.noteId}:${skipConfirmEntry.sourceInstanceId}`;
    setActionInProgress(entryKey);
    setSkipConfirmEntry(null);

    try {
      const result = await window.electronAPI.sync.skipStaleEntry(
        skipConfirmEntry.sdId,
        skipConfirmEntry.noteId,
        skipConfirmEntry.sourceInstanceId
      );
      if (!result.success) {
        setError(result.error ?? 'Failed to skip entry');
      } else {
        // Refresh the list
        await fetchEntries();
      }
    } catch (err) {
      console.error('[SyncStatusPanel] Failed to skip entry:', err);
      setError('Failed to skip entry');
    } finally {
      setActionInProgress(null);
    }
  }, [skipConfirmEntry, fetchEntries]);

  const handleSkipCancel = useCallback(() => {
    setSkipConfirmEntry(null);
  }, []);

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

  // Handle retry action
  const handleRetry = useCallback(
    async (entry: StaleSyncEntry) => {
      const entryKey = `${entry.sdId}:${entry.noteId}:${entry.sourceInstanceId}`;
      setActionInProgress(entryKey);

      try {
        const result = await window.electronAPI.sync.retryStaleEntry(
          entry.sdId,
          entry.noteId,
          entry.sourceInstanceId
        );
        if (!result.success) {
          setError(result.error ?? 'Failed to retry entry');
        } else {
          // Refresh the list
          await fetchEntries();
        }
      } catch (err) {
        console.error('[SyncStatusPanel] Failed to retry entry:', err);
        setError('Failed to retry entry');
      } finally {
        setActionInProgress(null);
      }
    },
    [fetchEntries]
  );

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  };

  // Format source name
  const formatSourceName = (entry: StaleSyncEntry): string => {
    if (entry.sourceProfile) {
      const { profileName, hostname } = entry.sourceProfile;
      return `@${profileName}'s ${hostname.replace('.local', '')}`;
    }
    return entry.sourceInstanceId.substring(0, 8) + '...';
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth data-testid="sync-status-panel">
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Sync Status</Typography>
            <IconButton
              size="small"
              onClick={() => {
                void fetchEntries();
              }}
              disabled={loading}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
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

          {loading && staleEntries.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : staleEntries.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No pending syncs. All notes are up to date.
              </Typography>
            </Box>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {staleEntries.length} note{staleEntries.length !== 1 ? 's' : ''} waiting for sync
              </Alert>

              {staleEntries.some((e) => !e.noteTitle) && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <strong>Unknown Note</strong> means the note is still being synced and hasn&apos;t
                  fully loaded yet. The title will appear once sync completes.
                </Alert>
              )}

              {staleEntries.some((e) => !e.sourceProfile) && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <strong>Unrecognized source</strong> (showing device ID) means the source device
                  hasn&apos;t shared its profile information yet. This is normal for first-time
                  syncs.
                </Alert>
              )}

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Note</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>Detected</TableCell>
                      <TableCell align="right">Gap</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staleEntries.map((entry) => {
                      const entryKey = `${entry.sdId}:${entry.noteId}:${entry.sourceInstanceId}`;
                      const isProcessing = actionInProgress === entryKey;

                      return (
                        <TableRow key={entryKey}>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {entry.noteTitle ?? 'Unknown Note'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {entry.noteId.substring(0, 8)}...
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatSourceName(entry)}</Typography>
                            {entry.sourceProfile && (
                              <Typography variant="caption" color="text.secondary">
                                Last seen: {formatRelativeTime(entry.sourceProfile.lastSeen)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatRelativeTime(entry.detectedAt)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="warning.main">
                              {entry.gap}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <Tooltip title="Skip (accept data loss)">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      handleSkip(entry);
                                    }}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <CircularProgress size={18} />
                                    ) : (
                                      <SkipNextIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Retry sync">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      void handleRetry(entry);
                                    }}
                                    disabled={isProcessing}
                                  >
                                    <ReplayIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
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

      <SkipConfirmDialog
        open={skipConfirmEntry !== null}
        entry={skipConfirmEntry}
        onConfirm={() => void handleSkipConfirm()}
        onCancel={handleSkipCancel}
      />
    </>
  );
};
