/**
 * Import Dialog Component
 *
 * Multi-step dialog for importing markdown files/folders into NoteCove.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Alert,
  IconButton,
  TextField,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (result: {
    notesCreated: number;
    foldersCreated: number;
    noteIds: string[];
    folderIds: string[];
    sdId: string;
  }) => void;
}

interface ScanResult {
  rootPath: string;
  isDirectory: boolean;
  totalFiles: number;
  totalSize: number;
}

interface ImportProgress {
  phase: 'scanning' | 'folders' | 'notes' | 'complete' | 'cancelled' | 'error';
  processedFiles: number;
  totalFiles: number;
  currentFile?: string;
  foldersCreated: number;
  notesCreated: number;
  notesSkipped: number;
  errors: { type: string; item: string; message: string }[];
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  sdId: string;
}

interface StorageDirectory {
  id: string;
  name: string;
  path: string;
}

type DialogStep = 'select' | 'configure' | 'importing' | 'complete';

export const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose, onImportComplete }) => {
  // Dialog state
  const [step, setStep] = useState<DialogStep>('select');
  const [error, setError] = useState<string | null>(null);

  // Source selection
  const [sourcePath, setSourcePath] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  // Configuration
  const [storageDirs, setStorageDirs] = useState<StorageDirectory[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedSdId, setSelectedSdId] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [createContainer, setCreateContainer] = useState(false);
  const [containerName, setContainerName] = useState('');

  // Import progress
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  // Result
  const [result, setResult] = useState<{
    success: boolean;
    notesCreated: number;
    foldersCreated: number;
    skipped: number;
    error?: string;
  } | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('select');
      setError(null);
      setSourcePath('');
      setScanResult(null);
      setScanning(false);
      setSelectedSdId('');
      setSelectedFolderId('');
      setPreserveStructure(true);
      setCreateContainer(false);
      setContainerName('');
      setProgress(null);
      setResult(null);
    }
  }, [open]);

  // Load storage directories and folders when dialog opens
  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      try {
        const sds = await window.electronAPI.sd.list();
        setStorageDirs(sds);

        const activeSdId = await window.electronAPI.sd.getActive();
        if (activeSdId) {
          setSelectedSdId(activeSdId);
        } else if (sds.length > 0) {
          setSelectedSdId(sds[0]?.id ?? '');
        }
      } catch (err) {
        console.error('[ImportDialog] Failed to load storage dirs:', err);
      }
    };

    void loadData();
  }, [open]);

  // Load folders when selected SD changes
  useEffect(() => {
    if (!selectedSdId) {
      setFolders([]);
      return;
    }

    const loadFolders = async () => {
      try {
        const folderList = await window.electronAPI.folder.list(selectedSdId);
        setFolders(folderList);
      } catch (err) {
        console.error('[ImportDialog] Failed to load folders:', err);
      }
    };

    void loadFolders();
  }, [selectedSdId]);

  // Subscribe to progress updates
  useEffect(() => {
    if (step !== 'importing') return;

    const unsubscribe = window.electronAPI.import.onProgress((progressUpdate) => {
      setProgress(progressUpdate);

      if (
        progressUpdate.phase === 'complete' ||
        progressUpdate.phase === 'cancelled' ||
        progressUpdate.phase === 'error'
      ) {
        // Will transition to complete step after result comes back
      }
    });

    return unsubscribe;
  }, [step]);

  // Handle browse for file
  const handleBrowseFile = async () => {
    setError(null);
    try {
      const path = await window.electronAPI.import.selectSource('file');
      if (path) {
        await scanSource(path);
      }
    } catch (err) {
      console.error('[ImportDialog] Browse file failed:', err);
      setError('Failed to open file picker');
    }
  };

  // Handle browse for folder
  const handleBrowseFolder = async () => {
    setError(null);
    try {
      const path = await window.electronAPI.import.selectSource('folder');
      if (path) {
        await scanSource(path);
      }
    } catch (err) {
      console.error('[ImportDialog] Browse folder failed:', err);
      setError('Failed to open folder picker');
    }
  };

  // Scan selected source
  const scanSource = async (path: string) => {
    setScanning(true);
    setError(null);

    try {
      const response = await window.electronAPI.import.scanSource(path);

      if (response.success && response.result) {
        setSourcePath(path);
        setScanResult(response.result);

        // Set default container name from source folder name
        const folderName = path.split('/').pop() ?? 'Imported';
        setContainerName(folderName);

        setStep('configure');
      } else {
        setError(response.error ?? 'Failed to scan source');
      }
    } catch (err) {
      console.error('[ImportDialog] Scan failed:', err);
      setError('Failed to scan source');
    } finally {
      setScanning(false);
    }
  };

  // Start import
  const handleStartImport = useCallback(async () => {
    if (!sourcePath || !selectedSdId) return;

    setStep('importing');
    setProgress(null);
    setResult(null);

    try {
      // Determine folder mode
      let folderMode: 'preserve' | 'container' | 'flatten';
      if (createContainer) {
        folderMode = 'container';
      } else if (preserveStructure) {
        folderMode = 'preserve';
      } else {
        folderMode = 'flatten';
      }

      const options: {
        sdId: string;
        targetFolderId: string | null;
        folderMode: 'preserve' | 'container' | 'flatten';
        containerName?: string;
        duplicateHandling: 'rename' | 'skip';
      } = {
        sdId: selectedSdId,
        targetFolderId: selectedFolderId || null,
        folderMode,
        duplicateHandling: 'rename',
      };
      if (createContainer) {
        options.containerName = containerName;
      }

      const importResult = await window.electronAPI.import.execute(sourcePath, options);

      const resultObj: {
        success: boolean;
        notesCreated: number;
        foldersCreated: number;
        skipped: number;
        error?: string;
      } = {
        success: importResult.success,
        notesCreated: importResult.notesCreated ?? 0,
        foldersCreated: importResult.foldersCreated ?? 0,
        skipped: importResult.skipped ?? 0,
      };
      if (importResult.error) {
        resultObj.error = importResult.error;
      }
      setResult(resultObj);
      setStep('complete');

      if (importResult.success && onImportComplete) {
        onImportComplete({
          notesCreated: importResult.notesCreated ?? 0,
          foldersCreated: importResult.foldersCreated ?? 0,
          noteIds: importResult.noteIds ?? [],
          folderIds: importResult.folderIds ?? [],
          sdId: selectedSdId,
        });
      }
    } catch (err) {
      console.error('[ImportDialog] Import failed:', err);
      setResult({
        success: false,
        notesCreated: 0,
        foldersCreated: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : 'Import failed',
      });
      setStep('complete');
    }
  }, [
    sourcePath,
    selectedSdId,
    selectedFolderId,
    preserveStructure,
    createContainer,
    containerName,
    onImportComplete,
  ]);

  // Cancel import
  const handleCancelImport = async () => {
    try {
      await window.electronAPI.import.cancel();
    } catch (err) {
      console.error('[ImportDialog] Cancel failed:', err);
    }
  };

  // Handle close
  const handleClose = () => {
    if (step === 'importing') {
      // Don't allow closing during import - use cancel instead
      return;
    }
    onClose();
  };

  // Get folder display name with path
  const getFolderPath = (folder: Folder): string => {
    const buildPath = (f: Folder): string => {
      if (!f.parentId) return f.name;
      const parent = folders.find((p) => p.id === f.parentId);
      if (!parent) return f.name;
      return `${buildPath(parent)} / ${f.name}`;
    };
    return buildPath(folder);
  };

  // Render select step
  const renderSelectStep = () => (
    <>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Select a markdown file or folder to import into NoteCove.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            size="large"
            startIcon={<DescriptionIcon />}
            onClick={() => {
              void handleBrowseFile();
            }}
            disabled={scanning}
            sx={{ px: 4, py: 2 }}
          >
            Select File
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<FolderIcon />}
            onClick={() => {
              void handleBrowseFolder();
            }}
            disabled={scanning}
            sx={{ px: 4, py: 2 }}
          >
            Select Folder
          </Button>
        </Box>

        {scanning && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <CircularProgress size={24} />
            <Typography sx={{ ml: 2 }}>Scanning...</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
      </DialogActions>
    </>
  );

  // Render configure step
  const renderConfigureStep = () => (
    <>
      <DialogContent dividers>
        {/* Source info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Source
          </Typography>
          <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
            {sourcePath}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {scanResult?.totalFiles} markdown file{scanResult?.totalFiles !== 1 ? 's' : ''} found
          </Typography>
        </Box>

        {/* Storage directory */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Storage Directory</InputLabel>
          <Select
            value={selectedSdId}
            label="Storage Directory"
            onChange={(e) => {
              setSelectedSdId(e.target.value);
              setSelectedFolderId('');
            }}
          >
            {storageDirs.map((sd) => (
              <MenuItem key={sd.id} value={sd.id}>
                {sd.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Target folder */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Import into folder</InputLabel>
          <Select
            value={selectedFolderId}
            label="Import into folder"
            onChange={(e) => {
              setSelectedFolderId(e.target.value);
            }}
          >
            <MenuItem value="">
              <em>Root (All Notes)</em>
            </MenuItem>
            {folders.map((folder) => (
              <MenuItem key={folder.id} value={folder.id}>
                {getFolderPath(folder)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Options */}
        {scanResult?.isDirectory && (
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={preserveStructure}
                  onChange={(e) => {
                    setPreserveStructure(e.target.checked);
                  }}
                  disabled={createContainer}
                />
              }
              label="Preserve folder structure"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
              Create matching folders in NoteCove for source subfolders
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={createContainer}
                  onChange={(e) => {
                    setCreateContainer(e.target.checked);
                  }}
                />
              }
              label={`Create "${containerName}" folder for imported files`}
              sx={{ mt: 1 }}
            />

            {createContainer && (
              <TextField
                fullWidth
                size="small"
                label="Container folder name"
                value={containerName}
                onChange={(e) => {
                  setContainerName(e.target.value);
                }}
                sx={{ ml: 4, mt: 1, width: 'calc(100% - 32px)' }}
              />
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setStep('select');
          }}
          color="inherit"
        >
          Back
        </Button>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={() => {
            void handleStartImport();
          }}
          variant="contained"
          disabled={!selectedSdId || scanResult?.totalFiles === 0}
        >
          Import {scanResult?.totalFiles} file{scanResult?.totalFiles !== 1 ? 's' : ''}
        </Button>
      </DialogActions>
    </>
  );

  // Render importing step
  const renderImportingStep = () => {
    const progressPercent = progress
      ? progress.totalFiles > 0
        ? (progress.processedFiles / progress.totalFiles) * 100
        : 0
      : 0;

    return (
      <>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {progress?.phase === 'scanning' && 'Scanning files...'}
              {progress?.phase === 'folders' && 'Creating folders...'}
              {progress?.phase === 'notes' && 'Importing notes...'}
              {!progress && 'Starting import...'}
            </Typography>

            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{ mb: 2, height: 8, borderRadius: 4 }}
            />

            <Typography variant="body2" color="text.secondary">
              {progress?.processedFiles ?? 0} of {progress?.totalFiles ?? 0} files
            </Typography>

            {progress?.currentFile && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mt: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {progress.currentFile}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              void handleCancelImport();
            }}
            color="inherit"
          >
            Cancel Import
          </Button>
        </DialogActions>
      </>
    );
  };

  // Render complete step
  const renderCompleteStep = () => (
    <>
      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 2 }}>
          {result?.success ? (
            <>
              <Typography variant="h6" color="success.main" sx={{ mb: 2 }}>
                Import Complete
              </Typography>
              <Typography variant="body1">
                Successfully imported {result.notesCreated} note
                {result.notesCreated !== 1 ? 's' : ''}
                {result.foldersCreated > 0 &&
                  ` and ${result.foldersCreated} folder${result.foldersCreated !== 1 ? 's' : ''}`}
                .
              </Typography>
              {result.skipped > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {result.skipped} file{result.skipped !== 1 ? 's' : ''} skipped (duplicates)
                </Typography>
              )}
            </>
          ) : (
            <>
              <Typography variant="h6" color="error.main" sx={{ mb: 2 }}>
                {result?.error === 'Import cancelled' ? 'Import Cancelled' : 'Import Failed'}
              </Typography>
              {result?.error && result.error !== 'Import cancelled' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {result.error}
                </Alert>
              )}
              {(result?.notesCreated ?? 0) > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {result?.notesCreated} note{result?.notesCreated !== 1 ? 's' : ''} were imported
                  before {result?.error === 'Import cancelled' ? 'cancellation' : 'the error'}.
                </Typography>
              )}
            </>
          )}

          {progress?.errors && progress.errors.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
              <Typography variant="subtitle2">
                {progress.errors.length} error{progress.errors.length !== 1 ? 's' : ''} occurred:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {progress.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>
                    <Typography variant="caption">
                      {err.item}: {err.message}
                    </Typography>
                  </li>
                ))}
                {progress.errors.length > 5 && (
                  <li>
                    <Typography variant="caption">
                      ...and {progress.errors.length - 5} more
                    </Typography>
                  </li>
                )}
              </Box>
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={step === 'importing'}
    >
      <DialogTitle>
        Import Markdown
        {step !== 'importing' && (
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      {step === 'select' && renderSelectStep()}
      {step === 'configure' && renderConfigureStep()}
      {step === 'importing' && renderImportingStep()}
      {step === 'complete' && renderCompleteStep()}
    </Dialog>
  );
};

export default ImportDialog;
