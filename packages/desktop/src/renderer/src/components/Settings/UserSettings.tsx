/**
 * User Settings Component
 *
 * User-specific settings:
 * - Username (for CRDT metadata)
 * - Mention handle (for @mentions in notes)
 */

import React, { useEffect, useState } from 'react';
import { Box, TextField, Typography, Button, Alert } from '@mui/material';
import { AppStateKey } from '@notecove/shared';

// Validate handle: alphanumeric and underscore only, max 20 chars
const HANDLE_REGEX = /^[a-zA-Z0-9_]*$/;
const MAX_HANDLE_LENGTH = 20;

function validateHandle(value: string): string | null {
  if (value === '') return null; // Empty is allowed (optional field)
  if (value.length > MAX_HANDLE_LENGTH) {
    return 'Handle must be 20 characters or less';
  }
  if (!HANDLE_REGEX.test(value)) {
    return 'Invalid handle: use only letters, numbers, and underscores';
  }
  return null;
}

export const UserSettings: React.FC = () => {
  const [username, setUsername] = useState('');
  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const savedUsername = await window.electronAPI.appState.get(AppStateKey.Username);
        const savedHandle = await window.electronAPI.appState.get(AppStateKey.UserHandle);

        // Use saved values or empty string (placeholder will show when empty)
        setUsername(savedUsername ?? '');
        setHandle(savedHandle ?? '');
      } catch (error) {
        console.error('Failed to load user settings:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      await window.electronAPI.appState.set(AppStateKey.Username, username);
      await window.electronAPI.appState.set(AppStateKey.UserHandle, handle);

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to save user settings:', error);
    }
  };

  return (
    <Box>
      <Typography variant="h6" mb={2}>
        User Settings
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        These settings identify you in collaborative editing and note metadata.
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Settings saved successfully!
        </Alert>
      )}

      <TextField
        id="username"
        label="Username"
        fullWidth
        variant="outlined"
        value={username}
        placeholder="Your name"
        onChange={(e) => {
          setUsername(e.target.value);
        }}
        helperText="Your name as shown in collaboration and note history"
        sx={{ mb: 3 }}
      />

      <TextField
        id="user-handle"
        label="Mention Handle"
        fullWidth
        variant="outlined"
        value={handle}
        placeholder="yourhandle"
        error={!!handleError}
        onChange={(e) => {
          const newValue = e.target.value;
          setHandle(newValue);
          setHandleError(validateHandle(newValue));
        }}
        helperText={handleError ?? 'Used for @mentions in notes (e.g., @username)'}
        InputProps={{
          startAdornment: '@',
        }}
        sx={{ mb: 3 }}
      />

      <Box display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={loading || !!handleError}
        >
          Save Changes
        </Button>
      </Box>
    </Box>
  );
};
