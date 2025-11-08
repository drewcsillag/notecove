/**
 * Draggable Note Item Component
 *
 * Wraps a note list item with drag functionality for drag-and-drop to folders.
 * Phase 2.5.7.3: Drag & Drop
 */

import React from 'react';
import { useDrag } from 'react-dnd';
import { ListItem, ListItemButton, ListItemText, Typography, Box } from '@mui/material';
import { PushPin as PushPinIcon } from '@mui/icons-material';

// Drag types for react-dnd
export const ItemTypes = {
  NOTE: 'note',
};

interface Note {
  id: string;
  title: string;
  sdId: string;
  folderId: string | null;
  created: number;
  modified: number;
  deleted: boolean;
  pinned: boolean;
  contentPreview: string;
  contentText: string;
}

interface DraggableNoteItemProps {
  note: Note;
  index: number; // Kept for future use (e.g., keyboard navigation)
  isMultiSelected: boolean;
  isSingleSelected: boolean;
  selectedNoteIds: Set<string>;
  onClick: (event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
  truncatePreview: (text: string) => string;
  formatDate: (timestamp: number) => string;
}

export const DraggableNoteItem: React.FC<DraggableNoteItemProps> = ({
  note,
  // index is kept for future use
  isMultiSelected,
  isSingleSelected,
  selectedNoteIds,
  onClick,
  onContextMenu,
  truncatePreview,
  formatDate,
}) => {
  // Set up drag
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: ItemTypes.NOTE,
      item: () => {
        // If multi-select is active and this note is selected, drag all selected notes
        if (selectedNoteIds.size > 0 && selectedNoteIds.has(note.id)) {
          return {
            noteIds: Array.from(selectedNoteIds),
            count: selectedNoteIds.size,
            sdId: note.sdId, // Include SD ID for cross-SD detection
          };
        }
        // Otherwise, drag just this note
        return {
          noteIds: [note.id],
          count: 1,
          sdId: note.sdId, // Include SD ID for cross-SD detection
        };
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [note.id, selectedNoteIds, note.sdId]
  );

  return (
    <ListItem ref={drag} key={note.id} disablePadding sx={{ opacity: isDragging ? 0.5 : 1 }}>
      <ListItemButton
        selected={isSingleSelected}
        onClick={onClick}
        onContextMenu={onContextMenu}
        data-testid={`note-item-${note.id}`}
        sx={{
          paddingY: 1.5,
          paddingX: 2,
          borderBottom: 1,
          borderColor: 'divider',
          // Highlight multi-selected notes with a different background
          backgroundColor: isMultiSelected
            ? 'rgba(33, 150, 243, 0.12)'
            : isSingleSelected
              ? 'action.selected'
              : 'transparent',
          '&:hover': {
            backgroundColor: isMultiSelected ? 'rgba(33, 150, 243, 0.2)' : undefined,
          },
          cursor: 'move',
        }}
      >
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {note.pinned && (
                <PushPinIcon
                  sx={{
                    fontSize: '1rem',
                    color: 'primary.main',
                  }}
                />
              )}
              <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>
                {note.title || 'Untitled Note'}
              </Typography>
            </Box>
          }
          secondary={
            <>
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {truncatePreview(note.contentPreview)}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', marginTop: 0.5 }}
              >
                {formatDate(note.modified)}
              </Typography>
            </>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};
