/**
 * Notes List Panel Component
 *
 * Displays a list of notes filtered by the selected folder.
 * Phase 2.5.1: Basic read-only display.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const DEFAULT_SD_ID = 'default'; // Phase 2.5.1: Single SD only

interface Note {
  id: string;
  title: string;
  sdId: string;
  folderId: string | null;
  created: number;
  modified: number;
  deleted: boolean;
  contentPreview: string;
  contentText: string;
}

interface NotesListPanelProps {
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
}

export const NotesListPanel: React.FC<NotesListPanelProps> = ({ selectedNoteId, onNoteSelect }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Load selected folder from app state
  const loadSelectedFolder = useCallback(async () => {
    try {
      const selected = await window.electronAPI.appState.get('selectedFolderId');
      setSelectedFolderId(selected ?? 'all-notes');
    } catch (err) {
      console.error('Failed to load selected folder:', err);
      setSelectedFolderId('all-notes');
    }
  }, []);

  // Note: selectedNoteId is now window-local state, not persisted globally

  // Fetch notes for the selected folder
  const fetchNotes = useCallback(async (folderId: string | null) => {
    setLoading(true);
    setError(null);

    try {
      let notesList: Note[];

      if (folderId === 'all-notes' || folderId === null) {
        // Fetch all notes for the SD
        notesList = await window.electronAPI.note.list(DEFAULT_SD_ID);
      } else {
        // Fetch notes for specific folder
        notesList = await window.electronAPI.note.list(DEFAULT_SD_ID, folderId);
      }

      // Sort by modified date (newest first)
      notesList.sort((a, b) => b.modified - a.modified);

      setNotes(notesList);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notes');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle note selection - delegate to parent
  const handleNoteSelect = useCallback(
    (noteId: string) => {
      onNoteSelect(noteId);
    },
    [onNoteSelect]
  );

  // Handle note creation
  const handleCreateNote = useCallback(async () => {
    if (creating) return; // Prevent double-clicks

    setCreating(true);
    try {
      // Determine folder for new note
      const folderId = selectedFolderId === 'all-notes' ? null : selectedFolderId;

      // Create note via IPC
      const noteId = await window.electronAPI.note.create(DEFAULT_SD_ID, folderId ?? '', '');

      // Select the newly created note
      handleNoteSelect(noteId);

      // Refresh notes list to show the new note
      if (selectedFolderId !== null) {
        await fetchNotes(selectedFolderId);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setCreating(false);
    }
  }, [creating, selectedFolderId, handleNoteSelect, fetchNotes]);

  // Load selected folder on mount
  useEffect(() => {
    void loadSelectedFolder();
  }, [loadSelectedFolder]);

  // Fetch notes when selected folder changes
  useEffect(() => {
    if (selectedFolderId !== null) {
      void fetchNotes(selectedFolderId);
    }
  }, [selectedFolderId, fetchNotes]);

  // Poll for selected folder changes (since we don't have cross-component events yet)
  useEffect(() => {
    const interval = setInterval(() => {
      void loadSelectedFolder();
    }, 500); // Check every 500ms

    return () => {
      clearInterval(interval);
    };
  }, [loadSelectedFolder]);

  // Listen for note updates from other windows
  useEffect(() => {
    const unsubscribeCreated = window.electronAPI.note.onCreated((data) => {
      console.log('[NotesListPanel] Note created:', data);
      // Refresh notes if it's in the current folder
      if (selectedFolderId === 'all-notes' || selectedFolderId === data.folderId) {
        void fetchNotes(selectedFolderId);
      }
      // Don't auto-select here - let the creating window handle selection
    });

    const unsubscribeDeleted = window.electronAPI.note.onDeleted((noteId) => {
      console.log('[NotesListPanel] Note deleted:', noteId);
      // Remove from list
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
    });

    const unsubscribeExternal = window.electronAPI.note.onExternalUpdate((data) => {
      console.log('[NotesListPanel] External update:', data);
      // Refresh notes list
      if (selectedFolderId !== null) {
        void fetchNotes(selectedFolderId);
      }
    });

    const unsubscribeTitleUpdated = window.electronAPI.note.onTitleUpdated((data) => {
      console.log('[NotesListPanel] Title updated:', data);
      // Refresh notes list to show updated title
      if (selectedFolderId !== null) {
        void fetchNotes(selectedFolderId);
      }
    });

    return () => {
      unsubscribeCreated();
      unsubscribeDeleted();
      unsubscribeExternal();
      unsubscribeTitleUpdated();
    };
  }, [selectedFolderId, fetchNotes, handleNoteSelect]);

  // Format date for display
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Format as date
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Truncate preview text
  const truncatePreview = (text: string, maxLength = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          padding: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6">Notes ({notes.length})</Typography>
        <IconButton
          size="small"
          onClick={() => void handleCreateNote()}
          disabled={creating}
          title="Create note"
          sx={{ marginLeft: 1 }}
        >
          <AddIcon />
        </IconButton>
      </Box>

      {/* Notes List or Status */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading && notes.length === 0 ? (
          <Box sx={{ padding: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Loading notes...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ padding: 2 }}>
            <Typography variant="body2" color="error">
              Error: {error}
            </Typography>
          </Box>
        ) : notes.length === 0 ? (
          <Box sx={{ padding: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No notes in this folder
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {notes.map((note) => (
              <ListItem key={note.id} disablePadding>
                <ListItemButton
                  selected={selectedNoteId === note.id}
                  onClick={() => {
                    handleNoteSelect(note.id);
                  }}
                  sx={{
                    paddingY: 1.5,
                    paddingX: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" noWrap>
                        {note.title || 'Untitled Note'}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {truncatePreview(note.contentPreview)}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', marginTop: 0.5 }}
                        >
                          {formatDate(note.modified)}
                        </Typography>
                      </>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};
