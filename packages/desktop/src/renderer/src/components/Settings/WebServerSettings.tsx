/**
 * Web Server Settings Component
 *
 * Allows users to view and configure the web server for browser access.
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
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import QRCode from 'qrcode';

interface WebServerStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  token: string | null;
  connectedClients: number;
}

export function WebServerSettings(): React.ReactElement {
  const [status, setStatus] = useState<WebServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [portInput, setPortInput] = useState('8765');
  const [showToken, setShowToken] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const serverStatus = await window.electronAPI.webServer.getStatus();
      setStatus(serverStatus);
      if (serverStatus.port) {
        setPortInput(String(serverStatus.port));
      }
    } catch (error) {
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
        } catch (error) {
          console.error('Failed to generate QR code:', error);
          setQrCodeDataUrl(null);
        }
      } else {
        setQrCodeDataUrl(null);
      }
    };
    void generateQR();
  }, [status?.running, status?.url, status?.token]);

  const handleStart = async () => {
    try {
      setActionLoading(true);
      const port = parseInt(portInput, 10);
      if (isNaN(port) || port < 1024 || port > 65535) {
        return;
      }
      const newStatus = await window.electronAPI.webServer.start(port);
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to start web server:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setActionLoading(true);
      await window.electronAPI.webServer.stop();
      await loadStatus();
    } catch (error) {
      console.error('Failed to stop web server:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    try {
      setActionLoading(true);
      await window.electronAPI.webServer.regenerateToken();
      await loadStatus();
    } catch (error) {
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
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (loading) {
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

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Web Server
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        The web server allows you to access your notes from a web browser on any device on your
        local network.
      </Alert>

      {/* Server Status */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle1">Server Status:</Typography>
            <Chip
              label={isRunning ? 'Running' : 'Stopped'}
              color={isRunning ? 'success' : 'default'}
              size="small"
            />
            {isRunning && status?.connectedClients !== undefined && (
              <Chip
                label={`${status.connectedClients} client${status.connectedClients !== 1 ? 's' : ''}`}
                variant="outlined"
                size="small"
              />
            )}
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={isRunning}
                onChange={() => {
                  if (isRunning) {
                    void handleStop();
                  } else {
                    void handleStart();
                  }
                }}
                disabled={actionLoading || (!isRunning && !portValid)}
              />
            }
            label={isRunning ? 'Stop' : 'Start'}
          />
        </Box>

        {isRunning && status?.url && (
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="body2" color="text.secondary">
              URL:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {status.url}
            </Typography>
            <Tooltip title={copySuccess === 'url' ? 'Copied!' : 'Copy URL'}>
              <IconButton
                size="small"
                onClick={() => {
                  if (status.url) {
                    void copyToClipboard(status.url, 'url');
                  }
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Paper>

      {/* Port Configuration */}
      <Typography variant="subtitle1" gutterBottom>
        Port Configuration
      </Typography>
      <Box display="flex" alignItems="flex-start" gap={2} mb={3}>
        <TextField
          label="Port"
          value={portInput}
          onChange={(e) => {
            setPortInput(e.target.value);
          }}
          type="number"
          inputProps={{ min: 1024, max: 65535 }}
          size="small"
          error={!portValid}
          helperText={!portValid ? 'Port must be between 1024 and 65535' : ''}
          disabled={isRunning}
          sx={{ width: 150 }}
        />
        {!isRunning && (
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => {
              void handleStart();
            }}
            disabled={actionLoading || !portValid}
          >
            Start Server
          </Button>
        )}
        {isRunning && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<StopIcon />}
            onClick={() => {
              void handleStop();
            }}
            disabled={actionLoading}
          >
            Stop Server
          </Button>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Authentication Token */}
      <Typography variant="subtitle1" gutterBottom>
        Authentication Token
      </Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        This token is required to access the web interface. Keep it secure and do not share it
        publicly.
      </Alert>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <TextField
          label="Token"
          value={showToken ? (status?.token ?? '') : '••••••••••••••••'}
          InputProps={{
            readOnly: true,
            endAdornment: (
              <Box display="flex" gap={0.5}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowToken(!showToken);
                  }}
                  edge="end"
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? (
                    <VisibilityOffIcon fontSize="small" />
                  ) : (
                    <VisibilityIcon fontSize="small" />
                  )}
                </IconButton>
                <Tooltip title={copySuccess === 'token' ? 'Copied!' : 'Copy token'}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (status?.token) {
                        void copyToClipboard(status.token, 'token');
                      }
                    }}
                    edge="end"
                    disabled={!status?.token}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          }}
          sx={{ flexGrow: 1, fontFamily: showToken ? 'monospace' : undefined }}
        />
        <Tooltip title="Generate a new token (invalidates the current one)">
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              void handleRegenerateToken();
            }}
            disabled={actionLoading}
          >
            Regenerate
          </Button>
        </Tooltip>
      </Box>

      {isRunning && status?.url && status.token && (
        <>
          <Divider sx={{ my: 3 }} />

          {/* Quick Connect with QR Code */}
          <Typography variant="subtitle1" gutterBottom>
            Quick Connect
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Scan this QR code with your mobile device to connect instantly, or use the URL below.
          </Typography>

          <Box display="flex" gap={3} alignItems="flex-start" mb={2}>
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
                }}
              >
                <img
                  src={qrCodeDataUrl}
                  alt="QR code to connect to web server"
                  style={{ width: 180, height: 180 }}
                />
              </Paper>
            )}

            {/* URL and instructions */}
            <Box flex={1}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Or enter this URL manually (includes authentication token):
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <TextField
                  value={
                    showToken
                      ? `${status.url}?token=${status.token}`
                      : `${status.url}?token=••••••••`
                  }
                  InputProps={{ readOnly: true }}
                  size="small"
                  fullWidth
                  sx={{ fontFamily: 'monospace' }}
                />
                <Tooltip title={copySuccess === 'fullUrl' ? 'Copied!' : 'Copy full URL'}>
                  <IconButton
                    onClick={() => {
                      if (status.url && status.token) {
                        void copyToClipboard(`${status.url}?token=${status.token}`, 'fullUrl');
                      }
                    }}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Note: You may need to accept a security warning for the self-signed certificate.
              </Typography>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
