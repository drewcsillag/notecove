/**
 * Note Info Dialog Component
 *
 * Displays comprehensive information about a note including:
 * - Basic metadata (title, SD, folder, tags)
 * - Timestamps
 * - Document statistics
 * - Advanced CRDT/technical details
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  created: number;
  modified: number;
  tags: string[];
  characterCount: number;
  wordCount: number;
  paragraphCount: number;
  vectorClock: Record<string, number>;
  documentHash: string;
  crdtUpdateCount: number;
  noteDirPath: string;
  totalFileSize: number;
  snapshotCount: number;
  packCount: number;
  deleted: boolean;
  pinned: boolean;
  contentPreview: string;
}

export interface NoteInfoDialogProps {
  open: boolean;
  noteId: string | null;
  onClose: () => void;
}

export const NoteInfoDialog: React.FC<NoteInfoDialogProps> = ({ open, noteId, onClose }) => {
  const [noteInfo, setNoteInfo] = useState<NoteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load note info when dialog opens or noteId changes
  useEffect(() => {
    if (!open || !noteId) {
      setNoteInfo(null);
      setError(null);
      return;
    }

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
        console.error('[NoteInfoDialog] Failed to load note info:', err);
        setError('Failed to load note information');
      } finally {
        setLoading(false);
      }
    };

    void loadNoteInfo();
  }, [open, noteId]);

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
      console.log(`[NoteInfoDialog] Copied ${label} to clipboard`);
    } catch (err) {
      console.error(`[NoteInfoDialog] Failed to copy ${label}:`, err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Note Information
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ py: 2 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {!loading && !error && noteInfo && (
          <Box>
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
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                      >
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
                  <TableCell>{noteInfo.folderPath ?? 'All Notes (root)'}</TableCell>
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

            {/* Advanced Information (Collapsible) */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Advanced Information</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" sx={{ fontWeight: 'bold', width: '30%' }}>
                        Vector Clock
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
                            {JSON.stringify(noteInfo.vectorClock)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => {
                              void copyToClipboard(
                                JSON.stringify(noteInfo.vectorClock),
                                'Vector Clock'
                              );
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
                        Document Hash
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                          >
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
                        Pack Count
                      </TableCell>
                      <TableCell>{noteInfo.packCount.toLocaleString()}</TableCell>
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
                        {formatFileSize(noteInfo.totalFileSize)} (
                        {noteInfo.totalFileSize.toLocaleString()} bytes)
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
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
