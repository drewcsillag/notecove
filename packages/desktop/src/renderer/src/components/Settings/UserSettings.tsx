/**
 * User Settings Component
 *
 * User-specific settings:
 * - Username (for CRDT metadata)
 * - Mention handle (for @mentions in notes)
 */

import React, { useEffect, useState } from 'react';
import { Box, TextField, Typography, Button, Alert } from '@mui/material';

export const UserSettings: React.FC = () => {
  const [username, setUsername] = useState('');
  const [handle, setHandle] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load username from app state
    // TODO: Implement loading from database
    const systemUsername = 'User'; // Placeholder
    setUsername(systemUsername);
    setHandle(systemUsername.toLowerCase());
  }, []);

  const handleSave = () => {
    // TODO: Implement saving to database/app state
    console.log('Save user settings:', { username, handle });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 3000);
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
        label="Username"
        fullWidth
        variant="outlined"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
        }}
        helperText="Your name as shown in collaboration and note history"
        sx={{ mb: 3 }}
      />

      <TextField
        label="Mention Handle"
        fullWidth
        variant="outlined"
        value={handle}
        onChange={(e) => {
          setHandle(e.target.value);
        }}
        helperText="Used for @mentions in notes (e.g., @username)"
        InputProps={{
          startAdornment: '@',
        }}
        sx={{ mb: 3 }}
      />

      <Box display="flex" justifyContent="flex-end">
        <Button variant="contained" onClick={handleSave}>
          Save Changes
        </Button>
      </Box>
    </Box>
  );
};
