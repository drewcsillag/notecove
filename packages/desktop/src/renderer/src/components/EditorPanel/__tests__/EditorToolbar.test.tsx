/**
 * EditorToolbar Tests
 *
 * Tests for the editor toolbar component, particularly the image button.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditorToolbar } from '../EditorToolbar';
import type { Editor } from '@tiptap/react';

// Mock editor with minimal implementation
function createMockEditor(overrides: Partial<Editor> = {}): Editor {
  const chainableMethods = {
    focus: jest.fn().mockReturnThis(),
    toggleBold: jest.fn().mockReturnThis(),
    toggleItalic: jest.fn().mockReturnThis(),
    toggleUnderline: jest.fn().mockReturnThis(),
    toggleStrike: jest.fn().mockReturnThis(),
    toggleCode: jest.fn().mockReturnThis(),
    toggleHeading: jest.fn().mockReturnThis(),
    toggleBulletList: jest.fn().mockReturnThis(),
    toggleOrderedList: jest.fn().mockReturnThis(),
    convertToTaskItem: jest.fn().mockReturnThis(),
    toggleBlockquote: jest.fn().mockReturnThis(),
    setHorizontalRule: jest.fn().mockReturnThis(),
    undo: jest.fn().mockReturnThis(),
    redo: jest.fn().mockReturnThis(),
    run: jest.fn(),
  };

  return {
    chain: jest.fn().mockReturnValue(chainableMethods),
    isActive: jest.fn().mockReturnValue(false),
    can: jest.fn().mockReturnValue({
      undo: jest.fn().mockReturnValue(true),
      redo: jest.fn().mockReturnValue(true),
    }),
    ...overrides,
  } as unknown as Editor;
}

describe('EditorToolbar', () => {
  describe('image button', () => {
    it('renders image button with correct tooltip', () => {
      const editor = createMockEditor();
      render(<EditorToolbar editor={editor} />);

      // Find by aria-label
      const imageButton = screen.getByRole('button', { name: /insert image/i });
      expect(imageButton).toBeInTheDocument();
    });

    it('calls onImageButtonClick when image button is clicked', () => {
      const editor = createMockEditor();
      const onImageButtonClick = jest.fn();
      render(<EditorToolbar editor={editor} onImageButtonClick={onImageButtonClick} />);

      const imageButton = screen.getByRole('button', { name: /insert image/i });
      fireEvent.click(imageButton);

      expect(onImageButtonClick).toHaveBeenCalled();
    });

    it('image button is positioned after horizontal rule', () => {
      const editor = createMockEditor();
      render(<EditorToolbar editor={editor} />);

      // Get all buttons
      const buttons = screen.getAllByRole('button');
      const buttonLabels = buttons.map((btn) => btn.getAttribute('aria-label') ?? btn.textContent);

      // Find positions
      const hrIndex = buttonLabels.findIndex((label) => label.includes('Horizontal'));
      const imageIndex = buttonLabels.findIndex((label) => label.includes('Insert image'));
      const undoIndex = buttonLabels.findIndex((label) => label.includes('Undo'));

      // Image should come after HR and before Undo
      expect(imageIndex).toBeGreaterThan(hrIndex);
      expect(imageIndex).toBeLessThan(undoIndex);
    });

    it('passes button element to onImageButtonClick for positioning', () => {
      const editor = createMockEditor();
      const onImageButtonClick = jest.fn();
      render(<EditorToolbar editor={editor} onImageButtonClick={onImageButtonClick} />);

      const imageButton = screen.getByRole('button', { name: /insert image/i });
      fireEvent.click(imageButton);

      // Callback should receive the button element
      expect(onImageButtonClick).toHaveBeenCalledWith(imageButton);
    });
  });

  describe('returns null when no editor', () => {
    it('renders nothing when editor is null', () => {
      const { container } = render(<EditorToolbar editor={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('code block button', () => {
    it('renders code block button with correct tooltip', () => {
      const editor = createMockEditor();
      render(<EditorToolbar editor={editor} />);

      const codeBlockButton = screen.getByRole('button', { name: /code block/i });
      expect(codeBlockButton).toBeInTheDocument();
    });

    it('toggles code block when clicked', () => {
      const chainableMethods = {
        focus: jest.fn().mockReturnThis(),
        toggleBold: jest.fn().mockReturnThis(),
        toggleItalic: jest.fn().mockReturnThis(),
        toggleUnderline: jest.fn().mockReturnThis(),
        toggleStrike: jest.fn().mockReturnThis(),
        toggleCode: jest.fn().mockReturnThis(),
        toggleCodeBlock: jest.fn().mockReturnThis(),
        toggleHeading: jest.fn().mockReturnThis(),
        toggleBulletList: jest.fn().mockReturnThis(),
        toggleOrderedList: jest.fn().mockReturnThis(),
        convertToTaskItem: jest.fn().mockReturnThis(),
        toggleBlockquote: jest.fn().mockReturnThis(),
        setHorizontalRule: jest.fn().mockReturnThis(),
        undo: jest.fn().mockReturnThis(),
        redo: jest.fn().mockReturnThis(),
        run: jest.fn(),
      };

      const editor = createMockEditor({
        chain: jest.fn().mockReturnValue(chainableMethods),
      });

      render(<EditorToolbar editor={editor} />);

      const codeBlockButton = screen.getByRole('button', { name: /code block/i });
      fireEvent.click(codeBlockButton);

      expect(chainableMethods.focus).toHaveBeenCalled();
      expect(chainableMethods.toggleCodeBlock).toHaveBeenCalled();
      expect(chainableMethods.run).toHaveBeenCalled();
    });

    it('highlights button when cursor is in code block', () => {
      const editor = createMockEditor({
        isActive: jest.fn((type: string) => type === 'codeBlock'),
      });

      render(<EditorToolbar editor={editor} />);

      const codeBlockButton = screen.getByRole('button', { name: /code block/i });
      // Button should have primary color when active
      expect(codeBlockButton).toHaveClass('MuiIconButton-colorPrimary');
    });

    it('code block button is positioned after blockquote', () => {
      const editor = createMockEditor();
      render(<EditorToolbar editor={editor} />);

      const buttons = screen.getAllByRole('button');
      const buttonLabels = buttons.map((btn) => btn.getAttribute('aria-label') ?? btn.textContent);

      // Find positions
      const blockquoteIndex = buttonLabels.findIndex((label) => label.includes('Blockquote'));
      const codeBlockIndex = buttonLabels.findIndex((label) => label.includes('Code block'));

      // Code block should come after blockquote
      expect(codeBlockIndex).toBeGreaterThan(blockquoteIndex);
    });
  });
});
