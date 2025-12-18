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
import { SyncStatusIndicator } from '../SyncStatusIndicator';

export interface LeftSidebarProps {
  onOpenSettings?: () => void;
  activeSdId?: string | undefined;
  onActiveSdChange?: (sdId: string) => void;
  tagFilters: Record<string, 'include' | 'exclude'>;
  onTagSelect: (tagId: string) => void;
  onClearTagFilters: () => void;
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
  tagFilters,
  onTagSelect,
  onClearTagFilters,
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
  } = {};

  if (onOpenSettings) folderPanelProps.onOpenSettings = onOpenSettings;
  if (activeSdId) folderPanelProps.activeSdId = activeSdId;
  if (onActiveSdChange) folderPanelProps.onActiveSdChange = onActiveSdChange;

  // If tag panel is hidden, just show folder panel
  if (!showTagPanel) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <FolderPanel {...folderPanelProps} />
        </Box>
        <SyncStatusIndicator />
      </Box>
    );
  }

  // Default sizes: 60% folder, 40% tags
  const folderSize = initialSizes?.[0] ?? 60;
  const tagsSize = initialSizes?.[1] ?? 40;

  const handleLayoutChange = (sizes: number[]): void => {
    if (onLayoutChange) {
      onLayoutChange(sizes);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <PanelGroup direction="vertical" onLayout={handleLayoutChange}>
          {/* Folder Panel */}
          <Panel defaultSize={folderSize} minSize={20}>
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              <FolderPanel {...folderPanelProps} />
            </Box>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle
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
      <SyncStatusIndicator />
    </Box>
  );
};
