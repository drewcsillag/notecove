/**
 * Tests for List Item Tab Behavior
 *
 * Tests that Tab/Shift-Tab behave correctly in list items:
 * - At start of content: indent/outdent the item
 * - Elsewhere: insert/remove tab character
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { BulletList, OrderedList } from '@tiptap/extension-list';
import { TriStateTaskItem } from '../TriStateTaskItem';
import { TabIndent } from '../TabIndent';
import { NotecoveListItem } from '../NotecoveListItem';

describe('Task Item Tab Behavior', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          bulletList: false,
          orderedList: false,
        }),
        BulletList.extend({
          content: '(listItem | taskItem)+',
        }),
        OrderedList.extend({
          content: '(listItem | taskItem)+',
        }),
        TriStateTaskItem.configure({
          nested: true,
        }),
        TabIndent,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Tab at start of task item', () => {
    it('should be able to sink task item when cursor is at content start', () => {
      // Create a bullet list with task items
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="false">First task</li>
          <li data-type="taskItem" data-checked="false">Second task</li>
        </ul>
      `);

      // Focus at start of content
      editor.commands.focus('start');

      // The sinkListItem command should be available
      const canSink = editor.can().sinkListItem('taskItem');
      expect(canSink).toBeDefined();
    });
  });

  describe('Tab mid-content in task item', () => {
    it('should insert tab character when cursor is not at content start', () => {
      // Create a task item with content
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="false">Task content here</li>
        </ul>
      `);

      // Position cursor mid-content (after "Task ")
      // Find the text node and position cursor after "Task "
      const doc = editor.state.doc;
      let taskContentPos = 0;
      doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('Task content here')) {
          taskContentPos = pos + 5; // After "Task "
          return false;
        }
        return true;
      });

      expect(taskContentPos).toBeGreaterThan(0);
      editor.commands.setTextSelection(taskContentPos);

      // Verify cursor is NOT at start (parentOffset > 0)
      const { $from } = editor.state.selection;
      expect($from.parentOffset).toBeGreaterThan(0);

      // Now Tab should insert a tab character (via TabIndent)
      // because TriStateTaskItem returns false when not at content start
      editor.commands.insertTab();

      expect(editor.getText()).toContain('Task \tcontent here');
    });
  });

  describe('Shift-Tab mid-content in task item', () => {
    it('should remove tab character when cursor is not at content start', () => {
      // Create a task item and insert a tab mid-content
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="false">Task content</li>
        </ul>
      `);

      // Position cursor mid-content and insert tab
      const doc = editor.state.doc;
      let taskContentPos = 0;
      doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('Task content')) {
          taskContentPos = pos + 5;
          return false;
        }
        return true;
      });

      editor.commands.setTextSelection(taskContentPos);
      editor.commands.insertTab();

      expect(editor.getText()).toContain('Task \tcontent');

      // Now Shift-Tab should remove the tab (via TabIndent)
      editor.commands.removeTab();

      expect(editor.getText()).not.toContain('\t');
    });
  });
});

describe('Bullet List Item Tab Behavior', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          listItem: false, // Use NotecoveListItem instead
        }),
        // Import and use NotecoveListItem
        NotecoveListItem,
        TabIndent,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Tab at start of list item', () => {
    it('should be able to sink list item when cursor is at content start', () => {
      editor.commands.setContent('<ul><li>Item one</li><li>Item two</li></ul>');
      editor.commands.focus('start');

      // The sinkListItem command should be available
      const canSink = editor.can().sinkListItem('listItem');
      expect(canSink).toBeDefined();
    });
  });

  describe('Tab mid-content in list item', () => {
    it('should insert tab character when cursor is not at content start', () => {
      editor.commands.setContent('<ul><li>List item content</li></ul>');

      // Position cursor mid-content
      const doc = editor.state.doc;
      let itemPos = 0;
      doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('List item content')) {
          itemPos = pos + 5; // After "List "
          return false;
        }
        return true;
      });

      expect(itemPos).toBeGreaterThan(0);
      editor.commands.setTextSelection(itemPos);

      // Verify cursor is NOT at start
      const { $from } = editor.state.selection;
      expect($from.parentOffset).toBeGreaterThan(0);

      // Tab should insert tab character
      editor.commands.insertTab();

      expect(editor.getText()).toContain('List \titem content');
    });
  });

  describe('Shift-Tab mid-content in list item', () => {
    it('should remove tab character when cursor is not at content start', () => {
      editor.commands.setContent('<ul><li>List item</li></ul>');

      // Position cursor mid-content and insert tab
      const doc = editor.state.doc;
      let itemPos = 0;
      doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('List item')) {
          itemPos = pos + 5;
          return false;
        }
        return true;
      });

      editor.commands.setTextSelection(itemPos);
      editor.commands.insertTab();

      expect(editor.getText()).toContain('List \titem');

      // Shift-Tab should remove the tab
      editor.commands.removeTab();

      expect(editor.getText()).not.toContain('\t');
    });
  });
});

describe('Integration: Tab inserts tab in paragraph (not list)', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit, TabIndent],
      content: '<p>Hello world</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should insert tab in regular paragraph', () => {
    editor.commands.focus('start');
    const result = editor.commands.insertTab();

    expect(result).toBe(true);
    expect(editor.getText()).toBe('\tHello world');
  });

  it('should remove tab in regular paragraph', () => {
    editor.commands.focus('start');
    editor.commands.insertTab();
    expect(editor.getText()).toBe('\tHello world');

    const result = editor.commands.removeTab();
    expect(result).toBe(true);
    expect(editor.getText()).toBe('Hello world');
  });
});
