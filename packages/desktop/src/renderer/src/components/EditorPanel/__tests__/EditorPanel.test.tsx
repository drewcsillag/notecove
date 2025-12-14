/**
 * EditorPanel Component Tests
 */

import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditorPanel } from '../EditorPanel';

// Mock electronAPI
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    note: {
      updateTitle: jest.fn().mockResolvedValue(undefined),
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
  },
});

// Mock TipTap editor
jest.mock('../TipTapEditor', () => ({
  TipTapEditor: ({
    noteId,
    onTitleChange,
  }: {
    noteId: string | null;
    onTitleChange?: (title: string) => void;
  }) => {
    // Simulate title change on mount
    if (onTitleChange) {
      setTimeout(() => {
        onTitleChange('Test Note');
      }, 0);
    }
    return <div data-testid="tiptap-editor">TipTap Editor Mock (noteId: {noteId ?? 'none'})</div>;
  },
}));

describe('EditorPanel', () => {
  it('should render without crashing', async () => {
    const { container } = render(<EditorPanel selectedNoteId={null} />);
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should render TipTapEditor component with null noteId', async () => {
    const { getByTestId } = render(<EditorPanel selectedNoteId={null} />);
    await waitFor(() => {
      expect(getByTestId('tiptap-editor')).toBeInTheDocument();
      expect(getByTestId('tiptap-editor')).toHaveTextContent('noteId: none');
    });
  });

  it('should pass selectedNoteId prop to TipTapEditor', async () => {
    const { getByText } = render(<EditorPanel selectedNoteId="test-note-id" />);
    await waitFor(() => {
      expect(getByText(/noteId: test-note-id/)).toBeInTheDocument();
    });
  });
});
