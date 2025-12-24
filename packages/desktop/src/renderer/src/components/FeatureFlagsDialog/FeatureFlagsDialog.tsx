/**
 * Feature Flags Dialog Component
 *
 * Modal dialog for managing feature flags.
 * Allows users to enable/disable experimental or optional features.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ScienceIcon from '@mui/icons-material/Science';

interface FeatureFlagInfo {
  flag: 'telemetry' | 'viewHistory' | 'webServer';
  enabled: boolean;
  metadata: {
    name: string;
    description: string;
    requiresRestart: boolean;
  };
}

export interface FeatureFlagsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const FeatureFlagsDialog: React.FC<FeatureFlagsDialogProps> = ({ open, onClose }) => {
  const [flags, setFlags] = useState<FeatureFlagInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load feature flags when dialog opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      void window.electronAPI.featureFlags
        .getAll()
        .then((allFlags) => {
          setFlags(allFlags);
          setLoading(false);
        })
        .catch((err: Error) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [open]);

  // Handle flag toggle
  const handleToggle = useCallback(async (flag: FeatureFlagInfo['flag'], enabled: boolean) => {
    try {
      const result = await window.electronAPI.featureFlags.set(flag, enabled);
      if (result.success) {
        // Update local state
        setFlags((prev) => prev.map((f) => (f.flag === flag ? { ...f, enabled } : f)));
        // Show restart notice if needed
        if (result.requiresRestart) {
          setPendingRestart(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature flag');
    }
  }, []);

  const handleClose = () => {
    setPendingRestart(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: 300,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScienceIcon color="primary" />
          <Typography variant="h6">Feature Flags</Typography>
        </Box>
        <IconButton aria-label="close" onClick={handleClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {pendingRestart && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Some changes require an app restart to take effect.
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enable or disable experimental and optional features. Some features may require an app
          restart to fully take effect.
        </Typography>

        {loading ? (
          <Typography color="text.secondary">Loading...</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {flags.map((flagInfo) => (
              <Paper
                key={flagInfo.flag}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ flex: 1, mr: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    {flagInfo.metadata.name}
                    {flagInfo.metadata.requiresRestart && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ ml: 1, color: 'text.secondary' }}
                      >
                        (restart required)
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {flagInfo.metadata.description}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={flagInfo.enabled}
                      onChange={(e) => void handleToggle(flagInfo.flag, e.target.checked)}
                      color="primary"
                    />
                  }
                  label=""
                  sx={{ m: 0 }}
                />
              </Paper>
            ))}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FeatureFlagsDialog;
