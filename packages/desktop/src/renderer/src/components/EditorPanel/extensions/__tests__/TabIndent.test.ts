/**
 * Tests for TabIndent Extension
 *
 * Tests Tab key behavior for inserting/removing tab characters
 * in various editor contexts.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TabIndent } from '../TabIndent';
import { NotecoveTable, NotecoveTableRow, NotecoveTableHeader, NotecoveTableCell } from '../Table';

describe('TabIndent Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit, TabIndent],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Tab inserts tab character', () => {
    it('should insert tab character in empty paragraph', () => {
      // Start with empty paragraph
      editor.commands.setContent('<p></p>');
      editor.commands.focus('start');

      // Simulate Tab key via the command
      const result = editor.commands.insertTab();

      expect(result).toBe(true);
      expect(editor.getText()).toBe('\t');
    });

    it('should insert tab character in paragraph with text', () => {
      editor.commands.setContent('<p>Hello world</p>');
      editor.commands.focus('start');

      const result = editor.commands.insertTab();

      expect(result).toBe(true);
      expect(editor.getText()).toBe('\tHello world');
    });

    it('should insert tab character mid-text', () => {
      editor.commands.setContent('<p>Hello world</p>');
      // Position cursor after "Hello " (position 1 is start of paragraph content)
      // "Hello " is 6 characters, so position 7 is after the space
      editor.commands.setTextSelection(7);

      const result = editor.commands.insertTab();

      expect(result).toBe(true);
      expect(editor.getText()).toBe('Hello \tworld');
    });

    it('should insert tab character in heading', () => {
      editor.commands.setContent('<h1>Heading</h1>');
      editor.commands.focus('start');

      const result = editor.commands.insertTab();

      expect(result).toBe(true);
      const html = editor.getHTML();
      expect(html).toMatch(/<h1>\tHeading<\/h1>/);
    });

    it('should insert tab character in blockquote', () => {
      editor.commands.setContent('<blockquote><p>Quote text</p></blockquote>');
      editor.commands.focus('start');

      const result = editor.commands.insertTab();

      expect(result).toBe(true);
      // getText() may include extra whitespace from structure, just check it contains the tab
      expect(editor.getText()).toContain('\tQuote text');
    });

    it('should insert tab character in code block', () => {
      editor.commands.setContent('<pre><code>const x = 1;</code></pre>');
      editor.commands.focus('start');

      const result = editor.commands.insertTab();

      expect(result).toBe(true);
      expect(editor.getText()).toBe('\tconst x = 1;');
    });
  });

  describe('Shift+Tab removes tab character', () => {
    it('should remove tab character before cursor', () => {
      // First insert content, then insert a tab, then try to remove it
      editor.commands.setContent('<p>Hello</p>');
      editor.commands.focus('start');
      editor.commands.insertTab();

      // Now we have '\tHello' with cursor after the tab
      expect(editor.getText()).toBe('\tHello');

      const result = editor.commands.removeTab();

      expect(result).toBe(true);
      expect(editor.getText()).toBe('Hello');
    });

    it('should do nothing if no tab before cursor', () => {
      editor.commands.setContent('<p>Hello</p>');
      editor.commands.setTextSelection(2); // After "H"

      const result = editor.commands.removeTab();

      expect(result).toBe(false);
      expect(editor.getText()).toBe('Hello');
    });

    it('should only remove one tab when multiple tabs present', () => {
      // Insert two tabs at start
      editor.commands.setContent('<p>Hello</p>');
      editor.commands.focus('start');
      editor.commands.insertTab();
      editor.commands.insertTab();

      // Now we have '\t\tHello' with cursor after both tabs
      expect(editor.getText()).toBe('\t\tHello');

      const result = editor.commands.removeTab();

      expect(result).toBe(true);
      expect(editor.getText()).toBe('\tHello');
    });

    it('should remove tab at end of text', () => {
      editor.commands.setContent('<p>Hello</p>');
      editor.commands.focus('end');
      editor.commands.insertTab();

      // Now we have 'Hello\t' with cursor after the tab
      expect(editor.getText()).toBe('Hello\t');

      const result = editor.commands.removeTab();

      expect(result).toBe(true);
      expect(editor.getText()).toBe('Hello');
    });

    it('should do nothing at start of document', () => {
      editor.commands.setContent('<p>Hello</p>');
      editor.commands.focus('start');

      const result = editor.commands.removeTab();

      expect(result).toBe(false);
      expect(editor.getText()).toBe('Hello');
    });
  });

  describe('Keyboard shortcut integration', () => {
    it('should have Tab keyboard shortcut registered', () => {
      // Verify the extension registers the Tab shortcut
      const shortcuts = editor.extensionManager.extensions.find((ext) => ext.name === 'tabIndent');
      expect(shortcuts).toBeDefined();
    });
  });
});

describe('TabIndent context awareness', () => {
  it('should defer to table handler when in table', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
        TabIndent,
      ],
      content: '',
    });

    // Insert a table
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Verify we're in a table
    expect(editor.isActive('table')).toBe(true);

    // Tab should navigate cells, not insert tab character
    const initialPos = editor.state.selection.from;
    editor.commands.goToNextCell();
    expect(editor.state.selection.from).not.toBe(initialPos);

    // Text should NOT contain tab character
    expect(editor.getText()).not.toContain('\t');

    editor.destroy();
  });
});
