/**
 * SD Picker Window Component
 *
 * Standalone window for selecting which Storage Directory to inspect.
 * Opens the Storage Inspector window for the selected SD.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Typography,
  Button,
  Paper,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';

interface SDInfo {
  id: string;
  name: string;
  path: string;
}

export const SDPickerWindow: React.FC = () => {
  const [sds, setSds] = useState<SDInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const sdList = await window.electronAPI.sd.list();
        setSds(sdList);
        // Auto-select first SD if only one
        if (sdList.length === 1 && sdList[0]) {
          setSelectedId(sdList[0].id);
        }
      } catch (err) {
        console.error('[SDPickerWindow] Failed to load SDs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load storage directories');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelect = async (): Promise<void> => {
    const selected = sds.find((sd) => sd.id === selectedId);
    if (selected) {
      // Open storage inspector for the selected SD
      await window.electronAPI.window.openStorageInspector(
        selected.id,
        selected.path,
        selected.name
      );
      // Close this window
      window.close();
    }
  };

  const handleCancel = (): void => {
    window.close();
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
      }}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>
        Select Storage Directory
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          mb: 2,
        }}
      >
        {loading ? (
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
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : sds.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography color="text.secondary">
              No storage directories found. Create one in Settings first.
            </Typography>
          </Box>
        ) : (
          <List sx={{ pt: 0 }}>
            {sds.map((sd) => (
              <ListItemButton
                key={sd.id}
                selected={selectedId === sd.id}
                onClick={() => {
                  setSelectedId(sd.id);
                }}
                sx={{
                  borderRadius: 1,
                  mx: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                  },
                }}
              >
                <ListItemIcon>
                  <FolderIcon />
                </ListItemIcon>
                <ListItemText
                  primary={sd.name}
                  secondary={sd.path}
                  secondaryTypographyProps={{
                    sx: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button
          onClick={() => void handleSelect()}
          variant="contained"
          disabled={!selectedId || loading}
        >
          Open Inspector
        </Button>
      </Box>
    </Box>
  );
};

export default SDPickerWindow;
