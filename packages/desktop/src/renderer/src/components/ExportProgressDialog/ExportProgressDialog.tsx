/**
 * Export Progress Dialog
 *
 * Shows progress when exporting notes to Markdown.
 * Displays current note being exported and overall progress.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Typography,
  Box,
  Button,
} from '@mui/material';

export interface ExportProgressDialogProps {
  open: boolean;
  current: number;
  total: number;
  currentNoteName: string;
  onCancel?: () => void;
}

export const ExportProgressDialog: React.FC<ExportProgressDialogProps> = ({
  open,
  current,
  total,
  currentNoteName,
  onCancel,
}) => {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>Exporting Notes to Markdown</DialogTitle>
      <DialogContent>
        <Box sx={{ width: '100%', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentNoteName || 'Preparing...'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2, flexShrink: 0 }}>
              {current} of {total}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      </DialogContent>
      {onCancel && (
        <DialogActions>
          <Button onClick={onCancel} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ExportProgressDialog;
