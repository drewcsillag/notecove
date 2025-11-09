/**
 * Recovery Settings Component
 *
 * Displays stuck move operations, backups, and provides recovery tools
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Alert,
  AlertTitle,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
  Tabs,
  Tab,
  TextField,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import BackupIcon from '@mui/icons-material/Backup';
import FolderIcon from '@mui/icons-material/Folder';

interface StaleMove {
  id: string;
  noteId: string;
  sourceSdUuid: string;
  targetSdUuid: string;
  targetFolderId: string | null;
  state: string;
  initiatedBy: string;
  initiatedAt: number;
  lastModified: number;
  sourceSdPath: string;
  targetSdPath: string;
  error: string | null;
}

interface TakeoverDialogData {
  open: boolean;
  move: StaleMove | null;
}

interface Backup {
  backupId: string;
  sdUuid: string;
  sdName: string;
  timestamp: number;
  noteCount: number;
  folderCount: number;
  size: number;
  isPacked: boolean;
  description?: string;
  backupPath: string;
}

interface StorageDir {
  id: string;
  name: string;
  path: string;
}

export const RecoverySettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  // Stuck operations state
  const [staleMoves, setStaleMoves] = useState<StaleMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [takeoverDialog, setTakeoverDialog] = useState<TakeoverDialogData>({
    open: false,
    move: null,
  });
  const [processing, setProcessing] = useState(false);

  // Backups state
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [storageDirs, setStorageDirs] = useState<StorageDir[]>([]);
  const [createBackupDialog, setCreateBackupDialog] = useState(false);
  const [selectedSd, setSelectedSd] = useState<string>('');
  const [backupDescription, setBackupDescription] = useState('');
  const [packAndSnapshot, setPackAndSnapshot] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    backup: Backup | null;
  }>({ open: false, backup: null });
  const [restorePath, setRestorePath] = useState('');
  const [registerAsNew, setRegisterAsNew] = useState(true);

  const loadStaleMoves = async () => {
    try {
      setLoading(true);
      setError(null);
      const moves = await window.electronAPI.recovery.getStaleMoves();
      setStaleMoves(moves);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stuck operations');
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      setBackupsLoading(true);
      setError(null);
      const allBackups = await window.electronAPI.backup.listBackups();
      setBackups(allBackups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backups');
    } finally {
      setBackupsLoading(false);
    }
  };

  const loadStorageDirs = async () => {
    try {
      const sds = await window.electronAPI.sd.list();
      setStorageDirs(sds);
      if (sds.length > 0 && !selectedSd) {
        setSelectedSd(sds[0].id);
      }
    } catch (err) {
      console.error('Failed to load storage directories:', err);
    }
  };

  useEffect(() => {
    void loadStaleMoves();
    void loadBackups();
    void loadStorageDirs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatAge = (timestamp: number): string => {
    const ageMs = Date.now() - timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);

    if (ageDays > 0) {
      return `${ageDays}d ${ageHours % 24}h ago`;
    } else if (ageHours > 0) {
      return `${ageHours}h ${ageMinutes % 60}m ago`;
    } else {
      return `${ageMinutes}m ago`;
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleTakeOver = (move: StaleMove) => {
    setTakeoverDialog({ open: true, move });
  };

  const handleConfirmTakeOver = async () => {
    if (!takeoverDialog.move) return;

    setProcessing(true);
    try {
      const result = await window.electronAPI.recovery.takeOverMove(takeoverDialog.move.id);
      if (result.success) {
        await loadStaleMoves();
        setTakeoverDialog({ open: false, move: null });
      } else {
        setError(`Failed to take over move: ${result.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take over move');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async (moveId: string) => {
    setProcessing(true);
    try {
      const result = await window.electronAPI.recovery.cancelMove(moveId);
      if (result.success) {
        await loadStaleMoves();
      } else {
        setError(`Failed to cancel move: ${result.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel move');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!selectedSd) return;

    setProcessing(true);
    try {
      await window.electronAPI.backup.createManualBackup(
        selectedSd,
        packAndSnapshot,
        backupDescription || undefined
      );
      await loadBackups();
      setCreateBackupDialog(false);
      setBackupDescription('');
      setPackAndSnapshot(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreDialog.backup || !restorePath) return;

    setProcessing(true);
    try {
      await window.electronAPI.backup.restoreFromBackup(
        restoreDialog.backup.backupId,
        restorePath,
        registerAsNew
      );
      await loadStorageDirs();
      setRestoreDialog({ open: false, backup: null });
      setRestorePath('');
      setRegisterAsNew(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;

    setProcessing(true);
    try {
      await window.electronAPI.backup.deleteBackup(backupId);
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectPath = async () => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Restore Location',
      });
      if (!result.canceled && result.filePaths.length > 0) {
        setRestorePath(result.filePaths[0]);
      }
    } catch (err) {
      console.error('Failed to select path:', err);
    }
  };

  const renderDiagnosticSummary = () => {
    if (loading) {
      return (
        <Box display="flex" alignItems="center" gap={1} mb={3}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading diagnostic information...</Typography>
        </Box>
      );
    }

    if (staleMoves.length === 0) {
      return (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          <AlertTitle>No Issues Detected</AlertTitle>
          All move operations are completing normally.
        </Alert>
      );
    }

    return (
      <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
        <AlertTitle>Stuck Operations Detected</AlertTitle>
        Found {staleMoves.length} incomplete move operation{staleMoves.length > 1 ? 's' : ''} that{' '}
        {staleMoves.length > 1 ? 'have' : 'has'} been stalled for more than 5 minutes.
      </Alert>
    );
  };

  const renderStuckOperations = () => (
    <Box>
      <Typography variant="body2" color="text.secondary" paragraph>
        Monitor and recover from stuck operations. If a move operation was interrupted (e.g., app
        crash), you can take over and complete it or cancel it.
      </Typography>

      {renderDiagnosticSummary()}

      {!loading && staleMoves.length > 0 && (
        <>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Stuck Operations
          </Typography>
          <List>
            {staleMoves.map((move) => (
              <ListItem
                key={move.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">Note: {move.noteId}</Typography>
                      <Chip label={move.state} size="small" color="warning" />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" display="block">
                        Instance: {move.initiatedBy}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Age: {formatAge(move.lastModified)}
                      </Typography>
                      {move.error && (
                        <Typography variant="caption" display="block" color="error">
                          Error: {move.error}
                        </Typography>
                      )}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        handleTakeOver(move);
                      }}
                      disabled={processing}
                    >
                      Take Over
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        void handleCancel(move.id);
                      }}
                      disabled={processing}
                    >
                      Cancel
                    </Button>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Button
          variant="outlined"
          onClick={() => {
            void loadStaleMoves();
          }}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>
    </Box>
  );

  const renderBackups = () => (
    <Box>
      <Typography variant="body2" color="text.secondary" paragraph>
        Create and manage backups of your Storage Directories. Backups include all notes, folders,
        and settings.
      </Typography>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle2">Available Backups ({backups.length})</Typography>
        <Button
          variant="contained"
          startIcon={<BackupIcon />}
          onClick={() => {
            setCreateBackupDialog(true);
          }}
          disabled={storageDirs.length === 0}
        >
          Create Backup
        </Button>
      </Box>

      {backupsLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : backups.length === 0 ? (
        <Alert severity="info">
          No backups found. Create your first backup to protect your data.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Storage Directory</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Notes</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.backupId}>
                  <TableCell>{backup.sdName}</TableCell>
                  <TableCell>{formatDate(backup.timestamp)}</TableCell>
                  <TableCell align="right">{backup.noteCount}</TableCell>
                  <TableCell align="right">{formatSize(backup.size)}</TableCell>
                  <TableCell>
                    {backup.description || <em>No description</em>}
                    {backup.isPacked && (
                      <Chip label="Packed" size="small" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setRestoreDialog({ open: true, backup });
                      }}
                      title="Restore"
                    >
                      <RestoreIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        void handleDeleteBackup(backup.backupId);
                      }}
                      title="Delete"
                      disabled={processing}
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

      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Button
          variant="outlined"
          onClick={() => {
            void loadBackups();
          }}
          disabled={backupsLoading}
        >
          Refresh
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Recovery & Diagnostics
      </Typography>

      {error && (
        <Alert
          severity="error"
          onClose={() => {
            setError(null);
          }}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onChange={(_e, newValue) => {
          setActiveTab(newValue);
        }}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="Stuck Operations" />
        <Tab label="Backups" />
      </Tabs>

      {activeTab === 0 && renderStuckOperations()}
      {activeTab === 1 && renderBackups()}

      {/* Takeover Confirmation Dialog */}
      <Dialog
        open={takeoverDialog.open}
        onClose={() => {
          if (!processing) {
            setTakeoverDialog({ open: false, move: null });
          }
        }}
      >
        <DialogTitle>Take Over Move Operation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to take over this move operation from another instance?
          </DialogContentText>
          {takeoverDialog.move && (
            <Box mt={2}>
              <Typography variant="body2" gutterBottom>
                <strong>Note ID:</strong> {takeoverDialog.move.noteId}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>State:</strong> {takeoverDialog.move.state}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Original Instance:</strong> {takeoverDialog.move.initiatedBy}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Age:</strong> {formatAge(takeoverDialog.move.lastModified)}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This will claim ownership of the move and attempt to complete it. Only do this if
            you&apos;re sure the original instance is no longer running.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTakeoverDialog({ open: false, move: null });
            }}
            disabled={processing}
          >
            Back
          </Button>
          <Button
            onClick={() => {
              void handleConfirmTakeOver();
            }}
            variant="contained"
            color="primary"
            disabled={processing}
          >
            {processing ? <CircularProgress size={20} /> : 'Complete Move'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Backup Dialog */}
      <Dialog
        open={createBackupDialog}
        onClose={() => {
          if (!processing) {
            setCreateBackupDialog(false);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Backup</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              select
              fullWidth
              label="Storage Directory"
              value={selectedSd}
              onChange={(e) => {
                setSelectedSd(e.target.value);
              }}
              SelectProps={{ native: true }}
              sx={{ mb: 2 }}
            >
              {storageDirs.map((sd) => (
                <option key={sd.id} value={sd.id}>
                  {sd.name} ({sd.path})
                </option>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Description (optional)"
              value={backupDescription}
              onChange={(e) => {
                setBackupDescription(e.target.value);
              }}
              placeholder="e.g., Before major update"
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={packAndSnapshot}
                  onChange={(e) => {
                    setPackAndSnapshot(e.target.checked);
                  }}
                />
              }
              label="Pack and snapshot (optimizes size, takes longer)"
            />

            <Alert severity="info" sx={{ mt: 2 }}>
              This will create a complete backup of the selected Storage Directory including all
              notes, folders, and settings.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateBackupDialog(false);
            }}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleCreateBackup();
            }}
            variant="contained"
            disabled={processing || !selectedSd}
          >
            {processing ? <CircularProgress size={20} /> : 'Create Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Backup Dialog */}
      <Dialog
        open={restoreDialog.open}
        onClose={() => {
          if (!processing) {
            setRestoreDialog({ open: false, backup: null });
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Restore Backup</DialogTitle>
        <DialogContent>
          {restoreDialog.backup && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Storage Directory:</strong> {restoreDialog.backup.sdName}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Date:</strong> {formatDate(restoreDialog.backup.timestamp)}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Notes:</strong> {restoreDialog.backup.noteCount}
              </Typography>

              <TextField
                fullWidth
                label="Restore Location"
                value={restorePath}
                onChange={(e) => {
                  setRestorePath(e.target.value);
                }}
                placeholder="/path/to/restore/location"
                sx={{ mt: 2, mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => void handleSelectPath()}>
                      <FolderIcon />
                    </IconButton>
                  ),
                }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={registerAsNew}
                    onChange={(e) => {
                      setRegisterAsNew(e.target.checked);
                    }}
                  />
                }
                label="Register as new Storage Directory"
              />

              <Alert severity="warning" sx={{ mt: 2 }}>
                This will extract the backup to the specified location. If &quot;Register as
                new&quot; is checked, it will be added to NoteCove as a new Storage Directory.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRestoreDialog({ open: false, backup: null });
              setRestorePath('');
            }}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleRestoreBackup();
            }}
            variant="contained"
            disabled={processing || !restorePath}
          >
            {processing ? <CircularProgress size={20} /> : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
