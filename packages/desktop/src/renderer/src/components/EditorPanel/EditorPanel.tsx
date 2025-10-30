/**
 * Editor Panel Component
 *
 * Displays the TipTap note editor with formatting toolbar.
 */

import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import { TipTapEditor } from './TipTapEditor';

interface EditorPanelProps {
  selectedNoteId: string | null;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ selectedNoteId }) => {
  const handleTitleChange = useCallback(
    async (noteId: string, title: string, contentText: string) => {
      try {
        await window.electronAPI.note.updateTitle(noteId, title, contentText);
      } catch (err) {
        console.error('Failed to update note title:', err);
      }
    },
    []
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Use key to force recreation of editor when switching notes */}
      <TipTapEditor
        key={selectedNoteId}
        noteId={selectedNoteId}
        onTitleChange={(noteId: string, title: string, contentText: string) => {
          void handleTitleChange(noteId, title, contentText);
        }}
      />
    </Box>
  );
};
