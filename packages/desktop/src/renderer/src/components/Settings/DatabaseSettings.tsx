/**
 * Database Settings Component
 *
 * Allows users to view and configure the database path.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import WarningIcon from '@mui/icons-material/Warning';

export function DatabaseSettings(): React.ReactElement {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [newPath, setNewPath] = useState<string>('');

  // Load current database path on mount
  useEffect(() => {
    const loadPath = async () => {
      try {
        setLoading(true);
        const path = await window.electronAPI.config.getDatabasePath();
        setCurrentPath(path);
      } catch (error) {
        console.error('Failed to load database path:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadPath();
  }, []);

  const handleBrowse = async () => {
    try {
      // Open file picker with current directory as default
      const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
      const selectedPath = await window.electronAPI.sd.selectPath(dir);

      if (selectedPath) {
        // Append notecove.db if user selected a directory
        const fullPath = selectedPath.endsWith('.db')
          ? selectedPath
          : `${selectedPath}/notecove.db`;
        setNewPath(fullPath);
        setConfirmDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to browse for database path:', error);
    }
  };

  const handleConfirmChange = async () => {
    try {
      await window.electronAPI.config.setDatabasePath(newPath);
      setCurrentPath(newPath);
      setConfirmDialogOpen(false);
      setNewPath('');
    } catch (error) {
      console.error('Failed to set database path:', error);
    }
  };

  const handleCancelChange = () => {
    setConfirmDialogOpen(false);
    setNewPath('');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Database Location
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        The database stores all your notes metadata, folders, and settings.
      </Alert>

      <TextField
        fullWidth
        label="Current Database Path"
        value={currentPath}
        InputProps={{
          readOnly: true,
        }}
        sx={{ mb: 2 }}
      />

      <Button
        variant="outlined"
        startIcon={<FolderOpenIcon />}
        onClick={() => {
          void handleBrowse();
        }}
      >
        Change Location
      </Button>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={handleCancelChange}>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            Change Database Location
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Important:</strong> Changing the database location requires restarting the
            application. The app will close after saving this change.
          </Alert>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            Current location:
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace' }}>
            {currentPath}
          </Typography>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            New location:
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {newPath}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelChange}>Cancel</Button>
          <Button
            onClick={() => {
              void handleConfirmChange();
            }}
            variant="contained"
            color="primary"
          >
            Save and Restart
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
