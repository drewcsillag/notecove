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
import { CrossSDConflictDialog } from './CrossSDConflictDialog';
import { extractTags } from '@notecove/shared';
import { ExportProgressDialog } from '../ExportProgressDialog/ExportProgressDialog';
import {
  exportNotes,
  exportAllNotes,
  buildNoteTitleLookup,
  type FolderInfo,
} from '../../services/export-service';
import type { ExportProgress } from '../../utils/markdown-export';

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
  onNoteCreated?: (noteId: string) => void;
  activeSdId?: string | undefined;
  tagFilters?: Record<string, 'include' | 'exclude'>;
  exportTrigger?: 'selected' | 'all' | null;
  onExportComplete?: () => void;
}

export const NotesListPanel: React.FC<NotesListPanelProps> = ({
  selectedNoteId,
  onNoteSelect,
  onNoteCreated,
  activeSdId,
  tagFilters = {},
  exportTrigger,
  onExportComplete,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Folders for building folder paths in notes list
  const [folders, setFolders] = useState<{ id: string; name: string; parentId: string | null }[]>(
    []
  );
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

  // Permanent delete confirmation dialog state
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [noteToPermanentDelete, setNoteToPermanentDelete] = useState<string | null>(null);

  // Move to folder dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [noteToMove, setNoteToMove] = useState<string | null>(null);
  const [selectedDestinationFolder, setSelectedDestinationFolder] = useState<string | null>(null);
  const [selectedDestinationSdId, setSelectedDestinationSdId] = useState<string | null>(null);
  const [availableFolders, setAvailableFolders] = useState<
    {
      sdId: string;
      sdName: string;
      folders: { id: string; name: string; parentId: string | null; sdId: string }[];
    }[]
  >([]);

  // Cross-SD conflict dialog state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictNote, setConflictNote] = useState<{
    noteId: string;
    noteTitle: string;
    targetSdName: string;
  } | null>(null);
  const [pendingMoves, setPendingMoves] = useState<
    {
      noteId: string;
      sourceSdId: string;
      targetSdId: string;
      targetFolderId: string | null;
    }[]
  >([]);

  // Export progress dialog state
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  // Load folders for the active SD (for displaying folder paths in notes list)
  const loadFolders = useCallback(async () => {
    try {
      const sdId = activeSdId ?? DEFAULT_SD_ID;
      const foldersData = await window.electronAPI.folder.list(sdId);
      setFolders(
        foldersData
          .filter((f) => !f.deleted)
          .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))
      );
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, [activeSdId]);

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

        // Filter by tag filters if any (AND logic for includes, AND logic for excludes)
        if (Object.keys(tagFilters).length > 0) {
          // Get all tags to map tag IDs to tag names
          const allTags = await window.electronAPI.tag.getAll();
          const tagIdToName = new Map(allTags.map((t) => [t.id, t.name]));

          // Separate includes and excludes
          const includeTags: string[] = [];
          const excludeTags: string[] = [];
          for (const [tagId, filterType] of Object.entries(tagFilters)) {
            const tagName = tagIdToName.get(tagId)?.toLowerCase();
            if (tagName) {
              if (filterType === 'include') {
                includeTags.push(tagName);
              } else {
                // filterType === 'exclude'
                excludeTags.push(tagName);
              }
            }
          }

          // Filter notes using AND logic
          notesList = notesList.filter((note) => {
            // Extract tags from note content
            const noteTags = extractTags(note.contentText);
            const noteTagsLower = noteTags.map((t) => t.toLowerCase());

            // Check includes: note must have ALL include tags (AND logic)
            const hasAllIncludes = includeTags.every((tag) => noteTagsLower.includes(tag));

            // Check excludes: note must NOT have ANY exclude tags (AND logic - all excludes satisfied)
            const hasNoExcludes = excludeTags.every((tag) => !noteTagsLower.includes(tag));

            return hasAllIncludes && hasNoExcludes;
          });
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
    [activeSdId, tagFilters]
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

    // Don't allow note creation in Recently Deleted
    if (
      selectedFolderId &&
      (selectedFolderId === 'recently-deleted' || selectedFolderId.startsWith('recently-deleted:'))
    ) {
      return;
    }

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

      // Notify parent that a new note was created (for initial formatting)
      onNoteCreated?.(noteId);

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
  }, [creating, selectedFolderId, handleNoteSelect, fetchNotes, activeSdId, onNoteCreated]);

  // Load selected folder, search query, and folders on mount
  useEffect(() => {
    void loadSelectedFolder();
    void loadSearchQuery();
    void loadFolders();
  }, [loadSelectedFolder, loadSearchQuery, loadFolders]);

  // Reset to "all-notes" and reload folders when active SD changes
  useEffect(() => {
    setSelectedFolderId('all-notes');
    void loadFolders();
  }, [activeSdId, loadFolders]);

  // Fetch notes when selected folder, active SD, or tag filters change (only if not searching)
  useEffect(() => {
    if (selectedFolderId !== null && !searchQuery.trim()) {
      void fetchNotes(selectedFolderId);
    }
  }, [selectedFolderId, searchQuery, fetchNotes]);

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

  // NOTE: We intentionally DON'T clear the selected note when changing folders
  // This allows users to browse folders while keeping their current note open in the editor
  // The notes list will update to show notes in the new folder, but the editor stays put

  // Listen for note updates from other windows
  useEffect(() => {
    const unsubscribeCreated = window.electronAPI.note.onCreated((data) => {
      console.log('[NotesListPanel] Note created:', data);
      // Refresh notes if it's in the current folder
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (
        selectedFolderId === 'all-notes' ||
        (data.folderId != null && selectedFolderId === data.folderId)
      ) {
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

    const unsubscribePermanentDeleted = window.electronAPI.note.onPermanentDeleted((noteId) => {
      console.log('[NotesListPanel] Note permanently deleted:', noteId);
      // Remove from notes list (should only happen in Recently Deleted view)
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

      // Remove the moved note from multi-select if it's selected
      setSelectedNoteIds((prev) => {
        if (prev.has(data.noteId)) {
          const newSet = new Set(prev);
          newSet.delete(data.noteId);
          // If this was the last selected note, clear the lastSelectedIndex
          if (newSet.size === 0) {
            lastSelectedIndexRef.current = -1;
          }
          return newSet;
        }
        return prev;
      });

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
      unsubscribePermanentDeleted();
      unsubscribeExternal();
      unsubscribeTitleUpdated();
      unsubscribePinned();
      unsubscribeMoved();
    };
  }, [selectedFolderId, fetchNotes, handleNoteSelect]);

  // Handle export trigger from app menu
  useEffect(() => {
    if (!exportTrigger) return;

    const runExport = async (): Promise<void> => {
      const noteTitleLookup = buildNoteTitleLookup(notes);

      setIsExporting(true);
      setExportProgress({ current: 0, total: 0, currentNoteName: '' });

      try {
        if (exportTrigger === 'selected') {
          // Export selected notes (multi-select or current note)
          const noteIdsToExport =
            selectedNoteIds.size > 0
              ? Array.from(selectedNoteIds)
              : selectedNoteId
                ? [selectedNoteId]
                : [];

          if (noteIdsToExport.length === 0) {
            console.log('[Export] No notes selected to export');
            return;
          }

          setExportProgress({ current: 0, total: noteIdsToExport.length, currentNoteName: '' });
          await exportNotes(noteIdsToExport, noteTitleLookup, (progress) => {
            setExportProgress(progress);
          });
        } else {
          // Export all notes in the current SD (exportTrigger === 'all')
          const sdId = activeSdId ?? DEFAULT_SD_ID;

          // Get all folders for this SD
          const foldersData = await window.electronAPI.folder.list(sdId);
          const folders: FolderInfo[] = foldersData.map((f) => ({
            id: f.id,
            name: f.name,
            parentId: f.parentId,
          }));

          // Get all notes for this SD (pass undefined to get ALL notes, not just root folder)
          const allNotesInSD = await window.electronAPI.note.list(sdId, undefined);

          setExportProgress({ current: 0, total: allNotesInSD.length, currentNoteName: '' });
          await exportAllNotes(sdId, folders, allNotesInSD, noteTitleLookup, (progress) => {
            setExportProgress(progress);
          });
        }
      } catch (err) {
        console.error('Failed to export notes:', err);
        setError(err instanceof Error ? err.message : 'Failed to export notes');
      } finally {
        setIsExporting(false);
        setExportProgress(null);
        onExportComplete?.();
      }
    };

    void runExport();
  }, [exportTrigger, notes, selectedNoteIds, selectedNoteId, activeSdId, onExportComplete]);

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

  // Handle export from context menu
  const handleExportFromMenu = useCallback(async () => {
    if (!contextMenu) return;
    handleContextMenuClose();

    // Determine which notes to export
    const noteIdsToExport =
      selectedNoteIds.size > 0 ? Array.from(selectedNoteIds) : [contextMenu.noteId];

    // Build note title lookup for resolving inter-note links
    const noteTitleLookup = buildNoteTitleLookup(notes);

    setIsExporting(true);
    setExportProgress({ current: 0, total: noteIdsToExport.length, currentNoteName: '' });

    try {
      await exportNotes(noteIdsToExport, noteTitleLookup, (progress) => {
        setExportProgress(progress);
      });
    } catch (err) {
      console.error('Failed to export notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to export notes');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [contextMenu, handleContextMenuClose, selectedNoteIds, notes]);

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

  // Handle permanent delete from menu
  const handlePermanentDeleteFromMenu = useCallback(() => {
    if (!contextMenu) return;

    const { noteId } = contextMenu;
    setNoteToPermanentDelete(noteId);
    setPermanentDeleteDialogOpen(true);
    handleContextMenuClose();
  }, [contextMenu, handleContextMenuClose]);

  // Handle cancel permanent delete
  const handleCancelPermanentDelete = useCallback(() => {
    setPermanentDeleteDialogOpen(false);
    setNoteToPermanentDelete(null);
  }, []);

  // Handle confirm permanent delete
  const handleConfirmPermanentDelete = useCallback(async () => {
    if (!noteToPermanentDelete) return;

    try {
      // If multi-select is active, delete all selected notes
      const notesToDelete =
        selectedNoteIds.size > 0 ? Array.from(selectedNoteIds) : [noteToPermanentDelete];

      // Delete all notes
      await Promise.all(notesToDelete.map((id) => window.electronAPI.note.permanentDelete(id)));

      console.log('[NotesListPanel] Notes permanently deleted:', notesToDelete);

      // Clear multi-select
      setSelectedNoteIds(new Set());

      // If we just deleted the selected note, clear selection
      if (selectedNoteId && notesToDelete.includes(selectedNoteId)) {
        onNoteSelect('');
      }

      // Refresh notes list
      if (selectedFolderId !== null) {
        await fetchNotes(selectedFolderId);
      }
    } catch (err) {
      console.error('Failed to permanently delete note:', err);
      setError(err instanceof Error ? err.message : 'Failed to permanently delete note');
    } finally {
      handleCancelPermanentDelete();
    }
  }, [
    noteToPermanentDelete,
    selectedNoteIds,
    handleCancelPermanentDelete,
    selectedNoteId,
    onNoteSelect,
    selectedFolderId,
    fetchNotes,
  ]);

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

  // Handle "Duplicate" from context menu
  const handleDuplicateFromMenu = useCallback(() => {
    if (!contextMenu) return;

    const { noteId } = contextMenu;
    handleContextMenuClose();

    // Call IPC to duplicate note
    window.electronAPI.note
      .duplicate(noteId)
      .then((newNoteId) => {
        console.log('[NotesListPanel] Note duplicated:', noteId, '-> New ID:', newNoteId);
        // Select the new note
        onNoteSelect(newNoteId);
        // Refresh notes list to show the duplicate
        if (selectedFolderId !== null) {
          void fetchNotes(selectedFolderId);
        }
      })
      .catch((err) => {
        console.error('Failed to duplicate note:', err);
        setError(err instanceof Error ? err.message : 'Failed to duplicate note');
      });
  }, [contextMenu, handleContextMenuClose, onNoteSelect, selectedFolderId, fetchNotes]);

  // Handle "Move to..." from context menu
  const handleMoveToFromMenu = useCallback(async () => {
    if (!contextMenu) return;

    const { noteId } = contextMenu;
    handleContextMenuClose();

    // Load folders from all SDs
    try {
      const allFolders = await window.electronAPI.folder.listAll();
      // Filter out deleted folders
      const activeFolders = allFolders.map((sd) => ({
        ...sd,
        folders: sd.folders.filter((f) => !f.deleted),
      }));
      setAvailableFolders(activeFolders);
      setNoteToMove(noteId);

      // Get current note's folder and SD to pre-select
      const note = notes.find((n) => n.id === noteId);
      setSelectedDestinationFolder(note?.folderId ?? null);
      setSelectedDestinationSdId(note?.sdId ?? activeSdId ?? DEFAULT_SD_ID);

      setMoveDialogOpen(true);
    } catch (err) {
      console.error('Failed to load folders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    }
  }, [contextMenu, handleContextMenuClose, activeSdId, notes]);

  // Handle move confirmation
  const handleConfirmMove = useCallback(async () => {
    if (!noteToMove || selectedDestinationSdId === null) return;

    try {
      // If multi-select is active, move all selected notes
      const notesToMove = selectedNoteIds.size > 0 ? Array.from(selectedNoteIds) : [noteToMove];

      // Get the source SD of the notes
      const sourceNote = notes.find((n) => n.id === noteToMove);
      if (!sourceNote) {
        throw new Error('Source note not found');
      }
      const sourceSdId = sourceNote.sdId;

      // Check if this is a cross-SD move
      const isCrossSdMove = sourceSdId !== selectedDestinationSdId;

      if (isCrossSdMove) {
        // Cross-SD move - check for conflicts first
        let conflictFound = false;

        // Check each note for conflicts
        for (const noteId of notesToMove) {
          const conflictCheck = await window.electronAPI.note.checkExistsInSD(
            noteId,
            selectedDestinationSdId
          );

          if (conflictCheck.exists && !conflictCheck.isDeleted) {
            // Note exists and is NOT in Recently Deleted - show conflict dialog
            const note = notes.find((n) => n.id === noteId);
            const targetSd = availableFolders.find((sd) => sd.sdId === selectedDestinationSdId);

            setConflictNote({
              noteId: noteId,
              noteTitle: note?.title ?? 'Untitled',
              targetSdName: targetSd?.sdName ?? 'Unknown SD',
            });

            // Store pending moves for after conflict resolution
            setPendingMoves(
              notesToMove.map((id) => ({
                noteId: id,
                sourceSdId: sourceSdId,
                targetSdId: selectedDestinationSdId,
                targetFolderId: selectedDestinationFolder,
              }))
            );

            setConflictDialogOpen(true);
            conflictFound = true;
            break; // Only show dialog for first conflict
          }
        }

        // If no conflicts (or all conflicts are in Recently Deleted), proceed with moves
        if (!conflictFound) {
          await Promise.all(
            notesToMove.map((id) =>
              window.electronAPI.note.moveToSD(
                id,
                sourceSdId,
                selectedDestinationSdId,
                selectedDestinationFolder,
                'replace' // Auto-replace if in Recently Deleted, or no conflict
              )
            )
          );
          console.log(
            '[NotesListPanel] Notes moved cross-SD:',
            notesToMove,
            'from',
            sourceSdId,
            'to',
            selectedDestinationSdId,
            'folder',
            selectedDestinationFolder
          );

          setMoveDialogOpen(false);
          setNoteToMove(null);
          setSelectedDestinationFolder(null);
          setSelectedDestinationSdId(null);
          setSelectedNoteIds(new Set());
        }
      } else {
        // Same-SD move - use regular move
        await Promise.all(
          notesToMove.map((id) => window.electronAPI.note.move(id, selectedDestinationFolder))
        );
        console.log('[NotesListPanel] Notes moved:', notesToMove, 'to', selectedDestinationFolder);

        setMoveDialogOpen(false);
        setNoteToMove(null);
        setSelectedDestinationFolder(null);
        setSelectedDestinationSdId(null);
        setSelectedNoteIds(new Set());
      }

      // Note: The notes list will be updated automatically via note:moved event
    } catch (err) {
      console.error('Failed to move note:', err);
      setError(err instanceof Error ? err.message : 'Failed to move note');
    }
  }, [
    noteToMove,
    selectedDestinationFolder,
    selectedDestinationSdId,
    selectedNoteIds,
    notes,
    availableFolders,
  ]);

  // Handle move dialog close
  const handleCancelMove = useCallback(() => {
    setMoveDialogOpen(false);
    setNoteToMove(null);
    setSelectedDestinationFolder(null);
    setSelectedDestinationSdId(null);
    setSelectedNoteIds(new Set()); // Clear multiselect
    lastSelectedIndexRef.current = -1;
  }, []);

  // Handle conflict resolution
  const handleConflictResolution = useCallback(
    async (resolution: 'replace' | 'keepBoth' | 'cancel') => {
      try {
        if (resolution === 'cancel') {
          // User cancelled - close dialogs and clear selection
          setConflictDialogOpen(false);
          setConflictNote(null);
          setPendingMoves([]);
          setMoveDialogOpen(false);
          setNoteToMove(null);
          setSelectedDestinationFolder(null);
          setSelectedDestinationSdId(null);
          setSelectedNoteIds(new Set()); // Clear multiselect
          lastSelectedIndexRef.current = -1;
          return;
        }

        // Execute all pending moves with the chosen resolution
        await Promise.all(
          pendingMoves.map((move) =>
            window.electronAPI.note.moveToSD(
              move.noteId,
              move.sourceSdId,
              move.targetSdId,
              move.targetFolderId,
              resolution
            )
          )
        );

        console.log(
          '[NotesListPanel] Cross-SD moves completed with resolution:',
          resolution,
          pendingMoves
        );

        // Close both dialogs and cleanup
        setConflictDialogOpen(false);
        setConflictNote(null);
        setPendingMoves([]);
        setMoveDialogOpen(false);
        setNoteToMove(null);
        setSelectedDestinationFolder(null);
        setSelectedDestinationSdId(null);
        setSelectedNoteIds(new Set());
      } catch (err) {
        console.error('Failed to complete cross-SD moves:', err);
        setError(err instanceof Error ? err.message : 'Failed to move notes');
      }
    },
    [pendingMoves]
  );

  // Format date for display - locale-based timestamps
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();

    // Check if the date is today
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isToday) {
      // Today: show time only
      return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    // Not today: show full date and time
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Truncate preview text
  const truncatePreview = (text: string, maxLength = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Build folder hierarchy path for display
  const buildFolderPath = (
    folderId: string,
    folderList: { id: string; name: string; parentId: string | null }[]
  ): string => {
    const folder = folderList.find((f) => f.id === folderId);
    if (!folder) return '';

    const path: string[] = [folder.name];
    let currentFolder = folder;

    while (currentFolder.parentId) {
      const parent = folderList.find((f) => f.id === currentFolder.parentId);
      if (!parent) break;
      path.unshift(parent.name);
      currentFolder = parent;
    }

    return path.join(' / ');
  };

  // Get folder path for a note (returns null for root notes)
  const getFolderPathForNote = (folderId: string | null): string | null => {
    if (!folderId) return null;
    const path = buildFolderPath(folderId, folders);
    return path || null;
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
            aria-label="create note"
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
      <Box sx={{ flexGrow: 1, overflow: 'auto' }} data-testid="notes-list">
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
          <List disablePadding>
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
                  folderPath={getFolderPathForNote(note.folderId)}
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
              <MenuItem onClick={handlePermanentDeleteFromMenu}>Delete Permanently</MenuItem>
            </>
          ) : (
            <>
              <MenuItem
                onClick={handleNewNoteFromMenu}
                disabled={
                  !!(
                    selectedFolderId &&
                    (selectedFolderId === 'recently-deleted' ||
                      selectedFolderId.startsWith('recently-deleted:'))
                  )
                }
              >
                New Note
              </MenuItem>
              {selectedNoteIds.size === 0 && (
                <MenuItem onClick={handleTogglePinFromMenu}>
                  {notes.find((n) => n.id === contextMenu.noteId)?.pinned ? 'Unpin' : 'Pin'}
                </MenuItem>
              )}
              {selectedNoteIds.size === 0 && (
                <MenuItem onClick={handleDuplicateFromMenu}>Duplicate</MenuItem>
              )}
              <MenuItem onClick={() => void handleMoveToFromMenu()}>
                {selectedNoteIds.size > 0
                  ? `Move ${selectedNoteIds.size} notes to...`
                  : 'Move to...'}
              </MenuItem>
              <MenuItem onClick={handleDeleteFromMenu}>
                {selectedNoteIds.size > 0 ? `Delete ${selectedNoteIds.size} notes` : 'Delete'}
              </MenuItem>
              <MenuItem onClick={() => void handleExportFromMenu()}>
                {selectedNoteIds.size > 0
                  ? `Export ${selectedNoteIds.size} notes to Markdown`
                  : 'Export to Markdown'}
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

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={permanentDeleteDialogOpen} onClose={handleCancelPermanentDelete}>
        <DialogTitle>
          {selectedNoteIds.size > 0
            ? `Permanently Delete ${selectedNoteIds.size} Notes?`
            : 'Permanently Delete Note?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedNoteIds.size > 0
              ? `This action cannot be undone. These ${selectedNoteIds.size} notes and all their content will be permanently deleted from disk.`
              : 'This action cannot be undone. The note and all its content will be permanently deleted from disk.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelPermanentDelete}>Cancel</Button>
          <Button onClick={() => void handleConfirmPermanentDelete()} color="error" autoFocus>
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cross-SD Conflict Dialog */}
      {conflictNote && (
        <CrossSDConflictDialog
          open={conflictDialogOpen}
          noteTitle={conflictNote.noteTitle}
          targetSdName={conflictNote.targetSdName}
          onResolve={handleConflictResolution}
        />
      )}

      {/* Export Progress Dialog */}
      <ExportProgressDialog
        open={isExporting}
        current={exportProgress?.current ?? 0}
        total={exportProgress?.total ?? 0}
        currentNoteName={exportProgress?.currentNoteName ?? ''}
      />

      {/* Move to Folder Dialog */}
      <Dialog open={moveDialogOpen} onClose={handleCancelMove} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedNoteIds.size > 0
            ? `Move ${selectedNoteIds.size} Notes to Folder`
            : 'Move Note to Folder'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Select a destination folder (folders are grouped by Storage Directory):
          </DialogContentText>
          <RadioGroup
            value={`${selectedDestinationSdId}:${selectedDestinationFolder ?? 'null'}`}
            onChange={(e) => {
              const [sdId, folderId] = e.target.value.split(':');
              setSelectedDestinationSdId(sdId ?? null);
              setSelectedDestinationFolder(folderId === 'null' ? null : (folderId ?? null));
            }}
            sx={{ mt: 2 }}
          >
            {availableFolders.map((sd) => (
              <Box key={sd.sdId} sx={{ mb: 2 }}>
                {/* SD Heading */}
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 'bold',
                    color: 'text.secondary',
                    mb: 0.5,
                    mt: 1,
                  }}
                >
                  {sd.sdName}
                </Typography>

                {/* "No Folder" option for this SD */}
                <FormControlLabel
                  value={`${sd.sdId}:null`}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon fontSize="small" />
                      <Typography>All Notes (No Folder)</Typography>
                    </Box>
                  }
                />

                {/* Folders for this SD */}
                {sd.folders.map((folder) => {
                  const folderPath = buildFolderPath(folder.id, sd.folders);
                  const sourceNote = notes.find((n) => n.id === noteToMove);

                  // For multi-select, disable if ALL selected notes are in this folder and SD
                  // For single note, disable if the note is in this folder and SD
                  const isCurrentLocation =
                    selectedNoteIds.size > 0
                      ? Array.from(selectedNoteIds).every((id) => {
                          const note = notes.find((n) => n.id === id);
                          return note
                            ? note.folderId === folder.id && note.sdId === sd.sdId
                            : false;
                        })
                      : sourceNote
                        ? sourceNote.folderId === folder.id && sourceNote.sdId === sd.sdId
                        : false;

                  return (
                    <FormControlLabel
                      key={folder.id}
                      value={`${sd.sdId}:${folder.id}`}
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon fontSize="small" />
                          <Typography>{folderPath}</Typography>
                        </Box>
                      }
                      disabled={isCurrentLocation}
                      sx={{ ml: 2 }}
                    />
                  );
                })}
              </Box>
            ))}
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelMove}>Cancel</Button>
          <Button
            onClick={() => void handleConfirmMove()}
            color="primary"
            autoFocus
            disabled={
              // Disable if no destination selected
              !selectedDestinationSdId ||
              // For multi-select, disable if destination is the same as ALL selected notes' current location
              // For single note, disable if destination matches the note's current location
              (selectedNoteIds.size > 0
                ? Array.from(selectedNoteIds).every((id) => {
                    const note = notes.find((n) => n.id === id);
                    return note
                      ? selectedDestinationFolder === note.folderId &&
                          selectedDestinationSdId === note.sdId
                      : false;
                  })
                : (() => {
                    const sourceNote = notes.find((n) => n.id === noteToMove);
                    return sourceNote
                      ? selectedDestinationFolder === sourceNote.folderId &&
                          selectedDestinationSdId === sourceNote.sdId
                      : false;
                  })())
            }
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
