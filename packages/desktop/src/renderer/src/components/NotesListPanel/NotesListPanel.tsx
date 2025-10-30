/**
 * Notes List Panel Component
 *
 * Displays a list of notes filtered by the selected folder.
 * Phase 2.5.1: Basic read-only display.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { Add as AddIcon, Clear as ClearIcon } from '@mui/icons-material';

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
  activeSdId?: string;
}

export const NotesListPanel: React.FC<NotesListPanelProps> = ({
  selectedNoteId,
  onNoteSelect,
  activeSdId,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    noteId: string;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

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

  // Load search query from app state
  const loadSearchQuery = useCallback(async () => {
    try {
      const savedQuery = await window.electronAPI.appState.get('searchQuery');
      if (savedQuery) {
        setSearchQuery(savedQuery);
      }
    } catch (err) {
      console.error('Failed to load search query:', err);
    }
  }, []);

  // Save search query to app state
  const saveSearchQuery = useCallback(async (query: string) => {
    try {
      await window.electronAPI.appState.set('searchQuery', query);
    } catch (err) {
      console.error('Failed to save search query:', err);
    }
  }, []);

  // Perform search
  const performSearch = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(null);
      setIsSearching(true);

      try {
        const searchResults = await window.electronAPI.note.search(query, 50);

        // Convert search results to Note format
        const notesList: Note[] = searchResults.map((result) => ({
          id: result.noteId,
          title: result.title,
          sdId: activeSdId ?? DEFAULT_SD_ID,
          folderId: null, // Search results don't have folder info
          created: 0,
          modified: 0,
          deleted: false,
          contentPreview: result.snippet,
          contentText: result.snippet,
        }));

        setNotes(notesList);
      } catch (err) {
        console.error('Failed to search notes:', err);
        setError(err instanceof Error ? err.message : 'Failed to search notes');
        setNotes([]);
      } finally {
        setLoading(false);
      }
    },
    [activeSdId]
  );

  // Note: selectedNoteId is now window-local state, not persisted globally

  // Fetch notes for the selected folder
  const fetchNotes = useCallback(
    async (folderId: string | null) => {
      setLoading(true);
      setError(null);
      setIsSearching(false);

      try {
        let notesList: Note[];
        const sdId = activeSdId ?? DEFAULT_SD_ID;

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (folderId === 'all-notes' || folderId?.startsWith('all-notes:') || folderId === null) {
          // Fetch all notes for the SD
          notesList = await window.electronAPI.note.list(sdId);
        } else {
          // Fetch notes for specific folder
          notesList = await window.electronAPI.note.list(sdId, folderId);
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
    },
    [activeSdId]
  );

  // Handle note selection - delegate to parent
  const handleNoteSelect = useCallback(
    (noteId: string) => {
      onNoteSelect(noteId);
    },
    [onNoteSelect]
  );

  // Handle search input change
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const query = event.target.value;
      setSearchQuery(query);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Save query to app state
      void saveSearchQuery(query);

      // Debounce search with 300ms delay
      if (query.trim()) {
        searchTimeoutRef.current = setTimeout(() => {
          void performSearch(query.trim());
        }, 300);
      } else {
        // Clear search, show folder contents
        setIsSearching(false);
        if (selectedFolderId !== null) {
          void fetchNotes(selectedFolderId);
        }
      }
    },
    [saveSearchQuery, performSearch, selectedFolderId, fetchNotes]
  );

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    void saveSearchQuery('');
    setIsSearching(false);
    if (selectedFolderId !== null) {
      void fetchNotes(selectedFolderId);
    }
  }, [saveSearchQuery, selectedFolderId, fetchNotes]);

  // Handle note creation
  const handleCreateNote = useCallback(async () => {
    if (creating) return; // Prevent double-clicks

    setCreating(true);
    try {
      // Determine folder for new note
      const folderId = selectedFolderId === 'all-notes' ? null : selectedFolderId;

      // Create note via IPC - use the currently active SD
      console.log('[NotesListPanel] Creating note with activeSdId:', activeSdId);
      const noteId = await window.electronAPI.note.create(
        activeSdId ?? DEFAULT_SD_ID,
        folderId ?? '',
        ''
      );

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
  }, [creating, selectedFolderId, handleNoteSelect, fetchNotes, activeSdId]);

  // Load selected folder and search query on mount
  useEffect(() => {
    void loadSelectedFolder();
    void loadSearchQuery();
  }, [loadSelectedFolder, loadSearchQuery]);

  // Reset to "all-notes" when active SD changes
  useEffect(() => {
    setSelectedFolderId('all-notes');
  }, [activeSdId]);

  // Fetch notes when selected folder or active SD changes (only if not searching)
  useEffect(() => {
    if (selectedFolderId !== null && !searchQuery.trim()) {
      void fetchNotes(selectedFolderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId, activeSdId]);

  // Trigger search when searchQuery changes (loaded from app state)
  useEffect(() => {
    // Skip if no query or folder not loaded yet
    if (!searchQuery.trim() || selectedFolderId === null) return;

    // Skip initial empty state
    if (notes.length === 0 && !loading) {
      void performSearch(searchQuery.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedFolderId]);

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
      // If we're viewing a regular folder (including "All Notes"), remove the note from the list
      // If we're viewing "Recently Deleted", we need to refetch to show the newly deleted note
      if (
        selectedFolderId &&
        (selectedFolderId === 'recently-deleted' ||
          selectedFolderId.startsWith('recently-deleted:'))
      ) {
        // Refresh the Recently Deleted view to show the new note
        void fetchNotes(selectedFolderId);
      } else {
        // Remove from the current view
        setNotes((prev) => prev.filter((note) => note.id !== noteId));
      }
    });

    const unsubscribeRestored = window.electronAPI.note.onRestored((noteId) => {
      console.log('[NotesListPanel] Note restored:', noteId);
      // If we're viewing "Recently Deleted", remove the note from the list
      // Otherwise, if we're viewing "All Notes" or the note's folder, refetch to show it
      if (
        selectedFolderId &&
        (selectedFolderId === 'recently-deleted' ||
          selectedFolderId.startsWith('recently-deleted:'))
      ) {
        // Remove from Recently Deleted view
        setNotes((prev) => prev.filter((note) => note.id !== noteId));
      } else {
        // Refresh other views to potentially show the restored note
        if (selectedFolderId !== null) {
          void fetchNotes(selectedFolderId);
        }
      }
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
      unsubscribeRestored();
      unsubscribeExternal();
      unsubscribeTitleUpdated();
    };
  }, [selectedFolderId, fetchNotes, handleNoteSelect]);

  // Handle context menu open
  const handleContextMenu = useCallback((event: React.MouseEvent, noteId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      noteId,
    });
  }, []);

  // Handle context menu close
  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle "New Note" from context menu
  const handleNewNoteFromMenu = useCallback(() => {
    handleContextMenuClose();
    void handleCreateNote();
  }, [handleContextMenuClose, handleCreateNote]);

  // Handle "Delete" from context menu
  const handleDeleteFromMenu = useCallback(() => {
    if (contextMenu) {
      setNoteToDelete(contextMenu.noteId);
      setDeleteDialogOpen(true);
      handleContextMenuClose();
    }
  }, [contextMenu, handleContextMenuClose]);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (!noteToDelete) return;

    try {
      // Call IPC to delete note (soft delete)
      await window.electronAPI.note.delete(noteToDelete);

      // Close dialog
      setDeleteDialogOpen(false);
      setNoteToDelete(null);

      // If we just deleted the selected note, clear selection
      if (selectedNoteId === noteToDelete) {
        onNoteSelect('');
      }

      // Note: The notes list will be updated automatically via the onDeleted event handler
      // which removes the note from the current view
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  }, [noteToDelete, selectedNoteId, onNoteSelect]);

  // Handle delete cancellation
  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setNoteToDelete(null);
  }, []);

  // Handle restore from menu
  const handleRestoreFromMenu = useCallback(() => {
    if (!contextMenu) return;

    const { noteId } = contextMenu;
    handleContextMenuClose();

    // Call IPC to restore note
    window.electronAPI.note
      .restore(noteId)
      .then(() => {
        console.log('[NotesListPanel] Note restored:', noteId);
        // If we just restored the selected note, clear selection
        if (selectedNoteId === noteId) {
          onNoteSelect('');
        }
        // Note: The notes list will be updated automatically via onRestored event
      })
      .catch((err) => {
        console.error('Failed to restore note:', err);
        setError(err instanceof Error ? err.message : 'Failed to restore note');
      });
  }, [contextMenu, handleContextMenuClose, selectedNoteId, onNoteSelect]);

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
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 1.5,
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

        {/* Search Box */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleClearSearch}
                  edge="end"
                  aria-label="clear search"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
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
              {isSearching ? 'No results found' : 'No notes in this folder'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding data-testid="notes-list">
            {notes.map((note) => (
              <ListItem key={note.id} disablePadding>
                <ListItemButton
                  selected={selectedNoteId === note.id}
                  onClick={() => {
                    handleNoteSelect(note.id);
                  }}
                  onContextMenu={(e) => {
                    handleContextMenu(e, note.id);
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

      {/* Context Menu */}
      {contextMenu && (
        <Menu
          open={true}
          onClose={handleContextMenuClose}
          anchorReference="anchorPosition"
          anchorPosition={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
        >
          {selectedFolderId &&
          (selectedFolderId === 'recently-deleted' ||
            selectedFolderId.startsWith('recently-deleted:')) ? (
            <>
              <MenuItem onClick={handleRestoreFromMenu}>Restore</MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={handleNewNoteFromMenu}>New Note</MenuItem>
              <MenuItem onClick={handleDeleteFromMenu}>Delete</MenuItem>
            </>
          )}
        </Menu>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Delete Note?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This note will be moved to Recently Deleted. You can restore it later or permanently
            delete it from there.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={() => void handleConfirmDelete()} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
