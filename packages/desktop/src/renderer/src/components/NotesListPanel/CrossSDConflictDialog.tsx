/**
 * Cross-SD Conflict Resolution Dialog
 *
 * Shows when a note being moved to another SD already exists there (usually because
 * the user previously moved and recovered it).
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
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';

interface CrossSDConflictDialogProps {
  open: boolean;
  noteTitle: string;
  targetSdName: string;
  onResolve: (resolution: 'replace' | 'keepBoth' | 'cancel') => void | Promise<void>;
}

export const CrossSDConflictDialog: React.FC<CrossSDConflictDialogProps> = ({
  open,
  noteTitle,
  targetSdName,
  onResolve,
}) => {
  const [resolution, setResolution] = React.useState<'replace' | 'keepBoth'>('replace');

  return (
    <Dialog
      open={open}
      onClose={() => {
        void onResolve('cancel');
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Note Already Exists in Target Storage Directory</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          A note with this ID already exists in <strong>{targetSdName}</strong>
        </Alert>

        <Typography variant="body1" gutterBottom>
          Note: <strong>{noteTitle}</strong>
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
          This can happen if you previously moved and recovered this note. Choose how to proceed:
        </Typography>

        <RadioGroup
          value={resolution}
          onChange={(e) => {
            setResolution(e.target.value as 'replace' | 'keepBoth');
          }}
        >
          <FormControlLabel
            value="replace"
            control={<Radio />}
            label={
              <div>
                <Typography variant="body1">Replace</Typography>
                <Typography variant="caption" color="text.secondary">
                  Delete the existing note and use this one
                </Typography>
              </div>
            }
          />
          <FormControlLabel
            value="keepBoth"
            control={<Radio />}
            label={
              <div>
                <Typography variant="body1">Keep Both</Typography>
                <Typography variant="caption" color="text.secondary">
                  Create a new note with a different ID
                </Typography>
              </div>
            }
          />
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            void onResolve('cancel');
          }}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            void onResolve(resolution);
          }}
          variant="contained"
          color="primary"
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};
