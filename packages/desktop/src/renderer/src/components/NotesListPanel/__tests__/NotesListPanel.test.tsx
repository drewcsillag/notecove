/**
 * NotesListPanel Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotesListPanel } from '../NotesListPanel';

// Mock i18n
jest.mock('../../../i18n', () => ({}));

/* eslint-disable @typescript-eslint/no-empty-function */
// Mock window.electronAPI
const mockElectronAPI = {
  note: {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue('new-note-id'),
    search: jest.fn().mockResolvedValue([]),
    onCreated: jest.fn().mockReturnValue(() => {}),
    onDeleted: jest.fn().mockReturnValue(() => {}),
    onExternalUpdate: jest.fn().mockReturnValue(() => {}),
    onTitleUpdated: jest.fn().mockReturnValue(() => {}),
  },
  appState: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'searchQuery') return Promise.resolve(null);
      if (key === 'selectedFolder') return Promise.resolve(null);
      return Promise.resolve(null);
    }),
    set: jest.fn().mockResolvedValue(undefined),
  },
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('NotesListPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should show loading state initially', () => {
    const onNoteSelect = jest.fn();
    render(<NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} />);
    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
  });

  it('should show "No notes" when folder is empty', async () => {
    mockElectronAPI.note.list.mockResolvedValue([]);
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolder') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    render(<NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} />);

    await waitFor(() => {
      expect(screen.getByText('No notes in this folder')).toBeInTheDocument();
    });
  });

  it('should display notes list when notes are available', async () => {
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
      if (key === 'selectedFolder') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    render(<NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Notes (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.getByText('Test Note 2')).toBeInTheDocument();
    expect(screen.getByText('This is a test note preview')).toBeInTheDocument();
  });

  it('should show "Untitled Note" for notes without title', async () => {
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
      if (key === 'selectedFolder') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const onNoteSelect = jest.fn();
    render(<NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Untitled Note')).toBeInTheDocument();
    });
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
    render(<NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} />);

    // Advance timers to trigger the polling interval
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(mockElectronAPI.note.list).toHaveBeenCalledWith('default', folderId);
    });
  });

  it('should call note.list without folder ID for all-notes', async () => {
    mockElectronAPI.appState.get.mockImplementation((key: string) => {
      if (key === 'selectedFolder') return Promise.resolve('all-notes');
      if (key === 'searchQuery') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    mockElectronAPI.note.list.mockResolvedValue([]);

    const onNoteSelect = jest.fn();
    render(<NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} />);

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
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} />
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
      <NotesListPanel selectedNoteId={null} onNoteSelect={onNoteSelect} />
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
});
