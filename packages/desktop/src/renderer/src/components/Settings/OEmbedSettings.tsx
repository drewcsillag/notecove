/**
 * oEmbed Settings Component
 *
 * Settings for link preview functionality:
 * - Link display preference (none, chip, unfurl)
 * - Cache statistics display
 * - Clear cache buttons
 * - Cache browser
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import type { LinkDisplayPreference } from '@notecove/shared';
import { useLinkDisplayPreference } from '../../contexts/LinkDisplayPreferenceContext';
import { CacheBrowserDialog } from './CacheBrowserDialog';
import { isElectron } from '../../utils/platform';

/**
 * Cache stats from the oEmbed service
 */
interface CacheStats {
  fetchCacheCount: number;
  faviconCount: number;
  thumbnailCount: number;
  thumbnailTotalSizeBytes: number;
  providerCount: number;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const OEmbedSettings: React.FC = () => {
  const { preference, setPreference, isLoading: preferenceLoading } = useLinkDisplayPreference();
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearingThumbnails, setClearingThumbnails] = useState(false);
  const [clearingFavicons, setClearingFavicons] = useState(false);
  const [clearingFetchCache, setClearingFetchCache] = useState(false);
  const [cacheBrowserOpen, setCacheBrowserOpen] = useState(false);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(true);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);

  const handleLinkDisplayChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void setPreference(event.target.value as LinkDisplayPreference);
  };

  // Load discovery preference
  useEffect(() => {
    const loadDiscoveryPref = async (): Promise<void> => {
      if (!isElectron()) {
        setDiscoveryLoading(false);
        return;
      }
      try {
        const stored = await window.electronAPI.appState.get('oembedDiscoveryEnabled');
        // Default to true if not set
        setDiscoveryEnabled(stored !== 'false');
      } catch (err) {
        console.error('Failed to load discovery preference:', err);
      } finally {
        setDiscoveryLoading(false);
      }
    };
    void loadDiscoveryPref();
  }, []);

  const handleDiscoveryChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setDiscoveryEnabled(enabled);
    if (isElectron()) {
      try {
        await window.electronAPI.appState.set('oembedDiscoveryEnabled', enabled ? 'true' : 'false');
      } catch (err) {
        console.error('Failed to save discovery preference:', err);
      }
    }
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const cacheStats = await window.electronAPI.oembed.getCacheStats();
      setStats(cacheStats);
    } catch (err) {
      console.error('Failed to load oEmbed cache stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleClearThumbnails = async () => {
    setClearingThumbnails(true);
    try {
      await window.electronAPI.oembed.debug.clearAllThumbnails();
      await loadStats();
    } catch (err) {
      console.error('Failed to clear thumbnails:', err);
    } finally {
      setClearingThumbnails(false);
    }
  };

  const handleClearFavicons = async () => {
    setClearingFavicons(true);
    try {
      await window.electronAPI.oembed.debug.clearAllFavicons();
      await loadStats();
    } catch (err) {
      console.error('Failed to clear favicons:', err);
    } finally {
      setClearingFavicons(false);
    }
  };

  const handleClearFetchCache = async () => {
    setClearingFetchCache(true);
    try {
      await window.electronAPI.oembed.clearCache();
      await loadStats();
    } catch (err) {
      console.error('Failed to clear fetch cache:', err);
    } finally {
      setClearingFetchCache(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" mb={2}>
        Link Previews
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Link previews show rich cards for URLs in your notes. This includes thumbnails, titles, and
        descriptions fetched from websites.
      </Typography>

      {/* Link Display Preference */}
      <Typography variant="subtitle1" mb={1}>
        Display Style
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Choose how web links are displayed in your notes.
      </Typography>

      <FormControl component="fieldset" disabled={preferenceLoading}>
        <RadioGroup value={preference} onChange={handleLinkDisplayChange}>
          <FormControlLabel
            value="unfurl"
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2">Rich previews</Typography>
                <Typography variant="caption" color="text.secondary">
                  Show full preview cards with title, description, and thumbnail
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 1 }}
          />
          <FormControlLabel
            value="chip"
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2">Compact chips</Typography>
                <Typography variant="caption" color="text.secondary">
                  Show links as small chips with favicon and title
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 1 }}
          />
          <FormControlLabel
            value="none"
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2">Plain links</Typography>
                <Typography variant="caption" color="text.secondary">
                  Show links as regular text, with option to convert individually
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 1 }}
          />
          <FormControlLabel
            value="secure"
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2">Plain links (secure - no network requests)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Plain text links only, no previews or favicon fetching
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start' }}
          />
        </RadioGroup>
      </FormControl>

      <Typography variant="caption" color="text.secondary" display="block" mt={2} mb={3}>
        Note: This setting affects newly added links. Existing links will retain their current
        display style.
      </Typography>

      <Divider sx={{ my: 2 }} />

      {/* Discovery Setting */}
      <Typography variant="subtitle1" mb={1}>
        oEmbed Discovery
      </Typography>

      <Box display="flex" alignItems="flex-start" mb={2}>
        <Switch
          checked={discoveryEnabled}
          onChange={(e) => void handleDiscoveryChange(e)}
          disabled={discoveryLoading || preference === 'secure'}
          size="small"
        />
        <Box ml={1}>
          <Typography variant="body2">Enable automatic discovery</Typography>
          <Typography variant="caption" color="text.secondary">
            When enabled, NoteCove will attempt to find preview data from websites not in the
            built-in registry by fetching and parsing the page HTML. Disable this for increased
            privacy.
          </Typography>
        </Box>
      </Box>

      {preference === 'secure' && (
        <Typography variant="caption" color="warning.main" display="block" mb={2}>
          Discovery is automatically disabled when &quot;Plain links (secure)&quot; is selected.
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Cache Statistics */}
      <Typography variant="subtitle1" mb={2}>
        Cache Statistics
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={24} />
        </Box>
      ) : stats ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Stack spacing={1}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Thumbnails
              </Typography>
              <Typography variant="body2">
                {stats.thumbnailCount} ({formatBytes(stats.thumbnailTotalSizeBytes)})
              </Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Favicons
              </Typography>
              <Typography variant="body2">{stats.faviconCount}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Fetch Cache
              </Typography>
              <Typography variant="body2">{stats.fetchCacheCount} entries</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Known Providers
              </Typography>
              <Typography variant="body2">{stats.providerCount}</Typography>
            </Box>
          </Stack>
        </Paper>
      ) : (
        <Typography color="text.secondary" mb={3}>
          Unable to load cache statistics.
        </Typography>
      )}

      <Button
        variant="outlined"
        startIcon={<StorageIcon />}
        onClick={() => {
          setCacheBrowserOpen(true);
        }}
        sx={{ mb: 3 }}
      >
        Browse Cache
      </Button>

      {/* Cache Management Buttons */}
      <Typography variant="subtitle1" mb={2}>
        Cache Management
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Clearing the cache will remove cached thumbnails and favicons. The next time you view a link
        preview, the data will be fetched again from the website.
      </Typography>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Button
          variant="outlined"
          startIcon={clearingThumbnails ? <CircularProgress size={16} /> : <DeleteIcon />}
          onClick={() => void handleClearThumbnails()}
          disabled={clearingThumbnails || loading}
        >
          Clear Thumbnails
        </Button>
        <Button
          variant="outlined"
          startIcon={clearingFavicons ? <CircularProgress size={16} /> : <DeleteIcon />}
          onClick={() => void handleClearFavicons()}
          disabled={clearingFavicons || loading}
        >
          Clear Favicons
        </Button>
        <Button
          variant="outlined"
          startIcon={clearingFetchCache ? <CircularProgress size={16} /> : <DeleteIcon />}
          onClick={() => void handleClearFetchCache()}
          disabled={clearingFetchCache || loading}
        >
          Clear Fetch Cache
        </Button>
        <Button
          variant="text"
          startIcon={<RefreshIcon />}
          onClick={() => void loadStats()}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary" display="block" mt={2}>
        Note: Link preview data is stored in each note and syncs across devices. Clearing the cache
        only removes locally cached images.
      </Typography>

      {/* Cache Browser Dialog */}
      <CacheBrowserDialog
        open={cacheBrowserOpen}
        onClose={() => {
          setCacheBrowserOpen(false);
        }}
      />
    </Box>
  );
};
