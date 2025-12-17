/**
 * Appearance Settings Component
 *
 * Visual/theme settings:
 * - Dark mode toggle
 * - (Future: custom colors, font size, etc.)
 */

import React from 'react';
import { Box, Typography, FormControlLabel, Switch } from '@mui/material';

export interface AppearanceSettingsProps {
  themeMode: 'light' | 'dark';
  onThemeChange: (mode: 'light' | 'dark') => void;
}

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  onThemeChange: _onThemeChange, // kept for backward compatibility but not used
}) => {
  const handleDarkModeToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newMode = event.target.checked ? 'dark' : 'light';
    // Use IPC to set theme - this broadcasts to all windows
    void window.electronAPI.theme.set(newMode);
  };

  return (
    <Box>
      <Typography variant="h6" mb={2}>
        Appearance
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Customize the look and feel of NoteCove.
      </Typography>

      <FormControlLabel
        control={<Switch checked={themeMode === 'dark'} onChange={handleDarkModeToggle} />}
        label="Dark Mode"
      />

      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
        Enable dark theme for reduced eye strain in low-light environments
      </Typography>
    </Box>
  );
};
