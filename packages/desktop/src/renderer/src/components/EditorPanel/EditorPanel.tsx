/**
 * Editor Panel Component
 *
 * Displays the note editor.
 * Placeholder implementation - will be replaced with TipTap editor in later phase.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const EditorPanel: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('editor.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('editor.placeholder')}
      </Typography>
    </Box>
  );
};
