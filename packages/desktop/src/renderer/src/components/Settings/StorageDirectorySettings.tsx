/**
 * Storage Directory Settings Component
 *
 * Manages Storage Directories (SDs):
 * - List all configured SDs
 * - Add new SD
 * - Remove SD (with confirmation)
 * - Set active SD
 * - Display active indicator
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  ButtonGroup,
  Menu,
  MenuItem,
  Snackbar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudIcon from '@mui/icons-material/Cloud';
import EditIcon from '@mui/icons-material/Edit';
import { useProfileMode } from '../../contexts/ProfileModeContext';

interface StorageDirectory {
  id: string;
  name: string;
  path: string;
  created: number;
  isActive: boolean;
}

export const StorageDirectorySettings: React.FC = () => {
  const [sds, setSds] = useState<StorageDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [sdToRemove, setSdToRemove] = useState<StorageDirectory | null>(null);
  const [newSdName, setNewSdName] = useState('');
  const [newSdPath, setNewSdPath] = useState('');
  const [cloudPaths, setCloudPaths] = useState<Record<string, string>>({});
  const { mode: profileMode } = useProfileMode();

  // Context menu state for SD items
  const [contextMenu, setContextMenu] = useState<{
    anchorEl: HTMLElement;
    sd: StorageDirectory;
  } | null>(null);

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    sd: StorageDirectory | null;
    newName: string;
  }>({
    open: false,
    sd: null,
    newName: '',
  });

  // Snackbar state for rename errors
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
  }>({
    open: false,
    message: '',
  });

  // Load SDs on mount
  useEffect(() => {
    void loadSds();
    void loadCloudPaths();
  }, []);

  const loadCloudPaths = async () => {
    try {
      const paths = await window.electronAPI.sd.getCloudStoragePaths();
      setCloudPaths(paths);
    } catch (err) {
      console.error('Failed to load cloud storage paths:', err);
    }
  };

  const loadSds = async () => {
    try {
      setLoading(true);
      setError(null);
      const sdList = await window.electronAPI.sd.list();
      setSds(sdList);
    } catch (err) {
      console.error('Failed to load SDs:', err);
      setError('Failed to load Storage Directories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSd = async () => {
    if (!newSdName.trim() || !newSdPath.trim()) {
      setError('Name and path are required');
      return;
    }

    try {
      setError(null);
      await window.electronAPI.sd.create(newSdName.trim(), newSdPath.trim());
      await loadSds();
      setAddDialogOpen(false);
      setNewSdName('');
      setNewSdPath('');
    } catch (err: unknown) {
      console.error('Failed to create SD:', err);
      if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
        setError('A Storage Directory with this name or path already exists');
      } else {
        setError('Failed to create Storage Directory');
      }
    }
  };

  const handleRemoveClick = (sd: StorageDirectory) => {
    setSdToRemove(sd);
    setRemoveDialogOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!sdToRemove) return;

    try {
      setError(null);
      await window.electronAPI.sd.delete(sdToRemove.id);
      await loadSds();
      setRemoveDialogOpen(false);
      setSdToRemove(null);
    } catch (err) {
      console.error('Failed to delete SD:', err);
      setError('Failed to remove Storage Directory');
    }
  };

  const handleSetActive = async (sdId: string) => {
    try {
      setError(null);
      await window.electronAPI.sd.setActive(sdId);
      await loadSds();
    } catch (err) {
      console.error('Failed to set active SD:', err);
      setError('Failed to set active Storage Directory');
    }
  };

  const handleBrowsePath = async () => {
    try {
      // Start at the current path if one is already entered
      const selectedPath = await window.electronAPI.sd.selectPath(newSdPath.trim() || undefined);
      if (selectedPath) {
        setNewSdPath(selectedPath);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to select path:', err);
      setError('Failed to open file picker');
    }
  };

  const handleCloudStorageQuickAdd = (name: string, basePath: string) => {
    setNewSdName(name);
    // Append /NoteCove to the cloud storage path
    const noteCovePath = `${basePath}/NoteCove`;
    setNewSdPath(noteCovePath);
    setAddDialogOpen(true);
  };

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent<HTMLElement>, sd: StorageDirectory) => {
    event.preventDefault();
    setContextMenu({
      anchorEl: event.currentTarget,
      sd,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Rename handlers
  const handleRenameClick = () => {
    if (!contextMenu) return;
    setRenameDialog({
      open: true,
      sd: contextMenu.sd,
      newName: contextMenu.sd.name,
    });
    handleCloseContextMenu();
  };

  const handleRenameConfirm = async () => {
    if (!renameDialog.sd) return;

    const trimmedName = renameDialog.newName.trim();

    // Skip if name hasn't changed
    if (trimmedName === renameDialog.sd.name) {
      handleRenameCancel();
      return;
    }

    try {
      await window.electronAPI.sd.rename(renameDialog.sd.id, trimmedName);
      await loadSds();
      handleRenameCancel();
    } catch (err) {
      console.error('Failed to rename SD:', err);
      // Show error in snackbar
      const message = err instanceof Error ? err.message : 'Failed to rename Storage Directory';
      setSnackbar({ open: true, message });
      handleRenameCancel();
    }
  };

  const handleRenameCancel = () => {
    setRenameDialog({
      open: false,
      sd: null,
      newName: '',
    });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ open: false, message: '' });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Storage Directories</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setAddDialogOpen(true);
          }}
        >
          Add Directory
        </Button>
      </Box>

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

      <Typography variant="body2" color="text.secondary" mb={2}>
        Storage Directories sync your notes across devices. Each directory contains its own
        collection of notes and folders.
      </Typography>

      {/* Cloud Storage Quick Add - hidden in paranoid mode */}
      {Object.keys(cloudPaths).length > 0 && profileMode !== 'paranoid' && (
        <Box mb={3}>
          <Typography variant="subtitle2" color="text.secondary" mb={1}>
            Quick Add from Cloud Storage:
          </Typography>
          <ButtonGroup variant="outlined" size="small">
            {cloudPaths['iCloudDrive'] && (
              <Button
                startIcon={<CloudIcon />}
                onClick={() => {
                  const path = cloudPaths['iCloudDrive'];
                  if (path) handleCloudStorageQuickAdd('iCloud Drive', path);
                }}
              >
                iCloud Drive
              </Button>
            )}
            {cloudPaths['Dropbox'] && (
              <Button
                startIcon={<CloudIcon />}
                onClick={() => {
                  const path = cloudPaths['Dropbox'];
                  if (path) handleCloudStorageQuickAdd('Dropbox', path);
                }}
              >
                Dropbox
              </Button>
            )}
            {cloudPaths['GoogleDrive'] && (
              <Button
                startIcon={<CloudIcon />}
                onClick={() => {
                  const path = cloudPaths['GoogleDrive'];
                  if (path) handleCloudStorageQuickAdd('Google Drive', path);
                }}
              >
                Google Drive
              </Button>
            )}
            {cloudPaths['OneDrive'] && (
              <Button
                startIcon={<CloudIcon />}
                onClick={() => {
                  const path = cloudPaths['OneDrive'];
                  if (path) handleCloudStorageQuickAdd('OneDrive', path);
                }}
              >
                OneDrive
              </Button>
            )}
          </ButtonGroup>
        </Box>
      )}

      {sds.length === 0 ? (
        <Alert severity="info">No Storage Directories configured. Add one to get started.</Alert>
      ) : (
        <List>
          {sds.map((sd) => (
            <ListItem
              key={sd.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                cursor: 'context-menu',
              }}
              onContextMenu={(e) => {
                handleContextMenu(e, sd);
              }}
            >
              <FolderIcon sx={{ mr: 2, color: 'primary.main' }} />
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle1">{sd.name}</Typography>
                    {sd.isActive && (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Active"
                        size="small"
                        color="primary"
                      />
                    )}
                  </Box>
                }
                secondary={sd.path}
              />
              <ListItemSecondaryAction>
                <Box display="flex" gap={1}>
                  {!sd.isActive && (
                    <Button size="small" onClick={() => void handleSetActive(sd.id)}>
                      Set Active
                    </Button>
                  )}
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => {
                      handleRemoveClick(sd);
                    }}
                    disabled={sds.length === 1} // Cannot remove last SD
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* Add SD Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => {
          setAddDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Storage Directory</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            variant="outlined"
            value={newSdName}
            onChange={(e) => {
              setNewSdName(e.target.value);
            }}
            placeholder="e.g., Work, Personal"
            sx={{ mb: 2 }}
          />
          <Box display="flex" gap={1}>
            <TextField
              margin="dense"
              label="Path"
              fullWidth
              variant="outlined"
              value={newSdPath}
              onChange={(e) => {
                setNewSdPath(e.target.value);
              }}
              placeholder="/path/to/directory"
            />
            <Button
              variant="outlined"
              onClick={() => {
                void handleBrowsePath();
              }}
              sx={{ mt: 1, mb: 1, flexShrink: 0 }}
            >
              Browse...
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            The directory will be created if it doesn&apos;t exist
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddDialogOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleAddSd()} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove SD Confirmation Dialog */}
      <Dialog
        open={removeDialogOpen}
        onClose={() => {
          setRemoveDialogOpen(false);
        }}
      >
        <DialogTitle>Remove Storage Directory?</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to remove &quot;{sdToRemove?.name}&quot;?</Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will not delete the files on disk, only remove it from NoteCove.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRemoveDialogOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleRemoveConfirm()} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu for SD items */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorEl={contextMenu?.anchorEl}
      >
        <MenuItem onClick={handleRenameClick}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Rename
        </MenuItem>
      </Menu>

      {/* Rename SD Dialog */}
      <Dialog open={renameDialog.open} onClose={handleRenameCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Storage Directory</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            value={renameDialog.newName}
            onChange={(e) => {
              setRenameDialog({ ...renameDialog, newName: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameDialog.newName.trim()) {
                void handleRenameConfirm();
              } else if (e.key === 'Escape') {
                handleRenameCancel();
              }
            }}
            onFocus={(e) => {
              // Select all text when focused
              e.target.select();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameCancel}>Cancel</Button>
          <Button
            onClick={() => {
              void handleRenameConfirm();
            }}
            variant="contained"
            disabled={!renameDialog.newName.trim()}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar for rename failures */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
