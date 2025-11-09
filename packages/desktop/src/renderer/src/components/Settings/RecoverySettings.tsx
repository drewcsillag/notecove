/**
 * Recovery Settings Component
 *
 * Displays stuck move operations and provides recovery tools
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Alert,
  AlertTitle,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface StaleMove {
  id: string;
  noteId: string;
  sourceSdUuid: string;
  targetSdUuid: string;
  targetFolderId: string | null;
  state: string;
  initiatedBy: string;
  initiatedAt: number;
  lastModified: number;
  sourceSdPath: string;
  targetSdPath: string;
  error: string | null;
}

interface TakeoverDialogData {
  open: boolean;
  move: StaleMove | null;
}

export const RecoverySettings: React.FC = () => {
  const [staleMoves, setStaleMoves] = useState<StaleMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [takeoverDialog, setTakeoverDialog] = useState<TakeoverDialogData>({
    open: false,
    move: null,
  });
  const [processing, setProcessing] = useState(false);

  const loadStaleMoves = async () => {
    try {
      setLoading(true);
      setError(null);
      const moves = await window.electronAPI.recovery.getStaleMoves();
      setStaleMoves(moves);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stuck operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStaleMoves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatAge = (timestamp: number): string => {
    const ageMs = Date.now() - timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);

    if (ageDays > 0) {
      return `${ageDays}d ${ageHours % 24}h ago`;
    } else if (ageHours > 0) {
      return `${ageHours}h ${ageMinutes % 60}m ago`;
    } else {
      return `${ageMinutes}m ago`;
    }
  };

  const handleTakeOver = (move: StaleMove) => {
    setTakeoverDialog({ open: true, move });
  };

  const handleConfirmTakeOver = async () => {
    if (!takeoverDialog.move) return;

    setProcessing(true);
    try {
      const result = await window.electronAPI.recovery.takeOverMove(takeoverDialog.move.id);
      if (result.success) {
        await loadStaleMoves();
        setTakeoverDialog({ open: false, move: null });
      } else {
        setError(`Failed to take over move: ${result.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take over move');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async (moveId: string) => {
    setProcessing(true);
    try {
      const result = await window.electronAPI.recovery.cancelMove(moveId);
      if (result.success) {
        await loadStaleMoves();
      } else {
        setError(`Failed to cancel move: ${result.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel move');
    } finally {
      setProcessing(false);
    }
  };

  const renderDiagnosticSummary = () => {
    if (loading) {
      return (
        <Box display="flex" alignItems="center" gap={1} mb={3}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading diagnostic information...</Typography>
        </Box>
      );
    }

    if (staleMoves.length === 0) {
      return (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          <AlertTitle>No Issues Detected</AlertTitle>
          All move operations are completing normally.
        </Alert>
      );
    }

    return (
      <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
        <AlertTitle>Stuck Operations Detected</AlertTitle>
        Found {staleMoves.length} incomplete move operation{staleMoves.length > 1 ? 's' : ''} that{' '}
        {staleMoves.length > 1 ? 'have' : 'has'} been stalled for more than 5 minutes.
      </Alert>
    );
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Recovery & Diagnostics
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Monitor and recover from stuck operations. If a move operation was interrupted (e.g., app
        crash), you can take over and complete it or cancel it.
      </Typography>

      {renderDiagnosticSummary()}

      {error && (
        <Alert
          severity="error"
          onClose={() => {
            setError(null);
          }}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {!loading && staleMoves.length > 0 && (
        <>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Stuck Operations
          </Typography>
          <List>
            {staleMoves.map((move) => (
              <ListItem
                key={move.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">Note: {move.noteId}</Typography>
                      <Chip label={move.state} size="small" color="warning" />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" display="block">
                        Instance: {move.initiatedBy}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Age: {formatAge(move.lastModified)}
                      </Typography>
                      {move.error && (
                        <Typography variant="caption" display="block" color="error">
                          Error: {move.error}
                        </Typography>
                      )}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        handleTakeOver(move);
                      }}
                      disabled={processing}
                    >
                      Take Over
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        void handleCancel(move.id);
                      }}
                      disabled={processing}
                    >
                      Cancel
                    </Button>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Button
          variant="outlined"
          onClick={() => {
            void loadStaleMoves();
          }}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Takeover Confirmation Dialog */}
      <Dialog
        open={takeoverDialog.open}
        onClose={() => {
          if (!processing) {
            setTakeoverDialog({ open: false, move: null });
          }
        }}
      >
        <DialogTitle>Take Over Move Operation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to take over this move operation from another instance?
          </DialogContentText>
          {takeoverDialog.move && (
            <Box mt={2}>
              <Typography variant="body2" gutterBottom>
                <strong>Note ID:</strong> {takeoverDialog.move.noteId}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>State:</strong> {takeoverDialog.move.state}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Original Instance:</strong> {takeoverDialog.move.initiatedBy}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Age:</strong> {formatAge(takeoverDialog.move.lastModified)}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will claim ownership of the move and attempt to complete it. Only do this if
            you&apos;re sure the original instance is no longer running.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTakeoverDialog({ open: false, move: null });
            }}
            disabled={processing}
          >
            Back
          </Button>
          <Button
            onClick={() => {
              void handleConfirmTakeOver();
            }}
            variant="contained"
            color="primary"
            disabled={processing}
          >
            {processing ? <CircularProgress size={20} /> : 'Complete Move'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
