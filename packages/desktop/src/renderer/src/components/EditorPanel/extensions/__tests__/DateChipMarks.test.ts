/**
 * DateChip Marks Integration Tests
 *
 * Tests that date chips (decorations) work correctly when text has marks applied
 * (bold, italic, underline, strikethrough).
 *
 * Key behavior: Date chips are decorations, not nodes. The underlying text can have
 * any marks applied, and decorations render on top. We verify that:
 * 1. Marks can be applied to date text
 * 2. DateChip decorations are still created for marked date text
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DateChip } from '../DateChip';

/**
 * Helper to find the DateChip plugin and get its decoration state
 */
function getDateChipDecorations(editor: Editor) {
  // Find the dateChip plugin by checking the key
  const plugin = editor.state.plugins.find((p) => {
    const key = (p as unknown as { key: string | { key: string } }).key;
    if (typeof key === 'string') {
      return key.includes('dateChip');
    }
    // key is { key: string } in this branch
    return key.key.includes('dateChip');
  });

  if (!plugin) {
    return null;
  }

  const state = plugin.getState(editor.state);
  if (!state) return [];

  // DecorationSet.find() returns an array of decorations
  return state.find();
}

/**
 * Helper to check if a mark type exists on any text node
 */
function hasMarkInDocument(editor: Editor, markName: string): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === markName)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

describe('DateChip with text marks', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit.configure({ undoRedo: false }), DateChip.configure({})],
      content: '<p>Meeting on 2025-01-15</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('decoration creation with marked text', () => {
    it('should create decoration for date text with bold mark', () => {
      editor.commands.setContent('<p>Meeting on <strong>2025-01-15</strong></p>');

      // Verify bold mark exists in document
      expect(hasMarkInDocument(editor, 'bold')).toBe(true);

      // Verify decoration is still created
      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBeGreaterThan(0);
    });

    it('should create decoration for date text with italic mark', () => {
      editor.commands.setContent('<p>Meeting on <em>2025-01-15</em></p>');

      expect(hasMarkInDocument(editor, 'italic')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBeGreaterThan(0);
    });

    it('should create decoration for date text with strike mark', () => {
      editor.commands.setContent('<p>Meeting on <s>2025-01-15</s></p>');

      expect(hasMarkInDocument(editor, 'strike')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBeGreaterThan(0);
    });

    it('should create decoration for date text with multiple marks', () => {
      editor.commands.setContent('<p>Meeting on <strong><em>2025-01-15</em></strong></p>');

      expect(hasMarkInDocument(editor, 'bold')).toBe(true);
      expect(hasMarkInDocument(editor, 'italic')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBeGreaterThan(0);
    });
  });

  describe('applying marks via commands', () => {
    it('should apply bold mark to date text and keep decoration', () => {
      // Start with plain date
      editor.commands.setContent('<p>Meeting on 2025-01-15</p>');

      // Verify decoration exists initially
      let decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBe(1);

      // Select the date text (find position dynamically)
      let dateStart = 0;
      let dateEnd = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('2025-01-15')) {
          const idx = node.text.indexOf('2025-01-15');
          dateStart = pos + idx;
          dateEnd = dateStart + 10;
          return false;
        }
        return true;
      });

      editor.commands.setTextSelection({ from: dateStart, to: dateEnd });
      editor.commands.toggleBold();

      // Verify bold was applied
      expect(hasMarkInDocument(editor, 'bold')).toBe(true);

      // Verify decoration still exists
      decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBe(1);
    });

    it('should apply italic mark to date text and keep decoration', () => {
      editor.commands.setContent('<p>Meeting on 2025-01-15</p>');

      let dateStart = 0;
      let dateEnd = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('2025-01-15')) {
          const idx = node.text.indexOf('2025-01-15');
          dateStart = pos + idx;
          dateEnd = dateStart + 10;
          return false;
        }
        return true;
      });

      editor.commands.setTextSelection({ from: dateStart, to: dateEnd });
      editor.commands.toggleItalic();

      expect(hasMarkInDocument(editor, 'italic')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBe(1);
    });

    it('should apply strike mark to date text and keep decoration', () => {
      editor.commands.setContent('<p>Meeting on 2025-01-15</p>');

      let dateStart = 0;
      let dateEnd = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('2025-01-15')) {
          const idx = node.text.indexOf('2025-01-15');
          dateStart = pos + idx;
          dateEnd = dateStart + 10;
          return false;
        }
        return true;
      });

      editor.commands.setTextSelection({ from: dateStart, to: dateEnd });
      editor.commands.toggleStrike();

      expect(hasMarkInDocument(editor, 'strike')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBe(1);
    });
  });

  describe('marks on chips in different contexts', () => {
    it('should work with bold date in a list item', () => {
      editor.commands.setContent('<ul><li><p>Task due <strong>2025-01-15</strong></p></li></ul>');

      expect(hasMarkInDocument(editor, 'bold')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBe(1);
    });

    it('should work with italic date in a heading', () => {
      editor.commands.setContent('<h2>Meeting on <em>2025-01-15</em></h2>');

      expect(hasMarkInDocument(editor, 'italic')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBe(1);
    });

    it('should work with bold+italic date in a blockquote', () => {
      editor.commands.setContent(
        '<blockquote><p>As of <strong><em>2025-01-15</em></strong></p></blockquote>'
      );

      expect(hasMarkInDocument(editor, 'bold')).toBe(true);
      expect(hasMarkInDocument(editor, 'italic')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBe(1);
    });

    it('should work with multiple marked dates in same paragraph', () => {
      editor.commands.setContent('<p>From <strong>2025-01-15</strong> to <em>2025-01-20</em></p>');

      expect(hasMarkInDocument(editor, 'bold')).toBe(true);
      expect(hasMarkInDocument(editor, 'italic')).toBe(true);

      const decorations = getDateChipDecorations(editor);
      expect(decorations?.length).toBe(2);
    });
  });
});
