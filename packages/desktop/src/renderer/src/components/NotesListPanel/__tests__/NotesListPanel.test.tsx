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
    onModifiedUpdated: jest.fn().mockReturnValue(() => {}),
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
  user: {
    getCurrentProfile: jest.fn().mockResolvedValue({
      profileId: 'test-profile-id',
      username: 'Test User',
      handle: '@testuser',
    }),
  },
  sd: {
    onUpdated: jest.fn().mockReturnValue(() => {}),
  },
};
/* eslint-enable @typescript-eslint/no-empty-function */

// Store for sd.onUpdated callbacks so tests can trigger them
let sdUpdatedCallbacks: ((data: { operation: string; sdId: string }) => void)[] = [];

// Store for note.onMoved callbacks so tests can trigger them
let noteMovedCallbacks: ((data: {
  noteId: string;
  oldFolderId: string | null;
  newFolderId: string;
}) => void)[] = [];

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Default props for tests (selectedFolderId is now required)
const defaultProps = {
  selectedNoteId: null as string | null,
  onNoteSelect: jest.fn(),
  activeSdId: 'default',
  selectedFolderId: null as string | null,
};

describe('NotesListPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    folderSelectedCallbacks = [];
    sdUpdatedCallbacks = [];
    noteMovedCallbacks = [];
    defaultProps.onNoteSelect.mockClear();

    // Set up sd.onUpdated to capture callbacks
    mockElectronAPI.sd.onUpdated.mockImplementation(
      (callback: (data: { operation: string; sdId: string }) => void) => {
        sdUpdatedCallbacks.push(callback);
        return () => {
          sdUpdatedCallbacks = sdUpdatedCallbacks.filter((cb) => cb !== callback);
        };
      }
    );

    // Set up note.onMoved to capture callbacks
    mockElectronAPI.note.onMoved.mockImplementation(
      (
        callback: (data: {
          noteId: string;
          oldFolderId: string | null;
          newFolderId: string;
        }) => void
      ) => {
        noteMovedCallbacks.push(callback);
        return () => {
          noteMovedCallbacks = noteMovedCallbacks.filter((cb) => cb !== callback);
        };
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show loading state initially', () => {
    render(<NotesListPanel {...defaultProps} />);
    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
  });

  it('should show "No notes" when folder is empty', async () => {
    // Use real timers for this test
    jest.useRealTimers();

    mockElectronAPI.note.list.mockResolvedValue([]);
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

    await waitFor(() => {
      expect(screen.getByText('No notes in this folder')).toBeInTheDocument();
    });

    unmount();
  });

  it('should display notes list when notes are available', async () => {
    // Use real timers for this test
    jest.useRealTimers();

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

    const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

    await waitFor(() => {
      expect(screen.getByText('Notes (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.getByText('Test Note 2')).toBeInTheDocument();
    expect(screen.getByText('This is a test note preview')).toBeInTheDocument();

    unmount();
  });

  it('should show "Untitled Note" for notes without title', async () => {
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

    const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

    await waitFor(() => {
      expect(screen.getByText('Untitled Note')).toBeInTheDocument();
    });

    unmount();
  });

  it('should call note.list with folder ID when folder is selected', async () => {
    // Use real timers for this test
    jest.useRealTimers();

    const folderId = 'folder123';
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolderId') return Promise.resolve(folderId);
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    mockElectronAPI.note.list.mockResolvedValue([]);

    const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId={folderId} />);

    await waitFor(() => {
      expect(mockElectronAPI.note.list).toHaveBeenCalledWith('default', folderId);
    });

    unmount();
  });

  it('should call note.list without folder ID for all-notes', async () => {
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolderId') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    mockElectronAPI.note.list.mockResolvedValue([]);

    render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

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
      <NotesListPanel {...defaultProps} selectedFolderId="all-notes" onNoteSelect={onNoteSelect} />
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
      <NotesListPanel {...defaultProps} selectedFolderId="all-notes" onNoteSelect={onNoteSelect} />
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

    const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

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

    const { unmount, container } = render(
      <NotesListPanel {...defaultProps} selectedFolderId="all-notes" />
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

    const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

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

    const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

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
    it('should clear search when folder selection changes', async () => {
      jest.useRealTimers();

      // Start with a search query
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'searchQuery') return Promise.resolve('test search');
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        return Promise.resolve(null);
      });
      mockElectronAPI.note.list.mockResolvedValue([]);
      mockElectronAPI.note.search.mockResolvedValue([]);

      const { unmount, rerender } = render(
        <NotesListPanel {...defaultProps} selectedFolderId="all-notes" />
      );

      // Wait for component to load and search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('test search');
      });

      // Change folder selection via props (how it now works)
      rerender(<NotesListPanel {...defaultProps} selectedFolderId="folder-123" />);

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

      const { unmount, rerender } = render(
        <NotesListPanel {...defaultProps} selectedFolderId="folder-1" />
      );

      // Wait for search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('my search');
      });

      // Change to "All Notes" via props
      rerender(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

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

      const { unmount, rerender } = render(
        <NotesListPanel {...defaultProps} selectedFolderId="folder-1" />
      );

      // Wait for search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('another search');
      });

      // Change to "Recently Deleted" via props
      rerender(<NotesListPanel {...defaultProps} selectedFolderId="recently-deleted" />);

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

      const { unmount, rerender } = render(<NotesListPanel {...defaultProps} activeSdId="sd-1" />);

      // Wait for search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('sd search');
      });

      // Change activeSdId
      rerender(<NotesListPanel {...defaultProps} activeSdId="sd-2" />);

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

      const { unmount, rerender } = render(
        <NotesListPanel {...defaultProps} selectedFolderId="all-notes" />
      );

      // Wait for search to be populated
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search notes...');
        expect(searchInput).toHaveValue('persistent search');
      });

      // Clear the mock to track new calls
      mockElectronAPI.appState.set.mockClear();

      // Change folder selection via props
      rerender(<NotesListPanel {...defaultProps} selectedFolderId="new-folder" />);

      // Wait for the search to be cleared and persisted
      await waitFor(() => {
        expect(mockElectronAPI.appState.set).toHaveBeenCalledWith('searchQuery', '');
      });

      unmount();
    });
  });

  describe('SD Deletion Handling', () => {
    it('should clear notes list when viewing deleted SD', async () => {
      jest.useRealTimers();

      const mockNotes = [
        {
          id: 'note1',
          title: 'Test Note',
          sdId: 'sd-to-delete',
          folderId: null,
          created: Date.now(),
          modified: Date.now(),
          deleted: false,
          pinned: false,
          contentPreview: 'Test content',
          contentText: 'Test content text',
        },
      ];

      mockElectronAPI.note.list.mockResolvedValue(mockNotes);
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        if (key === 'searchQuery') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      render(
        <NotesListPanel {...defaultProps} activeSdId="sd-to-delete" selectedFolderId="all-notes" />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // Simulate SD deletion
      sdUpdatedCallbacks.forEach((cb) => {
        cb({ operation: 'delete', sdId: 'sd-to-delete' });
      });

      // Notes should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Test Note')).not.toBeInTheDocument();
      });
    });

    it('should not clear notes when different SD is deleted', async () => {
      jest.useRealTimers();

      const mockNotes = [
        {
          id: 'note1',
          title: 'Test Note',
          sdId: 'my-sd',
          folderId: null,
          created: Date.now(),
          modified: Date.now(),
          deleted: false,
          pinned: false,
          contentPreview: 'Test content',
          contentText: 'Test content text',
        },
      ];

      mockElectronAPI.note.list.mockResolvedValue(mockNotes);
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        if (key === 'searchQuery') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      render(<NotesListPanel {...defaultProps} activeSdId="my-sd" selectedFolderId="all-notes" />);

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // Simulate a DIFFERENT SD being deleted
      sdUpdatedCallbacks.forEach((cb) => {
        cb({ operation: 'delete', sdId: 'other-sd' });
      });

      // Wait a bit and verify notes are still there
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByText('Test Note')).toBeInTheDocument();
    });
  });

  describe('Note Move Handling in All Notes view', () => {
    it('should keep note in list when moved to a folder while viewing All Notes', async () => {
      jest.useRealTimers();

      const mockFolders = [{ id: 'folder1', name: 'Projects', parentId: null, deleted: false }];

      const mockNotes = [
        {
          id: 'note1',
          title: 'Test Note',
          sdId: 'default',
          folderId: null, // Note starts in root
          created: Date.now(),
          modified: Date.now(),
          deleted: false,
          pinned: false,
          contentPreview: 'Test content',
          contentText: 'Test content text',
        },
      ];

      mockElectronAPI.note.list.mockResolvedValue(mockNotes);
      mockElectronAPI.folder.list.mockResolvedValue(mockFolders);
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        if (key === 'searchQuery') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

      // Wait for note to load
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // Simulate note being moved to a folder
      noteMovedCallbacks.forEach((cb) => {
        cb({ noteId: 'note1', oldFolderId: null, newFolderId: 'folder1' });
      });

      // Note should still be in the list (not removed)
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      unmount();
    });

    it('should update folder path display when note is moved to a folder', async () => {
      jest.useRealTimers();

      const mockFolders = [{ id: 'folder1', name: 'Projects', parentId: null, deleted: false }];

      const mockNotes = [
        {
          id: 'note1',
          title: 'Test Note',
          sdId: 'default',
          folderId: null, // Note starts in root (no folder)
          created: Date.now(),
          modified: Date.now(),
          deleted: false,
          pinned: false,
          contentPreview: 'Test content',
          contentText: 'Test content text',
        },
      ];

      mockElectronAPI.note.list.mockResolvedValue(mockNotes);
      mockElectronAPI.folder.list.mockResolvedValue(mockFolders);
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        if (key === 'searchQuery') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

      // Wait for note to load
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // Initially no folder path should be displayed
      expect(screen.queryByText('Projects')).not.toBeInTheDocument();

      // Simulate note being moved to the Projects folder
      noteMovedCallbacks.forEach((cb) => {
        cb({ noteId: 'note1', oldFolderId: null, newFolderId: 'folder1' });
      });

      // Folder path should now be displayed
      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });

      unmount();
    });

    it('should clear folder path when note is moved back to root', async () => {
      jest.useRealTimers();

      const mockFolders = [{ id: 'folder1', name: 'Projects', parentId: null, deleted: false }];

      const mockNotes = [
        {
          id: 'note1',
          title: 'Test Note',
          sdId: 'default',
          folderId: 'folder1', // Note starts in a folder
          created: Date.now(),
          modified: Date.now(),
          deleted: false,
          pinned: false,
          contentPreview: 'Test content',
          contentText: 'Test content text',
        },
      ];

      mockElectronAPI.note.list.mockResolvedValue(mockNotes);
      mockElectronAPI.folder.list.mockResolvedValue(mockFolders);
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        if (key === 'searchQuery') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

      // Wait for note to load with folder path
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });

      // Simulate note being moved back to root (null folderId, empty string in event)
      noteMovedCallbacks.forEach((cb) => {
        cb({ noteId: 'note1', oldFolderId: 'folder1', newFolderId: '' });
      });

      // Folder path should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Projects')).not.toBeInTheDocument();
      });

      unmount();
    });

    it('should update folder path when note is moved between folders', async () => {
      jest.useRealTimers();

      const mockFolders = [
        { id: 'folder1', name: 'Projects', parentId: null, deleted: false },
        { id: 'folder2', name: 'Archive', parentId: null, deleted: false },
      ];

      const mockNotes = [
        {
          id: 'note1',
          title: 'Test Note',
          sdId: 'default',
          folderId: 'folder1', // Note starts in Projects folder
          created: Date.now(),
          modified: Date.now(),
          deleted: false,
          pinned: false,
          contentPreview: 'Test content',
          contentText: 'Test content text',
        },
      ];

      mockElectronAPI.note.list.mockResolvedValue(mockNotes);
      mockElectronAPI.folder.list.mockResolvedValue(mockFolders);
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'selectedFolderId') return Promise.resolve('all-notes');
        if (key === 'searchQuery') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const { unmount } = render(<NotesListPanel {...defaultProps} selectedFolderId="all-notes" />);

      // Wait for note to load with initial folder path
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });

      // Simulate note being moved to Archive folder
      noteMovedCallbacks.forEach((cb) => {
        cb({ noteId: 'note1', oldFolderId: 'folder1', newFolderId: 'folder2' });
      });

      // Folder path should update to Archive
      await waitFor(() => {
        expect(screen.queryByText('Projects')).not.toBeInTheDocument();
        expect(screen.getByText('Archive')).toBeInTheDocument();
      });

      unmount();
    });

    it('should keep note in list when viewing all-notes:sdId variant', async () => {
      jest.useRealTimers();

      const mockFolders = [{ id: 'folder1', name: 'Projects', parentId: null, deleted: false }];

      const mockNotes = [
        {
          id: 'note1',
          title: 'Test Note',
          sdId: 'sd-123',
          folderId: null,
          created: Date.now(),
          modified: Date.now(),
          deleted: false,
          pinned: false,
          contentPreview: 'Test content',
          contentText: 'Test content text',
        },
      ];

      mockElectronAPI.note.list.mockResolvedValue(mockNotes);
      mockElectronAPI.folder.list.mockResolvedValue(mockFolders);
      mockElectronAPI.appState.get.mockImplementation((key: string) => {
        if (key === 'selectedFolderId') return Promise.resolve('all-notes:sd-123');
        if (key === 'searchQuery') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const { unmount } = render(
        <NotesListPanel {...defaultProps} activeSdId="sd-123" selectedFolderId="all-notes:sd-123" />
      );

      // Wait for note to load
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // Simulate note being moved to a folder
      noteMovedCallbacks.forEach((cb) => {
        cb({ noteId: 'note1', oldFolderId: null, newFolderId: 'folder1' });
      });

      // Note should still be in the list
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // And folder path should be displayed
      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });

      unmount();
    });
  });
});
