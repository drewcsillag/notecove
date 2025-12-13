/**
 * SD Picker Dialog Component
 *
 * Dialog for selecting which Storage Directory to inspect.
 * Shows a list of registered SDs with their names and paths.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';

interface SDInfo {
  id: string;
  name: string;
  path: string;
}

export interface SDPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sd: SDInfo) => void;
}

export const SDPickerDialog: React.FC<SDPickerDialogProps> = ({ open, onClose, onSelect }) => {
  const [sds, setSds] = useState<SDInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      setSelectedId(null);

      void (async () => {
        try {
          const sdList = await window.electronAPI.sd.list();
          setSds(sdList);
          // Auto-select first SD if only one
          if (sdList.length === 1 && sdList[0]) {
            setSelectedId(sdList[0].id);
          }
        } catch (err) {
          console.error('[SDPickerDialog] Failed to load SDs:', err);
          setError(err instanceof Error ? err.message : 'Failed to load storage directories');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [open]);

  const handleSelect = () => {
    const selected = sds.find((sd) => sd.id === selectedId);
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Storage Directory</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py: 4,
            }}
          >
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ py: 2 }}>
            {error}
          </Typography>
        ) : sds.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No storage directories found. Create one in Settings first.
          </Typography>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSelect} variant="contained" disabled={!selectedId || loading}>
          Open Inspector
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SDPickerDialog;
