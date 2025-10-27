/**
 * Editor Panel Component
 *
 * Displays the TipTap note editor with formatting toolbar.
 */

import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { TipTapEditor } from './TipTapEditor';

export const EditorPanel: React.FC = () => {
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the selected note from app state on mount
  useEffect(() => {
    const loadSelectedNote = async () => {
      const selectedNoteId = await window.electronAPI.appState.get('selectedNoteId');
      setCurrentNoteId(selectedNoteId);
      setIsLoading(false);
    };

    void loadSelectedNote();
  }, []);

  const handleTitleChange = (title: string) => {
    // TODO: Update note title in main process via IPC
    console.log('Note title changed:', title);
  };

  // Don't render editor until we've loaded the note ID
  if (isLoading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TipTapEditor noteId={currentNoteId} onTitleChange={handleTitleChange} />
    </Box>
  );
};
