/**
 * Web Server Settings Component
 *
 * Allows users to configure and control the web server for browser access.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem as MuiMenuItem,
  FormControl,
  InputLabel,
  Link,
  Collapse,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import QRCode from 'qrcode';

type TLSMode = 'off' | 'self-signed' | 'custom';

interface WebServerStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  token: string | null;
  connectedClients: number;
  localhostOnly: boolean;
  tlsMode: TLSMode;
  tlsEnabled: boolean;
}

interface WebServerSettings {
  port: number;
  localhostOnly: boolean;
  tlsMode: TLSMode;
  customCertPath?: string;
  customKeyPath?: string;
}

interface ConnectedClientInfo {
  id: string;
  ip: string;
  userAgent: string;
  connectedAt: number;
}

interface CertificateInfo {
  commonName: string;
  validFrom: string;
  validTo: string;
  isSelfSigned: boolean;
  fingerprint: string;
  path: string;
}

export function WebServerSettings(): React.ReactElement {
  const [status, setStatus] = useState<WebServerStatus | null>(null);
  const [settings, setSettings] = useState<WebServerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [portInput, setPortInput] = useState('8765');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [connectedClients, setConnectedClients] = useState<ConnectedClientInfo[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certInfo, setCertInfo] = useState<CertificateInfo | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const serverStatus: WebServerStatus = await window.electronAPI.webServer.getStatus();
      const serverSettings: WebServerSettings = await window.electronAPI.webServer.getSettings();
      const certificateInfo: CertificateInfo | null =
        await window.electronAPI.webServer.getCertificateInfo();
      setStatus(serverStatus);
      setSettings(serverSettings);
      setPortInput(String(serverSettings.port));
      setCertInfo(certificateInfo);
    } catch (error: unknown) {
      console.error('Failed to load web server status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Generate QR code when server is running with valid URL and token
  useEffect(() => {
    const generateQR = async () => {
      if (status?.running && status.url && status.token) {
        try {
          const fullUrl = `${status.url}?token=${status.token}`;
          const dataUrl = await QRCode.toDataURL(fullUrl, {
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
          setQrCodeDataUrl(dataUrl);
        } catch (error: unknown) {
          console.error('Failed to generate QR code:', error);
          setQrCodeDataUrl(null);
        }
      } else {
        setQrCodeDataUrl(null);
      }
    };
    void generateQR();
  }, [status?.running, status?.url, status?.token]);

  // Load connected clients when server is running (poll every 5 seconds)
  useEffect(() => {
    if (!status?.running) {
      setConnectedClients([]);
      return;
    }

    const loadClients = async () => {
      try {
        const clients = await window.electronAPI.webServer.getConnectedClients();
        setConnectedClients(clients);
      } catch (error: unknown) {
        console.error('Failed to load connected clients:', error);
      }
    };

    void loadClients();
    const interval = setInterval(() => {
      void loadClients();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [status?.running]);

  const handleToggleServer = async () => {
    try {
      setActionLoading(true);
      setError(null); // Clear previous error
      if (status?.running) {
        await window.electronAPI.webServer.stop();
      } else {
        const port = parseInt(portInput, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
          setError('Port must be between 1024 and 65535');
          return;
        }
        await window.electronAPI.webServer.start(port);
      }
      await loadStatus();
    } catch (err: unknown) {
      console.error('Failed to toggle web server:', err);
      // Extract error message for display
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'An unknown error occurred';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettingsChange = async (newSettings: Partial<WebServerSettings>) => {
    try {
      await window.electronAPI.webServer.setSettings(newSettings);
      await loadStatus();
    } catch (error: unknown) {
      console.error('Failed to update settings:', error);
    }
  };

  const handleRegenerateToken = async () => {
    try {
      setActionLoading(true);
      await window.electronAPI.webServer.regenerateToken();
      await loadStatus();
    } catch (error: unknown) {
      console.error('Failed to regenerate token:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => {
        setCopySuccess(null);
      }, 2000);
    } catch (error: unknown) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleOpenInBrowser = () => {
    if (status?.url && status.token) {
      const fullUrl = `${status.url}?token=${status.token}`;
      void window.electronAPI.shell.openExternal(fullUrl);
    }
  };

  const handleDisconnectClient = async (clientId: string) => {
    try {
      await window.electronAPI.webServer.disconnectClient(clientId);
      const clients = await window.electronAPI.webServer.getConnectedClients();
      setConnectedClients(clients);
    } catch (error: unknown) {
      console.error('Failed to disconnect client:', error);
    }
  };

  const handleDisconnectAllClients = async () => {
    try {
      await window.electronAPI.webServer.disconnectAllClients();
      setConnectedClients([]);
    } catch (error: unknown) {
      console.error('Failed to disconnect all clients:', error);
    }
  };

  const formatDuration = (connectedAt: number): string => {
    const seconds = Math.floor((Date.now() - connectedAt) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  if (loading || !settings) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const isRunning = status?.running ?? false;
  const portValid =
    !isNaN(parseInt(portInput, 10)) &&
    parseInt(portInput, 10) >= 1024 &&
    parseInt(portInput, 10) <= 65535;

  const fullUrl = status?.url && status.token ? `${status.url}?token=${status.token}` : null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Web Server
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Access your notes from a web browser on any device on your local network.
      </Alert>

      {/* Error Display */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => {
            setError(null);
          }}
        >
          {error}
        </Alert>
      )}

      {/* Server Control */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={isRunning}
                  onChange={() => {
                    handleToggleServer().catch((err: unknown) => {
                      console.error('Error toggling server:', err);
                    });
                  }}
                  disabled={actionLoading || (!isRunning && !portValid)}
                />
              }
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography>Server</Typography>
                  <Chip
                    label={isRunning ? 'Running' : 'Stopped'}
                    color={isRunning ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              }
            />
          </Box>
          {isRunning && (
            <Chip
              label={`${status?.connectedClients ?? 0} connection${(status?.connectedClients ?? 0) !== 1 ? 's' : ''}`}
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {/* Configuration (only when stopped) */}
        {!isRunning && (
          <Box mt={2}>
            <Divider sx={{ mb: 2 }} />
            <Box display="flex" flexWrap="wrap" gap={2} alignItems="flex-start">
              <TextField
                label="Port"
                value={portInput}
                onChange={(e) => {
                  setPortInput(e.target.value);
                  const port = parseInt(e.target.value, 10);
                  if (!isNaN(port) && port >= 1024 && port <= 65535) {
                    void handleSettingsChange({ port });
                  }
                }}
                type="number"
                inputProps={{ min: 1024, max: 65535 }}
                size="small"
                error={!portValid}
                helperText={!portValid ? 'Port must be 1024-65535' : ''}
                sx={{ width: 120 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.localhostOnly}
                    onChange={(e) => {
                      void handleSettingsChange({ localhostOnly: e.target.checked });
                    }}
                    size="small"
                  />
                }
                label="Localhost only"
              />

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>TLS</InputLabel>
                <Select
                  value={settings.tlsMode}
                  label="TLS"
                  onChange={(e) => {
                    void handleSettingsChange({ tlsMode: e.target.value as TLSMode });
                  }}
                >
                  <MuiMenuItem value="off">Off (HTTP)</MuiMenuItem>
                  <MuiMenuItem value="self-signed">Self-signed</MuiMenuItem>
                  <MuiMenuItem value="custom">Custom cert</MuiMenuItem>
                </Select>
              </FormControl>
            </Box>

            {settings.tlsMode === 'custom' && (
              <Box mt={2} display="flex" flexDirection="column" gap={1}>
                <TextField
                  label="Certificate path"
                  value={settings.customCertPath ?? ''}
                  onChange={(e) => {
                    void handleSettingsChange({ customCertPath: e.target.value });
                  }}
                  size="small"
                  fullWidth
                  placeholder="/path/to/cert.pem"
                />
                <TextField
                  label="Key path"
                  value={settings.customKeyPath ?? ''}
                  onChange={(e) => {
                    void handleSettingsChange({ customKeyPath: e.target.value });
                  }}
                  size="small"
                  fullWidth
                  placeholder="/path/to/key.pem"
                />
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Quick Connect (only when running) */}
      {isRunning && fullUrl && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Quick Connect
          </Typography>

          <Box display="flex" gap={3} alignItems="flex-start">
            {/* QR Code */}
            {qrCodeDataUrl && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'white',
                  flexShrink: 0,
                }}
              >
                <img
                  src={qrCodeDataUrl}
                  alt="QR code to connect"
                  style={{ width: 160, height: 160 }}
                />
              </Paper>
            )}

            {/* URL and actions */}
            <Box flex={1}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Scan the QR code or click to open in browser:
              </Typography>

              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Link
                  component="button"
                  variant="body2"
                  onClick={handleOpenInBrowser}
                  sx={{
                    fontFamily: 'monospace',
                    textAlign: 'left',
                    wordBreak: 'break-all',
                    cursor: 'pointer',
                  }}
                >
                  {fullUrl}
                </Link>
                <Tooltip title="Open in browser">
                  <IconButton size="small" onClick={handleOpenInBrowser}>
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={copySuccess === 'url' ? 'Copied!' : 'Copy URL'}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      void copyToClipboard(fullUrl, 'url');
                    }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {status?.tlsEnabled && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Note: You may need to accept a security warning for the self-signed certificate.
                </Typography>
              )}

              {/* Advanced options */}
              <Box mt={2}>
                <Button
                  size="small"
                  onClick={() => {
                    setShowAdvanced(!showAdvanced);
                  }}
                  endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Advanced
                </Button>
                <Collapse in={showAdvanced}>
                  <Box mt={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={() => {
                        handleRegenerateToken().catch((err: unknown) => {
                          console.error('Error regenerating token:', err);
                        });
                      }}
                      disabled={actionLoading}
                    >
                      Regenerate access token
                    </Button>
                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                      This will disconnect all existing sessions and invalidate the current URL.
                    </Typography>

                    {/* Certificate Info */}
                    {certInfo && status?.tlsEnabled && (
                      <Box mt={2}>
                        <Divider sx={{ mb: 1 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          TLS Certificate
                        </Typography>
                        <Box
                          sx={{
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                            p: 1,
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                          }}
                        >
                          <Typography variant="caption" component="div">
                            <strong>Type:</strong>{' '}
                            {certInfo.isSelfSigned ? 'Self-signed' : 'CA-signed'}
                          </Typography>
                          <Typography variant="caption" component="div">
                            <strong>Valid until:</strong>{' '}
                            {new Date(certInfo.validTo).toLocaleDateString()}
                            {new Date(certInfo.validTo) < new Date() && (
                              <Chip label="Expired" color="error" size="small" sx={{ ml: 1 }} />
                            )}
                            {new Date(certInfo.validTo) > new Date() &&
                              new Date(certInfo.validTo).getTime() - Date.now() <
                                30 * 24 * 60 * 60 * 1000 && (
                                <Chip
                                  label="Expiring soon"
                                  color="warning"
                                  size="small"
                                  sx={{ ml: 1 }}
                                />
                              )}
                          </Typography>
                          <Typography
                            variant="caption"
                            component="div"
                            sx={{
                              wordBreak: 'break-all',
                              mt: 0.5,
                            }}
                          >
                            <strong>Fingerprint:</strong> {certInfo.fingerprint.substring(0, 40)}...
                          </Typography>
                          <Typography
                            variant="caption"
                            component="div"
                            sx={{
                              wordBreak: 'break-all',
                              mt: 0.5,
                            }}
                          >
                            <strong>Path:</strong> {certInfo.path}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Active Connections */}
      {isRunning && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="subtitle1">
              Active Connections ({connectedClients.length})
            </Typography>
            {connectedClients.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<LinkOffIcon />}
                onClick={() => {
                  void handleDisconnectAllClients();
                }}
              >
                Disconnect All
              </Button>
            )}
          </Box>

          {connectedClients.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No clients currently connected.
            </Typography>
          ) : (
            <List dense disablePadding>
              {connectedClients.map((client) => (
                <ListItem key={client.id} divider sx={{ px: 0 }}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {client.ip}
                        </Typography>
                        <Chip
                          label={formatDuration(client.connectedAt)}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          maxWidth: '350px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {client.userAgent}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Disconnect">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => {
                          void handleDisconnectClient(client.id);
                        }}
                      >
                        <LinkOffIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}
    </Box>
  );
}
