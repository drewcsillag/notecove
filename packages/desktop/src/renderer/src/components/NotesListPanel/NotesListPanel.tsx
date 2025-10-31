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
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { Add as AddIcon, Clear as ClearIcon, Folder as FolderIcon } from '@mui/icons-material';
import { DraggableNoteItem } from './DraggableNoteItem';

const DEFAULT_SD_ID = 'default'; // Phase 2.5.1: Single SD only

interface Note {
  id: string;
  title: string;
  sdId: string;
  folderId: string | null;
  created: number;
  modified: number;
  deleted: boolean;
  pinned: boolean;
  contentPreview: string;
  contentText: string;
}

interface NotesListPanelProps {
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string | null) => void;
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

  // Multi-select state
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef<number>(-1);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    noteId: string;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Move to folder dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [noteToMove, setNoteToMove] = useState<string | null>(null);
  const [selectedDestinationFolder, setSelectedDestinationFolder] = useState<string | null>(null);
  const [availableFolders, setAvailableFolders] = useState<
    { id: string; name: string; parentId: string | null; sdId: string }[]
  >([]);

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
          pinned: false, // Search results don't include pin status
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

        // Sort by pinned status first, then by modified date (newest first)
        notesList.sort((a, b) => {
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1; // Pinned notes come first
          }
          return b.modified - a.modified; // Within each group, sort by modified date
        });

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

  // Handle multi-select click
  const handleNoteClick = useCallback(
    (noteId: string, index: number, event: React.MouseEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      const isShift = event.shiftKey;

      if (isCmdOrCtrl) {
        // Cmd/Ctrl+Click: Toggle individual note selection
        setSelectedNoteIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(noteId)) {
            newSet.delete(noteId);
          } else {
            newSet.add(noteId);
          }
          return newSet;
        });
        lastSelectedIndexRef.current = index;
      } else if (isShift && lastSelectedIndexRef.current !== -1) {
        // Shift+Click: Select range
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        const rangeIds = notes.slice(start, end + 1).map((note) => note.id);
        setSelectedNoteIds((prev) => {
          const newSet = new Set(prev);
          rangeIds.forEach((id) => newSet.add(id));
          return newSet;
        });
      } else {
        // Normal click: Clear multi-select and select single note for editing
        setSelectedNoteIds(new Set());
        handleNoteSelect(noteId);
        lastSelectedIndexRef.current = index;
      }
    },
    [notes, handleNoteSelect]
  );

  // Clear multi-select when folder changes
  useEffect(() => {
    setSelectedNoteIds(new Set());
    lastSelectedIndexRef.current = -1;
  }, [selectedFolderId]);

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

  // Clear selected note if it's not in the current notes list
  // This runs when folder changes or when notes are loaded/updated
  useEffect(() => {
    if (selectedNoteId && notes.length > 0) {
      const noteExists = notes.some((note) => note.id === selectedNoteId);
      if (!noteExists) {
        onNoteSelect(null); // Clear selection
      }
    } else if (selectedNoteId && notes.length === 0 && !loading) {
      // If folder is empty, clear selection
      onNoteSelect(null);
    }
    // Now depends on notes array too, but title updates don't refetch the whole array anymore
    // so this won't trigger on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId, notes, onNoteSelect]);

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
      // Update title in notes list without refetching (more efficient and prevents selection clearing)
      setNotes((prevNotes) => {
        const noteIndex = prevNotes.findIndex((note) => note.id === data.noteId);
        if (noteIndex !== -1) {
          const updatedNotes = [...prevNotes];
          updatedNotes[noteIndex] = {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            ...updatedNotes[noteIndex]!,
            title: data.title,
          };
          return updatedNotes;
        }
        return prevNotes;
      });
    });

    const unsubscribePinned = window.electronAPI.note.onPinned((data) => {
      console.log('[NotesListPanel] Note pin toggled:', data);
      // Update pinned status in notes list and re-sort
      setNotes((prevNotes) => {
        const updated = prevNotes.map((note) =>
          note.id === data.noteId ? { ...note, pinned: data.pinned } : note
        );
        // Re-sort with pinned notes first, then by modified date
        updated.sort((a, b) => {
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1;
          }
          return b.modified - a.modified;
        });
        return updated;
      });
    });

    const unsubscribeMoved = window.electronAPI.note.onMoved((data) => {
      console.log('[NotesListPanel] Note moved:', data);

      // Remove note from list if it's no longer in the current folder
      setNotes((prevNotes) => {
        const note = prevNotes.find((n) => n.id === data.noteId);
        if (!note) return prevNotes;

        // If we're viewing "All Notes" (can be 'all-notes' or 'all-notes:sdId'),
        // we need to check if the note is moving INTO a folder
        // (it should disappear from "All Notes" when moved to any folder)
        if (selectedFolderId === 'all-notes' || selectedFolderId?.startsWith('all-notes:')) {
          // Note is moving to a specific folder, remove it from "All Notes" view
          if (data.newFolderId !== null && data.newFolderId !== '') {
            return prevNotes.filter((n) => n.id !== data.noteId);
          }
          // Note is moving back to "All Notes", keep it
          return prevNotes;
        }

        // If the note is moving OUT of the current folder, remove it
        if (selectedFolderId === data.oldFolderId) {
          return prevNotes.filter((n) => n.id !== data.noteId);
        }

        // If the note is moving INTO the current folder, refresh to show it
        if (selectedFolderId === data.newFolderId) {
          void fetchNotes(selectedFolderId);
        }

        return prevNotes;
      });
    });

    return () => {
      unsubscribeCreated();
      unsubscribeDeleted();
      unsubscribeRestored();
      unsubscribeExternal();
      unsubscribeTitleUpdated();
      unsubscribePinned();
      unsubscribeMoved();
    };
  }, [selectedFolderId, fetchNotes, handleNoteSelect]);

  // Handle context menu open
  const handleContextMenu = useCallback(
    (event: React.MouseEvent, noteId: string) => {
      event.preventDefault();

      // If right-clicking on a note that's not in the multi-select, add it
      if (selectedNoteIds.size > 0 && !selectedNoteIds.has(noteId)) {
        setSelectedNoteIds((prev) => new Set([...prev, noteId]));
      }

      setContextMenu({
        mouseX: event.clientX - 2,
        mouseY: event.clientY - 4,
        noteId,
      });
    },
    [selectedNoteIds]
  );

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
      // If multi-select is active, delete all selected notes
      const notesToDelete = selectedNoteIds.size > 0 ? Array.from(selectedNoteIds) : [noteToDelete];

      // Delete all notes
      await Promise.all(notesToDelete.map((id) => window.electronAPI.note.delete(id)));

      // Close dialog
      setDeleteDialogOpen(false);
      setNoteToDelete(null);

      // Clear multi-select
      setSelectedNoteIds(new Set());

      // If we just deleted the selected note, clear selection
      if (selectedNoteId && notesToDelete.includes(selectedNoteId)) {
        onNoteSelect('');
      }

      // Note: The notes list will be updated automatically via the onDeleted event handler
      // which removes the note from the current view
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  }, [noteToDelete, selectedNoteId, selectedNoteIds, onNoteSelect]);

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

  const handleTogglePinFromMenu = useCallback(() => {
    if (!contextMenu) return;

    const { noteId } = contextMenu;
    handleContextMenuClose();

    // Call IPC to toggle pin status
    window.electronAPI.note
      .togglePin(noteId)
      .then(() => {
        console.log('[NotesListPanel] Note pin toggled:', noteId);
        // Note: The notes list will be updated automatically via onPinned event
      })
      .catch((err) => {
        console.error('Failed to toggle pin:', err);
        setError(err instanceof Error ? err.message : 'Failed to toggle pin');
      });
  }, [contextMenu, handleContextMenuClose]);

  // Handle "Move to..." from context menu
  const handleMoveToFromMenu = useCallback(async () => {
    if (!contextMenu) return;

    const { noteId } = contextMenu;
    handleContextMenuClose();

    // Load folders for the current SD
    try {
      const sdId = activeSdId ?? DEFAULT_SD_ID;
      const folders = await window.electronAPI.folder.list(sdId);
      setAvailableFolders(folders.filter((f) => !f.deleted));
      setNoteToMove(noteId);

      // Get current note's folder to pre-select or exclude
      const note = notes.find((n) => n.id === noteId);
      setSelectedDestinationFolder(note?.folderId ?? null);

      setMoveDialogOpen(true);
    } catch (err) {
      console.error('Failed to load folders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    }
  }, [contextMenu, handleContextMenuClose, activeSdId, notes]);

  // Handle move confirmation
  const handleConfirmMove = useCallback(async () => {
    if (!noteToMove) return;

    try {
      // If multi-select is active, move all selected notes
      const notesToMove = selectedNoteIds.size > 0 ? Array.from(selectedNoteIds) : [noteToMove];

      // Move all notes
      await Promise.all(
        notesToMove.map((id) => window.electronAPI.note.move(id, selectedDestinationFolder))
      );

      console.log('[NotesListPanel] Notes moved:', notesToMove, 'to', selectedDestinationFolder);
      setMoveDialogOpen(false);
      setNoteToMove(null);
      setSelectedDestinationFolder(null);

      // Clear multi-select
      setSelectedNoteIds(new Set());

      // Note: The notes list will be updated automatically via note:moved event
    } catch (err) {
      console.error('Failed to move note:', err);
      setError(err instanceof Error ? err.message : 'Failed to move note');
    }
  }, [noteToMove, selectedDestinationFolder, selectedNoteIds]);

  // Handle move dialog close
  const handleCancelMove = useCallback(() => {
    setMoveDialogOpen(false);
    setNoteToMove(null);
    setSelectedDestinationFolder(null);
  }, []);

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

      {/* Multi-select Badge */}
      {selectedNoteIds.size > 0 && (
        <Box
          sx={{
            padding: 1,
            backgroundColor: 'primary.light',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {selectedNoteIds.size} {selectedNoteIds.size === 1 ? 'note' : 'notes'} selected
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSelectedNoteIds(new Set());
              lastSelectedIndexRef.current = -1;
            }}
            sx={{
              color: 'inherit',
              borderColor: 'primary.contrastText',
              '&:hover': {
                borderColor: 'primary.contrastText',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Clear Selection
          </Button>
        </Box>
      )}

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
            {notes.map((note, index) => {
              const isMultiSelected = selectedNoteIds.has(note.id);
              const isSingleSelected = selectedNoteId === note.id;
              return (
                <DraggableNoteItem
                  key={note.id}
                  note={note}
                  index={index}
                  isMultiSelected={isMultiSelected}
                  isSingleSelected={isSingleSelected}
                  selectedNoteIds={selectedNoteIds}
                  onClick={(event) => {
                    handleNoteClick(note.id, index, event);
                  }}
                  onContextMenu={(e) => {
                    handleContextMenu(e, note.id);
                  }}
                  truncatePreview={truncatePreview}
                  formatDate={formatDate}
                />
              );
            })}
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
              {selectedNoteIds.size === 0 && (
                <MenuItem onClick={handleTogglePinFromMenu}>
                  {notes.find((n) => n.id === contextMenu.noteId)?.pinned ? 'Unpin' : 'Pin'}
                </MenuItem>
              )}
              <MenuItem onClick={() => void handleMoveToFromMenu()}>
                {selectedNoteIds.size > 0
                  ? `Move ${selectedNoteIds.size} notes to...`
                  : 'Move to...'}
              </MenuItem>
              <MenuItem onClick={handleDeleteFromMenu}>
                {selectedNoteIds.size > 0 ? `Delete ${selectedNoteIds.size} notes` : 'Delete'}
              </MenuItem>
            </>
          )}
        </Menu>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>
          {selectedNoteIds.size > 0 ? `Delete ${selectedNoteIds.size} Notes?` : 'Delete Note?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedNoteIds.size > 0
              ? `These ${selectedNoteIds.size} notes will be moved to Recently Deleted. You can restore them later or permanently delete them from there.`
              : 'This note will be moved to Recently Deleted. You can restore it later or permanently delete it from there.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={() => void handleConfirmDelete()} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move to Folder Dialog */}
      <Dialog open={moveDialogOpen} onClose={handleCancelMove} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedNoteIds.size > 0
            ? `Move ${selectedNoteIds.size} Notes to Folder`
            : 'Move Note to Folder'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>Select a destination folder:</DialogContentText>
          <RadioGroup
            value={selectedDestinationFolder ?? 'null'}
            onChange={(e) => {
              setSelectedDestinationFolder(e.target.value === 'null' ? null : e.target.value);
            }}
            sx={{ mt: 2 }}
          >
            <FormControlLabel
              value="null"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderIcon fontSize="small" />
                  <Typography>All Notes (No Folder)</Typography>
                </Box>
              }
            />
            {availableFolders.map((folder) => {
              // For multi-select, disable if ALL selected notes are in this folder
              // For single note, disable if the note is in this folder
              const isCurrentFolder =
                selectedNoteIds.size > 0
                  ? Array.from(selectedNoteIds).every(
                      (id) => notes.find((n) => n.id === id)?.folderId === folder.id
                    )
                  : notes.find((n) => n.id === noteToMove)?.folderId === folder.id;

              return (
                <FormControlLabel
                  key={folder.id}
                  value={folder.id}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon fontSize="small" />
                      <Typography>{folder.name}</Typography>
                    </Box>
                  }
                  disabled={isCurrentFolder}
                />
              );
            })}
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelMove}>Cancel</Button>
          <Button
            onClick={() => void handleConfirmMove()}
            color="primary"
            autoFocus
            disabled={
              // For multi-select, disable if destination is the same as ALL selected notes' current folder
              // For single note, disable if destination matches the note's current folder
              selectedNoteIds.size > 0
                ? Array.from(selectedNoteIds).every(
                    (id) => selectedDestinationFolder === notes.find((n) => n.id === id)?.folderId
                  )
                : selectedDestinationFolder === notes.find((n) => n.id === noteToMove)?.folderId
            }
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
