/**
 * Material-UI Theme Configuration
 */

import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: '#2196F3', // Blue accent
      },
      secondary: {
        main: '#1976D2',
      },
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            margin: 0,
            padding: 0,
            overflow: 'hidden',
          },
        },
      },
    },
  });

// Default light theme for backward compatibility
export const theme = createAppTheme('light');
