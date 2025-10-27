/**
 * NotesListPanel Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotesListPanel } from '../NotesListPanel';

// Mock i18n
jest.mock('../../../i18n', () => ({}));

// Mock window.electronAPI
const mockElectronAPI = {
  note: {
    list: jest.fn().mockResolvedValue([]),
    onCreated: jest.fn().mockReturnValue(() => {}),
    onDeleted: jest.fn().mockReturnValue(() => {}),
    onExternalUpdate: jest.fn().mockReturnValue(() => {}),
  },
  appState: {
    get: jest.fn().mockResolvedValue(null),
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
    render(<NotesListPanel />);
    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
  });

  it('should show "No notes" when folder is empty', async () => {
    mockElectronAPI.note.list.mockResolvedValue([]);
    mockElectronAPI.appState.get.mockResolvedValue('all-notes');

    render(<NotesListPanel />);

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
    mockElectronAPI.appState.get.mockResolvedValue('all-notes');

    render(<NotesListPanel />);

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
    mockElectronAPI.appState.get.mockResolvedValue('all-notes');

    render(<NotesListPanel />);

    await waitFor(() => {
      expect(screen.getByText('Untitled Note')).toBeInTheDocument();
    });
  });

  it('should call note.list with folder ID when folder is selected', async () => {
    const folderId = 'folder123';
    mockElectronAPI.appState.get.mockResolvedValue(folderId);
    mockElectronAPI.note.list.mockResolvedValue([]);

    render(<NotesListPanel />);

    await waitFor(() => {
      expect(mockElectronAPI.note.list).toHaveBeenCalledWith('default', folderId);
    });
  });

  it('should call note.list without folder ID for all-notes', async () => {
    mockElectronAPI.appState.get.mockResolvedValue('all-notes');
    mockElectronAPI.note.list.mockResolvedValue([]);

    render(<NotesListPanel />);

    await waitFor(() => {
      expect(mockElectronAPI.note.list).toHaveBeenCalledWith('default');
    });
  });
});
