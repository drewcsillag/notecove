/**
 * Telemetry Settings Component
 *
 * Controls for telemetry and observability:
 * - Remote metrics toggle (export to Datadog)
 * - Datadog API key configuration
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControlLabel,
  Switch,
  TextField,
  Alert,
  AlertTitle,
} from '@mui/material';

export const TelemetrySettings: React.FC = () => {
  const [consoleMetricsEnabled, setConsoleMetricsEnabled] = useState(true);
  const [remoteMetricsEnabled, setRemoteMetricsEnabled] = useState(false);
  const [datadogApiKey, setDatadogApiKey] = useState('');
  const [loading, setLoading] = useState(true);

  // Load current telemetry settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electronAPI.telemetry.getSettings();
        setConsoleMetricsEnabled(settings.consoleMetricsEnabled);
        setRemoteMetricsEnabled(settings.remoteMetricsEnabled);
        setDatadogApiKey(settings.datadogApiKey ?? '');
      } catch (error) {
        console.error('Failed to load telemetry settings:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleRemoteMetricsToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setRemoteMetricsEnabled(enabled);

    try {
      const settings: { remoteMetricsEnabled: boolean; datadogApiKey?: string } = {
        remoteMetricsEnabled: enabled,
      };
      if (enabled && datadogApiKey) {
        settings.datadogApiKey = datadogApiKey;
      }
      await window.electronAPI.telemetry.updateSettings(settings);
    } catch (error) {
      console.error('Failed to update remote metrics setting:', error);
      // Revert on error
      setRemoteMetricsEnabled(!enabled);
    }
  };

  const handleConsoleMetricsToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setConsoleMetricsEnabled(enabled);

    try {
      await window.electronAPI.telemetry.updateSettings({ consoleMetricsEnabled: enabled });
    } catch (error) {
      console.error('Failed to update console metrics setting:', error);
      // Revert on error
      setConsoleMetricsEnabled(!enabled);
    }
  };

  const handleApiKeyChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = event.target.value;
    setDatadogApiKey(newKey);

    // Only update if remote metrics are enabled
    if (remoteMetricsEnabled) {
      try {
        const settings: { remoteMetricsEnabled: boolean; datadogApiKey?: string } = {
          remoteMetricsEnabled: true,
        };
        if (newKey) {
          settings.datadogApiKey = newKey;
        }
        await window.electronAPI.telemetry.updateSettings(settings);
      } catch (error) {
        console.error('Failed to update API key:', error);
      }
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h6" mb={2}>
        Telemetry & Observability
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        NoteCove collects performance metrics locally to help debug issues. Optionally, you can
        export these metrics to Datadog for monitoring and analysis.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Privacy Notice</AlertTitle>
        All metrics are stored locally on your device. Remote metrics export is optional and
        user-controlled. No personal information is ever included in metrics.
      </Alert>

      <FormControlLabel
        control={
          <Switch
            checked={consoleMetricsEnabled}
            onChange={(e) => {
              void handleConsoleMetricsToggle(e);
            }}
          />
        }
        label="Console Metrics Logging"
      />

      <Typography variant="caption" color="text.secondary" display="block" mt={1} mb={3}>
        Log metrics to the developer console (useful for debugging, can be noisy)
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={remoteMetricsEnabled}
            onChange={(e) => {
              void handleRemoteMetricsToggle(e);
            }}
          />
        }
        label="Export Metrics to Datadog"
      />

      <Typography variant="caption" color="text.secondary" display="block" mt={1} mb={3}>
        Enable remote metrics export to Datadog for centralized monitoring and dashboards
      </Typography>

      {remoteMetricsEnabled && (
        <TextField
          fullWidth
          type="password"
          label="Datadog API Key"
          value={datadogApiKey}
          onChange={(e) => {
            void handleApiKeyChange(e as React.ChangeEvent<HTMLInputElement>);
          }}
          placeholder="Enter your Datadog API key"
          helperText="Your API key will be stored securely and only used for metrics export"
          sx={{ mt: 2 }}
        />
      )}

      <Typography variant="body2" color="text.secondary" mt={3}>
        <strong>What metrics are collected?</strong>
        <br />• Cold load times (P50, P95, P99)
        <br />• Snapshot creation times
        <br />• Pack creation times
        <br />• Garbage collection statistics
        <br />• File counts per note
      </Typography>
    </Box>
  );
};
