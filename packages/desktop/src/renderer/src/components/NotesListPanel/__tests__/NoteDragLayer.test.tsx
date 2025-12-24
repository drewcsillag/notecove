/**
 * NoteDragLayer Component Tests
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NoteDragLayer } from '../NoteDragLayer';
import * as reactDnd from 'react-dnd';

// Mock react-dnd
jest.mock('react-dnd');

describe('NoteDragLayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when not dragging', () => {
    (reactDnd.useDragLayer as jest.Mock).mockReturnValue({
      item: null,
      itemType: null,
      currentOffset: null,
      isDragging: false,
    });

    const { container } = render(<NoteDragLayer />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render when dragging wrong item type', () => {
    (reactDnd.useDragLayer as jest.Mock).mockReturnValue({
      item: { noteIds: ['note1'], count: 1, noteTitle: 'Test Note' },
      itemType: 'folder', // Wrong type
      currentOffset: { x: 100, y: 100 },
      isDragging: true,
    });

    const { container } = render(<NoteDragLayer />);
    expect(container.firstChild).toBeNull();
  });

  it('should render note title for single note drag', () => {
    (reactDnd.useDragLayer as jest.Mock).mockReturnValue({
      item: { noteIds: ['note1'], count: 1, noteTitle: 'My Test Note', sdId: 'sd1' },
      itemType: 'note',
      currentOffset: { x: 100, y: 100 },
      isDragging: true,
    });

    render(<NoteDragLayer />);
    expect(screen.getByText('My Test Note')).toBeInTheDocument();
  });

  it('should render "Note" when noteTitle is not provided', () => {
    (reactDnd.useDragLayer as jest.Mock).mockReturnValue({
      item: { noteIds: ['note1'], count: 1, sdId: 'sd1' }, // No noteTitle
      itemType: 'note',
      currentOffset: { x: 100, y: 100 },
      isDragging: true,
    });

    render(<NoteDragLayer />);
    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('should render count for multi-note drag', () => {
    (reactDnd.useDragLayer as jest.Mock).mockReturnValue({
      item: {
        noteIds: ['note1', 'note2', 'note3'],
        count: 3,
        noteTitle: 'First Note',
        sdId: 'sd1',
      },
      itemType: 'note',
      currentOffset: { x: 100, y: 100 },
      isDragging: true,
    });

    render(<NoteDragLayer />);
    expect(screen.getByText('3 notes')).toBeInTheDocument();
  });

  it('should not render when currentOffset is null', () => {
    (reactDnd.useDragLayer as jest.Mock).mockReturnValue({
      item: { noteIds: ['note1'], count: 1, noteTitle: 'Test Note', sdId: 'sd1' },
      itemType: 'note',
      currentOffset: null, // No offset
      isDragging: true,
    });

    render(<NoteDragLayer />);
    // The outer div exists but inner content should be hidden
    const text = screen.queryByText('Test Note');
    // When currentOffset is null, the transform style sets display: none
    // The component still renders but with hidden styles
    expect(text).not.toBeVisible();
  });
});
