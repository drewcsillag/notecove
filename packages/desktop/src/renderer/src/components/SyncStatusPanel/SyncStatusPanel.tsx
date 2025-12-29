/**
 * SyncStatusPanel Component
 *
 * A dialog that shows sync status information and allows exporting diagnostics.
 * This is a placeholder implementation - Phase 8 will redesign this to show
 * polling group status and pending sync items.
 */

import React, { useState, useCallback } from 'react';
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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

export interface SyncStatusPanelProps {
  open: boolean;
  onClose: () => void;
}

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({ open, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="sync-status-panel">
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">Sync Status</Typography>
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

        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Sync status monitoring will be available in a future update.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Use the SyncStatusIndicator in the status bar to see pending sync counts.
          </Typography>
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
