/**
 * Tests for TableSizePickerDialog component
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 2
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TableSizePickerDialog } from '../TableSizePickerDialog';

describe('TableSizePickerDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSelect = jest.fn();
  const mockAnchorEl = document.createElement('button');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when open', () => {
    render(
      <TableSizePickerDialog
        open={true}
        anchorEl={mockAnchorEl}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText(/insert table/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <TableSizePickerDialog
        open={false}
        anchorEl={mockAnchorEl}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.queryByText(/insert table/i)).not.toBeInTheDocument();
  });

  it('should show grid of cells', () => {
    render(
      <TableSizePickerDialog
        open={true}
        anchorEl={mockAnchorEl}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    // Should have cells for the grid
    const cells = screen.getAllByRole('button', { hidden: true });
    // Grid is 10x10 = 100 cells (though some may be hidden)
    expect(cells.length).toBeGreaterThan(0);
  });

  it('should show size indicator', () => {
    render(
      <TableSizePickerDialog
        open={true}
        anchorEl={mockAnchorEl}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    // Default should show "3 × 3" (the default size)
    expect(screen.getByText(/×/)).toBeInTheDocument();
  });

  it('should call onSelect with correct dimensions when cell clicked', () => {
    render(
      <TableSizePickerDialog
        open={true}
        anchorEl={mockAnchorEl}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    // Click on a cell - we'll find the grid cells and click one
    const gridContainer = screen.getByTestId('table-size-grid');
    expect(gridContainer).toBeInTheDocument();

    // Find a cell at position (2, 2) - which should create a 2x2 table
    const cell = screen.getByTestId('table-cell-2-2');
    fireEvent.click(cell);

    expect(mockOnSelect).toHaveBeenCalledWith(2, 2);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should highlight cells on hover', () => {
    render(
      <TableSizePickerDialog
        open={true}
        anchorEl={mockAnchorEl}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    // Hover over cell (3, 4)
    const cell = screen.getByTestId('table-cell-3-4');
    fireEvent.mouseEnter(cell);

    // Size indicator should update to show 3 × 4
    expect(screen.getByText('3 × 4')).toBeInTheDocument();
  });

  it('should support keyboard selection with Enter key', () => {
    render(
      <TableSizePickerDialog
        open={true}
        anchorEl={mockAnchorEl}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    // Find a cell and trigger Enter key
    const cell = screen.getByTestId('table-cell-4-3');
    fireEvent.keyDown(cell, { key: 'Enter' });

    expect(mockOnSelect).toHaveBeenCalledWith(4, 3);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should support keyboard selection with Space key', () => {
    render(
      <TableSizePickerDialog
        open={true}
        anchorEl={mockAnchorEl}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
      />
    );

    // Find a cell and trigger Space key
    const cell = screen.getByTestId('table-cell-5-2');
    fireEvent.keyDown(cell, { key: ' ' });

    expect(mockOnSelect).toHaveBeenCalledWith(5, 2);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
