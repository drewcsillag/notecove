/**
 * Cross-SD Confirmation Dialog
 *
 * Shows confirmation when user drags notes between different Storage Directories.
 * Phase 2.5.7.4: Cross-SD Drag & Drop
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from '@mui/material';

interface CrossSDConfirmDialogProps {
  open: boolean;
  noteCount: number;
  sourceSdName: string;
  targetSdName: string;
  targetFolderName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CrossSDConfirmDialog: React.FC<CrossSDConfirmDialogProps> = ({
  open,
  noteCount,
  sourceSdName,
  targetSdName,
  targetFolderName,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        Move {noteCount === 1 ? 'Note' : `${noteCount} Notes`} to Different Storage Directory?
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          You are about to move {noteCount === 1 ? 'a note' : `${noteCount} notes`} from{' '}
          <strong>{sourceSdName}</strong> to <strong>{targetSdName}</strong>
          {targetFolderName && (
            <>
              {' '}
              in folder <strong>{targetFolderName}</strong>
            </>
          )}
          .
        </Typography>

        <Alert severity="info" sx={{ mt: 2 }}>
          The {noteCount === 1 ? 'note' : 'notes'} will be copied to the target Storage Directory
          and moved to Recently Deleted in the source directory.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          Move
        </Button>
      </DialogActions>
    </Dialog>
  );
};
