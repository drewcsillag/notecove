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
    async (title: string, contentText: string) => {
      if (!selectedNoteId) {
        console.log('[EditorPanel] Skipping title update - no note selected');
        return;
      }

      console.log(`[EditorPanel] Updating title for note ${selectedNoteId}: "${title}"`);
      try {
        await window.electronAPI.note.updateTitle(selectedNoteId, title, contentText);
        console.log(`[EditorPanel] Title updated successfully`);
      } catch (err) {
        console.error('Failed to update note title:', err);
      }
    },
    [selectedNoteId]
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Use key to force recreation of editor when switching notes */}
      <TipTapEditor
        key={selectedNoteId}
        noteId={selectedNoteId}
        onTitleChange={(title: string, contentText: string) =>
          void handleTitleChange(title, contentText)
        }
      />
    </Box>
  );
};
