/**
 * NotesListPanel Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotesListPanel } from '../NotesListPanel';

// Mock i18n
jest.mock('../../../i18n', () => ({}));

// Store for folder.onSelected callbacks so tests can trigger them
let folderSelectedCallbacks: ((folderId: string) => void)[] = [];

// Mock window.electronAPI
/* eslint-disable @typescript-eslint/no-empty-function */
const mockElectronAPI = {
  note: {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue('new-note-id'),
    search: jest.fn().mockResolvedValue([]),
    restore: jest.fn().mockResolvedValue(undefined),
    permanentDelete: jest.fn().mockResolvedValue(undefined),
    duplicate: jest.fn().mockResolvedValue('new-note-id'),
    togglePin: jest.fn().mockResolvedValue(undefined),
    onCreated: jest.fn().mockReturnValue(() => {}),
    onDeleted: jest.fn().mockReturnValue(() => {}),
    onRestored: jest.fn().mockReturnValue(() => {}),
    onPermanentDeleted: jest.fn().mockReturnValue(() => {}),
    onExternalUpdate: jest.fn().mockReturnValue(() => {}),
    onTitleUpdated: jest.fn().mockReturnValue(() => {}),
    onPinned: jest.fn().mockReturnValue(() => {}),
    onMoved: jest.fn().mockReturnValue(() => {}),
  },
  folder: {
    list: jest.fn().mockResolvedValue([]),
    onSelected: jest.fn().mockImplementation((callback: (folderId: string) => void) => {
      folderSelectedCallbacks.push(callback);
      return () => {
        folderSelectedCallbacks = folderSelectedCallbacks.filter((cb) => cb !== callback);
      };
    }),
  },
  tag: {
    getAll: jest.fn().mockResolvedValue([]),
    getNotesWithTags: jest.fn().mockResolvedValue([]),
  },
  appState: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'searchQuery') return Promise.resolve(null);
      if (key === 'selectedFolderId') return Promise.resolve(null);
      if (key === 'selectedTags') return Promise.resolve([]);
      return Promise.resolve(null);
    }),
    set: jest.fn().mockResolvedValue(undefined),
  },
};
/* eslint-enable @typescript-eslint/no-empty-function */

// Helper to simulate folder selection event
const simulateFolderSelected = (folderId: string): void => {
  folderSelectedCallbacks.forEach((cb) => {
    cb(folderId);
  });
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('NotesListPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    folderSelectedCallbacks = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show loading state initially', () => {
    const onNoteSelect = jest.fn();
    render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );
    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
  });

  it.skip('should show "No notes" when folder is empty', async () => {
    // Use real timers for this test
    jest.useRealTimers();

    mockElectronAPI.note.list.mockResolvedValue([]);
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    await waitFor(() => {
      expect(screen.getByText('No notes in this folder')).toBeInTheDocument();
    });

    // Restore fake timers
    jest.useFakeTimers();
  });

  it.skip('should display notes list when notes are available', async () => {
    const mockNotes = [
      {
        id: 'note1',
        title: 'Test Note 1',
        sdId: 'default',
        folderId: null,
        created: Date.now() - 100000,
        modified: Date.now() - 10000,
        deleted: false,
        contentPreview: 'This is a test note preview',
        contentText: 'This is a test note content',
      },
      {
        id: 'note2',
        title: 'Test Note 2',
        sdId: 'default',
        folderId: null,
        created: Date.now() - 200000,
        modified: Date.now() - 20000,
        deleted: false,
        contentPreview: 'Another test note',
        contentText: 'Another test note content',
      },
    ];

    mockElectronAPI.note.list.mockResolvedValue(mockNotes);
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    await waitFor(() => {
      expect(screen.getByText('Notes (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.getByText('Test Note 2')).toBeInTheDocument();
    expect(screen.getByText('This is a test note preview')).toBeInTheDocument();
  });

  it.skip('should show "Untitled Note" for notes without title', async () => {
    // Use real timers for this test
    jest.useRealTimers();

    const mockNotes = [
      {
        id: 'note1',
        title: '',
        sdId: 'default',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        contentPreview: 'Note with no title',
        contentText: 'Note with no title content',
      },
    ];

    mockElectronAPI.note.list.mockResolvedValue(mockNotes);
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    await waitFor(() => {
      expect(screen.getByText('Untitled Note')).toBeInTheDocument();
    });

    // Restore fake timers
    jest.useFakeTimers();
  });

  it.skip('should call note.list with folder ID when folder is selected', async () => {
    const folderId = 'folder123';
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolder') return Promise.resolve(folderId);
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    mockElectronAPI.note.list.mockResolvedValue([]);

    const onNoteSelect = jest.fn();
    render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    // Advance timers to trigger the polling interval
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(mockElectronAPI.note.list).toHaveBeenCalledWith('default', folderId);
    });
  });

  it('should call note.list without folder ID for all-notes', async () => {
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    mockElectronAPI.note.list.mockResolvedValue([]);

    const onNoteSelect = jest.fn();
    render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    await waitFor(() => {
      expect(mockElectronAPI.note.list).toHaveBeenCalledWith('default');
    });
  });

  it('should select a note when clicked', async () => {
    // Use real timers for this test to avoid async issues
    jest.useRealTimers();

    const mockNotes = [
      {
        id: 'note1',
        title: 'Test Note',
        sdId: 'default',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        contentPreview: 'Preview text',
        contentText: 'Content text',
      },
    ];

    mockElectronAPI.note.list.mockResolvedValue(mockNotes);
    mockElectronAPI.appState.get.mockImplementation((key) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'selectedNoteId') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    const { getByText, unmount } = render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    await waitFor(() => {
      expect(getByText('Test Note')).toBeInTheDocument();
    });

    // Click the note - MUI ListItemButton is a div with role="button"
    const noteButton = getByText('Test Note').closest('[role="button"]');
    if (noteButton) {
      (noteButton as HTMLElement).click();
    }

    await waitFor(() => {
      expect(onNoteSelect).toHaveBeenCalledWith('note1');
    });

    // Clean up - unmount to stop polling interval
    unmount();
  });

  it('should create a note when plus button is clicked', async () => {
    // Use real timers for this test to avoid async issues
    jest.useRealTimers();

    mockElectronAPI.appState.get.mockImplementation((key) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'selectedNoteId') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    mockElectronAPI.note.list.mockResolvedValue([]);
    mockElectronAPI.note.create.mockResolvedValue('new-note-id');

    const onNoteSelect = jest.fn();
    const { getByTitle, unmount } = render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    await waitFor(() => {
      expect(getByTitle('Create note')).toBeInTheDocument();
    });

    // Click the create button
    const createButton = getByTitle('Create note');
    createButton.click();

    await waitFor(() => {
      expect(mockElectronAPI.note.create).toHaveBeenCalledWith('default', '', '');
      expect(onNoteSelect).toHaveBeenCalledWith('new-note-id');
    });

    // Clean up - unmount to stop polling interval
    unmount();
  });

  it('should display folder path for notes in folders', async () => {
    jest.useRealTimers();

    const mockFolders = [
      { id: 'folder1', name: 'Projects', parentId: null, deleted: false },
      { id: 'folder2', name: 'Work', parentId: 'folder1', deleted: false },
    ];

    const mockNotes = [
      {
        id: 'note1',
        title: 'Note in subfolder',
        sdId: 'default',
        folderId: 'folder2', // Note is in "Work" folder which is child of "Projects"
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'Preview text',
        contentText: 'Content text',
      },
    ];

    mockElectronAPI.note.list.mockResolvedValue(mockNotes);
    mockElectronAPI.folder.list.mockResolvedValue(mockFolders);
    mockElectronAPI.appState.get.mockImplementation((key) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    const { unmount } = render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    // Wait for the folder path to appear
    await waitFor(() => {
      expect(screen.getByText('Projects / Work')).toBeInTheDocument();
    });

    unmount();
  });

  it('should not display folder path for notes in root', async () => {
    jest.useRealTimers();

    const mockNotes = [
      {
        id: 'note1',
        title: 'Note in root',
        sdId: 'default',
        folderId: null, // Note is in root (no folder)
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'Preview text',
        contentText: 'Content text',
      },
    ];

    mockElectronAPI.note.list.mockResolvedValue(mockNotes);
    mockElectronAPI.folder.list.mockResolvedValue([]);
    mockElectronAPI.appState.get.mockImplementation((key) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    const { unmount, container } = render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    // Wait for the note to appear
    await waitFor(() => {
      expect(screen.getByText('Note in root')).toBeInTheDocument();
    });

    // Check that no folder icon is present (folder path not displayed)
    const folderIcons = container.querySelectorAll('[data-testid="FolderIcon"]');
    expect(folderIcons.length).toBe(0);

    unmount();
  });

  it('should display time only for notes modified today', async () => {
    jest.useRealTimers();

    // Create a timestamp for today
    const now = new Date();
    const todayTimestamp = now.getTime();

    const mockNotes = [
      {
        id: 'note1',
        title: 'Note modified today',
        sdId: 'default',
        folderId: null,
        created: todayTimestamp - 3600000, // 1 hour ago
        modified: todayTimestamp,
        deleted: false,
        pinned: false,
        contentPreview: 'Preview text',
        contentText: 'Content text',
      },
    ];

    mockElectronAPI.note.list.mockResolvedValue(mockNotes);
    mockElectronAPI.folder.list.mockResolvedValue([]);
    mockElectronAPI.appState.get.mockImplementation((key) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    const { unmount } = render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    // Wait for the note to appear
    await waitFor(() => {
      expect(screen.getByText('Note modified today')).toBeInTheDocument();
    });

    // Get the expected time format (locale-based, time only)
    const expectedTime = new Date(todayTimestamp).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    // Check that the time is displayed (not relative like "5m ago")
    expect(screen.getByText(expectedTime)).toBeInTheDocument();

    unmount();
  });

  it('should display full date and time for notes not modified today', async () => {
    jest.useRealTimers();

    // Create a timestamp for yesterday
    const now = new Date();
    const yesterdayTimestamp = now.getTime() - 86400000; // 24 hours ago

    const mockNotes = [
      {
        id: 'note1',
        title: 'Note modified yesterday',
        sdId: 'default',
        folderId: null,
        created: yesterdayTimestamp - 3600000,
        modified: yesterdayTimestamp,
        deleted: false,
        pinned: false,
        contentPreview: 'Preview text',
        contentText: 'Content text',
      },
    ];

    mockElectronAPI.note.list.mockResolvedValue(mockNotes);
    mockElectronAPI.folder.list.mockResolvedValue([]);
    mockElectronAPI.appState.get.mockImplementation((key) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    const { unmount } = render(
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
    );

    // Wait for the note to appear
    await waitFor(() => {
      expect(screen.getByText('Note modified yesterday')).toBeInTheDocument();
    });

    // Get the expected date+time format (locale-based)
    const expectedDateTime = new Date(yesterdayTimestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    // Check that the full date+time is displayed (not relative like "1d ago")
    expect(screen.getByText(expectedDateTime)).toBeInTheDocument();

    unmount();
  });

  describe('clear search on folder selection', () => {
    it('should clear search when folder:selected event is received', async () => {
      jest.useRealTimers();

      // Start with a search query
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'searchQuery') return Promise.resolve('test search');
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        return Promise.resolve(null);
      });
      mockElectronAPI.note.list.mockResolvedValue([]);
      mockElectronAPI.note.search.mockResolvedValue([]);

      const onNoteSelect = jest.fn();
      const { unmount } = render(
        <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
      );

      // Wait for component to load and search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('test search');
      });

      // Simulate folder selection event
      simulateFolderSelected('folder-123');

      // Search should be cleared
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('');
      });

      // Should have saved empty search query to app state
      expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('searchQuery', '');

      unmount();
    });

    it('should clear search when virtual folder "All Notes" is selected', async () => {
      jest.useRealTimers();

      // Start with a search query
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'searchQuery') return Promise.resolve('my search');
        if (key === 'selectedFolderId') return Promise.resolve('folder-1');
        return Promise.resolve(null);
      });
      mockElectronAPI.note.list.mockResolvedValue([]);
      mockElectronAPI.note.search.mockResolvedValue([]);

      const onNoteSelect = jest.fn();
      const { unmount } = render(
        <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
      );

      // Wait for search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('my search');
      });

      // Simulate "All Notes" selection
      simulateFolderSelected('all-notes');

      // Search should be cleared
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('');
      });

      unmount();
    });

    it('should clear search when virtual folder "Recently Deleted" is selected', async () => {
      jest.useRealTimers();

      // Start with a search query
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'searchQuery') return Promise.resolve('another search');
        if (key === 'selectedFolderId') return Promise.resolve('folder-1');
        return Promise.resolve(null);
      });
      mockElectronAPI.note.list.mockResolvedValue([]);
      mockElectronAPI.note.search.mockResolvedValue([]);

      const onNoteSelect = jest.fn();
      const { unmount } = render(
        <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
      );

      // Wait for search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('another search');
      });

      // Simulate "Recently Deleted" selection
      simulateFolderSelected('recently-deleted');

      // Search should be cleared
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('');
      });

      unmount();
    });

    it('should clear search when activeSdId prop changes', async () => {
      jest.useRealTimers();

      // Start with a search query
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'searchQuery') return Promise.resolve('sd search');
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        return Promise.resolve(null);
      });
      mockElectronAPI.note.list.mockResolvedValue([]);
      mockElectronAPI.note.search.mockResolvedValue([]);

      const onNoteSelect = jest.fn();
      const { unmount, rerender } = render(
        <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="sd-1" />
      );

      // Wait for search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('sd search');
      });

      // Change activeSdId
      rerender(
        <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="sd-2" />
      );

      // Search should be cleared
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('');
      });

      // Should have saved empty search query to app state
      expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('searchQuery', '');

      unmount();
    });

    it('should clear persisted searchQuery in app state when folder is selected', async () => {
      jest.useRealTimers();

      // Start with a search query
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'searchQuery') return Promise.resolve('persistent search');
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        return Promise.resolve(null);
      });
      mockElectronAPI.note.list.mockResolvedValue([]);
      mockElectronAPI.note.search.mockResolvedValue([]);

      const onNoteSelect = jest.fn();
      const { unmount } = render(
        <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} activeSdId="default" />
      );

      // Wait for search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('persistent search');
      });

      // Clear the mock to track new calls
      mockElectronAPI.appState.set.mockClear();

      // Simulate folder selection
      simulateFolderSelected('new-folder');

      // Wait for the search to be cleared and persisted
      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('searchQuery', '');
      });

      unmount();
    });
  });
});
