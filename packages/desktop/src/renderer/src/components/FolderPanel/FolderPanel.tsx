/**
 * Folder Panel Component
 *
 * Displays the folder tree navigation with selection and expansion state.
 * Phase 2.4.1: Basic display with persistent state.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { FolderTree } from './FolderTree';

const DEFAULT_SD_ID = 'default'; // Phase 2.4.1: Single SD only

export const FolderPanel: React.FC = () => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load persisted state on mount
  useEffect(() => {
    void loadState();
  }, []);

  const loadState = async (): Promise<void> => {
    try {
      // Load selected folder
      const selectedState = await window.electronAPI.appState.get('selectedFolderId');
      if (selectedState) {
        setSelectedFolderId(selectedState);
      } else {
        // Default to "All Notes"
        setSelectedFolderId('all-notes');
      }

      // Load expanded folders
      const expandedState = await window.electronAPI.appState.get('expandedFolderIds');
      if (expandedState) {
        setExpandedFolderIds(JSON.parse(expandedState) as string[]);
      }
    } catch (err) {
      console.error('Failed to load folder state:', err);
      // Default to "All Notes" on error
      setSelectedFolderId('all-notes');
    }
  };

  const handleFolderSelect = (folderId: string | null): void => {
    setSelectedFolderId(folderId);

    // Persist selection
    if (folderId) {
      window.electronAPI.appState.set('selectedFolderId', folderId).catch((err) => {
        console.error('Failed to save selected folder:', err);
      });
    }
  };

  const handleExpandedChange = (expandedIds: string[]): void => {
    setExpandedFolderIds(expandedIds);

    // Persist expansion state
    window.electronAPI.appState
      .set('expandedFolderIds', JSON.stringify(expandedIds))
      .catch((err) => {
        console.error('Failed to save expanded folders:', err);
      });
  };

  const handleCreateClick = (): void => {
    setCreateDialogOpen(true);
    setNewFolderName('');
    setCreateError(null);
  };

  const handleCreateCancel = (): void => {
    setCreateDialogOpen(false);
    setNewFolderName('');
    setCreateError(null);
  };

  const handleCreateConfirm = async (): Promise<void> => {
    try {
      setCreateError(null);

      // Determine parent folder
      let parentId: string | null = null;
      if (
        selectedFolderId &&
        selectedFolderId !== 'all-notes' &&
        selectedFolderId !== 'recently-deleted'
      ) {
        parentId = selectedFolderId;
      }

      // Create folder via IPC
      const newFolderId = await window.electronAPI.folder.create(
        DEFAULT_SD_ID,
        parentId,
        newFolderName
      );

      // Close dialog
      setCreateDialogOpen(false);
      setNewFolderName('');

      // Refresh folder tree
      setRefreshTrigger((prev) => prev + 1);

      // Expand parent folder if creating subfolder
      if (parentId && !expandedFolderIds.includes(parentId)) {
        const newExpanded = [...expandedFolderIds, parentId];
        setExpandedFolderIds(newExpanded);
        window.electronAPI.appState
          .set('expandedFolderIds', JSON.stringify(newExpanded))
          .catch((err) => {
            console.error('Failed to save expanded folders:', err);
          });
      }

      // Select the new folder
      setSelectedFolderId(newFolderId);
      window.electronAPI.appState.set('selectedFolderId', newFolderId).catch((err) => {
        console.error('Failed to save selected folder:', err);
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          padding: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">Folders</Typography>
        <IconButton size="small" onClick={handleCreateClick} title="Create folder">
          <AddIcon />
        </IconButton>
      </Box>

      {/* Folder Tree */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <FolderTree
          sdId={DEFAULT_SD_ID}
          selectedFolderId={selectedFolderId}
          expandedFolderIds={expandedFolderIds}
          onFolderSelect={handleFolderSelect}
          onExpandedChange={handleExpandedChange}
          refreshTrigger={refreshTrigger}
          onRefresh={() => {
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      </Box>

      {/* Create Folder Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCreateCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            type="text"
            fullWidth
            value={newFolderName}
            onChange={(e) => {
              setNewFolderName(e.target.value);
            }}
            error={!!createError}
            helperText={createError}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleCreateConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateCancel}>Cancel</Button>
          <Button
            onClick={() => void handleCreateConfirm()}
            variant="contained"
            disabled={!newFolderName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
