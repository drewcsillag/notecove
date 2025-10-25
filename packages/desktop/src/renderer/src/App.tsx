/**
 * Main App Component
 */

import React from 'react';
import { CssBaseline, ThemeProvider, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { theme } from './theme';
import './i18n';

function App(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ padding: 3 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          {t('app.title')}
        </Typography>
        <Typography variant="subtitle1" gutterBottom>
          {t('app.tagline')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Platform: {window.electronAPI.platform}
        </Typography>
      </Box>
    </ThemeProvider>
  );
}

export default App;
