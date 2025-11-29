/**
 * Reindex Notes Progress Dialog
 *
 * Shows progress when notes are being reindexed for full-text search.
 * Displays current note count, progress bar, and completion status.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress,
  Typography,
  Box,
  Alert,
} from '@mui/material';

export interface ReindexProgressDialogProps {
  open: boolean;
  current: number;
  total: number;
  error?: string;
}

export const ReindexProgressDialog: React.FC<ReindexProgressDialogProps> = ({
  open,
  current,
  total,
  error,
}) => {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>Reindexing Notes</DialogTitle>
      <DialogContent>
        <Box sx={{ width: '100%', mb: 2 }}>
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  Rebuilding search index...
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {current} of {total} notes
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} />
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
