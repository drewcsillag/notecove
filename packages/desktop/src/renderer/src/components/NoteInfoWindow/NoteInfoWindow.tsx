/**
 * Note Info Window Component
 *
 * Standalone page component that displays comprehensive information about a note.
 * Designed to be rendered in its own window (not as a dialog).
 * Shows all information inline without accordion sections.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface NoteInfo {
  id: string;
  title: string;
  sdId: string;
  sdName: string;
  sdPath: string;
  folderId: string | null;
  folderName: string | null;
  folderPath: string | null;
  fullFolderPath: string;
  created: number;
  modified: number;
  tags: string[];
  characterCount: number;
  wordCount: number;
  paragraphCount: number;
  vectorClock: Record<string, { sequence: number; offset: number; file: string }>;
  documentHash: string;
  crdtUpdateCount: number;
  noteDirPath: string;
  totalFileSize: number;
  snapshotCount: number;
  deleted: boolean;
  pinned: boolean;
  contentPreview: string;
}

export interface NoteInfoWindowProps {
  noteId: string;
}

export const NoteInfoWindow: React.FC<NoteInfoWindowProps> = ({ noteId }) => {
  const [noteInfo, setNoteInfo] = useState<NoteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load note info when component mounts or noteId changes
  useEffect(() => {
    const loadNoteInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const info = await window.electronAPI.note.getInfo(noteId);
        if (info) {
          setNoteInfo(info);
        } else {
          setError('Note not found');
        }
      } catch (err) {
        console.error('[NoteInfoWindow] Failed to load note info:', err);
        setError('Failed to load note information');
      } finally {
        setLoading(false);
      }
    };

    void loadNoteInfo();
  }, [noteId]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`[NoteInfoWindow] Copied ${label} to clipboard`);
    } catch (err) {
      console.error(`[NoteInfoWindow] Failed to copy ${label}:`, err);
    }
  };

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!noteInfo) {
    return null;
  }

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      {/* Basic Information */}
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>
      <Table size="small" sx={{ mb: 3 }}>
        <TableBody>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold', width: '30%' }}>
              Title
            </TableCell>
            <TableCell>{noteInfo.title}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Note ID
            </TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {noteInfo.id}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => {
                    void copyToClipboard(noteInfo.id, 'Note ID');
                  }}
                  title="Copy to clipboard"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Storage Directory
            </TableCell>
            <TableCell>
              {noteInfo.sdName}
              <Typography
                variant="caption"
                display="block"
                sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
              >
                {noteInfo.sdPath}
              </Typography>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Folder
            </TableCell>
            <TableCell>{noteInfo.fullFolderPath}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Tags
            </TableCell>
            <TableCell>
              {noteInfo.tags.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {noteInfo.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No tags
                </Typography>
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Divider sx={{ my: 2 }} />

      {/* Timestamps */}
      <Typography variant="h6" gutterBottom>
        Timestamps
      </Typography>
      <Table size="small" sx={{ mb: 3 }}>
        <TableBody>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold', width: '30%' }}>
              Created
            </TableCell>
            <TableCell>{formatDate(noteInfo.created)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Last Modified
            </TableCell>
            <TableCell>{formatDate(noteInfo.modified)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Divider sx={{ my: 2 }} />

      {/* Document Statistics */}
      <Typography variant="h6" gutterBottom>
        Document Statistics
      </Typography>
      <Table size="small" sx={{ mb: 3 }}>
        <TableBody>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold', width: '30%' }}>
              Characters
            </TableCell>
            <TableCell>{noteInfo.characterCount.toLocaleString()}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Words
            </TableCell>
            <TableCell>{noteInfo.wordCount.toLocaleString()}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Paragraphs
            </TableCell>
            <TableCell>{noteInfo.paragraphCount.toLocaleString()}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Divider sx={{ my: 2 }} />

      {/* Advanced Information - inline, no accordion */}
      <Typography variant="h6" gutterBottom>
        Advanced Information
      </Typography>
      <Table size="small">
        <TableBody>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold', width: '30%' }}>
              Vector Clock
            </TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(noteInfo.vectorClock).length === 0 ? (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    (empty)
                  </Typography>
                ) : (
                  Object.entries(noteInfo.vectorClock).map(([instanceId, entry]) => (
                    <Box
                      key={instanceId}
                      sx={{
                        backgroundColor: 'action.hover',
                        borderRadius: 1,
                        p: 1,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.7rem',
                          color: 'text.secondary',
                          wordBreak: 'break-all',
                        }}
                      >
                        {instanceId}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                      >
                        seq: {entry.sequence}, offset: {entry.offset}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.65rem',
                          color: 'text.secondary',
                          wordBreak: 'break-all',
                        }}
                      >
                        {entry.file}
                      </Typography>
                    </Box>
                  ))
                )}
                <IconButton
                  size="small"
                  onClick={() => {
                    void copyToClipboard(
                      JSON.stringify(noteInfo.vectorClock, null, 2),
                      'Vector Clock'
                    );
                  }}
                  title="Copy to clipboard"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Document Hash
            </TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {noteInfo.documentHash}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => {
                    void copyToClipboard(noteInfo.documentHash, 'Document Hash');
                  }}
                  title="Copy to clipboard"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              CRDT Update Count
            </TableCell>
            <TableCell>{noteInfo.crdtUpdateCount.toLocaleString()}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Snapshot Count
            </TableCell>
            <TableCell>{noteInfo.snapshotCount.toLocaleString()}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Note Directory
            </TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {noteInfo.noteDirPath}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => {
                    void copyToClipboard(noteInfo.noteDirPath, 'Note Directory');
                  }}
                  title="Copy to clipboard"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Total File Size
            </TableCell>
            <TableCell>
              {formatFileSize(noteInfo.totalFileSize)} ({noteInfo.totalFileSize.toLocaleString()}{' '}
              bytes)
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" sx={{ fontWeight: 'bold' }}>
              Status
            </TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {noteInfo.deleted && <Chip label="Deleted" size="small" color="error" />}
                {noteInfo.pinned && <Chip label="Pinned" size="small" color="primary" />}
                {!noteInfo.deleted && !noteInfo.pinned && (
                  <Chip label="Active" size="small" color="success" />
                )}
              </Box>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
};
