/**
 * About Window Component
 *
 * Standalone page component that displays application information.
 * Designed to be rendered in its own window (not as a dialog).
 * Shows:
 * - App name and version
 * - Development build indicator (if applicable)
 * - Profile name and ID (compact format)
 * - Instance ID (compact format)
 * - Copyright notice
 * - License information with link
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, Link, CircularProgress } from '@mui/material';
import { normalizeUuid, isFullUuid, isCompactUuid } from '@notecove/shared';

interface AppInfo {
  version: string;
  isDevBuild: boolean;
  profileId: string | null;
  profileName: string | null;
  instanceId: string;
}

/**
 * Convert a UUID to compact format, handling both old and new formats.
 */
function toCompact(id: string | null): string | null {
  if (!id) return null;
  if (isCompactUuid(id)) return id;
  if (isFullUuid(id)) return normalizeUuid(id);
  return id; // Return as-is if unknown format
}

export const AboutWindow: React.FC = () => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Load app info when component mounts
  useEffect(() => {
    const loadAppInfo = async (): Promise<void> => {
      setLoading(true);
      try {
        const info = await window.electronAPI.app.getInfo();
        setAppInfo(info);
      } catch (err) {
        console.error('[AboutWindow] Failed to load app info:', err);
      } finally {
        setLoading(false);
      }
    };

    void loadAppInfo();
  }, []);

  const handleLicenseClick = (): void => {
    void window.electronAPI.shell.openExternal('https://www.apache.org/licenses/LICENSE-2.0');
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          py: 4,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
        NoteCove
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
        Version {appInfo?.version ?? '...'}
      </Typography>

      {appInfo?.isDevBuild && (
        <Typography
          variant="body2"
          sx={{
            mb: 2,
            color: 'warning.main',
            fontWeight: 'medium',
          }}
        >
          Development Build
        </Typography>
      )}

      {appInfo?.profileName && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Profile: {appInfo.profileName}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
            {toCompact(appInfo.profileId)}
          </Typography>
        </Box>
      )}

      {appInfo?.instanceId && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Instance
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
            {toCompact(appInfo.instanceId)}
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          © 2025 Drew Csillag
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Licensed under{' '}
          <Link
            component="button"
            variant="body2"
            onClick={handleLicenseClick}
            sx={{ cursor: 'pointer' }}
          >
            Apache 2.0
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};
