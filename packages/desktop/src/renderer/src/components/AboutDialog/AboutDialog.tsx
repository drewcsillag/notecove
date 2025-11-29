/**
 * About Dialog Component
 *
 * Displays application information including:
 * - App name and version
 * - Development build indicator (if applicable)
 * - Profile name and ID
 * - Copyright notice
 * - License information with link
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Link,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AppInfo {
  version: string;
  isDevBuild: boolean;
  profileId: string | null;
  profileName: string | null;
}

export interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ open, onClose }) => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // Load app info when dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }

    const loadAppInfo = async (): Promise<void> => {
      setLoading(true);
      try {
        const info = await window.electronAPI.app.getInfo();
        setAppInfo(info);
      } catch (err) {
        console.error('[AboutDialog] Failed to load app info:', err);
      } finally {
        setLoading(false);
      }
    };

    void loadAppInfo();
  }, [open]);

  const handleLicenseClick = (): void => {
    void window.electronAPI.shell.openExternal('https://www.apache.org/licenses/LICENSE-2.0');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        About
        <IconButton aria-label="close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
              NoteCove
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              Version {appInfo?.version ?? '...'}
            </Typography>

            {appInfo?.isDevBuild && (
              <Typography
                variant="body2"
                sx={{
                  mb: 2,
                  color: 'warning.main',
                  fontWeight: 'medium',
                }}
              >
                Development Build
              </Typography>
            )}

            {appInfo?.profileName && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Profile: {appInfo.profileName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ fontFamily: 'monospace' }}
                >
                  {appInfo.profileId}
                </Typography>
              </Box>
            )}

            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                © 2025 Drew Csillag
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Licensed under{' '}
                <Link
                  component="button"
                  variant="body2"
                  onClick={handleLicenseClick}
                  sx={{ cursor: 'pointer' }}
                >
                  Apache 2.0
                </Link>
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
