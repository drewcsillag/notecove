/**
 * Storage Directory Initialization Progress Dialog
 *
 * Shows progress when a new Storage Directory is being initialized.
 * Displays current step, progress bar, and status message.
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

export interface SDInitProgressDialogProps {
  open: boolean;
  step: number;
  total: number;
  message: string;
  error?: string;
}

export const SDInitProgressDialog: React.FC<SDInitProgressDialogProps> = ({
  open,
  step,
  total,
  message,
  error,
}) => {
  const progress = total > 0 ? (step / total) * 100 : 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>Initializing Storage Directory</DialogTitle>
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
                  {message}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  Step {step} of {total}
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
