/**
 * Settings Dialog Component
 *
 * Modal dialog for application settings including:
 * - Storage Directory management
 * - User settings (username, handle)
 * - Appearance settings (dark mode)
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { StorageDirectorySettings } from './StorageDirectorySettings';
import { UserSettings } from './UserSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { DatabaseSettings } from './DatabaseSettings';
import { TelemetrySettings } from './TelemetrySettings';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  themeMode: 'light' | 'dark';
  onThemeChange: (mode: 'light' | 'dark') => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  themeMode,
  onThemeChange,
}) => {
  const [tabValue, setTabValue] = useState(0);

  // Reset to first tab when dialog closes
  useEffect(() => {
    if (!open) {
      setTabValue(0);
    }
  }, [open]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleClose = () => {
    setTabValue(0); // Reset to first tab
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '600px' },
      }}
    >
      <DialogTitle>
        Settings
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
            <Tab label="Storage Directories" {...a11yProps(0)} />
            <Tab label="User" {...a11yProps(1)} />
            <Tab label="Appearance" {...a11yProps(2)} />
            <Tab label="Telemetry" {...a11yProps(3)} />
            <Tab label="Database" {...a11yProps(4)} />
          </Tabs>
        </Box>
        <TabPanel value={tabValue} index={0}>
          <StorageDirectorySettings />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <UserSettings />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <AppearanceSettings themeMode={themeMode} onThemeChange={onThemeChange} />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <TelemetrySettings />
        </TabPanel>
        <TabPanel value={tabValue} index={4}>
          <DatabaseSettings />
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
