/**
 * Folder Panel Component
 *
 * Displays the folder tree navigation with selection and expansion state.
 * Phase 2.4.1: Basic display with persistent state.
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { FolderTree } from './FolderTree';

const DEFAULT_SD_ID = 'default'; // Phase 2.4.1: Single SD only

export const FolderPanel: React.FC = () => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ padding: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Folders</Typography>
      </Box>

      {/* Folder Tree */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <FolderTree
          sdId={DEFAULT_SD_ID}
          selectedFolderId={selectedFolderId}
          expandedFolderIds={expandedFolderIds}
          onFolderSelect={handleFolderSelect}
          onExpandedChange={handleExpandedChange}
        />
      </Box>
    </Box>
  );
};
