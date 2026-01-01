/**
 * Appearance Settings Component
 *
 * Visual/theme settings:
 * - Dark mode toggle
 * - Checkbox behavior toggles
 */

import React from 'react';
import { Box, Typography, FormControlLabel, Switch, Divider } from '@mui/material';
import { useCheckboxSettings } from '../../contexts/CheckboxSettingsContext';

export interface AppearanceSettingsProps {
  themeMode: 'light' | 'dark';
  onThemeChange: (mode: 'light' | 'dark') => void;
}

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  themeMode,
  onThemeChange: _onThemeChange, // kept for backward compatibility but not used
}) => {
  const {
    strikethrough,
    autoReorder,
    nopeEnabled,
    setStrikethrough,
    setAutoReorder,
    setNopeEnabled,
    isLoading,
  } = useCheckboxSettings();

  const handleDarkModeToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newMode = event.target.checked ? 'dark' : 'light';
    // Use IPC to set theme - this broadcasts to all windows
    void window.electronAPI.theme.set(newMode);
  };

  const handleStrikethroughToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    void setStrikethrough(event.target.checked);
  };

  const handleAutoReorderToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    void setAutoReorder(event.target.checked);
  };

  const handleNopeEnabledToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    void setNopeEnabled(event.target.checked);
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

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" mb={2}>
        Checkbox Behavior
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={strikethrough}
              onChange={handleStrikethroughToggle}
              disabled={isLoading}
            />
          }
          label="Strikethrough completed items"
        />

        <Typography variant="caption" color="text.secondary" display="block" ml={6} mt={-1}>
          Apply strikethrough text style to checked and cancelled checkbox items
        </Typography>

        <FormControlLabel
          control={
            <Switch checked={autoReorder} onChange={handleAutoReorderToggle} disabled={isLoading} />
          }
          label="Move completed items to bottom"
        />

        <Typography variant="caption" color="text.secondary" display="block" ml={6} mt={-1}>
          Automatically move completed checkbox items to the bottom of their list
        </Typography>

        <FormControlLabel
          control={
            <Switch checked={nopeEnabled} onChange={handleNopeEnabledToggle} disabled={isLoading} />
          }
          label="Enable nope state for checkboxes"
        />

        <Typography variant="caption" color="text.secondary" display="block" ml={6} mt={-1}>
          Allow checkboxes to cycle through three states: unchecked, checked, and cancelled (nope)
        </Typography>
      </Box>
    </Box>
  );
};
