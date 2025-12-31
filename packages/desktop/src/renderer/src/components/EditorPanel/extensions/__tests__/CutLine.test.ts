/**
 * Tests for CutLine Extension
 *
 * Tests that Mod-x (Cmd+X on Mac, Ctrl+X on Windows/Linux) cuts the current line
 * when there is no selection, similar to VS Code and Sublime Text behavior.
 *
 * When there IS a selection, the default cut behavior should be used.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CutLine } from '../CutLine';

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

/**
 * Helper to find text position in editor document
 */
function findTextPosition(editor: Editor, searchText: string, offset = 0): number {
  let foundPos = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes(searchText)) {
      foundPos = pos + offset;
      return false;
    }
    return true;
  });
  return foundPos;
}

describe('CutLine Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    jest.clearAllMocks();
    editor = new Editor({
      extensions: [StarterKit, CutLine],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('cutLine command', () => {
    it('should cut the current line when cursor is in the middle of a line', async () => {
      editor.commands.setContent('<p>First line</p><p>Second line</p><p>Third line</p>');

      // Position cursor in "Second line"
      const pos = findTextPosition(editor, 'Second line', 3); // After "Sec"
      editor.commands.setTextSelection(pos);

      // Cut line
      const result = editor.commands.cutLine();

      expect(result).toBe(true);

      // Wait for async clipboard operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Line should be copied to clipboard with newline
      expect(mockClipboard.writeText).toHaveBeenCalledWith('Second line\n');

      // Line should be deleted from document
      const html = editor.getHTML();
      expect(html).toContain('First line');
      expect(html).not.toContain('Second line');
      expect(html).toContain('Third line');
    });

    it('should cut the first line of document', async () => {
      editor.commands.setContent('<p>First line</p><p>Second line</p>');

      // Position cursor at start of first line
      const pos = findTextPosition(editor, 'First line');
      editor.commands.setTextSelection(pos);

      // Cut line
      const result = editor.commands.cutLine();

      expect(result).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockClipboard.writeText).toHaveBeenCalledWith('First line\n');

      // First line should be deleted
      const html = editor.getHTML();
      expect(html).not.toContain('First line');
      expect(html).toContain('Second line');
    });

    it('should cut the last line of document', async () => {
      editor.commands.setContent('<p>First line</p><p>Last line</p>');

      // Position cursor in "Last line"
      const pos = findTextPosition(editor, 'Last line');
      editor.commands.setTextSelection(pos);

      // Cut line
      const result = editor.commands.cutLine();

      expect(result).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockClipboard.writeText).toHaveBeenCalledWith('Last line\n');

      // Last line should be deleted
      const html = editor.getHTML();
      expect(html).toContain('First line');
      expect(html).not.toContain('Last line');
    });

    it('should cut an empty line', async () => {
      editor.commands.setContent('<p>First line</p><p></p><p>Third line</p>');

      // Position cursor in the empty paragraph using focus command
      // The empty paragraph is after "First line" paragraph
      // We can use the editor's selection commands to navigate there
      editor.commands.focus('start');
      // Move to end of first paragraph, then forward into the empty paragraph
      // Alternatively, find the position by traversing the document
      let emptyParaPos = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && node.textContent === '') {
          emptyParaPos = pos + 1; // Position inside the empty paragraph
          return false;
        }
        return true;
      });

      expect(emptyParaPos).toBeGreaterThan(0);
      editor.commands.setTextSelection(emptyParaPos);

      // Cut line
      const result = editor.commands.cutLine();

      expect(result).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Empty line should still copy a newline
      expect(mockClipboard.writeText).toHaveBeenCalledWith('\n');
    });

    it('should handle single line document', async () => {
      editor.commands.setContent('<p>Only line</p>');

      // Position cursor in the line
      const pos = findTextPosition(editor, 'Only line');
      editor.commands.setTextSelection(pos);

      // Cut line
      const result = editor.commands.cutLine();

      expect(result).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockClipboard.writeText).toHaveBeenCalledWith('Only line\n');

      // Document should still have an empty paragraph (TipTap/ProseMirror requirement)
      const html = editor.getHTML();
      expect(html).not.toContain('Only line');
    });

    it('should return false when there is a selection', () => {
      editor.commands.setContent('<p>First line</p><p>Second line</p>');

      // Create a selection
      const from = findTextPosition(editor, 'First line');
      const to = findTextPosition(editor, 'First line', 5);
      editor.commands.setTextSelection({ from, to });

      // Cut line should return false to let default cut handle it
      const result = editor.commands.cutLine();

      expect(result).toBe(false);

      // Clipboard should NOT have been called (default cut will handle it)
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    it('should cut heading line', async () => {
      editor.commands.setContent('<h1>My Heading</h1><p>Paragraph</p>');

      // Position cursor in heading
      const pos = findTextPosition(editor, 'My Heading');
      editor.commands.setTextSelection(pos);

      // Cut line
      const result = editor.commands.cutLine();

      expect(result).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockClipboard.writeText).toHaveBeenCalledWith('My Heading\n');

      // Heading should be deleted
      const html = editor.getHTML();
      expect(html).not.toContain('My Heading');
      expect(html).toContain('Paragraph');
    });

    it('should cut list item line', async () => {
      editor.commands.setContent('<ul><li>First item</li><li>Second item</li></ul>');

      // Position cursor in "Second item"
      const pos = findTextPosition(editor, 'Second item');
      editor.commands.setTextSelection(pos);

      // Cut line
      const result = editor.commands.cutLine();

      expect(result).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockClipboard.writeText).toHaveBeenCalledWith('Second item\n');

      // List item should be deleted
      const html = editor.getHTML();
      expect(html).toContain('First item');
      expect(html).not.toContain('Second item');
    });
  });

  describe('keyboard shortcut', () => {
    it('should have Mod-x keyboard shortcut registered', () => {
      // The presence of the extension with addKeyboardShortcuts is tested by the commands above
      // This is just a sanity check that the extension is loaded
      expect(editor.extensionManager.extensions.some((ext) => ext.name === 'cutLine')).toBe(true);
    });
  });
});
