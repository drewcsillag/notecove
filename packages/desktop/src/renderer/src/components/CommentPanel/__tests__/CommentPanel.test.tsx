/**
 * CommentPanel Component Tests
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommentPanel } from '../CommentPanel';

// Mock electronAPI
const mockGetThreads = jest.fn();
const mockGetReplies = jest.fn();
const mockGetReactions = jest.fn();
const mockUpdateThread = jest.fn();
const mockDeleteThread = jest.fn();
const mockAddReply = jest.fn();
const mockAddReaction = jest.fn();
const mockRemoveReaction = jest.fn();
const mockOnThreadAdded = jest.fn(() => jest.fn());
const mockOnThreadUpdated = jest.fn(() => jest.fn());
const mockOnThreadDeleted = jest.fn(() => jest.fn());
const mockOnReplyAdded = jest.fn(() => jest.fn());
const mockOnReplyUpdated = jest.fn(() => jest.fn());
const mockOnReplyDeleted = jest.fn(() => jest.fn());
const mockOnReactionAdded = jest.fn(() => jest.fn());
const mockOnReactionRemoved = jest.fn(() => jest.fn());

Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    comment: {
      getThreads: mockGetThreads,
      getReplies: mockGetReplies,
      getReactions: mockGetReactions,
      updateThread: mockUpdateThread,
      deleteThread: mockDeleteThread,
      addReply: mockAddReply,
      addReaction: mockAddReaction,
      removeReaction: mockRemoveReaction,
      onThreadAdded: mockOnThreadAdded,
      onThreadUpdated: mockOnThreadUpdated,
      onThreadDeleted: mockOnThreadDeleted,
      onReplyAdded: mockOnReplyAdded,
      onReplyUpdated: mockOnReplyUpdated,
      onReplyDeleted: mockOnReplyDeleted,
      onReactionAdded: mockOnReactionAdded,
      onReactionRemoved: mockOnReactionRemoved,
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
  },
});

describe('CommentPanel', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetThreads.mockResolvedValue([]);
    mockGetReplies.mockResolvedValue([]);
    mockGetReactions.mockResolvedValue([]);
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
        screen.getByText('No comments yet. Select text and click the comment button or press ⌘⌥M.')
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

  describe('Edit functionality', () => {
    it('should show edit button only for own comments', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          noteId: 'test-note',
          authorId: 'test-profile-id', // Current user's comment
          authorName: 'You',
          content: 'My comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
        {
          id: 'thread-2',
          noteId: 'test-note',
          authorId: 'other-user', // Someone else's comment
          authorName: 'Other User',
          content: 'Their comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
      ];
      mockGetThreads.mockResolvedValue(mockThreads);

      render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('My comment')).toBeInTheDocument();
        expect(screen.getByText('Their comment')).toBeInTheDocument();
      });

      // Should show edit button for own comment
      const editButtons = screen.getAllByTitle('Edit comment');
      expect(editButtons).toHaveLength(1);
    });

    it('should enter edit mode when edit button is clicked', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          noteId: 'test-note',
          authorId: 'test-profile-id',
          authorName: 'You',
          content: 'Original comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
      ];
      mockGetThreads.mockResolvedValue(mockThreads);

      render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Original comment')).toBeInTheDocument();
      });

      // Click edit button
      const editButton = screen.getByTitle('Edit comment');
      fireEvent.click(editButton);

      // Should show edit form with textarea
      await waitFor(() => {
        expect(screen.getByDisplayValue('Original comment')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('should save edited comment when Save is clicked', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          noteId: 'test-note',
          authorId: 'test-profile-id',
          authorName: 'You',
          content: 'Original comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
      ];
      mockGetThreads.mockResolvedValue(mockThreads);
      mockUpdateThread.mockResolvedValue(undefined);

      render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Original comment')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByTitle('Edit comment'));

      // Edit the comment
      const textarea = screen.getByDisplayValue('Original comment');
      fireEvent.change(textarea, { target: { value: 'Updated comment' } });

      // Click save
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockUpdateThread).toHaveBeenCalledWith('test-note', 'thread-1', {
          content: 'Updated comment',
        });
      });
    });
  });

  describe('Delete functionality', () => {
    it('should show delete button only for own comments', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          noteId: 'test-note',
          authorId: 'test-profile-id',
          authorName: 'You',
          content: 'My comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
        {
          id: 'thread-2',
          noteId: 'test-note',
          authorId: 'other-user',
          authorName: 'Other User',
          content: 'Their comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
      ];
      mockGetThreads.mockResolvedValue(mockThreads);

      render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('My comment')).toBeInTheDocument();
        expect(screen.getByText('Their comment')).toBeInTheDocument();
      });

      // Should show only one delete button (for own comment)
      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons).toHaveLength(1);
    });

    it('should show confirmation dialog when delete is clicked', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          noteId: 'test-note',
          authorId: 'test-profile-id',
          authorName: 'You',
          content: 'My comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
      ];
      mockGetThreads.mockResolvedValue(mockThreads);

      render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('My comment')).toBeInTheDocument();
      });

      // Click delete button
      fireEvent.click(screen.getByText('Delete'));

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText('Delete Comment')).toBeInTheDocument();
        expect(
          screen.getByText(
            'Are you sure you want to delete this comment? This action cannot be undone.'
          )
        ).toBeInTheDocument();
      });
    });

    it('should delete comment when confirmed', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          noteId: 'test-note',
          authorId: 'test-profile-id',
          authorName: 'You',
          content: 'My comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
      ];
      mockGetThreads.mockResolvedValue(mockThreads);
      mockDeleteThread.mockResolvedValue(undefined);

      render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('My comment')).toBeInTheDocument();
      });

      // Click delete button
      fireEvent.click(screen.getByText('Delete'));

      // Wait for dialog and confirm
      await waitFor(() => {
        expect(screen.getByText('Delete Comment')).toBeInTheDocument();
      });

      // Find and click the Confirm button (not the Delete button on the thread)
      // There are now two Delete buttons - one in thread, one in dialog
      // Get the one in the dialog (it's inside DialogActions)
      const dialogButtons = screen.getAllByText('Delete');
      const confirmDeleteButton = dialogButtons.find((btn) =>
        btn.closest('[class*="MuiDialogActions"]')
      );
      if (confirmDeleteButton) {
        fireEvent.click(confirmDeleteButton);
      }

      await waitFor(() => {
        expect(mockDeleteThread).toHaveBeenCalledWith('test-note', 'thread-1');
      });
    });

    it('should cancel delete when Cancel is clicked', async () => {
      const mockThreads = [
        {
          id: 'thread-1',
          noteId: 'test-note',
          authorId: 'test-profile-id',
          authorName: 'You',
          content: 'My comment',
          created: Date.now(),
          modified: Date.now(),
          resolved: false,
        },
      ];
      mockGetThreads.mockResolvedValue(mockThreads);

      render(<CommentPanel noteId="test-note" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('My comment')).toBeInTheDocument();
      });

      // Click delete button
      fireEvent.click(screen.getByText('Delete'));

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByText('Delete Comment')).toBeInTheDocument();
      });

      // Click Cancel
      fireEvent.click(screen.getByText('Cancel'));

      // Dialog should close, deleteThread should not be called
      await waitFor(() => {
        expect(screen.queryByText('Delete Comment')).not.toBeInTheDocument();
      });
      expect(mockDeleteThread).not.toHaveBeenCalled();
    });
  });
});
