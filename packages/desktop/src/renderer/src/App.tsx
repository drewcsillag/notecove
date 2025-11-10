/**
 * Main App Component
 */

import React, { useEffect, useState, useMemo } from 'react';
import { CssBaseline, ThemeProvider, type PaletteMode } from '@mui/material';
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
import { AppStateKey } from '@notecove/shared';

const PANEL_SIZES_KEY = AppStateKey.PanelSizes;
const THEME_MODE_KEY = AppStateKey.ThemeMode;

function App(): React.ReactElement {
  const [initialPanelSizes, setInitialPanelSizes] = useState<number[] | undefined>(undefined);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSdId, setActiveSdId] = useState<string>('default');
  const [themeMode, setThemeMode] = useState<PaletteMode>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);
  // Tag filters: tagId -> 'include' | 'exclude' (omitted = neutral/no filter)
  const [tagFilters, setTagFilters] = useState<Record<string, 'include' | 'exclude'>>({});
  const [showTagPanel, setShowTagPanel] = useState(true);
  // SD initialization progress
  const [sdInitProgress, setSDInitProgress] = useState<{
    open: boolean;
    step: number;
    total: number;
    message: string;
    error?: string;
  }>({ open: false, step: 0, total: 6, message: '' });

  // Create theme based on mode
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  // Debug: Log when activeSdId changes
  useEffect(() => {
    console.log('[App] activeSdId changed to:', activeSdId);
  }, [activeSdId]);

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

  // Load saved panel sizes on mount
  useEffect(() => {
    const loadPanelSizes = async (): Promise<void> => {
      try {
        const saved = await window.electronAPI.appState.get(PANEL_SIZES_KEY);
        if (saved) {
          const sizes = JSON.parse(saved) as number[];
          setInitialPanelSizes(sizes);
        }
      } catch (error) {
        console.error('Failed to load panel sizes:', error);
      }
    };

    void loadPanelSizes();
  }, []);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
      try {
        const saved = await window.electronAPI.appState.get(THEME_MODE_KEY);
        if (saved === 'dark' || saved === 'light') {
          setThemeMode(saved as PaletteMode);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      } finally {
        setThemeLoaded(true);
      }
    };

    void loadTheme();
  }, []);

  // Save theme preference when it changes (only after initial load)
  useEffect(() => {
    if (!themeLoaded) return;

    const saveTheme = async (): Promise<void> => {
      try {
        await window.electronAPI.appState.set(THEME_MODE_KEY, themeMode);
      } catch (error) {
        console.error('Failed to save theme:', error);
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
      } catch (error) {
        console.error('Failed to load default note:', error);
      }
    };

    void loadDefaultNote();
  }, []);

  // Keyboard shortcut: Cmd+, or Ctrl+, to open Settings
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Check for Cmd+, (macOS) or Ctrl+, (Windows/Linux)
      if (event.key === ',' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Listen for menu command to open Settings
  useEffect(() => {
    const cleanup = window.electronAPI.sd.onOpenSettings(() => {
      setSettingsOpen(true);
    });

    return cleanup;
  }, []);

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

    // Find in Note (not implemented yet - TipTap doesn't have search built in)
    const cleanupFindInNote = window.electronAPI.menu.onFindInNote(() => {
      console.log('[Menu] Find in Note - not yet implemented');
      // TODO: Implement in-editor search when TipTap search extension is added
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

    // About dialog (not implemented yet)
    const cleanupAbout = window.electronAPI.menu.onAbout(() => {
      console.log('[Menu] About NoteCove - not yet implemented');
      // TODO: Create About dialog with version info, license, etc.
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
          .catch((error) => {
            console.error('[Menu] Error creating snapshot:', error);
          });
      } else {
        console.log('[Menu] No note selected for snapshot creation');
      }
    });

    return () => {
      cleanupNewNote();
      cleanupNewFolder();
      cleanupFind();
      cleanupFindInNote();
      cleanupToggleDarkMode();
      cleanupToggleFolderPanel();
      cleanupToggleTagsPanel();
      cleanupAbout();
      cleanupCreateSnapshot();
    };
  }, [selectedNoteId]);

  const handleLayoutChange = (sizes: number[]): void => {
    // Persist panel sizes to app state
    const savePanelSizes = async (): Promise<void> => {
      try {
        await window.electronAPI.appState.set(PANEL_SIZES_KEY, JSON.stringify(sizes));
      } catch (error) {
        console.error('Failed to save panel sizes:', error);
      }
    };

    void savePanelSizes();
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
              />
            }
            middlePanel={
              <NotesListPanel
                selectedNoteId={selectedNoteId}
                onNoteSelect={setSelectedNoteId}
                activeSdId={activeSdId}
                tagFilters={tagFilters}
              />
            }
            rightPanel={<EditorPanel selectedNoteId={selectedNoteId} />}
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
        <SDInitProgressDialog
          open={sdInitProgress.open}
          step={sdInitProgress.step}
          total={sdInitProgress.total}
          message={sdInitProgress.message}
          error={sdInitProgress.error}
        />
      </DndProvider>
    </ThemeProvider>
  );
}

export default App;
