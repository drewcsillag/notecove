/**
 * Note Info Window Tests
 *
 * Tests for the standalone Note Info window component that displays
 * comprehensive information about a note.
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NoteInfoWindow } from '../NoteInfoWindow';

// Mock note info data
const mockNoteInfo = {
  id: 'note-123',
  title: 'Test Note Title',
  sdId: 'sd-456',
  sdName: 'My Storage',
  sdPath: '/path/to/storage',
  folderId: 'folder-789',
  folderName: 'Work Documents',
  folderPath: 'Projects / Work Documents',
  fullFolderPath: 'My Storage / Projects / Work Documents',
  created: 1700000000000,
  modified: 1700100000000,
  tags: ['tag1', 'tag2'],
  characterCount: 1500,
  wordCount: 250,
  paragraphCount: 10,
  vectorClock: {
    'instance-1': { sequence: 5, offset: 100, file: 'log1.crdt' },
    'instance-2': { sequence: 3, offset: 50, file: 'log2.crdt' },
  },
  documentHash: 'abc123def456',
  crdtUpdateCount: 8,
  noteDirPath: '/path/to/storage/notes/note-123',
  totalFileSize: 50000,
  snapshotCount: 2,
  deleted: false,
  pinned: true,
  contentPreview: 'This is a preview of the note content...',
};

// Mock window.electronAPI
const mockGetInfo = jest.fn();

// Set up global mocks before tests
beforeAll(() => {
  Object.defineProperty(window, 'electronAPI', {
    value: {
      note: {
        getInfo: mockGetInfo,
      },
    },
    writable: true,
  });
});

describe('NoteInfoWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInfo.mockResolvedValue(mockNoteInfo);
  });

  it('should render all info sections inline without accordion', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      // All sections should be visible without needing to expand anything
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Timestamps')).toBeInTheDocument();
      expect(screen.getByText('Document Statistics')).toBeInTheDocument();
      expect(screen.getByText('Advanced Information')).toBeInTheDocument();
    });

    // Accordion expand icon should NOT be present
    expect(screen.queryByTestId('ExpandMoreIcon')).not.toBeInTheDocument();
  });

  it('should show full folder path with SD name prefix', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('My Storage / Projects / Work Documents')).toBeInTheDocument();
    });
  });

  it('should not render Pack Count row', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('Test Note Title')).toBeInTheDocument();
    });

    // Pack Count should NOT be present
    expect(screen.queryByText('Pack Count')).not.toBeInTheDocument();
  });

  it('should show CRDT Update Count', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('CRDT Update Count')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('should display note title', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('Test Note Title')).toBeInTheDocument();
    });
  });

  it('should display note ID with copy button', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('note-123')).toBeInTheDocument();
    });
  });

  it('should display storage directory name and path', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('My Storage')).toBeInTheDocument();
      expect(screen.getByText('/path/to/storage')).toBeInTheDocument();
    });
  });

  it('should display tags as chips', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
    });
  });

  it('should display timestamps', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Last Modified')).toBeInTheDocument();
    });
  });

  it('should display document statistics', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('Characters')).toBeInTheDocument();
      expect(screen.getByText('1,500')).toBeInTheDocument();
      expect(screen.getByText('Words')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('Paragraphs')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('should display vector clock information', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('Vector Clock')).toBeInTheDocument();
      expect(screen.getByText('instance-1')).toBeInTheDocument();
      expect(screen.getByText('instance-2')).toBeInTheDocument();
    });
  });

  it('should display status chips for pinned note', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('Pinned')).toBeInTheDocument();
    });
  });

  it('should show loading state while fetching data', () => {
    mockGetInfo.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => new Promise(() => {}) // Never resolves
    );

    render(<NoteInfoWindow noteId="note-123" />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should show error message when note not found', async () => {
    mockGetInfo.mockResolvedValue(null);

    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(screen.getByText('Note not found')).toBeInTheDocument();
    });
  });

  it('should call getInfo with the provided noteId', async () => {
    render(<NoteInfoWindow noteId="note-123" />);

    await waitFor(() => {
      expect(mockGetInfo).toHaveBeenCalledWith('note-123');
    });
  });
});
