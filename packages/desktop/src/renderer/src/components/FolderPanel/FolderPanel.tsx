/**
 * Folder Panel Component
 *
 * Displays the folder tree navigation.
 * Placeholder implementation - will be replaced with actual folder tree in later phase.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const FolderPanel: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('folders.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('folders.placeholder')}
      </Typography>
    </Box>
  );
};
