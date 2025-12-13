/**
 * Table Size Picker Dialog
 *
 * A popover dialog for selecting table dimensions via a visual grid.
 * Similar to how Word/Google Docs let you pick table size.
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 2
 */

import React, { useState } from 'react';
import { Popover, Box, Typography, useTheme } from '@mui/material';
import { TABLE_CONSTRAINTS } from './extensions/Table';

export interface TableSizePickerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Anchor element for the popover */
  anchorEl: HTMLElement | null;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when a size is selected */
  onSelect: (rows: number, cols: number) => void;
}

/** Maximum grid size to show in the picker */
const MAX_GRID_SIZE = 10;

/** Default hover position (3x3) */
const DEFAULT_HOVER: { rows: number; cols: number } = {
  rows: TABLE_CONSTRAINTS.DEFAULT_ROWS,
  cols: TABLE_CONSTRAINTS.DEFAULT_COLS,
};

export const TableSizePickerDialog: React.FC<TableSizePickerDialogProps> = ({
  open,
  anchorEl,
  onClose,
  onSelect,
}) => {
  const theme = useTheme();
  const [hoverSize, setHoverSize] = useState(DEFAULT_HOVER);

  /**
   * Handle mouse entering a cell
   */
  const handleCellHover = (row: number, col: number) => {
    setHoverSize({ rows: row, cols: col });
  };

  /**
   * Handle clicking a cell to select size
   */
  const handleCellClick = (row: number, col: number) => {
    onSelect(row, col);
    onClose();
    // Reset hover state for next time
    setHoverSize(DEFAULT_HOVER);
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    onClose();
    setHoverSize(DEFAULT_HOVER);
  };

  /**
   * Check if a cell should be highlighted
   */
  const isCellHighlighted = (row: number, col: number): boolean => {
    return row <= hoverSize.rows && col <= hoverSize.cols;
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      slotProps={{
        paper: {
          sx: {
            p: 2,
            minWidth: 200,
          },
        },
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Insert Table
      </Typography>

      {/* Grid of cells */}
      <Box
        data-testid="table-size-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${MAX_GRID_SIZE}, 1fr)`,
          gap: '2px',
          mb: 1,
        }}
      >
        {Array.from({ length: MAX_GRID_SIZE * MAX_GRID_SIZE }).map((_, index) => {
          const row = Math.floor(index / MAX_GRID_SIZE) + 1;
          const col = (index % MAX_GRID_SIZE) + 1;
          const highlighted = isCellHighlighted(row, col);

          return (
            <Box
              key={`${row}-${col}`}
              data-testid={`table-cell-${row}-${col}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                handleCellClick(row, col);
              }}
              onMouseEnter={() => {
                handleCellHover(row, col);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleCellClick(row, col);
                }
              }}
              sx={{
                width: 16,
                height: 16,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: '2px',
                backgroundColor: highlighted
                  ? theme.palette.primary.main
                  : theme.palette.background.paper,
                cursor: 'pointer',
                transition: 'background-color 0.1s ease',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                },
              }}
            />
          );
        })}
      </Box>

      {/* Size indicator */}
      <Typography
        variant="body2"
        sx={{
          textAlign: 'center',
          color: theme.palette.text.secondary,
        }}
      >
        {hoverSize.rows} × {hoverSize.cols}
      </Typography>
    </Popover>
  );
};
