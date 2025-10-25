/**
 * Three-Panel Layout Component
 *
 * Implements the main application layout with three resizable panels:
 * - Left: Folder/Tags navigation (25% default)
 * - Middle: Notes list (25% default)
 * - Right: Note editor (50% default)
 */

import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Box, useTheme } from '@mui/material';

interface ThreePanelLayoutProps {
  leftPanel: React.ReactNode;
  middlePanel: React.ReactNode;
  rightPanel: React.ReactNode;
  onLayoutChange?: (sizes: number[]) => void;
  initialSizes?: number[] | undefined;
}

export const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({
  leftPanel,
  middlePanel,
  rightPanel,
  onLayoutChange,
  initialSizes,
}) => {
  const theme = useTheme();

  const handleLayoutChange = (sizes: number[]): void => {
    if (onLayoutChange) {
      onLayoutChange(sizes);
    }
  };

  // Default sizes: [25, 25, 50]
  const leftSize = initialSizes?.[0] ?? 25;
  const middleSize = initialSizes?.[1] ?? 25;
  const rightSize = initialSizes?.[2] ?? 50;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PanelGroup direction="horizontal" onLayout={handleLayoutChange}>
        {/* Left Panel - Folder/Tags Navigation */}
        <Panel
          id="left-panel"
          order={1}
          defaultSize={leftSize}
          minSize={15}
          maxSize={40}
          collapsible={true}
        >
          <Box
            sx={{
              height: '100%',
              overflow: 'auto',
              borderRight: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.default,
            }}
          >
            {leftPanel}
          </Box>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle>
          <Box
            sx={{
              width: '4px',
              height: '100%',
              backgroundColor: theme.palette.divider,
              cursor: 'col-resize',
              '&:hover': {
                backgroundColor: theme.palette.primary.main,
              },
              '&:active': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          />
        </PanelResizeHandle>

        {/* Middle Panel - Notes List */}
        <Panel
          id="middle-panel"
          order={2}
          defaultSize={middleSize}
          minSize={15}
          maxSize={50}
          collapsible={true}
        >
          <Box
            sx={{
              height: '100%',
              overflow: 'auto',
              borderRight: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            {middlePanel}
          </Box>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle>
          <Box
            sx={{
              width: '4px',
              height: '100%',
              backgroundColor: theme.palette.divider,
              cursor: 'col-resize',
              '&:hover': {
                backgroundColor: theme.palette.primary.main,
              },
              '&:active': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          />
        </PanelResizeHandle>

        {/* Right Panel - Editor */}
        <Panel id="right-panel" order={3} defaultSize={rightSize} minSize={30}>
          <Box
            sx={{
              height: '100%',
              overflow: 'auto',
              backgroundColor: theme.palette.background.paper,
            }}
          >
            {rightPanel}
          </Box>
        </Panel>
      </PanelGroup>
    </Box>
  );
};
