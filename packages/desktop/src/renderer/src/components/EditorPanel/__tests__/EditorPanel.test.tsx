/**
 * EditorPanel Component Tests
 */

import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditorPanel } from '../EditorPanel';

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
  it('should render without crashing', () => {
    const { container } = render(<EditorPanel />);
    expect(container).toBeInTheDocument();
  });

  it('should render TipTapEditor component', () => {
    const { getByTestId } = render(<EditorPanel />);
    expect(getByTestId('tiptap-editor')).toBeInTheDocument();
  });

  it('should pass null noteId initially', () => {
    const { getByText } = render(<EditorPanel />);
    expect(getByText(/noteId: none/)).toBeInTheDocument();
  });
});
