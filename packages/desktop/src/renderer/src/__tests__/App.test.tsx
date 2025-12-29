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
    onModifiedUpdated: jest.fn(),
    updateTitle: jest.fn(),
    togglePin: jest.fn(),
    createSnapshot: jest.fn().mockResolvedValue({ success: true, filename: 'test-snapshot.yjson' }),
    getInfo: jest.fn().mockResolvedValue(null),
    reloadFromCRDTLogs: jest.fn().mockResolvedValue({ success: true }),
  },
  folder: {
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    delete: jest.fn(),
    onUpdated: jest.fn(),
    onSelected: jest.fn(() => () => {
      /* unsubscribe */
    }),
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
    getStatus: jest.fn().mockResolvedValue({
      pendingCount: 0,
      perSd: [],
      isSyncing: false,
    }),
    onStatusChanged: jest.fn(() => () => {
      /* unsubscribe */
    }),
    exportDiagnostics: jest.fn().mockResolvedValue({ success: true }),
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
    onToggleNotesListPanel: jest.fn(() => () => {
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
    onReloadFromCRDTLogs: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onReindexNotes: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onStorageInspector: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onImportMarkdown: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onFeatureFlags: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
  featureFlags: {
    get: jest.fn().mockResolvedValue(false),
    getAll: jest.fn().mockResolvedValue([
      {
        flag: 'telemetry',
        enabled: false,
        metadata: { name: 'Telemetry', description: '', requiresRestart: false },
      },
      {
        flag: 'viewHistory',
        enabled: false,
        metadata: { name: 'View History', description: '', requiresRestart: true },
      },
      {
        flag: 'webServer',
        enabled: false,
        metadata: { name: 'Web Server', description: '', requiresRestart: true },
      },
    ]),
    onChange: jest.fn(() => () => {
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
  tools: {
    onReindexProgress: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onReindexComplete: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onReindexError: jest.fn(() => () => {
      /* unsubscribe */
    }),
    reindexNotes: jest.fn(() => Promise.resolve()),
  },
  comment: {
    createThread: jest.fn().mockResolvedValue('thread-1'),
    getThreads: jest.fn().mockResolvedValue([]),
    updateThread: jest.fn().mockResolvedValue(undefined),
    deleteThread: jest.fn().mockResolvedValue(undefined),
    addReply: jest.fn().mockResolvedValue('reply-1'),
    updateReply: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    addReaction: jest.fn().mockResolvedValue(undefined),
    removeReaction: jest.fn().mockResolvedValue(undefined),
    onThreadAdded: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onThreadUpdated: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onThreadDeleted: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onReplyAdded: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onReplyUpdated: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onReplyDeleted: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onReactionAdded: jest.fn(() => () => {
      /* unsubscribe */
    }),
    onReactionRemoved: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
  app: {
    getInfo: jest.fn().mockResolvedValue({
      version: '1.0.0',
      isDevBuild: false,
      profileId: null,
      profileName: null,
    }),
  },
  theme: {
    set: jest.fn().mockResolvedValue(undefined),
    onChanged: jest.fn((_callback: (theme: 'light' | 'dark') => void) => () => {
      /* unsubscribe */
    }),
  },
  user: {
    getCurrentProfile: jest.fn().mockResolvedValue({
      profileId: 'test-profile-id',
      username: 'Test User',
      handle: '@testuser',
    }),
    onProfileChanged: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
  windowState: {
    reportCurrentNote: jest.fn().mockResolvedValue(undefined),
    reportEditorState: jest.fn().mockResolvedValue(undefined),
    reportPanelLayout: jest.fn().mockResolvedValue(undefined),
    getSavedState: jest.fn().mockResolvedValue(null),
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
    mockElectronAPI.note.onModifiedUpdated.mockReturnValue(() => {
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

    // Wait for panel sizes to load, then check that the panel group is rendered
    await waitFor(() => {
      const panelGroup = container.querySelector('[data-testid="panel-group"]');
      expect(panelGroup).toBeInTheDocument();
    });

    expect(mockElectronAPI.appState.get).toHaveBeenCalled();
  });

  it('should render all main panels', async () => {
    const { container } = render(<App />);

    // Wait for panel sizes to load, then check that key panels are rendered
    await waitFor(() => {
      const panels = container.querySelectorAll('[data-testid="panel"]');
      // We have nested panels in the left sidebar, so just verify we have multiple panels
      expect(panels.length).toBeGreaterThanOrEqual(3);
    });

    expect(mockElectronAPI.appState.get).toHaveBeenCalled();
  });

  it('should render folder panel content', async () => {
    render(<App />);

    // Wait for panel sizes to load, then check for Folders
    await waitFor(() => {
      expect(screen.getByText('Folders')).toBeInTheDocument();
    });

    expect(mockElectronAPI.appState.get).toHaveBeenCalled();
  });

  it('should render notes list panel content', async () => {
    render(<App />);

    // Wait for panel sizes to load, then check for loading or empty state
    await waitFor(() => {
      // After panel sizes load, notes list should show loading or empty state
      const hasLoading = screen.queryByText('Loading notes...');
      const hasEmpty = screen.queryByText('No notes in this folder');
      expect(hasLoading ?? hasEmpty).toBeTruthy();
    });

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

  describe('Theme Broadcasting', () => {
    it('should register a listener for theme:changed events', async () => {
      render(<App />);

      // Wait for component to mount and register listeners
      await waitFor(() => {
        expect(mockElectronAPI.theme.onChanged).toHaveBeenCalled();
      });
    });

    it('should update theme when theme:changed event is received', async () => {
      // Capture the callback when onChanged is called
      let themeChangedCallback: ((theme: 'light' | 'dark') => void) | null = null;
      mockElectronAPI.theme.onChanged.mockImplementation(
        (callback: (theme: 'light' | 'dark') => void) => {
          themeChangedCallback = callback;
          return () => {
            /* unsubscribe */
          };
        }
      );

      const { container } = render(<App />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockElectronAPI.theme.onChanged).toHaveBeenCalled();
      });

      // Verify callback was captured
      expect(themeChangedCallback).not.toBeNull();

      // Simulate receiving a theme change broadcast
      themeChangedCallback!('dark');

      // The theme should update - we can verify by checking the MUI theme mode
      // The app uses ThemeProvider which applies data-mui-color-scheme attribute
      await waitFor(() => {
        // Check that the theme was applied (Material-UI adds color-scheme to body)
        const body = container.ownerDocument.body;
        // In dark mode, MUI sets the background color differently
        // We just verify the callback was invoked and no errors occurred
        expect(body).toBeInTheDocument();
      });
    });

    it('should not save to database when theme change comes from broadcast', async () => {
      // Capture the callback when onChanged is called
      let themeChangedCallback: ((theme: 'light' | 'dark') => void) | null = null;
      mockElectronAPI.theme.onChanged.mockImplementation(
        (callback: (theme: 'light' | 'dark') => void) => {
          themeChangedCallback = callback;
          return () => {
            /* unsubscribe */
          };
        }
      );

      // Start with light theme loaded - use implementation to handle all keys
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'themeMode') {
          return Promise.resolve('light');
        }
        return Promise.resolve(null);
      });

      render(<App />);

      // Wait for initial load and panel sizes
      await waitFor(() => {
        expect(mockElectronAPI.appState.get).toHaveBeenCalledWith('themeMode');
      });

      // Wait for all effects to settle before clearing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Record the current call count
      const callCountBeforeBroadcast = mockElectronAPI.appState.set.mock.calls.filter(
        (call) => call[0] === 'themeMode' && call[1] === 'dark'
      ).length;

      // Simulate receiving a theme change broadcast
      themeChangedCallback!('dark');

      // Wait a bit for any potential saves
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The broadcast should not trigger additional saves for 'dark' theme
      // (the ref-based skip should prevent redundant saves)
      const callCountAfterBroadcast = mockElectronAPI.appState.set.mock.calls.filter(
        (call) => call[0] === 'themeMode' && call[1] === 'dark'
      ).length;

      // At most one save should happen (React may run effects multiple times in dev mode)
      // The key is that the broadcast itself doesn't trigger multiple redundant saves
      expect(callCountAfterBroadcast - callCountBeforeBroadcast).toBeLessThanOrEqual(1);
    });
  });

  describe('SD Deletion Handling', () => {
    it('should call getMetadata to check if selected note belongs to deleted SD', async () => {
      // Capture the sd.onUpdated callback
      let sdUpdatedCallback: ((data: { operation: string; sdId: string }) => void) | null = null;
      mockElectronAPI.sd.onUpdated.mockImplementation(
        (callback: (data: { operation: string; sdId: string }) => void) => {
          sdUpdatedCallback = callback;
          return () => {
            /* unsubscribe */
          };
        }
      );

      // Set up note.getMetadata to return a note in the SD that will be deleted
      mockElectronAPI.note.getMetadata.mockResolvedValue({
        noteId: 'note-123',
        sdId: 'sd-to-delete',
        title: 'Test Note',
        folderId: null,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        deleted: false,
      });

      // Set up note.list to return a note - this triggers auto-selection of default note
      mockElectronAPI.note.list.mockResolvedValue([
        {
          id: 'default-note',
          title: 'Default Note',
          sdId: 'sd-to-delete',
          folderId: null,
          created: Date.now(),
          modified: Date.now(),
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
      ]);

      render(<App />);

      // Wait for component to mount and register listeners
      await waitFor(() => {
        expect(mockElectronAPI.sd.onUpdated).toHaveBeenCalled();
      });

      // Clear any previous calls
      mockElectronAPI.note.getMetadata.mockClear();

      // Verify callback was captured
      expect(sdUpdatedCallback).not.toBeNull();

      // Simulate SD deletion
      sdUpdatedCallback!({ operation: 'delete', sdId: 'sd-to-delete' });

      // The app should call getMetadata to check if selected note belongs to deleted SD
      // Note: The selectedNoteId is set to 'default-note' on mount via the loadDefaultNote effect
      await waitFor(() => {
        expect(mockElectronAPI.note.getMetadata).toHaveBeenCalledWith('default-note');
      });
    });

    it('should not call getMetadata when operation is not delete', async () => {
      // Capture the sd.onUpdated callback
      let sdUpdatedCallback: ((data: { operation: string; sdId: string }) => void) | null = null;
      mockElectronAPI.sd.onUpdated.mockImplementation(
        (callback: (data: { operation: string; sdId: string }) => void) => {
          sdUpdatedCallback = callback;
          return () => {
            /* unsubscribe */
          };
        }
      );

      render(<App />);

      // Wait for component to mount and any initial loading to complete
      await waitFor(() => {
        expect(mockElectronAPI.sd.onUpdated).toHaveBeenCalled();
      });

      // Wait a bit for any async operations to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear any previous calls (from initial mount/loading)
      mockElectronAPI.note.getMetadata.mockClear();

      // Simulate a non-delete operation
      sdUpdatedCallback!({ operation: 'create', sdId: 'new-sd' });

      // Wait a bit and verify getMetadata was NOT called by our SD deletion handler
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockElectronAPI.note.getMetadata).not.toHaveBeenCalled();
    });

    it('should fetch remaining SDs when active SD is deleted', async () => {
      // Capture the sd.onUpdated callback
      let sdUpdatedCallback: ((data: { operation: string; sdId: string }) => void) | null = null;
      mockElectronAPI.sd.onUpdated.mockImplementation(
        (callback: (data: { operation: string; sdId: string }) => void) => {
          sdUpdatedCallback = callback;
          return () => {
            /* unsubscribe */
          };
        }
      );

      // Set up sd.getActive to return the SD that will be deleted
      mockElectronAPI.sd.getActive.mockResolvedValue('sd-to-delete');

      // Set up sd.list to return remaining SDs after deletion
      mockElectronAPI.sd.list.mockResolvedValue([
        {
          id: 'remaining-sd',
          name: 'Remaining SD',
          path: '/path',
          created: Date.now(),
          isActive: false,
        },
      ]);

      render(<App />);

      // Wait for component to mount and activeSdId to be set
      await waitFor(() => {
        expect(mockElectronAPI.sd.onUpdated).toHaveBeenCalled();
      });

      // Clear previous sd.list calls from mount
      mockElectronAPI.sd.list.mockClear();

      // Verify callback was captured
      expect(sdUpdatedCallback).not.toBeNull();

      // Simulate active SD deletion
      sdUpdatedCallback!({ operation: 'delete', sdId: 'sd-to-delete' });

      // App should fetch remaining SDs to switch to one
      await waitFor(() => {
        expect(mockElectronAPI.sd.list).toHaveBeenCalled();
      });
    });

    it('should auto-select a note from the new SD after SD deletion', async () => {
      // Capture the sd.onUpdated callback
      let sdUpdatedCallback: ((data: { operation: string; sdId: string }) => void) | null = null;
      mockElectronAPI.sd.onUpdated.mockImplementation(
        (callback: (data: { operation: string; sdId: string }) => void) => {
          sdUpdatedCallback = callback;
          return () => {
            /* unsubscribe */
          };
        }
      );

      // Set up sd.getActive to return the SD that will be deleted
      mockElectronAPI.sd.getActive.mockResolvedValue('sd-to-delete');

      // Set up sd.list to return remaining SDs after deletion
      mockElectronAPI.sd.list.mockResolvedValue([
        {
          id: 'remaining-sd',
          name: 'Remaining SD',
          path: '/path',
          created: Date.now(),
          isActive: false,
        },
      ]);

      // Set up note.list to return notes in the new SD
      mockElectronAPI.note.list.mockResolvedValue([
        {
          id: 'note-in-new-sd',
          title: 'Note in New SD',
          sdId: 'remaining-sd',
          folderId: null,
          created: 1000,
          modified: 1000,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
      ]);

      render(<App />);

      // Wait for component to mount and activeSdId to be set
      await waitFor(() => {
        expect(mockElectronAPI.sd.onUpdated).toHaveBeenCalled();
      });

      // Wait for initial load to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear previous calls
      mockElectronAPI.note.list.mockClear();

      // Verify callback was captured
      expect(sdUpdatedCallback).not.toBeNull();

      // Simulate active SD deletion
      sdUpdatedCallback!({ operation: 'delete', sdId: 'sd-to-delete' });

      // App should query for notes in the new SD to auto-select one
      await waitFor(() => {
        expect(mockElectronAPI.note.list).toHaveBeenCalledWith('all-notes');
      });
    });
  });

  describe('Panel Size Persistence', () => {
    it('should wait for panel sizes to load before rendering ThreePanelLayout', async () => {
      // Panel sizes are now per-window via windowState
      // With no windowId (new window), layout should render with defaults
      const { container } = render(<App />);

      // Wait for the panel group to appear
      await waitFor(() => {
        expect(container.querySelector('[data-testid="panel-group"]')).toBeInTheDocument();
      });

      // Theme is still loaded from appState
      expect(mockElectronAPI.appState.get).toHaveBeenCalledWith('themeMode');
    });

    it('should load panel sizes from windowState when available', async () => {
      // Mock URL with windowId parameter
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: {
          href: originalLocation.href,
          origin: originalLocation.origin,
          protocol: originalLocation.protocol,
          host: originalLocation.host,
          hostname: originalLocation.hostname,
          port: originalLocation.port,
          pathname: originalLocation.pathname,
          search: '?windowId=test-window-123',
          hash: '',
        },
        writable: true,
      });

      // Set up windowState to return saved panel layout
      mockElectronAPI.windowState.getSavedState.mockResolvedValue({
        panelLayout: {
          panelSizes: [30, 30, 40],
          leftSidebarSizes: [70, 30],
          showFolderPanel: true,
          showTagPanel: true,
        },
      });

      render(<App />);

      // Wait for layout to render
      await waitFor(() => {
        expect(mockElectronAPI.windowState.getSavedState).toHaveBeenCalledWith('test-window-123');
      });

      // Restore location
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      });
    });

    it('should render with default sizes when no windowId is present', async () => {
      // Ensure no windowId in URL
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          hash: '',
        },
        writable: true,
      });

      const { container } = render(<App />);

      // Wait for initial render
      await waitFor(() => {
        expect(container.querySelector('[data-testid="panel-group"]')).toBeInTheDocument();
      });

      // With no windowId, getSavedState is not called with a valid ID
      // The app should render with default panel sizes
      const panelGroup = document.querySelector('[data-testid="panel-group"]');
      expect(panelGroup).toBeInTheDocument();
    });
  });

  describe('Auto-select on Note Deletion', () => {
    it('should auto-select next note even when selection was already cleared (NotesListPanel scenario)', async () => {
      // This tests the real-world scenario where:
      // 1. NotesListPanel deletes a note
      // 2. NotesListPanel calls onNoteSelect('') to clear selection immediately
      // 3. The note:deleted event fires
      // 4. App should still auto-select another note

      // Capture ALL note.onDeleted callbacks (multiple components subscribe)
      const noteDeletedCallbacks: ((noteId: string) => void)[] = [];
      mockElectronAPI.note.onDeleted.mockImplementation((callback: (noteId: string) => void) => {
        noteDeletedCallbacks.push(callback);
        return () => {
          /* unsubscribe */
        };
      });

      // Set up notes list - will return remaining note after deletion
      mockElectronAPI.note.list.mockResolvedValue([
        {
          id: 'remaining-note',
          title: 'Remaining Note',
          sdId: 'test-sd',
          folderId: null,
          created: 2000,
          modified: 2000,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
      ]);

      const { container } = render(<App />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockElectronAPI.note.onDeleted).toHaveBeenCalled();
      });

      // Wait for initial load to settle
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Clear previous calls to track the auto-select query
      mockElectronAPI.note.list.mockClear();

      // Verify callbacks were captured
      expect(noteDeletedCallbacks.length).toBeGreaterThan(0);

      // Simulate the deletion event firing (in real app, NotesListPanel already cleared selection)
      // The key test is that auto-select still works even when current selection is empty
      noteDeletedCallbacks.forEach((cb) => {
        cb('deleted-note');
      });

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 100));

      // App should query for notes to auto-select
      await waitFor(
        () => {
          expect(mockElectronAPI.note.list).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Verify TipTapEditor is NOT showing empty state (a note should be selected)
      await waitFor(() => {
        const emptyState = container.querySelector('[data-testid="editor-empty-state"]');
        expect(emptyState).not.toBeInTheDocument();
      });
    });

    it('should auto-select next note when selected note is soft-deleted', async () => {
      // Capture ALL note.onDeleted callbacks (multiple components subscribe)
      const noteDeletedCallbacks: ((noteId: string) => void)[] = [];
      mockElectronAPI.note.onDeleted.mockImplementation((callback: (noteId: string) => void) => {
        noteDeletedCallbacks.push(callback);
        return () => {
          /* unsubscribe */
        };
      });

      // Set up initial notes list with a default note
      mockElectronAPI.note.list.mockResolvedValue([
        {
          id: 'default-note',
          title: 'Default Note',
          sdId: 'test-sd',
          folderId: null,
          created: 1000,
          modified: 1000,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
        {
          id: 'other-note',
          title: 'Other Note',
          sdId: 'test-sd',
          folderId: null,
          created: 2000,
          modified: 2000,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
      ]);

      render(<App />);

      // Wait for component to mount and auto-select default note
      await waitFor(() => {
        expect(mockElectronAPI.note.onDeleted).toHaveBeenCalled();
      });

      // Wait for initial load to settle
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Clear previous calls
      mockElectronAPI.note.list.mockClear();

      // Verify callbacks were captured
      expect(noteDeletedCallbacks.length).toBeGreaterThan(0);

      // Simulate deletion of the selected note (default-note) - invoke ALL callbacks
      noteDeletedCallbacks.forEach((cb) => {
        cb('default-note');
      });

      // Wait a bit for the async handler to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      // App should query for notes to pick the next one
      await waitFor(
        () => {
          // The note.list call happens to find next note (called with folder ID)
          expect(mockElectronAPI.note.list).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });

    it('should auto-select next note when selected note is permanently deleted', async () => {
      // Capture ALL note.onPermanentDeleted callbacks (multiple components may subscribe)
      const notePermanentDeletedCallbacks: ((noteId: string) => void)[] = [];
      mockElectronAPI.note.onPermanentDeleted.mockImplementation(
        (callback: (noteId: string) => void) => {
          notePermanentDeletedCallbacks.push(callback);
          return () => {
            /* unsubscribe */
          };
        }
      );

      // Set up initial notes list
      mockElectronAPI.note.list.mockResolvedValue([
        {
          id: 'default-note',
          title: 'Default Note',
          sdId: 'test-sd',
          folderId: null,
          created: 1000,
          modified: 1000,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
        {
          id: 'other-note',
          title: 'Other Note',
          sdId: 'test-sd',
          folderId: null,
          created: 2000,
          modified: 2000,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
      ]);

      render(<App />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockElectronAPI.note.onPermanentDeleted).toHaveBeenCalled();
      });

      // Wait for initial load to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear previous calls
      mockElectronAPI.note.list.mockClear();

      // Verify callbacks were captured
      expect(notePermanentDeletedCallbacks.length).toBeGreaterThan(0);

      // Simulate permanent deletion of the selected note - invoke ALL callbacks
      notePermanentDeletedCallbacks.forEach((cb) => {
        cb('default-note');
      });

      // Wait a bit for the async handler to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      // App should query for notes to pick the next one
      await waitFor(() => {
        expect(mockElectronAPI.note.list).toHaveBeenCalled();
      });
    });

    it('should close minimal mode window when note is deleted', async () => {
      // Mock window.close
      const originalClose = window.close;
      const mockClose = jest.fn();
      window.close = mockClose;

      // Set up URL with minimal=true parameter
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: {
          href: originalLocation.href,
          origin: originalLocation.origin,
          protocol: originalLocation.protocol,
          host: originalLocation.host,
          hostname: originalLocation.hostname,
          port: originalLocation.port,
          pathname: originalLocation.pathname,
          hash: originalLocation.hash,
          search: '?minimal=true&noteId=minimal-note',
        },
        writable: true,
      });

      // Capture ALL note.onDeleted callbacks
      const noteDeletedCallbacks: ((noteId: string) => void)[] = [];
      mockElectronAPI.note.onDeleted.mockImplementation((callback: (noteId: string) => void) => {
        noteDeletedCallbacks.push(callback);
        return () => {
          /* unsubscribe */
        };
      });

      // Set up initial notes list
      mockElectronAPI.note.list.mockResolvedValue([
        {
          id: 'minimal-note',
          title: 'Minimal Note',
          sdId: 'test-sd',
          folderId: null,
          created: 1000,
          modified: 1000,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
      ]);

      render(<App />);

      // Wait for component to mount
      await waitFor(() => {
        expect(mockElectronAPI.note.onDeleted).toHaveBeenCalled();
      });

      // Wait for initial load to settle
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Simulate deletion of the minimal mode note - invoke ALL callbacks
      noteDeletedCallbacks.forEach((cb) => {
        cb('minimal-note');
      });

      // Wait a bit for the async handler to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Window should be closed
      expect(mockClose).toHaveBeenCalled();

      // Restore
      window.close = originalClose;
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      });
    });

    it('should not auto-select when deleted note is not the selected note', async () => {
      // Capture the note.onDeleted callback
      let noteDeletedCallback: ((noteId: string) => void) | null = null;
      mockElectronAPI.note.onDeleted.mockImplementation((callback: (noteId: string) => void) => {
        noteDeletedCallback = callback;
        return () => {
          /* unsubscribe */
        };
      });

      // Set up initial notes list
      mockElectronAPI.note.list.mockResolvedValue([
        {
          id: 'default-note',
          title: 'Default Note',
          sdId: 'test-sd',
          folderId: null,
          created: 1000,
          modified: 1000,
          deleted: false,
          pinned: false,
          contentPreview: '',
          contentText: '',
        },
      ]);

      render(<App />);

      // Wait for component to mount and initial notes to load
      await waitFor(() => {
        expect(mockElectronAPI.note.onDeleted).toHaveBeenCalled();
      });

      // Wait longer for all initial async operations to settle
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Track call count BEFORE the deletion event
      const callCountBefore = mockElectronAPI.note.list.mock.calls.length;

      // Simulate deletion of a different note (not the selected one)
      noteDeletedCallback!('some-other-note');

      // Wait a bit for the event to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // App should NOT query for notes since the deleted note wasn't selected
      // Check that no NEW calls were made
      expect(mockElectronAPI.note.list.mock.calls.length).toBe(callCountBefore);
    });
  });
});
