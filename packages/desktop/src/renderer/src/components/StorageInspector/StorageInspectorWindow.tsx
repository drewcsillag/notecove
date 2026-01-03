/**
 * Storage Inspector Window Component
 *
 * Standalone window for browsing and inspecting storage directory contents.
 * Displays CRDT logs, snapshots, activity logs, profiles, and media with
 * a Wireshark-style hex viewer.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import BugReportIcon from '@mui/icons-material/BugReport';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { StorageTreeBrowser, type SDTreeNode } from './StorageTreeBrowser';
import { HexViewer, type ParsedField } from './HexViewer';
import { RecordList, type RecordInfo } from './RecordList';
import { TextPreview } from './TextPreview';
import { ImagePreview } from './ImagePreview';
import { YjsUpdatePreview } from './YjsUpdatePreview';
import { ActivityLogPreview } from './ActivityLogPreview';

/**
 * Helper to ensure data is a proper Uint8Array after IPC serialization.
 * Electron IPC can serialize Uint8Array to a plain object with numeric keys.
 * Cross-realm Uint8Arrays (from preload) fail instanceof checks.
 */
function ensureUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  // IPC serialization may convert Uint8Array to an object with numeric keys
  if (data && typeof data === 'object') {
    // If it's an ArrayBuffer, wrap it
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    // If it's a Buffer (Node.js)
    if (Buffer.isBuffer(data)) {
      return new Uint8Array(data);
    }
    // Check if it's a cross-realm Uint8Array (from preload context)
    // These have the right constructor name but fail instanceof
    const obj = data as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (obj.constructor?.name === 'Uint8Array' && typeof obj['length'] === 'number') {
      // It's a Uint8Array from another realm - copy byte by byte
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const length = obj['length'] as number;
      const arr = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = (obj[i] as number | undefined) ?? 0;
      }
      return arr;
    }
    // If it's an object with numeric keys (serialized Uint8Array)
    // Need to sort keys numerically since Object.values doesn't guarantee order
    const numericObj = obj as Record<string, number>;
    const keys = Object.keys(numericObj)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    if (keys.length > 0) {
      const arr = new Uint8Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key !== undefined) {
          arr[i] = numericObj[key] ?? 0;
        }
      }
      return arr;
    }
    // If object has 'data' property (some serialization formats)
    if ('data' in numericObj && Array.isArray(numericObj['data'])) {
      return new Uint8Array(numericObj['data'] as number[]);
    }
  }
  // If it's an array of numbers
  if (Array.isArray(data)) {
    return new Uint8Array(data as number[]);
  }
  console.warn('[StorageInspector] Could not convert to Uint8Array:', typeof data, data);
  return new Uint8Array();
}

/**
 * Determines whether the hex viewer should be shown for a given file type.
 * Files with dedicated previews (images, text files) don't need hex dumps.
 * Binary files (CRDT logs, snapshots) and unknown types benefit from hex inspection.
 */
export function shouldShowHexViewer(fileType: string): boolean {
  // Types with dedicated previews that don't need hex dumps
  const noHexTypes = new Set(['image', 'activity', 'profile', 'identity', 'directory']);
  return !noHexTypes.has(fileType);
}

/**
 * Extract noteId from a file path if it's under notes/{noteId}/...
 * Returns null if not a note path.
 */
export function extractNoteIdFromPath(relativePath: string): string | null {
  // Match paths like: notes/{noteId}/... or notes/{noteId}
  const regex = /^notes\/([^/]+)/;
  const match = regex.exec(relativePath);
  return match?.[1] ?? null;
}

export interface StorageInspectorWindowProps {
  sdId: string;
  sdPath: string;
  sdName: string;
}

export const StorageInspectorWindow: React.FC<StorageInspectorWindowProps> = ({
  sdId,
  sdPath,
  sdName,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<SDTreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SDTreeNode | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileData, setFileData] = useState<{
    path: string;
    type: string;
    size: number;
    modified: Date;
    data: Uint8Array;
  } | null>(null);
  const [parsedFields, setParsedFields] = useState<ParsedField[] | undefined>(undefined);
  const [parsedRecords, setParsedRecords] = useState<RecordInfo[]>([]);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null);
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null);
  const [noteExists, setNoteExists] = useState<boolean>(true);
  const [noteTitle, setNoteTitle] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<boolean>(false);

  // Load SD contents
  const loadContents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[StorageInspector] Loading SD:', sdId, sdPath);
      const result = await window.electronAPI.inspector.listSDContents(sdPath);

      if (result.error) {
        setError(result.error);
        setTreeData([]);
      } else {
        // Cast the children array to SDTreeNode[] (the API returns a compatible structure)
        setTreeData(result.children as SDTreeNode[]);
      }
    } catch (err) {
      console.error('[StorageInspector] Failed to load:', err);
      setError(err instanceof Error ? err.message : 'Failed to load storage directory');
      setTreeData([]);
    } finally {
      setLoading(false);
    }
  }, [sdId, sdPath]);

  useEffect(() => {
    void loadContents();
  }, [loadContents]);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (node: SDTreeNode) => {
      setSelectedNode(node);
      setParsedFields(undefined);
      setParsedRecords([]);
      setSelectedRecordIndex(null);
      setHighlightRange(null);
      setNoteExists(true); // Reset note existence
      setNoteTitle(null); // Reset note title

      // Check if this is a note path and verify note exists
      const noteId = extractNoteIdFromPath(node.path);
      if (noteId) {
        try {
          const noteInfo = await window.electronAPI.note.getInfo(noteId);
          setNoteExists(noteInfo !== null);
          setNoteTitle(noteInfo?.title ?? null);
        } catch {
          setNoteExists(false);
          setNoteTitle(null);
        }
      }

      // Don't load file data for directories
      if (node.type === 'directory') {
        setFileData(null);
        return;
      }

      // Load file data
      setFileLoading(true);
      try {
        const result = await window.electronAPI.inspector.readFileInfo(sdPath, node.path);
        if (result.error) {
          console.error('[StorageInspector] Failed to load file:', result.error);
          setFileData(null);
        } else {
          // Ensure data is a proper Uint8Array after IPC serialization
          console.log(
            '[StorageInspector] Raw data type:',
            typeof result.data,
            result.data.constructor.name
          );
          const fileBytes = ensureUint8Array(result.data);
          console.log(
            '[StorageInspector] Converted bytes length:',
            fileBytes.length,
            'first bytes:',
            fileBytes.slice(0, 10)
          );

          setFileData({
            path: result.path,
            type: result.type,
            size: result.size,
            modified: result.modified,
            data: fileBytes,
          });

          // Parse binary files for color coding
          if (result.type === 'crdtlog' || result.type === 'snapshot') {
            try {
              const parseResult = await window.electronAPI.inspector.parseFile(
                fileBytes,
                result.type
              );

              // Convert parsed result to ParsedField array for HexViewer
              const fields: ParsedField[] = [];

              if (parseResult.crdtLog) {
                // Add header fields
                fields.push(...parseResult.crdtLog.fields);
                // Add record fields and save records for the record list
                const records: RecordInfo[] = [];
                for (const record of parseResult.crdtLog.records) {
                  fields.push(...record.fields);
                  records.push({
                    index: record.index,
                    timestamp: record.timestamp,
                    sequence: record.sequence,
                    dataSize: record.dataSize,
                    startOffset: record.startOffset,
                    endOffset: record.endOffset,
                    dataStartOffset: record.dataStartOffset,
                  });
                }
                setParsedRecords(records);
              } else if (parseResult.snapshot) {
                // Add header fields
                fields.push(...parseResult.snapshot.fields);
                // Add vector clock entry fields
                for (const entry of parseResult.snapshot.vectorClockEntries) {
                  fields.push(...entry.fields);
                }
              }

              setParsedFields(fields.length > 0 ? fields : undefined);
            } catch (parseErr) {
              console.warn('[StorageInspector] Failed to parse file:', parseErr);
              // Non-fatal - just won't have color coding
            }
          }
        }
      } catch (err) {
        console.error('[StorageInspector] Failed to load file:', err);
        setFileData(null);
      } finally {
        setFileLoading(false);
      }
    },
    [sdPath]
  );

  // Handle record selection from RecordList
  const handleRecordSelect = useCallback((record: RecordInfo) => {
    setSelectedRecordIndex(record.index);
    setHighlightRange({ start: record.startOffset, end: record.endOffset });
  }, []);

  const handleRefresh = () => {
    void loadContents();
  };

  // Copy full path to clipboard
  const handleCopyPath = useCallback(async () => {
    if (!fileData || !selectedNode) return;

    // Build full absolute path: sdPath + relativePath
    const fullPath = `${sdPath}/${selectedNode.path}`;
    await navigator.clipboard.writeText(fullPath);

    // Show feedback
    setCopiedPath(true);
    setTimeout(() => {
      setCopiedPath(false);
    }, 2000);
  }, [fileData, selectedNode, sdPath]);

  // Open note in new window
  const handleOpenNote = useCallback(
    (noteId: string) => {
      void window.electronAPI.testing.createWindow({ noteId });
    },
    []
  );

  // Get note title for hover tooltip (searches across all SDs)
  const getNoteTitle = useCallback(async (noteId: string): Promise<string | null> => {
    try {
      const noteInfo = await window.electronAPI.note.getInfo(noteId);
      return noteInfo?.title ?? null;
    } catch {
      return null;
    }
  }, []);

  // Get profile data for hover tooltip
  const getProfileData = useCallback(
    async (profileId: string): Promise<string | null> => {
      try {
        const profilePath = `profiles/${profileId}.json`;
        const result = await window.electronAPI.inspector.readFileInfo(sdPath, profilePath);
        if (result.error || result.data.length === 0) {
          return 'Profile not found';
        }
        // Decode and parse profile JSON (ProfilePresence format)
        const text = new TextDecoder().decode(result.data);
        const profile = JSON.parse(text) as {
          profileName?: string;
          username?: string;
          user?: string;
          hostname?: string;
          platform?: string;
        };
        // Return formatted profile info
        const lines = [];
        if (profile.profileName) lines.push(profile.profileName);
        if (profile.username) {
          lines.push(profile.user ? `${profile.username} (${profile.user})` : profile.username);
        } else if (profile.user) {
          lines.push(profile.user);
        }
        if (profile.hostname) {
          const platformIcon =
            profile.platform === 'darwin'
              ? '🍎'
              : profile.platform === 'win32'
                ? '🪟'
                : profile.platform === 'linux'
                  ? '🐧'
                  : profile.platform === 'ios'
                    ? '📱'
                    : '';
          lines.push(`${platformIcon} ${profile.hostname}`.trim());
        }
        return lines.length > 0 ? lines.join('\n') : 'Profile data available';
      } catch {
        return 'Invalid profile';
      }
    },
    [sdPath]
  );

  // Get noteId from current path
  const currentNoteId = selectedNode ? extractNoteIdFromPath(selectedNode.path) : null;

  // Find a node in the tree by path
  const findNodeByPath = useCallback(
    (path: string, nodes?: SDTreeNode[]): SDTreeNode | null => {
      const searchNodes = nodes ?? treeData;
      for (const node of searchNodes) {
        if (node.path === path) {
          return node;
        }
        if (node.children) {
          const found = findNodeByPath(path, node.children);
          if (found) return found;
        }
      }
      return null;
    },
    [treeData]
  );

  // Navigate to a profile file in the tree
  const handleNavigateToProfile = useCallback(
    (profileId: string) => {
      const profilePath = `profiles/${profileId}.json`;
      const node = findNodeByPath(profilePath);
      if (node) {
        void handleFileSelect(node);
      }
    },
    [findNodeByPath, handleFileSelect]
  );

  // Copy hex selection to clipboard
  const handleCopyHex = useCallback(async () => {
    if (!fileData || !highlightRange) return;

    const { start, end } = highlightRange;
    const selectedBytes = fileData.data.slice(start, end);
    const hexString = Array.from(selectedBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');

    await navigator.clipboard.writeText(hexString);
  }, [fileData, highlightRange]);

  // Copy parsed structure as JSON
  const handleCopyJson = useCallback(async () => {
    if (!parsedFields || parsedFields.length === 0) return;

    const jsonData = {
      fields: parsedFields,
      records: parsedRecords.length > 0 ? parsedRecords : undefined,
    };

    await navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
  }, [parsedFields, parsedRecords]);

  // Export raw file
  const handleExportFile = useCallback(() => {
    if (!fileData || !selectedNode) return;

    // Create download link
    const buffer = new ArrayBuffer(fileData.data.length);
    new Uint8Array(buffer).set(fileData.data);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = selectedNode.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [fileData, selectedNode]);

  // Dump to console (dev mode)
  const handleDumpToConsole = useCallback(() => {
    if (!fileData) return;

    console.group(`[StorageInspector] File: ${selectedNode?.name}`);
    console.log('Type:', fileData.type);
    console.log('Size:', fileData.size);
    console.log('Path:', fileData.path);
    console.log('Data:', fileData.data);
    if (parsedFields) {
      console.log('Parsed Fields:', parsedFields);
    }
    if (parsedRecords.length > 0) {
      console.log('Records:', parsedRecords);
    }
    console.groupEnd();
  }, [fileData, selectedNode, parsedFields, parsedRecords]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading storage directory...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2,
          p: 3,
        }}
      >
        <Typography color="error">{error}</Typography>
        <Button variant="outlined" onClick={handleRefresh}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" component="span">
            {sdName}
          </Typography>
          <Typography
            variant="caption"
            sx={{ ml: 1, color: 'text.secondary', fontFamily: 'monospace' }}
          >
            {sdPath}
          </Typography>
        </Box>

        {/* File actions - only show when a file is selected */}
        {fileData && (
          <>
            <Tooltip title="Copy hex selection to clipboard">
              <span>
                <IconButton
                  size="small"
                  onClick={() => {
                    void handleCopyHex();
                  }}
                  disabled={!highlightRange}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Copy parsed structure as JSON">
              <span>
                <IconButton
                  size="small"
                  onClick={() => {
                    void handleCopyJson();
                  }}
                  disabled={!parsedFields || parsedFields.length === 0}
                >
                  <ContentCopyIcon fontSize="small" sx={{ color: 'info.main' }} />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Export file">
              <IconButton size="small" onClick={handleExportFile}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Dump to console">
              <IconButton size="small" onClick={handleDumpToConsole}>
                <BugReportIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={copiedPath ? 'Copied!' : 'Copy full path'}>
              <IconButton
                size="small"
                onClick={() => {
                  void handleCopyPath();
                }}
              >
                <FolderOpenIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          </>
        )}

        <Button size="small" startIcon={<RefreshIcon />} onClick={handleRefresh}>
          Refresh
        </Button>
      </Paper>

      {/* Main content area - two panes */}
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left pane - Tree browser */}
        <Paper
          elevation={0}
          sx={{
            width: 300,
            minWidth: 200,
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'auto',
          }}
        >
          <StorageTreeBrowser
            data={treeData}
            selectedPath={selectedNode?.path ?? null}
            onFileSelect={(node) => {
              void handleFileSelect(node);
            }}
          />
        </Paper>

        {/* Right pane - Detail view */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!selectedNode ? (
            <Box
              sx={{
                p: 2,
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Select a file from the tree to view its contents
              </Typography>
            </Box>
          ) : selectedNode.type === 'directory' ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2">{selectedNode.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Directory with {selectedNode.children?.length ?? 0} items
              </Typography>
            </Box>
          ) : fileLoading ? (
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading file...
              </Typography>
            </Box>
          ) : fileData ? (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* File metadata */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle2">{selectedNode.name}</Typography>
                  {/* Open Note button */}
                  {currentNoteId && (
                    <Tooltip title={noteExists ? 'Open note in new window' : 'Note not found'}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => {
                            handleOpenNote(currentNoteId);
                          }}
                          disabled={!noteExists}
                          sx={{ p: 0.25 }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" component="div">
                  Type: {fileData.type} | Size: {formatBytes(fileData.size)} | Modified:{' '}
                  {new Date(fileData.modified).toLocaleString()}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Path: {selectedNode.path}
                  </Typography>
                  <Tooltip title={copiedPath ? 'Copied!' : 'Copy full path'}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        void handleCopyPath();
                      }}
                      sx={{ p: 0.25 }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Note context for CRDT log files */}
                {currentNoteId && fileData.type === 'crdtlog' && (
                  <Box
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      bgcolor: 'grey.900',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'grey.700',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: 'grey.400', display: 'block', mb: 0.5 }}
                    >
                      Note Context
                    </Typography>
                    {noteTitle && (
                      <Typography
                        variant="body2"
                        sx={{ color: 'primary.main', fontWeight: 500, mb: 1 }}
                      >
                        {noteTitle}
                      </Typography>
                    )}
                    {!noteTitle && noteExists && (
                      <Typography
                        variant="body2"
                        sx={{ color: 'grey.500', fontStyle: 'italic', mb: 1 }}
                      >
                        (untitled note)
                      </Typography>
                    )}
                    {!noteExists && (
                      <Typography
                        variant="body2"
                        sx={{ color: 'warning.main', fontStyle: 'italic', mb: 1 }}
                      >
                        (note not found in database)
                      </Typography>
                    )}
                    <Box sx={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      <Typography
                        variant="caption"
                        component="div"
                        sx={{ color: 'grey.500', fontFamily: 'monospace' }}
                      >
                        notes/<span style={{ color: '#4A90D9' }}>{currentNoteId}</span>
                      </Typography>
                      <Typography
                        variant="caption"
                        component="div"
                        sx={{ color: 'grey.500', fontFamily: 'monospace', pl: 2 }}
                      >
                        └─ logs/
                      </Typography>
                      <Typography
                        variant="caption"
                        component="div"
                        sx={{ color: 'grey.400', fontFamily: 'monospace', pl: 4 }}
                      >
                        └─ <span style={{ color: '#50C878' }}>{selectedNode.name}</span>
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Image preview for image files */}
              {fileData.type === 'image' && (
                <Box sx={{ mb: 2 }}>
                  <ImagePreview data={fileData.data} fileName={selectedNode.name} maxHeight={400} />
                </Box>
              )}

              {/* Activity log preview with parsing */}
              {fileData.type === 'activity' && (
                <Box sx={{ mb: 2 }}>
                  <ActivityLogPreview
                    data={fileData.data}
                    filename={selectedNode.name}
                    maxHeight={300}
                    onRefresh={() => {
                      void handleFileSelect(selectedNode);
                    }}
                    onNoteClick={(noteId) => {
                      void window.electronAPI.testing.createWindow({ noteId });
                    }}
                    onProfileClick={handleNavigateToProfile}
                    getNoteTitle={getNoteTitle}
                    getProfileData={getProfileData}
                  />
                </Box>
              )}

              {/* Text preview for profile and identity files */}
              {(fileData.type === 'profile' || fileData.type === 'identity') && (
                <Box sx={{ mb: 2 }}>
                  <TextPreview data={fileData.data} fileType={fileData.type} maxHeight={300} />
                </Box>
              )}

              {/* Record list for CRDT log files */}
              {parsedRecords.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <RecordList
                    records={parsedRecords}
                    selectedIndex={selectedRecordIndex}
                    onRecordSelect={handleRecordSelect}
                    maxHeight={200}
                    onRefresh={() => {
                      void handleFileSelect(selectedNode);
                    }}
                    noteId={currentNoteId ?? undefined}
                    noteExists={noteExists}
                    onOpenNote={handleOpenNote}
                  />
                </Box>
              )}

              {/* Yjs update preview when a CRDT record is selected */}
              {selectedRecordIndex !== null &&
                parsedRecords[selectedRecordIndex] &&
                fileData.type === 'crdtlog' && (
                  <Box sx={{ mb: 2 }}>
                    <YjsUpdatePreview
                      data={fileData.data.slice(
                        parsedRecords[selectedRecordIndex].dataStartOffset,
                        parsedRecords[selectedRecordIndex].dataStartOffset +
                          parsedRecords[selectedRecordIndex].dataSize
                      )}
                      maxHeight={300}
                    />
                  </Box>
                )}

              {/* Hex viewer - only for binary file types that benefit from inspection */}
              {shouldShowHexViewer(fileData.type) && (
                <Paper
                  variant="outlined"
                  sx={{
                    flexGrow: 1,
                    overflow: 'hidden',
                    p: 1,
                    bgcolor: 'grey.900',
                    color: 'grey.100',
                  }}
                >
                  <HexViewer
                    data={fileData.data}
                    fields={parsedFields}
                    highlightRange={highlightRange}
                    onHighlightChange={setHighlightRange}
                  />
                </Paper>
              )}
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="error">
                Failed to load file
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default StorageInspectorWindow;
