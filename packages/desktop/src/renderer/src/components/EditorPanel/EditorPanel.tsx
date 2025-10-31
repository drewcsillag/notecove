/**
 * Editor Panel Component
 *
 * Displays the TipTap note editor with formatting toolbar.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { TipTapEditor } from './TipTapEditor';

interface EditorPanelProps {
  selectedNoteId: string | null;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ selectedNoteId }) => {
  const [isNoteDeleted, setIsNoteDeleted] = useState(false);

  // Check if the selected note is deleted
  useEffect(() => {
    if (!selectedNoteId) {
      setIsNoteDeleted(false);
      return;
    }

    const checkNoteStatus = async (): Promise<void> => {
      try {
        const metadata = await window.electronAPI.note.getMetadata(selectedNoteId);
        setIsNoteDeleted(metadata.deleted);
      } catch (err) {
        console.error('Failed to get note metadata:', err);
        setIsNoteDeleted(false);
      }
    };

    void checkNoteStatus();
  }, [selectedNoteId]);

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
        readOnly={isNoteDeleted}
        onTitleChange={(noteId: string, title: string, contentText: string) => {
          void handleTitleChange(noteId, title, contentText);
        }}
      />
    </Box>
  );
};
