/**
 * Editor Panel Component
 *
 * Displays the TipTap note editor with formatting toolbar.
 */

import React, { useState } from 'react';
import { Box } from '@mui/material';
import { TipTapEditor } from './TipTapEditor';

export const EditorPanel: React.FC = () => {
  // TODO: Get current note ID from app state
  const [currentNoteId] = useState<string | null>(null);

  const handleTitleChange = (title: string) => {
    // TODO: Update note title in main process via IPC
    console.log('Note title changed:', title);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TipTapEditor noteId={currentNoteId} onTitleChange={handleTitleChange} />
    </Box>
  );
};
