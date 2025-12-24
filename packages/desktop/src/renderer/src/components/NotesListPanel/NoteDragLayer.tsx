/**
 * Custom Drag Layer for Note Items
 *
 * Renders a custom drag preview that follows the cursor during drag operations.
 * This replaces the default browser drag preview which can capture extra elements.
 */

import React from 'react';
import { useDragLayer } from 'react-dnd';
import { Paper, Typography } from '@mui/material';
import { Description as NoteIcon } from '@mui/icons-material';
import { ItemTypes } from './DraggableNoteItem';

interface DragItem {
  noteIds: string[];
  count: number;
  sdId: string;
  noteTitle?: string; // Optional title for single note drags
}

const layerStyles: React.CSSProperties = {
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 9999,
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
};

function getItemStyles(currentOffset: { x: number; y: number } | null): React.CSSProperties {
  if (!currentOffset) {
    return {
      display: 'none',
    };
  }

  const { x, y } = currentOffset;
  const transform = `translate(${x}px, ${y}px)`;

  return {
    transform,
    WebkitTransform: transform,
  };
}

export const NoteDragLayer: React.FC = () => {
  const { itemType, isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem<DragItem | null>(),
    itemType: monitor.getItemType(),
    currentOffset: monitor.getClientOffset(),
    isDragging: monitor.isDragging(),
  }));

  if (!isDragging || itemType !== ItemTypes.NOTE || !item) {
    return null;
  }

  const isMultiDrag = item.count > 1;

  return (
    <div style={layerStyles}>
      <div style={getItemStyles(currentOffset)}>
        <Paper
          elevation={3}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            maxWidth: 250,
            opacity: 0.9,
          }}
        >
          <NoteIcon color="action" fontSize="small" />
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {isMultiDrag ? `${item.count} notes` : (item.noteTitle ?? 'Note')}
          </Typography>
        </Paper>
      </div>
    </div>
  );
};
