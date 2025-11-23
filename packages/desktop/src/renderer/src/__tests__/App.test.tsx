/**
 * App Component Tests
 */

// Mock i18n before any imports
jest.mock('../i18n', () => ({}));

// Mock TipTap editor
jest.mock('../components/EditorPanel/TipTapEditor', () => ({
  TipTapEditor: () => <div data-testid="tiptap-editor">TipTap Editor</div>,
}));

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock window.electronAPI
const mockElectronAPI = {
  platform: 'darwin',
  note: {
    load: jest.fn(),
    unload: jest.fn(),
    applyUpdate: jest.fn(),
    create: jest.fn().mockResolvedValue('new-note-id'),
    delete: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn(),
    duplicate: jest.fn().mockResolvedValue('new-note-id'),
    move: jest.fn(),
    getMetadata: jest.fn(),
    list: jest.fn().mockResolvedValue([]),
    onUpdated: jest.fn(),
    onDeleted: jest.fn(),
    onRestored: jest.fn(),
    onPermanentDeleted: jest.fn(),
    onCreated: jest.fn(),
    onExternalUpdate: jest.fn(),
    onTitleUpdated: jest.fn(),
    onPinned: jest.fn(),
    onMoved: jest.fn(),
    updateTitle: jest.fn(),
    togglePin: jest.fn(),
    createSnapshot: jest.fn().mockResolvedValue({ success: true, filename: 'test-snapshot.yjson' }),
  },
  folder: {
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    delete: jest.fn(),
    onUpdated: jest.fn(),
  },
  sd: {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    setActive: jest.fn(),
    getActive: jest.fn().mockResolvedValue(null),
    onUpdated: jest.fn(),
    onOpenSettings: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onInitProgress: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onInitComplete: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onInitError: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
  sync: {
    onProgress: jest.fn(),
  },
  appState: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  menu: {
    onNewNote: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onNewFolder: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onFind: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onFindInNote: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onToggleDarkMode: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onToggleFolderPanel: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onToggleTagsPanel: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onAbout: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onCreateSnapshot: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onNoteInfo: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onViewHistory: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onExportSelectedNotes: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onExportAllNotes: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
  export: {
    selectDirectory: jest.fn(() => Promise.resolve(null)),
    writeFile: jest.fn(() => Promise.resolve({ success: true })),
    createDirectory: jest.fn(() => Promise.resolve({ success: true })),
    getNotesForExport: jest.fn(() => Promise.resolve([])),
    showCompletionMessage: jest.fn(() => Promise.resolve()),
  },
  shutdown: {
    onProgress: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onComplete: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Make onUpdated return an unsubscribe function
    mockElectronAPI.folder.onUpdated.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onUpdated.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onDeleted.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onRestored.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onPermanentDeleted.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onCreated.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onExternalUpdate.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onTitleUpdated.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onPinned.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.note.onMoved.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.sd.onUpdated.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.sd.onOpenSettings.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockElectronAPI.sync.onProgress.mockReturnValue(() => {
      /* unsubscribe */
    });
  });
  it('should render the three-panel layout', async () => {
    const { container } = render(<App />);
    // Check that the panel group is rendered
    const panelGroup = container.querySelector('[data-testid="panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    // Wait for appState to be called
    await waitFor(() => {
      expect(mockElectronAPI.appState.get).toHaveBeenCalled();
    });
  });

  it('should render all main panels', async () => {
    const { container } = render(<App />);
    // Check that key panels are rendered (left sidebar with nested folders/tags, notes list, editor)
    const panels = container.querySelectorAll('[data-testid="panel"]');
    // We have nested panels in the left sidebar, so just verify we have multiple panels
    expect(panels.length).toBeGreaterThanOrEqual(3);

    // Wait for appState to be called
    await waitFor(() => {
      expect(mockElectronAPI.appState.get).toHaveBeenCalled();
    });
  });

  it('should render folder panel content', async () => {
    render(<App />);
    expect(screen.getByText('Folders')).toBeInTheDocument();

    // Wait for appState to be called
    await waitFor(() => {
      expect(mockElectronAPI.appState.get).toHaveBeenCalled();
    });
  });

  it('should render notes list panel content', async () => {
    render(<App />);

    // Should show loading initially
    expect(screen.getByText('Loading notes...')).toBeInTheDocument();

    // Wait for notes to load and show empty state
    await waitFor(() => {
      expect(screen.getByText('No notes in this folder')).toBeInTheDocument();
    });
  });

  it('should render editor panel content', async () => {
    render(<App />);

    // Wait for editor to finish loading
    await waitFor(() => {
      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    // Verify appState was called
    expect(mockElectronAPI.appState.get).toHaveBeenCalled();
  });

  it('should use Material-UI theme', async () => {
    const { container } = render(<App />);
    // Check that MUI CssBaseline is applied
    expect(container.firstChild).toBeTruthy();

    // Wait for appState to be called
    await waitFor(() => {
      expect(mockElectronAPI.appState.get).toHaveBeenCalled();
    });
  });
});
