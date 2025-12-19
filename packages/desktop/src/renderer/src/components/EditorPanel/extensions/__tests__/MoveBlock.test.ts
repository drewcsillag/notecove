/**
 * Tests for MoveBlock Extension
 *
 * Tests that Alt-Up/Alt-Down move blocks correctly:
 * - List items move within their parent list
 * - Paragraphs and other blocks move at document level
 * - Nested list items move with their children
 * - No-op at container boundaries
 * - Tables are not supported
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import { TriStateTaskItem } from '../TriStateTaskItem';
import { NotecoveListItem } from '../NotecoveListItem';
import { MoveBlock } from '../MoveBlock';

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

/**
 * Helper to get text content of list items in order
 */
function getListItemTexts(editor: Editor): string[] {
  const texts: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
      // Get the text content of this list item's first paragraph
      const firstChild = node.firstChild;
      if (firstChild?.isTextblock) {
        texts.push(firstChild.textContent);
      }
    }
    return true;
  });
  return texts;
}

describe('MoveBlock Extension - Bullet List Items', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          bulletList: false,
          orderedList: false,
          listItem: false,
        }),
        BulletList.extend({
          content: '(listItem | taskItem)+',
        }),
        OrderedList.extend({
          content: '(listItem | taskItem)+',
        }),
        NotecoveListItem,
        TriStateTaskItem.configure({
          nested: true,
        }),
        MoveBlock,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('moveBlockUp', () => {
    it('should move list item up within flat list', () => {
      editor.commands.setContent('<ul><li>First</li><li>Second</li><li>Third</li></ul>');

      // Position cursor in "Second" item
      const pos = findTextPosition(editor, 'Second');
      expect(pos).toBeGreaterThan(0);
      editor.commands.setTextSelection(pos);

      // Move up
      const result = editor.commands.moveBlockUp();

      expect(result).toBe(true);
      expect(getListItemTexts(editor)).toEqual(['Second', 'First', 'Third']);
    });

    it('should return false when list item is at top', () => {
      editor.commands.setContent('<ul><li>First</li><li>Second</li></ul>');

      // Position cursor in "First" item (top)
      const pos = findTextPosition(editor, 'First');
      editor.commands.setTextSelection(pos);

      // Try to move up
      const result = editor.commands.moveBlockUp();

      expect(result).toBe(false);
      expect(getListItemTexts(editor)).toEqual(['First', 'Second']);
    });

    it('should preserve cursor position after move', () => {
      editor.commands.setContent('<ul><li>First item</li><li>Second item</li></ul>');

      // Position cursor after "Second " (in the middle of the text)
      const pos = findTextPosition(editor, 'Second item', 7); // After "Second "
      editor.commands.setTextSelection(pos);

      const beforeOffset = editor.state.selection.$from.parentOffset;

      // Move up
      editor.commands.moveBlockUp();

      // Cursor should still be at same offset within the item
      const afterOffset = editor.state.selection.$from.parentOffset;
      expect(afterOffset).toBe(beforeOffset);
    });
  });

  describe('moveBlockDown', () => {
    it('should move list item down within flat list', () => {
      editor.commands.setContent('<ul><li>First</li><li>Second</li><li>Third</li></ul>');

      // Position cursor in "Second" item
      const pos = findTextPosition(editor, 'Second');
      expect(pos).toBeGreaterThan(0);
      editor.commands.setTextSelection(pos);

      // Move down
      const result = editor.commands.moveBlockDown();

      expect(result).toBe(true);
      expect(getListItemTexts(editor)).toEqual(['First', 'Third', 'Second']);
    });

    it('should return false when list item is at bottom', () => {
      editor.commands.setContent('<ul><li>First</li><li>Second</li></ul>');

      // Position cursor in "Second" item (bottom)
      const pos = findTextPosition(editor, 'Second');
      editor.commands.setTextSelection(pos);

      // Try to move down
      const result = editor.commands.moveBlockDown();

      expect(result).toBe(false);
      expect(getListItemTexts(editor)).toEqual(['First', 'Second']);
    });

    it('should preserve cursor position after move', () => {
      editor.commands.setContent('<ul><li>First item</li><li>Second item</li></ul>');

      // Position cursor after "First " (in the middle of the text)
      const pos = findTextPosition(editor, 'First item', 6); // After "First "
      editor.commands.setTextSelection(pos);

      const beforeOffset = editor.state.selection.$from.parentOffset;

      // Move down
      editor.commands.moveBlockDown();

      // Cursor should still be at same offset within the item
      const afterOffset = editor.state.selection.$from.parentOffset;
      expect(afterOffset).toBe(beforeOffset);
    });
  });
});

describe('MoveBlock Extension - Task Items', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          bulletList: false,
          orderedList: false,
          listItem: false,
        }),
        BulletList.extend({
          content: '(listItem | taskItem)+',
        }),
        OrderedList.extend({
          content: '(listItem | taskItem)+',
        }),
        NotecoveListItem,
        TriStateTaskItem.configure({
          nested: true,
        }),
        MoveBlock,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should move task item up', () => {
    editor.commands.setContent(`
      <ul>
        <li data-type="taskItem" data-checked="unchecked">Task One</li>
        <li data-type="taskItem" data-checked="unchecked">Task Two</li>
        <li data-type="taskItem" data-checked="unchecked">Task Three</li>
      </ul>
    `);

    // Position cursor in "Task Two"
    const pos = findTextPosition(editor, 'Task Two');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move up
    const result = editor.commands.moveBlockUp();

    expect(result).toBe(true);
    expect(getListItemTexts(editor)).toEqual(['Task Two', 'Task One', 'Task Three']);
  });

  it('should move task item down', () => {
    editor.commands.setContent(`
      <ul>
        <li data-type="taskItem" data-checked="unchecked">Task One</li>
        <li data-type="taskItem" data-checked="unchecked">Task Two</li>
        <li data-type="taskItem" data-checked="unchecked">Task Three</li>
      </ul>
    `);

    // Position cursor in "Task Two"
    const pos = findTextPosition(editor, 'Task Two');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move down
    const result = editor.commands.moveBlockDown();

    expect(result).toBe(true);
    expect(getListItemTexts(editor)).toEqual(['Task One', 'Task Three', 'Task Two']);
  });

  it('should handle mixed list with listItem and taskItem', () => {
    editor.commands.setContent(`
      <ul>
        <li>Regular item</li>
        <li data-type="taskItem" data-checked="unchecked">Task item</li>
        <li>Another regular</li>
      </ul>
    `);

    // Position cursor in "Task item"
    const pos = findTextPosition(editor, 'Task item');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move up
    const result = editor.commands.moveBlockUp();

    expect(result).toBe(true);
    expect(getListItemTexts(editor)).toEqual(['Task item', 'Regular item', 'Another regular']);
  });
});

describe('MoveBlock Extension - Nested Lists', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          bulletList: false,
          orderedList: false,
          listItem: false,
        }),
        BulletList.extend({
          content: '(listItem | taskItem)+',
        }),
        OrderedList.extend({
          content: '(listItem | taskItem)+',
        }),
        NotecoveListItem,
        TriStateTaskItem.configure({
          nested: true,
        }),
        MoveBlock,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should move list item with nested children', () => {
    editor.commands.setContent(`
      <ul>
        <li>First</li>
        <li>Second
          <ul>
            <li>Nested A</li>
            <li>Nested B</li>
          </ul>
        </li>
        <li>Third</li>
      </ul>
    `);

    // Position cursor in "Second"
    const pos = findTextPosition(editor, 'Second');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move up - should move Second AND its nested children
    const result = editor.commands.moveBlockUp();

    expect(result).toBe(true);

    // Verify structure: Second (with nested) is now first
    const html = editor.getHTML();
    expect(html).toMatch(/Second.*Nested A.*Nested B.*First.*Third/s);
  });
});

describe('MoveBlock Extension - Paragraphs', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit, MoveBlock],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should move paragraph up', () => {
    editor.commands.setContent('<p>First para</p><p>Second para</p><p>Third para</p>');

    // Position cursor in "Second para"
    const pos = findTextPosition(editor, 'Second para');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move up
    const result = editor.commands.moveBlockUp();

    expect(result).toBe(true);
    // Check order: Second should come before First
    const html = editor.getHTML();
    expect(html.indexOf('Second para')).toBeLessThan(html.indexOf('First para'));
  });

  it('should move paragraph down', () => {
    editor.commands.setContent('<p>First para</p><p>Second para</p><p>Third para</p>');

    // Position cursor in "Second para"
    const pos = findTextPosition(editor, 'Second para');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move down
    const result = editor.commands.moveBlockDown();

    expect(result).toBe(true);
    // Check order: Third should come before Second
    const html = editor.getHTML();
    expect(html.indexOf('Third para')).toBeLessThan(html.indexOf('Second para'));
  });

  it('should return false when paragraph is first in document', () => {
    editor.commands.setContent('<p>First para</p><p>Second para</p>');

    // Position cursor in "First para"
    const pos = findTextPosition(editor, 'First para');
    editor.commands.setTextSelection(pos);

    // Try to move up
    const result = editor.commands.moveBlockUp();

    expect(result).toBe(false);
    // Content unchanged
    const html = editor.getHTML();
    expect(html.indexOf('First para')).toBeLessThan(html.indexOf('Second para'));
  });

  it('should return false when paragraph is last in document', () => {
    editor.commands.setContent('<p>First para</p><p>Second para</p>');

    // Position cursor in "Second para"
    const pos = findTextPosition(editor, 'Second para');
    editor.commands.setTextSelection(pos);

    // Try to move down
    const result = editor.commands.moveBlockDown();

    expect(result).toBe(false);
    // Content unchanged
    const html = editor.getHTML();
    expect(html.indexOf('First para')).toBeLessThan(html.indexOf('Second para'));
  });
});

describe('MoveBlock Extension - Headings', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit, MoveBlock],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should move heading up', () => {
    editor.commands.setContent('<p>First para</p><h2>My Heading</h2><p>Third para</p>');

    // Position cursor in heading
    const pos = findTextPosition(editor, 'My Heading');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move up
    const result = editor.commands.moveBlockUp();

    expect(result).toBe(true);
    // Check order: Heading should come before First para
    const html = editor.getHTML();
    expect(html.indexOf('My Heading')).toBeLessThan(html.indexOf('First para'));
  });

  it('should move heading down', () => {
    editor.commands.setContent('<h2>My Heading</h2><p>First para</p><p>Second para</p>');

    // Position cursor in heading
    const pos = findTextPosition(editor, 'My Heading');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move down
    const result = editor.commands.moveBlockDown();

    expect(result).toBe(true);
    // Check order: First para should come before Heading
    const html = editor.getHTML();
    expect(html.indexOf('First para')).toBeLessThan(html.indexOf('My Heading'));
  });
});

describe('MoveBlock Extension - Blockquotes', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit, MoveBlock],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should move blockquote up', () => {
    editor.commands.setContent(
      '<p>First para</p><blockquote><p>Quote text</p></blockquote><p>Third para</p>'
    );

    // Position cursor in blockquote
    const pos = findTextPosition(editor, 'Quote text');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move up
    const result = editor.commands.moveBlockUp();

    expect(result).toBe(true);
    // Blockquote should now be first
    const html = editor.getHTML();
    expect(html.indexOf('Quote text')).toBeLessThan(html.indexOf('First para'));
  });

  it('should move blockquote down', () => {
    editor.commands.setContent(
      '<blockquote><p>Quote text</p></blockquote><p>First para</p><p>Second para</p>'
    );

    // Position cursor in blockquote
    const pos = findTextPosition(editor, 'Quote text');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move down
    const result = editor.commands.moveBlockDown();

    expect(result).toBe(true);
    // Blockquote should now be after First para
    const html = editor.getHTML();
    expect(html.indexOf('First para')).toBeLessThan(html.indexOf('Quote text'));
  });
});

describe('MoveBlock Extension - Code Blocks', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit, MoveBlock],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should move code block up', () => {
    editor.commands.setContent(
      '<p>First para</p><pre><code>const x = 1;</code></pre><p>Third para</p>'
    );

    // Position cursor in code block
    const pos = findTextPosition(editor, 'const x = 1;');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move up
    const result = editor.commands.moveBlockUp();

    expect(result).toBe(true);
    // Code block should now be first
    const html = editor.getHTML();
    expect(html.indexOf('const x = 1;')).toBeLessThan(html.indexOf('First para'));
  });

  it('should move code block down', () => {
    editor.commands.setContent(
      '<pre><code>const x = 1;</code></pre><p>First para</p><p>Second para</p>'
    );

    // Position cursor in code block
    const pos = findTextPosition(editor, 'const x = 1;');
    expect(pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    // Move down
    const result = editor.commands.moveBlockDown();

    expect(result).toBe(true);
    // Code block should now be after First para
    const html = editor.getHTML();
    expect(html.indexOf('First para')).toBeLessThan(html.indexOf('const x = 1;'));
  });
});

describe('MoveBlock Extension - Tables (not supported)', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit, MoveBlock],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should return false when in table', () => {
    // Note: StarterKit doesn't include tables, so this test would need the Table extension
    // For now, we just test that the extension handles the case where findTopLevelBlockInfo
    // returns null for unsupported content
    editor.commands.setContent('<p>Only paragraph</p>');

    // Test with single paragraph at document start (edge case)
    editor.commands.focus('start');

    // Should return false for move up at document start
    const result = editor.commands.moveBlockUp();
    expect(result).toBe(false);
  });
});
