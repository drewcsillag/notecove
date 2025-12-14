/**
 * CommentPanel Component Tests
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommentPanel } from '../CommentPanel';

// Mock electronAPI
const mockGetThreads = jest.fn();
const mockUpdateThread = jest.fn();
const mockDeleteThread = jest.fn();
const mockAddReply = jest.fn();
const mockOnThreadAdded = jest.fn(() => jest.fn());
const mockOnThreadUpdated = jest.fn(() => jest.fn());
const mockOnThreadDeleted = jest.fn(() => jest.fn());

Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    comment: {
      getThreads: mockGetThreads,
      updateThread: mockUpdateThread,
      deleteThread: mockDeleteThread,
      addReply: mockAddReply,
      onThreadAdded: mockOnThreadAdded,
      onThreadUpdated: mockOnThreadUpdated,
      onThreadDeleted: mockOnThreadDeleted,
    },
  },
});

describe('CommentPanel', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetThreads.mockResolvedValue([]);
  });

  it('should render empty state when no noteId is provided', async () => {
    render(<CommentPanel noteId={null} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Select a note to view comments')).toBeInTheDocument();
    });
  });

  it('should render header with close button', async () => {
    render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Comments')).toBeInTheDocument();
    });

    // Find and click the close button
    const closeButton = screen.getByTitle('Close comments');
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should render empty state when no threads exist', async () => {
    mockGetThreads.mockResolvedValue([]);

    render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(
        screen.getByText('No comments yet. Select text and use Cmd+Shift+M to add a comment.')
      ).toBeInTheDocument();
    });
  });

  it('should display threads when they exist', async () => {
    const mockThreads = [
      {
        id: 'thread-1',
        noteId: 'test-note',
        authorName: 'Test User',
        authorHandle: '@testuser',
        content: 'This is a test comment',
        originalText: 'Some quoted text',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      },
    ];
    mockGetThreads.mockResolvedValue(mockThreads);

    render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      expect(screen.getByText(/Some quoted text/)).toBeInTheDocument();
    });
  });

  it('should show resolved threads count when they exist', async () => {
    const mockThreads = [
      {
        id: 'thread-1',
        noteId: 'test-note',
        authorName: 'User 1',
        content: 'Open comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      },
      {
        id: 'thread-2',
        noteId: 'test-note',
        authorName: 'User 2',
        content: 'Resolved comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: true,
        resolvedBy: 'user-1',
        resolvedAt: Date.now(),
      },
    ];
    mockGetThreads.mockResolvedValue(mockThreads);

    render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/1 resolved/)).toBeInTheDocument();
    });
  });

  it('should call onThreadSelect when a thread is clicked', async () => {
    const mockOnThreadSelect = jest.fn();
    const mockThreads = [
      {
        id: 'thread-1',
        noteId: 'test-note',
        authorName: 'Test User',
        content: 'Test comment',
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      },
    ];
    mockGetThreads.mockResolvedValue(mockThreads);

    render(
      <CommentPanel noteId="test-note" onClose={mockOnClose} onThreadSelect={mockOnThreadSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    // Click on the thread (the Paper element containing the thread)
    const threadElement = screen.getByText('Test User').closest('[class*="MuiPaper-root"]');
    if (threadElement) {
      fireEvent.click(threadElement);
      expect(mockOnThreadSelect).toHaveBeenCalledWith('thread-1');
    }
  });
});
