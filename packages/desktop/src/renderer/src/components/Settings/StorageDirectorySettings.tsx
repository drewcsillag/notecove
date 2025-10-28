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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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

  // Load SDs on mount
  useEffect(() => {
    void loadSds();
  }, []);

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

  const handleRemoveConfirm = () => {
    if (!sdToRemove) return;

    // TODO: Implement sd:delete IPC handler
    console.log('Remove SD:', sdToRemove.id);
    setRemoveDialogOpen(false);
    setSdToRemove(null);
    setError('SD removal not yet implemented');
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

  const handleBrowsePath = () => {
    // TODO: Implement native file picker dialog
    // For now, user must enter path manually
    setError('File picker not yet implemented - please enter path manually');
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
              onClick={handleBrowsePath}
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
          <Button onClick={handleRemoveConfirm} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
