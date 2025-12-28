/**
 * Cache Browser Dialog
 *
 * Modal dialog to browse the oEmbed cache contents.
 * Shows cached favicons, thumbnails, and fetch cache entries.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';

interface CachedFavicon {
  domain: string;
  dataUrl: string;
  fetchedAt: number;
}

interface CachedThumbnail {
  url: string;
  dataUrl: string;
  sizeBytes: number;
  fetchedAt: number;
}

interface CachedFetch {
  url: string;
  rawJson: string;
  fetchedAt: number;
}

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
      id={`cache-tabpanel-${index}`}
      aria-labelledby={`cache-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function truncateUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

interface CacheBrowserDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CacheBrowserDialog: React.FC<CacheBrowserDialogProps> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favicons, setFavicons] = useState<CachedFavicon[]>([]);
  const [thumbnails, setThumbnails] = useState<CachedThumbnail[]>([]);
  const [fetchCache, setFetchCache] = useState<CachedFetch[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [faviconData, thumbnailData, fetchData] = await Promise.all([
        window.electronAPI.oembed.debug.listFavicons(),
        window.electronAPI.oembed.debug.listThumbnails(),
        window.electronAPI.oembed.debug.listFetchCache(),
      ]);
      setFavicons(faviconData);
      setThumbnails(thumbnailData);
      setFetchCache(fetchData);
    } catch (err) {
      console.error('Failed to load cache data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDeleteFavicon = async (domain: string) => {
    try {
      await window.electronAPI.oembed.debug.deleteFavicon(domain);
      setFavicons((prev) => prev.filter((f) => f.domain !== domain));
    } catch (err) {
      console.error('Failed to delete favicon:', err);
    }
  };

  const handleDeleteThumbnail = async (url: string) => {
    try {
      await window.electronAPI.oembed.debug.deleteThumbnail(url);
      setThumbnails((prev) => prev.filter((t) => t.url !== url));
    } catch (err) {
      console.error('Failed to delete thumbnail:', err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Cache Browser</Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={() => void loadData()} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label={`Favicons (${favicons.length})`} />
              <Tab label={`Thumbnails (${thumbnails.length})`} />
              <Tab label={`Fetch Cache (${fetchCache.length})`} />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {favicons.length === 0 ? (
                <Typography color="text.secondary" py={2}>
                  No cached favicons
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={50}>Icon</TableCell>
                        <TableCell>Domain</TableCell>
                        <TableCell>Fetched</TableCell>
                        <TableCell width={50}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {favicons.map((favicon) => (
                        <TableRow key={favicon.domain}>
                          <TableCell>
                            <img src={favicon.dataUrl} alt="" style={{ width: 16, height: 16 }} />
                          </TableCell>
                          <TableCell>{favicon.domain}</TableCell>
                          <TableCell>{formatDate(favicon.fetchedAt)}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => void handleDeleteFavicon(favicon.domain)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {thumbnails.length === 0 ? (
                <Typography color="text.secondary" py={2}>
                  No cached thumbnails
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={80}>Preview</TableCell>
                        <TableCell>URL</TableCell>
                        <TableCell width={80}>Size</TableCell>
                        <TableCell>Fetched</TableCell>
                        <TableCell width={50}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {thumbnails.map((thumbnail) => (
                        <TableRow key={thumbnail.url}>
                          <TableCell>
                            <img
                              src={thumbnail.dataUrl}
                              alt=""
                              style={{ width: 60, height: 40, objectFit: 'cover' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title={thumbnail.url}>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                                {truncateUrl(thumbnail.url)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{formatBytes(thumbnail.sizeBytes)}</TableCell>
                          <TableCell>{formatDate(thumbnail.fetchedAt)}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => void handleDeleteThumbnail(thumbnail.url)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {fetchCache.length === 0 ? (
                <Typography color="text.secondary" py={2}>
                  No cached fetches
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>URL</TableCell>
                        <TableCell>Data</TableCell>
                        <TableCell>Fetched</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {fetchCache.map((entry) => (
                        <TableRow key={entry.url}>
                          <TableCell>
                            <Tooltip title={entry.url}>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                                {truncateUrl(entry.url)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={entry.rawJson}>
                              <Typography
                                variant="body2"
                                noWrap
                                sx={{ maxWidth: 200, fontFamily: 'monospace', fontSize: 11 }}
                              >
                                {truncateUrl(entry.rawJson, 40)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{formatDate(entry.fetchedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
