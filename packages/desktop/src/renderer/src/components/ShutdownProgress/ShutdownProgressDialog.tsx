/**
 * Shutdown Progress Dialog
 *
 * Shows progress when the app is shutting down and saving snapshots.
 * Displayed when >5 notes need to be saved.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress,
  Typography,
  Box,
} from '@mui/material';

export interface ShutdownProgressDialogProps {
  open: boolean;
  current: number;
  total: number;
}

export const ShutdownProgressDialog: React.FC<ShutdownProgressDialogProps> = ({
  open,
  current,
  total,
}) => {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>Saving Your Work</DialogTitle>
      <DialogContent>
        <Box sx={{ width: '100%', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              Creating snapshots for modified notes...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              {current} of {total}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Please wait while NoteCove saves your changes.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
