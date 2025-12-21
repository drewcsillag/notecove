/**
 * Main App Component
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { CssBaseline, ThemeProvider, Box, type PaletteMode } from '@mui/material';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createAppTheme } from './theme';
import './i18n';
import { ThreePanelLayout } from './components/Layout/ThreePanelLayout';
import { LeftSidebar } from './components/LeftSidebar/LeftSidebar';
import { NotesListPanel } from './components/NotesListPanel/NotesListPanel';
import { EditorPanel } from './components/EditorPanel/EditorPanel';
import { SettingsDialog } from './components/Settings/SettingsDialog';
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
import { StaleSyncToast } from './components/StaleSyncToast';
import { SyncStatusPanel } from './components/SyncStatusPanel';
import { ImportDialog } from './components/ImportDialog';
import { AppStateKey } from '@notecove/shared';

const PANEL_SIZES_KEY = AppStateKey.PanelSizes;
const LEFT_SIDEBAR_SIZES_KEY = AppStateKey.LeftSidebarPanelSizes;
const THEME_MODE_KEY = AppStateKey.ThemeMode;

function App(): React.ReactElement {
  const [initialPanelSizes, setInitialPanelSizes] = useState<number[] | undefined>(undefined);
  const [leftSidebarSizes, setLeftSidebarSizes] = useState<number[] | undefined>(undefined);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [activeSdId, setActiveSdId] = useState<string | undefined>(undefined);
  const [themeMode, setThemeMode] = useState<PaletteMode>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);
  // Ref to track if theme change came from broadcast (skip redundant save)
  const themeFromBroadcastRef = useRef(false);
  // Tag filters: tagId -> 'include' | 'exclude' (omitted = neutral/no filter)
  const [tagFilters, setTagFilters] = useState<Record<string, 'include' | 'exclude'>>({});
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

  // Load saved panel sizes on mount
  useEffect(() => {
    const loadPanelSizes = async (): Promise<void> => {
      try {
        const saved = await window.electronAPI.appState.get(PANEL_SIZES_KEY);
        if (saved) {
          const sizes = JSON.parse(saved) as number[];
          setInitialPanelSizes(sizes);
        }
      } catch (error: unknown) {
        console.error(
          'Failed to load panel sizes:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    void loadPanelSizes();
  }, []);

  // Load saved left sidebar panel sizes on mount
  useEffect(() => {
    const loadLeftSidebarSizes = async (): Promise<void> => {
      try {
        const saved = await window.electronAPI.appState.get(LEFT_SIDEBAR_SIZES_KEY);
        if (saved) {
          const sizes = JSON.parse(saved) as number[];
          setLeftSidebarSizes(sizes);
        }
      } catch (error: unknown) {
        console.error(
          'Failed to load left sidebar sizes:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    void loadLeftSidebarSizes();
  }, []);

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
        if (selectedNoteId) {
          setHistoryPanelOpen((prev) => !prev);
        }
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
              setActiveSdId(remainingSds[0].id);
            } else {
              setActiveSdId(undefined);
            }
          } catch (error) {
            console.error('[App] Failed to fetch remaining SDs:', error);
            setActiveSdId(undefined);
          }
        }
      })();
    });

    return cleanup;
  }, [selectedNoteId, activeSdId, minimalMode]);

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

    // Toggle Folder Panel (not implemented - would need panel collapse state)
    const cleanupToggleFolderPanel = window.electronAPI.menu.onToggleFolderPanel(() => {
      console.log('[Menu] Toggle Folder Panel - not yet implemented');
      // TODO: Would need to add collapsible state to ThreePanelLayout
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

    // View History
    const cleanupViewHistory = window.electronAPI.menu.onViewHistory(() => {
      if (selectedNoteId) {
        setHistoryPanelOpen(true);
      } else {
        console.log('[Menu] No note selected for View History');
      }
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

    // Sync Status - open in dedicated window
    const cleanupSyncStatus = window.electronAPI.menu.onSyncStatus(() => {
      void window.electronAPI.sync.openWindow();
    });

    // Storage Inspector - now handled directly by main process (no renderer callback needed)

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
      cleanupSyncStatus();
    };
  }, [selectedNoteId]);

  const handleLayoutChange = (sizes: number[]): void => {
    // Persist panel sizes to app state
    const savePanelSizes = async (): Promise<void> => {
      try {
        await window.electronAPI.appState.set(PANEL_SIZES_KEY, JSON.stringify(sizes));
      } catch (error: unknown) {
        console.error(
          'Failed to save panel sizes:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    void savePanelSizes();
  };

  const handleLeftSidebarLayoutChange = (sizes: number[]): void => {
    // Persist left sidebar panel sizes to app state
    const saveLeftSidebarSizes = async (): Promise<void> => {
      try {
        await window.electronAPI.appState.set(LEFT_SIDEBAR_SIZES_KEY, JSON.stringify(sizes));
      } catch (error: unknown) {
        console.error(
          'Failed to save left sidebar sizes:',
          error instanceof Error ? error.message : String(error)
        );
      }
    };

    void saveLeftSidebarSizes();
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
              onNoteLoaded={() => {
                // No-op in minimal mode
              }}
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

  // Render full layout (with sidebars)
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DndProvider backend={HTML5Backend}>
        <div data-testid="app-root" data-active-sd-id={activeSdId}>
          <ThreePanelLayout
            leftPanel={
              <LeftSidebar
                onOpenSettings={() => {
                  setSettingsOpen(true);
                }}
                activeSdId={activeSdId}
                onActiveSdChange={setActiveSdId}
                tagFilters={tagFilters}
                onTagSelect={handleTagSelect}
                onClearTagFilters={handleClearTagFilters}
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
                onNoteLoaded={() => {
                  // Clear the newly created flag once the note has been loaded
                  if (newlyCreatedNoteId === selectedNoteId) {
                    setNewlyCreatedNoteId(null);
                  }
                }}
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
        <StaleSyncToast />
      </DndProvider>
    </ThemeProvider>
  );
}

export default App;
