/**
 * Main App Component
 */

import React, { useEffect, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import './i18n';
import { ThreePanelLayout } from './components/Layout/ThreePanelLayout';
import { FolderPanel } from './components/FolderPanel/FolderPanel';
import { NotesListPanel } from './components/NotesListPanel/NotesListPanel';
import { EditorPanel } from './components/EditorPanel/EditorPanel';
import { SettingsDialog } from './components/Settings/SettingsDialog';
import { AppStateKey } from '@notecove/shared';

const PANEL_SIZES_KEY = AppStateKey.PanelSizes;

function App(): React.ReactElement {
  const [initialPanelSizes, setInitialPanelSizes] = useState<number[] | undefined>(undefined);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSdId, setActiveSdId] = useState<string>('default');

  // Debug: Log when activeSdId changes
  useEffect(() => {
    console.log('[App] activeSdId changed to:', activeSdId);
  }, [activeSdId]);

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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div data-testid="app-root" data-active-sd-id={activeSdId}>
        <ThreePanelLayout
          leftPanel={
            <FolderPanel
              onOpenSettings={() => {
                setSettingsOpen(true);
              }}
              activeSdId={activeSdId}
              onActiveSdChange={setActiveSdId}
            />
          }
          middlePanel={
            <NotesListPanel
              selectedNoteId={selectedNoteId}
              onNoteSelect={setSelectedNoteId}
              activeSdId={activeSdId}
            />
          }
          rightPanel={<EditorPanel selectedNoteId={selectedNoteId} />}
          onLayoutChange={handleLayoutChange}
          initialSizes={initialPanelSizes}
        />
      </div>
      <SettingsDialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
    </ThemeProvider>
  );
}

export default App;
