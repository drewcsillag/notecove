/**
 * Main App Component
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { CssBaseline, ThemeProvider, Box, type PaletteMode } from '@mui/material';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createAppTheme } from './theme';
import './i18n';
import { ThreePanelLayout } from './components/Layout/ThreePanelLayout';
import { LeftSidebar } from './components/LeftSidebar/LeftSidebar';
import { NotesListPanel } from './components/NotesListPanel/NotesListPanel';
import { NoteDragLayer } from './components/NotesListPanel/NoteDragLayer';
import { EditorPanel } from './components/EditorPanel/EditorPanel';
import { SettingsDialog } from './components/Settings/SettingsDialog';
import { FeatureFlagsDialog } from './components/FeatureFlagsDialog';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { SDInitProgressDialog } from './components/SDInitProgress/SDInitProgressDialog';
import { ShutdownProgressDialog } from './components/ShutdownProgress/ShutdownProgressDialog';
import { ReindexProgressDialog } from './components/ReindexProgress/ReindexProgressDialog';
import { NoteInfoWindow } from './components/NoteInfoWindow';
import {
  StorageInspectorWindow,
  SDPickerWindow,
  InspectorErrorBoundary,
} from './components/StorageInspector';
import { AboutWindow } from './components/AboutWindow';
import { SyncStatusPanel } from './components/SyncStatusPanel';
import { ImportDialog } from './components/ImportDialog';
import { AppStateKey } from '@notecove/shared';
import { useWindowState } from './hooks/useWindowState';
import { pickNextNote } from './utils/pickNextNote';

const THEME_MODE_KEY = AppStateKey.ThemeMode as string;

function App(): React.ReactElement {
  // Get windowId for per-window panel state
  const { windowId } = useWindowState();
  const [initialPanelSizes, setInitialPanelSizes] = useState<number[] | undefined>(undefined);
  const [leftSidebarSizes, setLeftSidebarSizes] = useState<number[] | undefined>(undefined);
  const [panelSizesLoaded, setPanelSizesLoaded] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [featureFlagsOpen, setFeatureFlagsOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [activeSdId, setActiveSdId] = useState<string | undefined>(undefined);
  // Selected folder ID - lifted from FolderPanel for window isolation
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderLoaded, setSelectedFolderLoaded] = useState(false);
  const [themeMode, setThemeMode] = useState<PaletteMode>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);
  // Ref to track if theme change came from broadcast (skip redundant save)
  const themeFromBroadcastRef = useRef(false);
  // Tag filters: tagId -> 'include' | 'exclude' (omitted = neutral/no filter)
  const [tagFilters, setTagFilters] = useState<Record<string, 'include' | 'exclude'>>({});
  const [showFolderPanel, setShowFolderPanel] = useState(true);
  const [showTagPanel, setShowTagPanel] = useState(true);
  // Track newly created notes (to apply initial formatting)
  const [newlyCreatedNoteId, setNewlyCreatedNoteId] = useState<string | null>(null);
  // SD initialization progress
  const [sdInitProgress, setSDInitProgress] = useState<{
    open: boolean;
    step: number;
    total: number;
    message: string;
    error?: string;
  }>({ open: false, step: 0, total: 6, message: '' });
  // Shutdown progress (for snapshot saving)
  const [shutdownProgress, setShutdownProgress] = useState<{
    open: boolean;
    current: number;
    total: number;
  }>({ open: false, current: 0, total: 0 });
  // Reindex progress (for rebuilding search index)
  const [reindexProgress, setReindexProgress] = useState<{
    open: boolean;
    current: number;
    total: number;
    error?: string;
  }>({ open: false, current: 0, total: 0 });
  // Minimal mode (for linked note windows)
  const [minimalMode, setMinimalMode] = useState(false);
  // Sync status window mode (dedicated window for sync status panel)
  const [syncStatusMode, setSyncStatusMode] = useState(false);
  // Note Info window mode (dedicated window for note information)
  const [noteInfoMode, setNoteInfoMode] = useState(false);
  const [noteInfoTargetNoteId, setNoteInfoTargetNoteId] = useState<string | null>(null);
  // Storage Inspector window mode (dedicated window for browsing SD contents)
  const [storageInspectorMode, setStorageInspectorMode] = useState(false);
  const [storageInspectorSdId, setStorageInspectorSdId] = useState<string | null>(null);
  const [storageInspectorSdPath, setStorageInspectorSdPath] = useState<string | null>(null);
  const [storageInspectorSdName, setStorageInspectorSdName] = useState<string | null>(null);
  // SD Picker window mode (dedicated window for selecting SD to inspect)
  const [sdPickerMode, setSdPickerMode] = useState(false);
  // About window mode (dedicated window for app information)
  const [aboutMode, setAboutMode] = useState(false);
  // Export trigger from menu (null | 'selected' | 'all')
  const [exportTrigger, setExportTrigger] = useState<'selected' | 'all' | null>(null);
  // Import dialog open state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Create theme based on mode
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  // Memoized callback for when a note finishes loading
  // This prevents TipTapEditor's useEffect from re-running when unrelated state changes
  const handleNoteLoaded = useCallback(() => {
    // Clear the newly created flag once the note has been loaded
    setNewlyCreatedNoteId((currentNewlyCreatedId) => {
      if (currentNewlyCreatedId === selectedNoteId) {
        return null;
      }
      return currentNewlyCreatedId;
    });
  }, [selectedNoteId]);

  // Parse URL parameters on mount (for minimal window mode with specific noteId)
  useEffect(() => {
    try {
      // Try to parse from query string first, then from hash
      const searchParams = new URLSearchParams(window.location.search);
      let noteIdParam = searchParams.get('noteId');
      let minimalParam = searchParams.get('minimal');
      let syncStatusParam = searchParams.get('syncStatus');
      let noteInfoParam = searchParams.get('noteInfo');
      let targetNoteIdParam = searchParams.get('targetNoteId');
      let storageInspectorParam = searchParams.get('storageInspector');
      let sdIdParam = searchParams.get('sdId');
      let sdPathParam = searchParams.get('sdPath');
      let sdNameParam = searchParams.get('sdName');

      let sdPickerParam = searchParams.get('sdPicker');
      let aboutParam = searchParams.get('about');

      // If not in search, try hash (for file:// protocol)
      if (
        !noteIdParam &&
        !minimalParam &&
        !syncStatusParam &&
        !noteInfoParam &&
        !storageInspectorParam &&
        !sdPickerParam &&
        !aboutParam &&
        window.location.hash
      ) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        noteIdParam = hashParams.get('noteId');
        minimalParam = hashParams.get('minimal');
        syncStatusParam = hashParams.get('syncStatus');
        noteInfoParam = hashParams.get('noteInfo');
        targetNoteIdParam = hashParams.get('targetNoteId');
        storageInspectorParam = hashParams.get('storageInspector');
        sdIdParam = hashParams.get('sdId');
        sdPathParam = hashParams.get('sdPath');
        sdNameParam = hashParams.get('sdName');
        sdPickerParam = hashParams.get('sdPicker');
        aboutParam = hashParams.get('about');
      }

      if (noteIdParam) {
        console.log('[App] Opening note from URL parameter:', noteIdParam);
        setSelectedNoteId(noteIdParam);
      }

      if (minimalParam === 'true') {
        console.log('[App] Enabling minimal mode from URL parameter');
        setMinimalMode(true);
      }

      if (syncStatusParam === 'true') {
        console.log('[App] Enabling sync status mode from URL parameter');
        setSyncStatusMode(true);
      }

      if (noteInfoParam === 'true' && targetNoteIdParam) {
        console.log('[App] Enabling note info mode from URL parameter, noteId:', targetNoteIdParam);
        setNoteInfoMode(true);
        setNoteInfoTargetNoteId(targetNoteIdParam);
      }

      if (storageInspectorParam === 'true' && sdIdParam && sdPathParam && sdNameParam) {
        console.log('[App] Enabling storage inspector mode from URL parameter, sdId:', sdIdParam);
        setStorageInspectorMode(true);
        setStorageInspectorSdId(sdIdParam);
        setStorageInspectorSdPath(sdPathParam);
        setStorageInspectorSdName(sdNameParam);
      }

      if (sdPickerParam === 'true') {
        console.log('[App] Enabling SD picker mode from URL parameter');
        setSdPickerMode(true);
      }

      if (aboutParam === 'true') {
        console.log('[App] Enabling about mode from URL parameter');
        setAboutMode(true);
      }
    } catch (error: unknown) {
      console.error(
        '[App] Error parsing URL parameters:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }, []);

  // Set document title based on app info (dev build indicator + profile name)
  useEffect(() => {
    const setWindowTitle = async (): Promise<void> => {
      try {
        const appInfo = await window.electronAPI.app.getInfo();
        const devPrefix = appInfo.isDevBuild ? '[DEV] ' : '';
        const profileSuffix = appInfo.profileName ? ` - ${appInfo.profileName}` : '';
        document.title = `${devPrefix}NoteCove${profileSuffix}`;
      } catch (error: unknown) {
        console.error(
          '[App] Failed to get app info for title:',
          error instanceof Error ? error.message : String(error)
        );
        // Fallback title
        document.title = 'NoteCove';
      }
    };
    void setWindowTitle();
  }, []);

  // Debug: Log when activeSdId changes
  useEffect(() => {
    console.log('[App] activeSdId changed to:', activeSdId);
  }, [activeSdId]);

  // Close search panel when note changes
  useEffect(() => {
    setSearchPanelOpen(false);
  }, [selectedNoteId]);

  // Listen for SD initialization progress
  useEffect(() => {
    const unsubscribeProgress = window.electronAPI.sd.onInitProgress((data) => {
      setSDInitProgress({
        open: true,
        step: data.step,
        total: data.total,
        message: data.message,
      });
    });

    const unsubscribeComplete = window.electronAPI.sd.onInitComplete(() => {
      setSDInitProgress({ open: false, step: 0, total: 6, message: '' });
    });

    const unsubscribeError = window.electronAPI.sd.onInitError((data) => {
      setSDInitProgress((prev) => ({
        ...prev,
        error: data.error,
      }));
      // Auto-close after 3 seconds on error
      setTimeout(() => {
        setSDInitProgress({ open: false, step: 0, total: 6, message: '' });
      }, 3000);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, []);

  // Listen for shutdown progress (when app is closing and saving snapshots)
  useEffect(() => {
    const unsubscribeProgress = window.electronAPI.shutdown.onProgress((data) => {
      setShutdownProgress({
        open: true,
        current: data.current,
        total: data.total,
      });
    });

    const unsubscribeComplete = window.electronAPI.shutdown.onComplete(() => {
      setShutdownProgress({ open: false, current: 0, total: 0 });
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, []);

  // Listen for reindex progress (when rebuilding search index)
  useEffect(() => {
    const unsubscribeProgress = window.electronAPI.tools.onReindexProgress((data) => {
      setReindexProgress({
        open: true,
        current: data.current,
        total: data.total,
      });
    });

    const unsubscribeComplete = window.electronAPI.tools.onReindexComplete(() => {
      setReindexProgress({ open: false, current: 0, total: 0 });
    });

    const unsubscribeError = window.electronAPI.tools.onReindexError((data) => {
      setReindexProgress((prev) => ({
        ...prev,
        error: data.error,
      }));
      // Auto-close after 3 seconds on error
      setTimeout(() => {
        setReindexProgress({ open: false, current: 0, total: 0 });
      }, 3000);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, []);

  // Load saved panel layout - per-window state if windowId available, otherwise global appState
  useEffect(() => {
    const loadPanelLayout = async (): Promise<void> => {
      try {
        // Try per-window state first if we have a windowId (restored window)
        if (windowId) {
          const savedState = await window.electronAPI.windowState.getSavedState(windowId);
          if (savedState?.panelLayout) {
            const {
              panelSizes,
              leftSidebarSizes: sidebarSizes,
              showFolderPanel: folder,
              showTagPanel: tag,
            } = savedState.panelLayout;
            if (panelSizes) {
              setInitialPanelSizes(panelSizes);
            }
            if (sidebarSizes) {
              setLeftSidebarSizes(sidebarSizes);
            }
            if (folder !== undefined) {
              setShowFolderPanel(folder);
            }
            if (tag !== undefined) {
              setShowTagPanel(tag);
            }
            return; // Loaded from per-window state, done
          }
        }

        // Fall back to global appState for windows without windowId or no per-window state
        const [panelSizesResult, leftSidebarResult, showFolderResult, showTagResult] =
          await Promise.all([
            window.electronAPI.appState.get(AppStateKey.PanelSizes),
            window.electronAPI.appState.get(AppStateKey.LeftSidebarPanelSizes),
            window.electronAPI.appState.get(AppStateKey.ShowFolderPanel),
            window.electronAPI.appState.get(AppStateKey.ShowTagPanel),
          ]);

        if (panelSizesResult) {
          const sizes = JSON.parse(panelSizesResult) as number[];
          setInitialPanelSizes(sizes);
        }
        if (leftSidebarResult) {
          const sizes = JSON.parse(leftSidebarResult) as number[];
          setLeftSidebarSizes(sizes);
        }
        if (showFolderResult !== null) {
          setShowFolderPanel(showFolderResult === 'true');
        }
        if (showTagResult !== null) {
          setShowTagPanel(showTagResult === 'true');
        }
      } catch (error: unknown) {
        console.error(
          'Failed to load panel layout:',
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        // Always mark as loaded so UI can render (with defaults if load failed)
        setPanelSizesLoaded(true);
      }
    };

    void loadPanelLayout();
  }, [windowId]);

  // Load selected folder from appState on mount (for window isolation)
  useEffect(() => {
    const loadSelectedFolder = async (): Promise<void> => {
      try {
        const saved = await window.electronAPI.appState.get(AppStateKey.SelectedFolderId);
        if (saved) {
          setSelectedFolderId(saved);
        } else {
          // Default to "all-notes" if no saved selection
          setSelectedFolderId('all-notes');
        }
      } catch (error: unknown) {
        console.error(
          'Failed to load selected folder:',
          error instanceof Error ? error.message : String(error)
        );
        setSelectedFolderId('all-notes');
      } finally {
        setSelectedFolderLoaded(true);
      }
    };

    void loadSelectedFolder();
  }, []);

  // Save selected folder to appState when it changes (after initial load)
  useEffect(() => {
    if (!selectedFolderLoaded || selectedFolderId === null) return;

    const saveSelectedFolder = async (): Promise<void> => {
      try {
        await window.electronAPI.appState.set(AppStateKey.SelectedFolderId, selectedFolderId);
      } catch (error: unknown) {
        console.error(
          'Failed to save selected folder:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    void saveSelectedFolder();
  }, [selectedFolderId, selectedFolderLoaded]);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
      try {
        const saved = await window.electronAPI.appState.get(THEME_MODE_KEY);
        if (saved === 'dark' || saved === 'light') {
          setThemeMode(saved as PaletteMode);
        }
      } catch (error: unknown) {
        console.error(
          'Failed to load theme:',
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        setThemeLoaded(true);
      }
    };

    void loadTheme();
  }, []);

  // Listen for theme change broadcasts from main process
  useEffect(() => {
    const cleanup = window.electronAPI.theme.onChanged((newTheme) => {
      // Mark that this change came from broadcast (skip redundant save)
      themeFromBroadcastRef.current = true;
      setThemeMode(newTheme);
    });

    return cleanup;
  }, []);

  // Save theme preference when it changes (only after initial load)
  // Skip if the change came from a broadcast (already saved by main process)
  useEffect(() => {
    if (!themeLoaded) return;

    // If theme change came from broadcast, skip save (already saved by main process)
    if (themeFromBroadcastRef.current) {
      themeFromBroadcastRef.current = false;
      return;
    }

    const saveTheme = async (): Promise<void> => {
      try {
        await window.electronAPI.appState.set(THEME_MODE_KEY, themeMode);
      } catch (error: unknown) {
        console.error(
          'Failed to save theme:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    void saveTheme();
  }, [themeMode, themeLoaded]);

  // Save panel visibility changes - per-window if windowId available, otherwise global appState
  useEffect(() => {
    if (!panelSizesLoaded) return;

    if (windowId) {
      void window.electronAPI.windowState.reportPanelLayout(windowId, { showFolderPanel });
    } else {
      void window.electronAPI.appState.set(AppStateKey.ShowFolderPanel, String(showFolderPanel));
    }
  }, [showFolderPanel, panelSizesLoaded, windowId]);

  useEffect(() => {
    if (!panelSizesLoaded) return;

    if (windowId) {
      void window.electronAPI.windowState.reportPanelLayout(windowId, { showTagPanel });
    } else {
      void window.electronAPI.appState.set(AppStateKey.ShowTagPanel, String(showTagPanel));
    }
  }, [showTagPanel, panelSizesLoaded, windowId]);

  // Auto-select default note on first load
  useEffect(() => {
    const loadDefaultNote = async (): Promise<void> => {
      try {
        // Check if default note exists
        const notes = await window.electronAPI.note.list('default');
        const defaultNote = notes.find((note) => note.id === 'default-note');
        if (defaultNote) {
          setSelectedNoteId('default-note');
        }
      } catch (error: unknown) {
        console.error(
          'Failed to load default note:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    void loadDefaultNote();
  }, []);

  // Keyboard shortcuts:
  // - Cmd+, or Ctrl+, to open Settings
  // - Cmd+Y or Ctrl+Y to toggle History
  // - Shift+Cmd+F or Shift+Ctrl+F to toggle Search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Check for Cmd+, (macOS) or Ctrl+, (Windows/Linux)
      if (event.key === ',' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSettingsOpen(true);
      }
      // Check for Cmd+Option+H (macOS) or Ctrl+Alt+H (Windows/Linux) to toggle History
      // Note: Cmd+Y is reserved for redo in the editor
      if (event.key === 'h' && event.altKey && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        // Check feature flag before toggling
        void (async () => {
          const enabled = await window.electronAPI.featureFlags.get('viewHistory');
          if (!enabled) {
            console.log('[Keyboard] View History feature is disabled');
            return;
          }
          if (selectedNoteId) {
            setHistoryPanelOpen((prev) => !prev);
          }
        })();
      }
      // Check for Shift+Cmd+F (macOS) or Shift+Ctrl+F (Windows/Linux) to toggle Search
      // Note: When Shift is pressed, event.key is uppercase 'F', not lowercase 'f'
      if (event.key.toLowerCase() === 'f' && event.shiftKey && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (selectedNoteId) {
          setSearchPanelOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNoteId]);

  // Listen for menu command to open Settings
  useEffect(() => {
    const cleanup = window.electronAPI.sd.onOpenSettings(() => {
      setSettingsOpen(true);
    });

    return cleanup;
  }, []);

  // Handle SD deletion - clear selected note if it belongs to deleted SD, switch active SD
  useEffect(() => {
    const cleanup = window.electronAPI.sd.onUpdated((data) => {
      void (async () => {
        if (data.operation !== 'delete') {
          return;
        }

        const deletedSdId = data.sdId;
        console.log('[App] SD deleted:', deletedSdId);

        // Check if currently selected note belongs to deleted SD
        if (selectedNoteId) {
          try {
            const metadata = await window.electronAPI.note.getMetadata(selectedNoteId);
            if (metadata.sdId === deletedSdId) {
              // In minimal mode, close the window since the note no longer exists
              if (minimalMode) {
                console.log('[App] Closing minimal window - note belongs to deleted SD');
                window.close();
                return;
              }
              console.log('[App] Clearing selectedNoteId - note belongs to deleted SD');
              setSelectedNoteId(null);
            }
          } catch {
            // Note not found (already deleted from DB)
            if (minimalMode) {
              console.log('[App] Closing minimal window - note no longer exists');
              window.close();
              return;
            }
            console.log('[App] Clearing selectedNoteId - note no longer exists');
            setSelectedNoteId(null);
          }
        }

        // Check if active SD was deleted - switch to another SD (not applicable in minimal mode)
        if (!minimalMode && activeSdId === deletedSdId) {
          console.log('[App] Active SD was deleted, switching to another SD');
          try {
            const remainingSds = await window.electronAPI.sd.list();
            if (remainingSds.length > 0 && remainingSds[0]) {
              const newSdId = remainingSds[0].id;
              setActiveSdId(newSdId);

              // Auto-select a note from the new SD
              const notesInNewSd = await window.electronAPI.note.list('all-notes');
              const nextNoteId = pickNextNote(notesInNewSd);
              if (nextNoteId) {
                console.log('[App] Auto-selected note from new SD:', nextNoteId);
                setSelectedNoteId(nextNoteId);
              } else {
                console.log('[App] No notes in new SD, clearing selection');
                setSelectedNoteId(null);
              }
            } else {
              setActiveSdId(undefined);
              setSelectedNoteId(null);
            }
          } catch (error) {
            console.error('[App] Failed to fetch remaining SDs:', error);
            setActiveSdId(undefined);
            setSelectedNoteId(null);
          }
        }
      })();
    });

    return cleanup;
  }, [selectedNoteId, activeSdId, minimalMode]);

  // Use refs to track current values for deletion handler (avoids closure issues)
  const selectedNoteIdRef = useRef(selectedNoteId);
  const selectedFolderIdRef = useRef(selectedFolderId);
  const activeSdIdRef = useRef(activeSdId);
  const minimalModeRef = useRef(minimalMode);

  // Keep refs in sync with state
  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  useEffect(() => {
    selectedFolderIdRef.current = selectedFolderId;
  }, [selectedFolderId]);

  useEffect(() => {
    activeSdIdRef.current = activeSdId;
  }, [activeSdId]);

  useEffect(() => {
    minimalModeRef.current = minimalMode;
  }, [minimalMode]);

  // Handle note deletion - auto-select next note when selected note is deleted
  useEffect(() => {
    const selectNextNote = async (deletedNoteId: string): Promise<void> => {
      // If we have a different note selected (not empty, not the deleted one), no action needed
      // This handles the case where NotesListPanel already cleared selection before the event fires
      const currentSelection = selectedNoteIdRef.current;
      if (currentSelection && currentSelection !== deletedNoteId) {
        return;
      }

      // In minimal mode, close the window since the note no longer exists
      if (minimalModeRef.current) {
        window.close();
        return;
      }

      try {
        const sdId = activeSdIdRef.current;
        if (!sdId) {
          setSelectedNoteId(null);
          return;
        }

        // First try to find a note in the current folder
        const folderId = selectedFolderIdRef.current;
        // note.list(sdId, folderId?) - pass undefined to get all notes in SD
        const notesInFolder = await window.electronAPI.note.list(sdId, folderId);
        const nextNoteId = pickNextNote(notesInFolder, [deletedNoteId]);

        if (nextNoteId) {
          setSelectedNoteId(nextNoteId);
          return;
        }

        // Fall back to any note in the active SD (pass undefined to get all notes)
        const allNotes = await window.electronAPI.note.list(sdId, undefined);
        const fallbackNoteId = pickNextNote(allNotes, [deletedNoteId]);

        if (fallbackNoteId) {
          setSelectedNoteId(fallbackNoteId);
          return;
        }

        // No notes available - clear selection (empty state will show)
        setSelectedNoteId(null);
      } catch (error) {
        console.error('[App] Error auto-selecting next note:', error);
        setSelectedNoteId(null);
      }
    };

    // Listen for soft delete (move to trash)
    const cleanupDeleted = window.electronAPI.note.onDeleted((noteId) => {
      void selectNextNote(noteId);
    });

    // Listen for permanent delete
    const cleanupPermanentDeleted = window.electronAPI.note.onPermanentDeleted((noteId) => {
      void selectNextNote(noteId);
    });

    return () => {
      cleanupDeleted();
      cleanupPermanentDeleted();
    };
  }, []); // Empty deps - the handler uses refs for current values

  // Listen for menu commands
  useEffect(() => {
    // New Note
    const cleanupNewNote = window.electronAPI.menu.onNewNote(() => {
      // Trigger create note button click in NotesListPanel
      const createButton = document.querySelector<HTMLButtonElement>('button[title="Create note"]');
      createButton?.click();
    });

    // New Folder
    const cleanupNewFolder = window.electronAPI.menu.onNewFolder(() => {
      // Trigger create folder button click in FolderPanel
      const createButton = document.querySelector<HTMLButtonElement>(
        'button[title="Create folder"]'
      );
      createButton?.click();
    });

    // Find (focus search box)
    const cleanupFind = window.electronAPI.menu.onFind(() => {
      // Focus search input in NotesListPanel
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
      searchInput?.focus();
    });

    // Find in Note
    const cleanupFindInNote = window.electronAPI.menu.onFindInNote(() => {
      if (selectedNoteId) {
        setSearchPanelOpen(true);
      } else {
        console.log('[Menu] No note selected for Find in Note');
      }
    });

    // Toggle Dark Mode
    const cleanupToggleDarkMode = window.electronAPI.menu.onToggleDarkMode(() => {
      setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
    });

    // Toggle Folder Panel
    const cleanupToggleFolderPanel = window.electronAPI.menu.onToggleFolderPanel(() => {
      setShowFolderPanel((prev) => !prev);
    });

    // Toggle Tags Panel
    const cleanupToggleTagsPanel = window.electronAPI.menu.onToggleTagsPanel(() => {
      setShowTagPanel((prev) => !prev);
    });

    // Create Snapshot
    const cleanupCreateSnapshot = window.electronAPI.menu.onCreateSnapshot(() => {
      if (selectedNoteId) {
        window.electronAPI.note
          .createSnapshot(selectedNoteId)
          .then((result) => {
            if (result.success) {
              console.log(`[Menu] Snapshot created: ${result.filename}`);
              // TODO: Show success notification to user
            } else {
              console.error(`[Menu] Failed to create snapshot: ${result.error}`);
              // TODO: Show error notification to user
            }
          })
          .catch((error: unknown) => {
            console.error(
              '[Menu] Error creating snapshot:',
              error instanceof Error ? error.message : String(error)
            );
          });
      } else {
        console.log('[Menu] No note selected for snapshot creation');
      }
    });

    // Note Info - opens a new window instead of a dialog
    const cleanupNoteInfo = window.electronAPI.menu.onNoteInfo(() => {
      if (selectedNoteId) {
        void window.electronAPI.window.openNoteInfo(selectedNoteId).then((result) => {
          if (!result.success) {
            console.error('[Menu] Failed to open Note Info window:', result.error);
          }
        });
      } else {
        console.log('[Menu] No note selected for Note Info');
      }
    });

    // View History (respects feature flag)
    const cleanupViewHistory = window.electronAPI.menu.onViewHistory(() => {
      void (async () => {
        // Check if viewHistory feature flag is enabled
        const enabled = await window.electronAPI.featureFlags.get('viewHistory');
        if (!enabled) {
          console.log('[Menu] View History feature is disabled');
          return;
        }
        if (selectedNoteId) {
          setHistoryPanelOpen(true);
        } else {
          console.log('[Menu] No note selected for View History');
        }
      })();
    });

    // Export Selected Notes
    const cleanupExportSelected = window.electronAPI.menu.onExportSelectedNotes(() => {
      setExportTrigger('selected');
    });

    // Export All Notes
    const cleanupExportAll = window.electronAPI.menu.onExportAllNotes(() => {
      setExportTrigger('all');
    });

    // Import Markdown
    const cleanupImportMarkdown = window.electronAPI.menu.onImportMarkdown(() => {
      setImportDialogOpen(true);
    });

    // Reload from CRDT Logs (Advanced)
    const cleanupReloadFromCRDTLogs = window.electronAPI.menu.onReloadFromCRDTLogs(() => {
      if (selectedNoteId) {
        console.log('[Menu] Reloading note from CRDT logs:', selectedNoteId);
        void (async () => {
          try {
            const result = await window.electronAPI.note.reloadFromCRDTLogs(selectedNoteId);
            if (result.success) {
              console.log('[Menu] Successfully reloaded note from CRDT logs');
              // Trigger a refresh of the editor by reselecting the note
              setSelectedNoteId(null);
              setTimeout(() => {
                setSelectedNoteId(selectedNoteId);
              }, 100);
            } else {
              console.error('[Menu] Failed to reload from CRDT logs:', result.error);
            }
          } catch (error: unknown) {
            console.error(
              '[Menu] Error reloading from CRDT logs:',
              error instanceof Error ? error.message : String(error)
            );
          }
        })();
      } else {
        console.log('[Menu] No note selected for Reload from CRDT Logs');
      }
    });

    // Reindex Notes
    const cleanupReindexNotes = window.electronAPI.menu.onReindexNotes(() => {
      console.log('[Menu] Reindexing notes');
      void window.electronAPI.tools.reindexNotes();
    });

    // Feature Flags
    const cleanupFeatureFlags = window.electronAPI.menu.onFeatureFlags(() => {
      setFeatureFlagsOpen(true);
    });

    // Subscribe to feature flag changes - close history panel if viewHistory is disabled
    const cleanupFlagChanges = window.electronAPI.featureFlags.onChange(({ flag, enabled }) => {
      if (flag === 'viewHistory' && !enabled) {
        console.log('[FeatureFlags] viewHistory disabled, closing history panel');
        setHistoryPanelOpen(false);
      }
    });

    // Storage Inspector and Sync Status - now handled directly by main process (no renderer callback needed)

    return () => {
      cleanupNewNote();
      cleanupNewFolder();
      cleanupFind();
      cleanupFindInNote();
      cleanupToggleDarkMode();
      cleanupToggleFolderPanel();
      cleanupToggleTagsPanel();
      cleanupCreateSnapshot();
      cleanupNoteInfo();
      cleanupViewHistory();
      cleanupExportSelected();
      cleanupExportAll();
      cleanupImportMarkdown();
      cleanupReloadFromCRDTLogs();
      cleanupReindexNotes();
      cleanupFeatureFlags();
      cleanupFlagChanges();
    };
  }, [selectedNoteId]);

  const handleLayoutChange = (sizes: number[]): void => {
    // Save panel sizes - per-window if windowId available, otherwise global appState
    if (windowId) {
      void window.electronAPI.windowState.reportPanelLayout(windowId, { panelSizes: sizes });
    } else {
      void window.electronAPI.appState.set(AppStateKey.PanelSizes, JSON.stringify(sizes));
    }
  };

  const handleLeftSidebarLayoutChange = (sizes: number[]): void => {
    // Save left sidebar sizes - per-window if windowId available, otherwise global appState
    if (windowId) {
      void window.electronAPI.windowState.reportPanelLayout(windowId, { leftSidebarSizes: sizes });
    } else {
      void window.electronAPI.appState.set(
        AppStateKey.LeftSidebarPanelSizes,
        JSON.stringify(sizes)
      );
    }
  };

  // Tag filter handlers - cycle through: neutral -> include -> exclude -> neutral
  const handleTagSelect = (tagId: string): void => {
    setTagFilters((prev) => {
      const current = prev[tagId];
      const newFilters = { ...prev };

      if (!current) {
        // neutral -> include
        newFilters[tagId] = 'include';
      } else if (current === 'include') {
        // include -> exclude
        newFilters[tagId] = 'exclude';
      } else {
        // exclude -> neutral (remove from filters)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [tagId]: _, ...rest } = newFilters;
        return rest;
      }

      return newFilters;
    });
  };

  const handleClearTagFilters = (): void => {
    setTagFilters({});
  };

  // Render sync status window (standalone window for sync status panel)
  if (syncStatusMode) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <SyncStatusPanel
            open={true}
            onClose={() => {
              // Close the window
              window.close();
            }}
          />
        </Box>
      </ThemeProvider>
    );
  }

  // Render note info window (standalone window for note information)
  if (noteInfoMode && noteInfoTargetNoteId) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <NoteInfoWindow noteId={noteInfoTargetNoteId} />
        </Box>
      </ThemeProvider>
    );
  }

  // Render storage inspector window (standalone window for SD inspection)
  if (
    storageInspectorMode &&
    storageInspectorSdId &&
    storageInspectorSdPath &&
    storageInspectorSdName
  ) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <InspectorErrorBoundary>
            <StorageInspectorWindow
              sdId={storageInspectorSdId}
              sdPath={storageInspectorSdPath}
              sdName={storageInspectorSdName}
            />
          </InspectorErrorBoundary>
        </Box>
      </ThemeProvider>
    );
  }

  // Render SD picker window (standalone window for selecting SD to inspect)
  if (sdPickerMode) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <SDPickerWindow />
        </Box>
      </ThemeProvider>
    );
  }

  // Render about window (standalone window for app information)
  if (aboutMode) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <AboutWindow />
        </Box>
      </ThemeProvider>
    );
  }

  // Render minimal layout (just editor, no sidebars)
  if (minimalMode) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <DndProvider backend={HTML5Backend}>
          <NoteDragLayer />
          <Box
            sx={{
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <EditorPanel
              selectedNoteId={selectedNoteId}
              isNewlyCreated={false}
              onNoteLoaded={handleNoteLoaded}
              showHistoryPanel={historyPanelOpen}
              onHistoryPanelClose={() => {
                setHistoryPanelOpen(false);
              }}
              showSearchPanel={searchPanelOpen}
              onSearchPanelClose={() => {
                setSearchPanelOpen(false);
              }}
              showCommentPanel={commentPanelOpen}
              onCommentPanelClose={() => {
                setCommentPanelOpen(false);
              }}
              onCommentAdded={() => {
                setCommentPanelOpen(true);
              }}
              onNavigateToNote={setSelectedNoteId}
            />
          </Box>
        </DndProvider>
      </ThemeProvider>
    );
  }

  // Wait for panel sizes to load before rendering layout
  // This ensures defaultSize is set correctly on first mount
  if (!panelSizesLoaded) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Brief loading state while panel sizes load from database */}
        </Box>
      </ThemeProvider>
    );
  }

  // Render full layout (with sidebars)
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <FeatureFlagsProvider>
        <DndProvider backend={HTML5Backend}>
          <NoteDragLayer />
          <div data-testid="app-root" data-active-sd-id={activeSdId}>
            <ThreePanelLayout
              leftPanel={
                <LeftSidebar
                  onOpenSettings={() => {
                    setSettingsOpen(true);
                  }}
                  activeSdId={activeSdId}
                  onActiveSdChange={setActiveSdId}
                  selectedFolderId={selectedFolderId}
                  onFolderSelect={setSelectedFolderId}
                  tagFilters={tagFilters}
                  onTagSelect={handleTagSelect}
                  onClearTagFilters={handleClearTagFilters}
                  showFolderPanel={showFolderPanel}
                  showTagPanel={showTagPanel}
                  {...(leftSidebarSizes ? { initialSizes: leftSidebarSizes } : {})}
                  onLayoutChange={handleLeftSidebarLayoutChange}
                />
              }
              middlePanel={
                <NotesListPanel
                  selectedNoteId={selectedNoteId}
                  onNoteSelect={setSelectedNoteId}
                  onNoteCreated={setNewlyCreatedNoteId}
                  activeSdId={activeSdId}
                  selectedFolderId={selectedFolderId}
                  tagFilters={tagFilters}
                  exportTrigger={exportTrigger}
                  onExportComplete={() => {
                    setExportTrigger(null);
                  }}
                />
              }
              rightPanel={
                <EditorPanel
                  selectedNoteId={selectedNoteId}
                  isNewlyCreated={selectedNoteId === newlyCreatedNoteId}
                  onNoteLoaded={handleNoteLoaded}
                  showHistoryPanel={historyPanelOpen}
                  onHistoryPanelClose={() => {
                    setHistoryPanelOpen(false);
                  }}
                  showSearchPanel={searchPanelOpen}
                  onSearchPanelClose={() => {
                    setSearchPanelOpen(false);
                  }}
                  showCommentPanel={commentPanelOpen}
                  onCommentPanelClose={() => {
                    setCommentPanelOpen(false);
                  }}
                  onCommentAdded={() => {
                    setCommentPanelOpen(true);
                  }}
                  onNavigateToNote={setSelectedNoteId}
                />
              }
              onLayoutChange={handleLayoutChange}
              initialSizes={initialPanelSizes}
            />
          </div>
          {settingsOpen && (
            <SettingsDialog
              open={settingsOpen}
              onClose={() => {
                setSettingsOpen(false);
              }}
              themeMode={themeMode}
              onThemeChange={setThemeMode}
            />
          )}
          {featureFlagsOpen && (
            <FeatureFlagsDialog
              open={featureFlagsOpen}
              onClose={() => {
                setFeatureFlagsOpen(false);
              }}
            />
          )}
          <ImportDialog
            open={importDialogOpen}
            onClose={() => {
              setImportDialogOpen(false);
            }}
            onImportComplete={(result) => {
              console.log('[App] Import complete:', result);
              // Navigate to the imported content
              if (result.folderIds.length > 0) {
                // Navigate to the first created folder (usually the container)
                const folderId = result.folderIds[0];
                if (folderId) {
                  void window.electronAPI.appState.set('selectedFolderId', folderId);
                }
              }
              if (result.noteIds.length > 0) {
                // Select the first imported note
                const noteId = result.noteIds[0];
                if (noteId) {
                  setSelectedNoteId(noteId);
                }
              }
            }}
          />
          <SDInitProgressDialog
            open={sdInitProgress.open}
            step={sdInitProgress.step}
            total={sdInitProgress.total}
            message={sdInitProgress.message}
            {...(sdInitProgress.error ? { error: sdInitProgress.error } : {})}
          />
          <ShutdownProgressDialog
            open={shutdownProgress.open}
            current={shutdownProgress.current}
            total={shutdownProgress.total}
          />
          <ReindexProgressDialog
            open={reindexProgress.open}
            current={reindexProgress.current}
            total={reindexProgress.total}
            {...(reindexProgress.error ? { error: reindexProgress.error } : {})}
          />
        </DndProvider>
      </FeatureFlagsProvider>
    </ThemeProvider>
  );
}

export default App;
