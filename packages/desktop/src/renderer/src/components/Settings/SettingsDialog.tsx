/**
 * Settings Dialog Component
 *
 * Modal dialog for application settings including:
 * - Storage Directory management
 * - User settings (username, handle)
 * - Appearance settings (dark mode)
 *
 * In browser mode, some tabs are hidden as they require Electron features.
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import { TelemetrySettings } from './TelemetrySettings';
import { RecoverySettings } from './RecoverySettings';
import { WebServerSettings } from './WebServerSettings';
import { OEmbedSettings } from './OEmbedSettings';
import { AdvancedSettings } from './AdvancedSettings';
import { isElectron } from '../../utils/platform';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { useProfileMode } from '../../contexts/ProfileModeContext';

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

/**
 * Tab configuration for settings dialog.
 * Some tabs are only available in Electron mode or require feature flags.
 */
interface TabConfig {
  label: string;
  electronOnly: boolean;
  /** Feature flag required for this tab (if any) */
  featureFlag?: 'telemetry' | 'viewHistory' | 'webServer';
  /** Hide this tab in paranoid profile mode */
  hideInParanoidMode?: boolean;
  component: React.ReactNode;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  themeMode,
  onThemeChange,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const inElectron = isElectron();
  const { isEnabled } = useFeatureFlags();
  const { mode: profileMode } = useProfileMode();

  // Define all tabs with their Electron-only status
  const allTabs: TabConfig[] = useMemo(
    () => [
      {
        label: 'Storage Directories',
        electronOnly: true,
        component: <StorageDirectorySettings />,
      },
      {
        label: 'User',
        electronOnly: false,
        component: <UserSettings />,
      },
      {
        label: 'Appearance',
        electronOnly: false,
        component: <AppearanceSettings themeMode={themeMode} onThemeChange={onThemeChange} />,
      },
      {
        label: 'Link Previews',
        electronOnly: true,
        hideInParanoidMode: true, // Not editable in paranoid mode
        component: <OEmbedSettings />,
      },
      {
        label: 'Telemetry',
        electronOnly: true,
        featureFlag: 'telemetry',
        component: <TelemetrySettings />,
      },
      {
        label: 'Web Server',
        electronOnly: true,
        featureFlag: 'webServer',
        component: <WebServerSettings />,
      },
      {
        label: 'Recovery',
        electronOnly: true,
        component: <RecoverySettings />,
      },
      {
        label: 'Advanced',
        electronOnly: true,
        component: <AdvancedSettings />,
      },
    ],
    [themeMode, onThemeChange]
  );

  // Filter tabs based on platform, feature flags, and profile mode
  const visibleTabs = useMemo(
    () =>
      allTabs.filter((tab) => {
        // Check platform requirement
        if (tab.electronOnly && !inElectron) return false;
        // Check feature flag requirement
        if (tab.featureFlag && !isEnabled(tab.featureFlag)) return false;
        // Check paranoid mode restriction
        if (tab.hideInParanoidMode && profileMode === 'paranoid') return false;
        return true;
      }),
    [allTabs, inElectron, isEnabled, profileMode]
  );

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
            {visibleTabs.map((tab, index) => (
              <Tab key={tab.label} label={tab.label} {...a11yProps(index)} />
            ))}
          </Tabs>
        </Box>
        {visibleTabs.map((tab, index) => (
          <TabPanel key={tab.label} value={tabValue} index={index}>
            {tab.component}
          </TabPanel>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
