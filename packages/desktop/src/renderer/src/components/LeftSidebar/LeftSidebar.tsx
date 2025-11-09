/**
 * Left Sidebar Component
 *
 * Contains both FolderPanel and TagPanel in a vertical stack.
 */

import React from 'react';
import { Box } from '@mui/material';
import { FolderPanel } from '../FolderPanel/FolderPanel';
import { TagPanel } from '../TagPanel/TagPanel';

export interface LeftSidebarProps {
  onOpenSettings?: () => void;
  activeSdId?: string;
  onActiveSdChange?: (sdId: string) => void;
  selectedTags: string[];
  onTagSelect: (tagId: string) => void;
  onClearTagFilters: () => void;
  showTagPanel: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  onOpenSettings,
  activeSdId,
  onActiveSdChange,
  selectedTags,
  onTagSelect,
  onClearTagFilters,
  showTagPanel,
}) => {
  // Build FolderPanel props conditionally to avoid passing undefined
  const folderPanelProps: {
    onOpenSettings?: () => void;
    activeSdId?: string;
    onActiveSdChange?: (sdId: string) => void;
  } = {};

  if (onOpenSettings) folderPanelProps.onOpenSettings = onOpenSettings;
  if (activeSdId) folderPanelProps.activeSdId = activeSdId;
  if (onActiveSdChange) folderPanelProps.onActiveSdChange = onActiveSdChange;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Folder Panel - takes up 60% of space */}
      <Box
        sx={{
          flex: showTagPanel ? 6 : 1,
          overflow: 'auto',
          borderBottom: showTagPanel ? 1 : 0,
          borderColor: 'divider',
        }}
      >
        <FolderPanel {...folderPanelProps} />
      </Box>

      {/* Tag Panel - takes up 40% of space */}
      {showTagPanel && (
        <Box sx={{ flex: 4, overflow: 'auto' }}>
          <TagPanel
            selectedTags={selectedTags}
            onTagSelect={onTagSelect}
            onClearFilters={onClearTagFilters}
          />
        </Box>
      )}
    </Box>
  );
};
