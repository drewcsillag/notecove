/**
 * Droppable Folder Node Component
 *
 * Wraps folder tree nodes with drop functionality to accept note drops.
 * Phase 2.5.7.3: Drag & Drop
 */

import React, { type ReactNode } from 'react';
import { useDrop } from 'react-dnd';

// Drag types - must match DraggableNoteItem
export const ItemTypes = {
  NOTE: 'note',
};

interface DroppableFolderNodeProps {
  folderId: string;
  children: ReactNode;
  onDrop: (noteIds: string[], targetFolderId: string) => void;
  isSpecial?: boolean; // For "All Notes" and "Recently Deleted" (currently unused but kept for future use)
}

export const DroppableFolderNode: React.FC<DroppableFolderNodeProps> = ({
  folderId,
  children,
  onDrop,
  // isSpecial is kept for future use
}) => {
  // Set up drop zone
  const [{ isOver, canDropNote }, drop] = useDrop(
    () => ({
      accept: ItemTypes.NOTE,
      drop: (item: { noteIds: string[]; count: number }) => {
        // Handle the drop
        onDrop(item.noteIds, folderId);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDropNote: monitor.canDrop(),
      }),
      // Allow drops on all folders including "Recently Deleted" (soft delete)
      canDrop: () => true,
    }),
    [folderId, onDrop]
  );

  const isActive = canDropNote && isOver;

  return (
    <div
      ref={drop}
      style={{
        position: 'relative',
        backgroundColor: isActive ? 'rgba(33, 150, 243, 0.1)' : undefined,
        borderLeft: isActive ? '3px solid #2196f3' : undefined,
      }}
    >
      {children}
    </div>
  );
};
