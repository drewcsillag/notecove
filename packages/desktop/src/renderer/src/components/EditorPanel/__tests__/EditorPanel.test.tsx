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
    appState: {
      get: jest.fn().mockResolvedValue('test-note-id'),
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
    const { container } = render(<EditorPanel />);
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should render TipTapEditor component after loading', async () => {
    const { getByTestId } = render(<EditorPanel />);
    await waitFor(() => {
      expect(getByTestId('tiptap-editor')).toBeInTheDocument();
    });
  });

  it('should pass loaded noteId to TipTapEditor', async () => {
    const { getByText } = render(<EditorPanel />);
    await waitFor(() => {
      expect(getByText(/noteId: test-note-id/)).toBeInTheDocument();
    });
  });
});
