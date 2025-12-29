/**
 * Left Sidebar Component
 *
 * Contains both FolderPanel and TagPanel in a vertical stack with resizable divider.
 */

import React from 'react';
import { Box, useTheme } from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FolderPanel } from '../FolderPanel/FolderPanel';
import { TagPanel } from '../TagPanel/TagPanel';

export interface LeftSidebarProps {
  onOpenSettings?: () => void;
  activeSdId?: string | undefined;
  onActiveSdChange?: (sdId: string) => void;
  /** Currently selected folder ID (lifted state for window isolation) */
  selectedFolderId: string | null;
  /** Callback when folder selection changes */
  onFolderSelect: (folderId: string | null) => void;
  tagFilters: Record<string, 'include' | 'exclude'>;
  onTagSelect: (tagId: string) => void;
  onClearTagFilters: () => void;
  showFolderPanel: boolean;
  showTagPanel: boolean;
  /** Initial sizes for folder/tags panels as percentages [folder%, tags%] */
  initialSizes?: number[];
  /** Callback when panel sizes change */
  onLayoutChange?: (sizes: number[]) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  onOpenSettings,
  activeSdId,
  onActiveSdChange,
  selectedFolderId,
  onFolderSelect,
  tagFilters,
  onTagSelect,
  onClearTagFilters,
  showFolderPanel,
  showTagPanel,
  initialSizes,
  onLayoutChange,
}) => {
  const theme = useTheme();

  // Build FolderPanel props conditionally to avoid passing undefined
  const folderPanelProps: {
    onOpenSettings?: () => void;
    activeSdId?: string;
    onActiveSdChange?: (sdId: string) => void;
    selectedFolderId: string | null;
    onFolderSelect: (folderId: string | null) => void;
  } = {
    selectedFolderId,
    onFolderSelect,
  };

  if (onOpenSettings) folderPanelProps.onOpenSettings = onOpenSettings;
  if (activeSdId) folderPanelProps.activeSdId = activeSdId;
  if (onActiveSdChange) folderPanelProps.onActiveSdChange = onActiveSdChange;

  // If only folder panel is shown (tags hidden)
  if (showFolderPanel && !showTagPanel) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <FolderPanel {...folderPanelProps} />
        </Box>
      </Box>
    );
  }

  // If only tag panel is shown (folder hidden)
  if (!showFolderPanel && showTagPanel) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TagPanel
            tagFilters={tagFilters}
            onTagSelect={onTagSelect}
            onClearFilters={onClearTagFilters}
          />
        </Box>
      </Box>
    );
  }

  // If both panels are hidden, show an empty sidebar
  if (!showFolderPanel && !showTagPanel) {
    return <Box sx={{ height: '100%' }} />;
  }

  // Default sizes: 60% folder, 40% tags
  const folderSize = initialSizes?.[0] ?? 60;
  const tagsSize = initialSizes?.[1] ?? 40;

  const handleLayoutChange = (sizes: number[]): void => {
    if (onLayoutChange) {
      onLayoutChange(sizes);
    }
  };

  // Both panels are shown - render resizable layout
  return (
    <Box sx={{ height: '100%' }} data-testid="left-sidebar-panel-group">
      <PanelGroup direction="vertical" onLayout={handleLayoutChange}>
        {/* Folder Panel */}
        <Panel defaultSize={folderSize} minSize={20} data-testid="panel">
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <FolderPanel {...folderPanelProps} />
          </Box>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle
          data-testid="resize-handle"
          style={{
            height: '4px',
            backgroundColor: theme.palette.divider,
            cursor: 'row-resize',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as unknown as HTMLElement;
            target.style.backgroundColor = theme.palette.primary.main;
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as unknown as HTMLElement;
            target.style.backgroundColor = theme.palette.divider;
          }}
        />

        {/* Tag Panel */}
        <Panel defaultSize={tagsSize} minSize={20}>
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <TagPanel
              tagFilters={tagFilters}
              onTagSelect={onTagSelect}
              onClearFilters={onClearTagFilters}
            />
          </Box>
        </Panel>
      </PanelGroup>
    </Box>
  );
};
