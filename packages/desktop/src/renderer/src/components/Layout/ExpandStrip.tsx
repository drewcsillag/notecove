/**
 * ExpandStrip Component
 *
 * A thin vertical strip shown when a panel is collapsed.
 * Provides visual indication and click/drag interaction to expand the panel.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tooltip, useTheme } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export interface ExpandStripProps {
  /** Position of the strip - determines chevron direction */
  position?: 'left' | 'right';
  /** Click handler to expand the panel */
  onClick: () => void;
  /** Optional drag handler for resizing */
  onDrag?: (deltaX: number) => void;
  /** Accessibility label */
  ariaLabel: string;
  /** Whether to show the onboarding tooltip */
  showTooltip?: boolean | undefined;
  /** Content for the onboarding tooltip */
  tooltipContent?: string | undefined;
  /** Callback when tooltip is dismissed */
  onTooltipDismiss?: (() => void) | undefined;
}

const STRIP_WIDTH = 10; // pixels

const TOOLTIP_AUTO_DISMISS_MS = 5000;

export const ExpandStrip: React.FC<ExpandStripProps> = ({
  position = 'left',
  onClick,
  onDrag,
  ariaLabel,
  showTooltip = false,
  tooltipContent,
  onTooltipDismiss,
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // Show tooltip when showTooltip becomes true
  useEffect(() => {
    if (!showTooltip || !tooltipContent) {
      setTooltipOpen(false);
      return;
    }
    setTooltipOpen(true);
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setTooltipOpen(false);
      onTooltipDismiss?.();
    }, TOOLTIP_AUTO_DISMISS_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [showTooltip, tooltipContent, onTooltipDismiss]);

  // Dismiss tooltip on any interaction
  const dismissTooltip = useCallback(() => {
    if (tooltipOpen) {
      setTooltipOpen(false);
      onTooltipDismiss?.();
    }
  }, [tooltipOpen, onTooltipDismiss]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setIsHovered(false);
    }
  }, [isDragging]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (onDrag) {
        setIsDragging(true);
        setDragStartX(e.clientX);
        e.preventDefault();
      }
    },
    [onDrag]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && onDrag) {
        const deltaX = e.clientX - dragStartX;
        onDrag(deltaX);
        setDragStartX(e.clientX);
      }
    },
    [isDragging, onDrag, dragStartX]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsHovered(false);
  }, []);

  // Set up global mouse listeners for drag
  React.useEffect(() => {
    if (!isDragging) {
      return;
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleClick = useCallback(() => {
    dismissTooltip();
    if (!isDragging) {
      onClick();
    }
  }, [isDragging, onClick, dismissTooltip]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      dismissTooltip();
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick, dismissTooltip]
  );

  // Choose chevron based on position
  const ChevronIcon = position === 'left' ? ChevronRightIcon : ChevronLeftIcon;

  const stripContent = (
    <Box
      data-testid="expand-strip"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      sx={{
        width: STRIP_WIDTH,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isHovered
          ? theme.palette.action.hover
          : theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.02)',
        borderRight: position === 'left' ? `1px solid ${theme.palette.divider}` : 'none',
        borderLeft: position === 'right' ? `1px solid ${theme.palette.divider}` : 'none',
        cursor: onDrag ? 'col-resize' : 'pointer',
        transition: 'background-color 0.2s',
        '&:focus': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
        '&:focus:not(:focus-visible)': {
          outline: 'none',
        },
      }}
    >
      <ChevronIcon
        data-testid="expand-strip-chevron"
        sx={{
          fontSize: 16,
          color: theme.palette.text.secondary,
          opacity: isHovered ? 1 : 0.5,
          transition: 'opacity 0.2s',
        }}
      />
    </Box>
  );

  // Wrap with tooltip if content is provided
  if (tooltipContent) {
    return (
      <Tooltip
        open={tooltipOpen}
        title={tooltipContent}
        placement={position === 'left' ? 'right' : 'left'}
        arrow
        slotProps={{
          popper: {
            modifiers: [
              {
                name: 'offset',
                options: {
                  offset: [0, 8],
                },
              },
            ],
          },
          tooltip: {
            sx: {
              maxWidth: 280,
              fontSize: '0.8125rem',
              padding: '8px 12px',
            },
          },
        }}
      >
        {stripContent}
      </Tooltip>
    );
  }

  return stripContent;
};
