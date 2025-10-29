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
import { Add as AddIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { FolderTree } from './FolderTree';

export interface FolderPanelProps {
  onOpenSettings?: () => void;
  activeSdId?: string;
  onActiveSdChange?: (sdId: string) => void;
}

export const FolderPanel: React.FC<FolderPanelProps> = ({
  onOpenSettings,
  activeSdId,
  onActiveSdChange,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stateLoaded, setStateLoaded] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    void loadState();
  }, []);

  // Listen for folder updates from other windows or file system changes
  useEffect(() => {
    const unsubscribe = window.electronAPI.folder.onUpdated((data) => {
      console.log('[FolderPanel] Received folder:updated event:', data);
      // Refresh the folder tree
      setRefreshTrigger((prev) => prev + 1);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for SD updates (create, setActive)
  useEffect(() => {
    const unsubscribe = window.electronAPI.sd.onUpdated((data) => {
      console.log('[FolderPanel] Received sd:updated event:', data);
      // Refresh the folder tree to show new SD or active SD change
      setRefreshTrigger((prev) => prev + 1);

      // If SD was set active, update local state
      if (data.operation === 'setActive' && onActiveSdChange) {
        onActiveSdChange(data.sdId);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadState = async (): Promise<void> => {
    try {
      // Load active SD
      const loadedActiveSdId = await window.electronAPI.sd.getActive();
      if (loadedActiveSdId && onActiveSdChange) {
        onActiveSdChange(loadedActiveSdId);
      }

      // Load selected folder
      const selectedState = await window.electronAPI.appState.get('selectedFolderId');
      if (selectedState) {
        setSelectedFolderId(selectedState);
      } else {
        // Default to "All Notes" for the active SD
        if (loadedActiveSdId) {
          setSelectedFolderId(`all-notes:${loadedActiveSdId}`);
        }
      }

      // Load expanded folders
      const expandedState = await window.electronAPI.appState.get('expandedFolderIds');
      if (expandedState) {
        setExpandedFolderIds(JSON.parse(expandedState) as string[]);
      } else {
        // No saved state - in multi-SD mode, the tree will handle default expansion
        setExpandedFolderIds([]);
      }

      // Mark state as loaded
      setStateLoaded(true);
    } catch (err) {
      console.error('Failed to load folder state:', err);
      // Default to "All Notes" on error
      setSelectedFolderId('all-notes');
      setStateLoaded(true); // Still mark as loaded even on error
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

  const handleActiveSdChange = async (sdId: string): Promise<void> => {
    try {
      // Update parent state
      onActiveSdChange?.(sdId);

      // Set as active in backend
      await window.electronAPI.sd.setActive(sdId);

      // Persist in app state
      await window.electronAPI.appState.set('activeSdId', sdId);
    } catch (err) {
      console.error('Failed to change active SD:', err);
    }
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

      // Must have an active SD to create a folder
      if (!activeSdId) {
        setCreateError('No active storage directory');
        return;
      }

      // Determine parent folder
      let parentId: string | null = null;
      if (selectedFolderId) {
        // Handle multi-SD special nodes
        if (
          selectedFolderId.startsWith('all-notes:') ||
          selectedFolderId.startsWith('recently-deleted:') ||
          selectedFolderId.startsWith('sd:')
        ) {
          // Creating at root level of the SD
          parentId = null;
        } else {
          // Creating as a subfolder
          parentId = selectedFolderId;
        }
      }

      // Create folder via IPC
      const newFolderId = await window.electronAPI.folder.create(
        activeSdId,
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
        <Box display="flex" gap={0.5}>
          <IconButton size="small" onClick={handleCreateClick} title="Create folder">
            <AddIcon />
          </IconButton>
          {onOpenSettings && (
            <IconButton size="small" onClick={onOpenSettings} title="Settings">
              <SettingsIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Folder Tree */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {stateLoaded ? (
          <FolderTree
            selectedFolderId={selectedFolderId}
            expandedFolderIds={expandedFolderIds}
            onFolderSelect={handleFolderSelect}
            onExpandedChange={handleExpandedChange}
            refreshTrigger={refreshTrigger}
            onRefresh={() => {
              setRefreshTrigger((prev) => prev + 1);
            }}
            {...(activeSdId && { activeSdId })}
            onActiveSdChange={(sdId) => {
              void handleActiveSdChange(sdId);
            }}
          />
        ) : (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Loading folders...
            </Typography>
          </Box>
        )}
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
