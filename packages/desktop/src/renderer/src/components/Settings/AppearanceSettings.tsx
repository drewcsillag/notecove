/**
 * Appearance Settings Component
 *
 * Visual/theme settings:
 * - Dark mode toggle
 * - (Future: custom colors, font size, etc.)
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography, FormControlLabel, Switch, Alert } from '@mui/material';

export const AppearanceSettings: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Load dark mode preference
    // TODO: Implement loading from app state and applying theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
  }, []);

  const handleDarkModeToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setDarkMode(newValue);
    // TODO: Implement saving to app state and applying theme
    console.log('Dark mode:', newValue);
  };

  return (
    <Box>
      <Typography variant="h6" mb={2}>
        Appearance
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Customize the look and feel of NoteCove.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Dark mode implementation is pending. Theme changes will take effect after restart.
      </Alert>

      <FormControlLabel
        control={<Switch checked={darkMode} onChange={handleDarkModeToggle} />}
        label="Dark Mode"
      />

      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
        Enable dark theme for reduced eye strain in low-light environments
      </Typography>
    </Box>
  );
};
