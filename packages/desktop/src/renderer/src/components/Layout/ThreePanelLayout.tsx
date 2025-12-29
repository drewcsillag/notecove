/**
 * Three-Panel Layout Component
 *
 * Implements the main application layout with three resizable panels:
 * - Left: Folder/Tags navigation (25% default)
 * - Middle: Notes list (25% default)
 * - Right: Note editor (50% default)
 *
 * Panels can be collapsed via keyboard shortcuts. Collapsed panels
 * can be expanded by dragging the resize handle.
 */

import React, { useRef, useEffect } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';
import { Box, useTheme } from '@mui/material';

interface ThreePanelLayoutProps {
  leftPanel: React.ReactNode;
  middlePanel: React.ReactNode;
  rightPanel: React.ReactNode;
  onLayoutChange?: (sizes: number[]) => void;
  initialSizes?: number[] | undefined;
  /** Whether the left pane should be collapsed */
  leftPaneCollapsed?: boolean;
  /** Whether the middle pane should be collapsed */
  middlePaneCollapsed?: boolean;
}

export const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({
  leftPanel,
  middlePanel,
  rightPanel,
  onLayoutChange,
  initialSizes,
  leftPaneCollapsed = false,
  middlePaneCollapsed = false,
}) => {
  const theme = useTheme();
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const middlePanelRef = useRef<ImperativePanelHandle>(null);

  const handleLayoutChange = (sizes: number[]): void => {
    if (onLayoutChange) {
      onLayoutChange(sizes);
    }
  };

  // Handle left pane collapse/expand
  useEffect(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;

    if (leftPaneCollapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [leftPaneCollapsed]);

  // Handle middle pane collapse/expand
  useEffect(() => {
    const panel = middlePanelRef.current;
    if (!panel) return;

    if (middlePaneCollapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [middlePaneCollapsed]);

  // Default sizes: [25, 25, 50]
  const leftSize = initialSizes?.[0] ?? 25;
  const middleSize = initialSizes?.[1] ?? 25;
  const rightSize = initialSizes?.[2] ?? 50;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PanelGroup direction="horizontal" onLayout={handleLayoutChange}>
        {/* Left Panel - Folder/Tags Navigation */}
        <Panel
          ref={leftPanelRef}
          id="left-panel"
          order={1}
          defaultSize={leftSize}
          minSize={0}
          maxSize={40}
          collapsible={true}
          collapsedSize={0}
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
          ref={middlePanelRef}
          id="middle-panel"
          order={2}
          defaultSize={middleSize}
          minSize={0}
          maxSize={50}
          collapsible={true}
          collapsedSize={0}
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
