/**
 * Advanced Settings Component
 *
 * Settings for polling group configuration:
 * - Poll rate configuration
 * - Recent edit window
 * - Full repoll interval
 * - Fast path max delay
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Slider,
  Stack,
  Divider,
  Paper,
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { isElectron } from '../../utils/platform';
import type { PollingGroupStoredSettings } from '@notecove/shared';

// Default values matching the PollingGroup defaults
const DEFAULTS = {
  pollRatePerMinute: 120,
  hitRateMultiplier: 0.25,
  maxBurstPerSecond: 10,
  normalPriorityReserve: 0.2,
  recentEditWindowMinutes: 5,
  fullRepollIntervalMinutes: 30,
  fastPathMaxDelaySeconds: 60,
};

interface SettingSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  unit?: string;
  onChange: (value: number) => void;
  marks?: { value: number; label: string }[];
}

const SettingSlider: React.FC<SettingSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  unit = '',
  onChange,
  marks,
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography gutterBottom>
        {label}: {value}
        {unit}
      </Typography>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(_e, newValue) => {
          onChange(newValue as number);
        }}
        marks={marks ?? false}
        valueLabelDisplay="auto"
      />
    </Box>
  );
};

export const AdvancedSettings: React.FC = () => {
  const [settings, setSettings] = useState<PollingGroupStoredSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullRepollEnabled, setFullRepollEnabled] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      if (!isElectron()) {
        setLoading(false);
        return;
      }

      try {
        const stored = await window.electronAPI.polling.getSettings();
        setSettings({ ...DEFAULTS, ...stored });
        setFullRepollEnabled(
          stored.fullRepollIntervalMinutes === undefined || stored.fullRepollIntervalMinutes > 0
        );
      } catch (error) {
        console.error('[AdvancedSettings] Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  // Save settings when they change (debounced)
  useEffect(() => {
    if (loading) return;

    const saveTimeout = setTimeout(() => {
      const saveSettings = async (): Promise<void> => {
        if (!isElectron()) return;

        setSaving(true);
        try {
          await window.electronAPI.polling.setSettings(settings);
        } catch (error) {
          console.error('[AdvancedSettings] Error saving settings:', error);
        } finally {
          setSaving(false);
        }
      };

      void saveSettings();
    }, 500);

    return () => {
      clearTimeout(saveTimeout);
    };
  }, [settings, loading]);

  const updateSetting = (key: keyof PollingGroupStoredSettings, value: number): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleFullRepollToggle = (enabled: boolean): void => {
    setFullRepollEnabled(enabled);
    if (enabled) {
      // Restore to default 30 minutes
      updateSetting('fullRepollIntervalMinutes', DEFAULTS.fullRepollIntervalMinutes);
    } else {
      // Disable by setting to 0
      updateSetting('fullRepollIntervalMinutes', 0);
    }
  };

  if (!isElectron()) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">
          Advanced sync settings are only available in the desktop app.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack spacing={3}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: -1 }}>
          Configure how NoteCove polls for changes from other devices. These settings affect battery
          usage and sync speed.
          {saving && ' (Saving...)'}
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Polling Rate
          </Typography>

          <SettingSlider
            label="Base poll rate"
            value={settings.pollRatePerMinute ?? DEFAULTS.pollRatePerMinute}
            min={60}
            max={300}
            step={10}
            unit=" polls/min"
            onChange={(v) => {
              updateSetting('pollRatePerMinute', v);
            }}
            marks={[
              { value: 60, label: '60' },
              { value: 120, label: '120' },
              { value: 180, label: '180' },
              { value: 240, label: '240' },
              { value: 300, label: '300' },
            ]}
          />

          <SettingSlider
            label="Max burst rate"
            value={settings.maxBurstPerSecond ?? DEFAULTS.maxBurstPerSecond}
            min={5}
            max={20}
            unit=" polls/sec"
            onChange={(v) => {
              updateSetting('maxBurstPerSecond', v);
            }}
          />
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Timing
          </Typography>

          <SettingSlider
            label="Recent edit window"
            value={settings.recentEditWindowMinutes ?? DEFAULTS.recentEditWindowMinutes}
            min={1}
            max={30}
            unit=" min"
            onChange={(v) => {
              updateSetting('recentEditWindowMinutes', v);
            }}
          />

          <SettingSlider
            label="Fast path max delay"
            value={settings.fastPathMaxDelaySeconds ?? DEFAULTS.fastPathMaxDelaySeconds}
            min={30}
            max={120}
            unit=" sec"
            onChange={(v) => {
              updateSetting('fastPathMaxDelaySeconds', v);
            }}
          />

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={fullRepollEnabled}
                onChange={(e) => {
                  handleFullRepollToggle(e.target.checked);
                }}
              />
            }
            label="Enable periodic full repoll"
          />

          {fullRepollEnabled && (
            <SettingSlider
              label="Full repoll interval"
              value={settings.fullRepollIntervalMinutes ?? DEFAULTS.fullRepollIntervalMinutes}
              min={15}
              max={120}
              step={5}
              unit=" min"
              onChange={(v) => {
                updateSetting('fullRepollIntervalMinutes', v);
              }}
            />
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Advanced
          </Typography>

          <SettingSlider
            label="Hit rate multiplier"
            value={settings.hitRateMultiplier ?? DEFAULTS.hitRateMultiplier}
            min={0.1}
            max={1.0}
            step={0.05}
            onChange={(v) => {
              updateSetting('hitRateMultiplier', v);
            }}
          />

          <Typography variant="body2" color="text.secondary" sx={{ mt: -2 }}>
            Lower values accelerate polling when changes are detected (0.25 = 4x faster on hits)
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
};
