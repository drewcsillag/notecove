/**
 * Notes List Panel Component
 *
 * Displays the list of notes in the selected folder.
 * Placeholder implementation - will be replaced with actual notes list in later phase.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const NotesListPanel: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('notes.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('notes.placeholder')}
      </Typography>
    </Box>
  );
};
