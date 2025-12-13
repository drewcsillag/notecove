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
import { StorageTreeBrowser, type SDTreeNode } from './StorageTreeBrowser';
import { HexViewer, type ParsedField } from './HexViewer';
import { RecordList, type RecordInfo } from './RecordList';
import { TextPreview } from './TextPreview';
import { ImagePreview } from './ImagePreview';

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
          setFileData({
            path: result.path,
            type: result.type,
            size: result.size,
            modified: result.modified,
            data: result.data,
          });

          // Parse binary files for color coding
          if (result.type === 'crdtlog' || result.type === 'snapshot') {
            try {
              const parseResult = await window.electronAPI.inspector.parseFile(
                result.data,
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
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {sdName}
        </Typography>

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
                <Typography variant="subtitle2">{selectedNode.name}</Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Type: {fileData.type} | Size: {formatBytes(fileData.size)} | Modified:{' '}
                  {new Date(fileData.modified).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Path: {selectedNode.path}
                </Typography>
              </Box>

              {/* Image preview for image files */}
              {fileData.type === 'image' && (
                <Box sx={{ mb: 2 }}>
                  <ImagePreview data={fileData.data} fileName={selectedNode.name} maxHeight={400} />
                </Box>
              )}

              {/* Text preview for text-based files */}
              {(fileData.type === 'activity' ||
                fileData.type === 'profile' ||
                fileData.type === 'identity') && (
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
                  />
                </Box>
              )}

              {/* Hex viewer */}
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
