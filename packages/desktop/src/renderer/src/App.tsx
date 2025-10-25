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
import { AppStateKey } from '@notecove/shared';

const PANEL_SIZES_KEY = AppStateKey.PanelSizes;

function App(): React.ReactElement {
  const [initialPanelSizes, setInitialPanelSizes] = useState<number[] | undefined>(undefined);

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
      <ThreePanelLayout
        leftPanel={<FolderPanel />}
        middlePanel={<NotesListPanel />}
        rightPanel={<EditorPanel />}
        onLayoutChange={handleLayoutChange}
        initialSizes={initialPanelSizes}
      />
    </ThemeProvider>
  );
}

export default App;
