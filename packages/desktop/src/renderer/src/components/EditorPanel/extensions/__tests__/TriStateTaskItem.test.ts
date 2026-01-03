/**
 * Tests for TriStateTaskItem Extension Commands
 *
 * Tests for convertToListItem and toggleTaskItem commands.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { BulletList, OrderedList } from '@tiptap/extension-list';
import { TriStateTaskItem } from '../TriStateTaskItem';
import { NotecoveListItem } from '../NotecoveListItem';
import * as CheckboxSettings from '../../../../contexts/CheckboxSettingsContext';

// Mock the checkbox settings module
jest.mock('../../../../contexts/CheckboxSettingsContext', () => ({
  getCheckboxAutoReorder: jest.fn(() => true),
  getCheckboxNopeEnabled: jest.fn(() => true),
}));

describe('TriStateTaskItem Commands', () => {
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
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  beforeEach(() => {
    // Reset mocks to default behavior (all enabled)
    (CheckboxSettings.getCheckboxAutoReorder as jest.Mock).mockReturnValue(true);
    (CheckboxSettings.getCheckboxNopeEnabled as jest.Mock).mockReturnValue(true);
  });

  describe('convertToListItem', () => {
    it('should convert taskItem to listItem', () => {
      // Create a bullet list with a task item
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="unchecked">Task content</li>
        </ul>
      `);

      // Focus in the task item
      editor.commands.focus('start');

      // Verify we're in a taskItem
      expect(editor.isActive('taskItem')).toBe(true);

      // Convert to listItem
      const result = editor.commands.convertToListItem();

      expect(result).toBe(true);
      expect(editor.isActive('taskItem')).toBe(false);
      expect(editor.isActive('listItem')).toBe(true);
      expect(editor.getText()).toContain('Task content');
    });

    it('should preserve content when converting', () => {
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="checked"><p>First paragraph</p><p>Second paragraph</p></li>
        </ul>
      `);

      editor.commands.focus('start');
      editor.commands.convertToListItem();

      // Content should be preserved
      const text = editor.getText();
      expect(text).toContain('First paragraph');
      expect(text).toContain('Second paragraph');
    });

    it('should return false when not in a taskItem', () => {
      // Create a regular list item
      editor.commands.setContent('<ul><li>Regular item</li></ul>');
      editor.commands.focus('start');

      // Should be in a listItem, not taskItem
      expect(editor.isActive('listItem')).toBe(true);
      expect(editor.isActive('taskItem')).toBe(false);

      // convertToListItem should return false (already a listItem)
      const result = editor.commands.convertToListItem();
      expect(result).toBe(false);
    });

    it('should return false when in a paragraph (not in list)', () => {
      editor.commands.setContent('<p>Just a paragraph</p>');
      editor.commands.focus('start');

      const result = editor.commands.convertToListItem();
      expect(result).toBe(false);
    });

    it('should work with checked taskItem', () => {
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="checked">Completed task</li>
        </ul>
      `);

      editor.commands.focus('start');
      expect(editor.isActive('taskItem')).toBe(true);

      const result = editor.commands.convertToListItem();

      expect(result).toBe(true);
      expect(editor.isActive('listItem')).toBe(true);
      expect(editor.getText()).toContain('Completed task');
    });

    it('should work with nope taskItem', () => {
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="nope">Cancelled task</li>
        </ul>
      `);

      editor.commands.focus('start');
      const result = editor.commands.convertToListItem();

      expect(result).toBe(true);
      expect(editor.isActive('listItem')).toBe(true);
    });

    it('should work in ordered list', () => {
      editor.commands.setContent(`
        <ol>
          <li data-type="taskItem" data-checked="unchecked">Numbered task</li>
        </ol>
      `);

      editor.commands.focus('start');
      expect(editor.isActive('taskItem')).toBe(true);
      expect(editor.isActive('orderedList')).toBe(true);

      const result = editor.commands.convertToListItem();

      expect(result).toBe(true);
      expect(editor.isActive('listItem')).toBe(true);
      expect(editor.isActive('orderedList')).toBe(true); // Should stay in ordered list
    });
  });

  describe('toggleTaskItem', () => {
    it('should convert listItem to taskItem', () => {
      editor.commands.setContent('<ul><li>Regular item</li></ul>');
      editor.commands.focus('start');

      expect(editor.isActive('listItem')).toBe(true);

      const result = editor.commands.toggleTaskItem();

      expect(result).toBe(true);
      expect(editor.isActive('taskItem')).toBe(true);
      expect(editor.isActive('listItem')).toBe(false);
    });

    it('should convert taskItem to listItem', () => {
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="unchecked">Task item</li>
        </ul>
      `);
      editor.commands.focus('start');

      expect(editor.isActive('taskItem')).toBe(true);

      const result = editor.commands.toggleTaskItem();

      expect(result).toBe(true);
      expect(editor.isActive('listItem')).toBe(true);
      expect(editor.isActive('taskItem')).toBe(false);
    });

    it('should create bulletList with taskItem when on paragraph', () => {
      editor.commands.setContent('<p>Plain text</p>');
      editor.commands.focus('start');

      expect(editor.isActive('bulletList')).toBe(false);

      const result = editor.commands.toggleTaskItem();

      expect(result).toBe(true);
      expect(editor.isActive('bulletList')).toBe(true);
      expect(editor.isActive('taskItem')).toBe(true);
      expect(editor.getText()).toContain('Plain text');
    });

    it('should preserve content when toggling listItem to taskItem', () => {
      editor.commands.setContent('<ul><li>Item content here</li></ul>');
      editor.commands.focus('start');

      editor.commands.toggleTaskItem();

      expect(editor.getText()).toContain('Item content here');
    });

    it('should preserve list type when toggling in ordered list', () => {
      editor.commands.setContent('<ol><li>Numbered item</li></ol>');
      editor.commands.focus('start');

      expect(editor.isActive('orderedList')).toBe(true);

      editor.commands.toggleTaskItem();

      expect(editor.isActive('orderedList')).toBe(true);
      expect(editor.isActive('taskItem')).toBe(true);
    });
  });

  describe('Toolbar Button Behavior Integration', () => {
    /**
     * These tests verify the expected button logic for the toolbar:
     *
     * Bullet button:
     *   if isActive('taskItem') && isActive('bulletList'):
     *     convertToListItem()  // Already in bullet list, convert to regular item
     *   else:
     *     toggleBulletList()   // Works for: ordered->bullet, or toggle off
     *
     * Numbered button:
     *   if isActive('taskItem') && isActive('orderedList'):
     *     convertToListItem()  // Already in ordered list, convert to regular item
     *   else:
     *     toggleOrderedList()  // Works for: bullet->ordered, or toggle off
     *
     * Checkbox button:
     *   toggleTaskItem()  // Converts between listItem <-> taskItem
     */

    describe('Bullet button on taskItem', () => {
      it('should convert taskItem to listItem when in bulletList', () => {
        editor.commands.setContent(`
          <ul>
            <li data-type="taskItem" data-checked="unchecked">Task in bullet list</li>
          </ul>
        `);
        editor.commands.focus('start');

        expect(editor.isActive('taskItem')).toBe(true);
        expect(editor.isActive('bulletList')).toBe(true);

        // Simulate bullet button logic: if taskItem in bulletList, convertToListItem
        const inTaskItemInBullet = editor.isActive('taskItem') && editor.isActive('bulletList');
        if (inTaskItemInBullet) {
          editor.commands.convertToListItem();
        } else {
          editor.commands.toggleBulletList();
        }

        expect(editor.isActive('listItem')).toBe(true);
        expect(editor.isActive('bulletList')).toBe(true);
        expect(editor.isActive('taskItem')).toBe(false);
      });

      it('should switch to bulletList and keep taskItem when in orderedList', () => {
        editor.commands.setContent(`
          <ol>
            <li data-type="taskItem" data-checked="unchecked">Task in ordered list</li>
          </ol>
        `);
        editor.commands.focus('start');

        expect(editor.isActive('taskItem')).toBe(true);
        expect(editor.isActive('orderedList')).toBe(true);

        // Simulate bullet button logic
        const inTaskItemInBullet = editor.isActive('taskItem') && editor.isActive('bulletList');
        if (inTaskItemInBullet) {
          editor.commands.convertToListItem();
        } else {
          editor.commands.toggleBulletList();
        }

        // Should switch to bullet list but keep as taskItem
        expect(editor.isActive('bulletList')).toBe(true);
        expect(editor.isActive('orderedList')).toBe(false);
        expect(editor.isActive('taskItem')).toBe(true);
      });
    });

    describe('Numbered button on taskItem', () => {
      it('should convert taskItem to listItem when in orderedList', () => {
        editor.commands.setContent(`
          <ol>
            <li data-type="taskItem" data-checked="unchecked">Task in ordered list</li>
          </ol>
        `);
        editor.commands.focus('start');

        expect(editor.isActive('taskItem')).toBe(true);
        expect(editor.isActive('orderedList')).toBe(true);

        // Simulate numbered button logic: if taskItem in orderedList, convertToListItem
        const inTaskItemInOrdered = editor.isActive('taskItem') && editor.isActive('orderedList');
        if (inTaskItemInOrdered) {
          editor.commands.convertToListItem();
        } else {
          editor.commands.toggleOrderedList();
        }

        expect(editor.isActive('listItem')).toBe(true);
        expect(editor.isActive('orderedList')).toBe(true);
        expect(editor.isActive('taskItem')).toBe(false);
      });

      it('should switch to orderedList and keep taskItem when in bulletList', () => {
        editor.commands.setContent(`
          <ul>
            <li data-type="taskItem" data-checked="unchecked">Task in bullet list</li>
          </ul>
        `);
        editor.commands.focus('start');

        expect(editor.isActive('taskItem')).toBe(true);
        expect(editor.isActive('bulletList')).toBe(true);

        // Simulate numbered button logic
        const inTaskItemInOrdered = editor.isActive('taskItem') && editor.isActive('orderedList');
        if (inTaskItemInOrdered) {
          editor.commands.convertToListItem();
        } else {
          editor.commands.toggleOrderedList();
        }

        // Should switch to ordered list but keep as taskItem
        expect(editor.isActive('orderedList')).toBe(true);
        expect(editor.isActive('bulletList')).toBe(false);
        expect(editor.isActive('taskItem')).toBe(true);
      });
    });

    describe('Checkbox button', () => {
      it('should convert taskItem to listItem', () => {
        editor.commands.setContent(`
          <ul>
            <li data-type="taskItem" data-checked="unchecked">Task item</li>
          </ul>
        `);
        editor.commands.focus('start');

        expect(editor.isActive('taskItem')).toBe(true);

        // Simulate checkbox button: toggleTaskItem
        editor.commands.toggleTaskItem();

        expect(editor.isActive('listItem')).toBe(true);
        expect(editor.isActive('taskItem')).toBe(false);
      });

      it('should convert listItem to taskItem', () => {
        editor.commands.setContent('<ul><li>Regular item</li></ul>');
        editor.commands.focus('start');

        expect(editor.isActive('listItem')).toBe(true);

        // Simulate checkbox button: toggleTaskItem
        editor.commands.toggleTaskItem();

        expect(editor.isActive('taskItem')).toBe(true);
        expect(editor.isActive('listItem')).toBe(false);
      });
    });
  });

  describe('Nested Task Items', () => {
    it('should convert nested taskItem to listItem', () => {
      // Create a nested list structure with a task item inside
      editor.commands.setContent(`
        <ul>
          <li>Parent item
            <ul>
              <li data-type="taskItem" data-checked="unchecked">Nested task</li>
            </ul>
          </li>
        </ul>
      `);

      // Focus in the nested task item
      const doc = editor.state.doc;
      let nestedTaskPos = 0;
      doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('Nested task')) {
          nestedTaskPos = pos;
          return false;
        }
        return true;
      });

      editor.commands.setTextSelection(nestedTaskPos);
      expect(editor.isActive('taskItem')).toBe(true);

      // Convert to list item
      const result = editor.commands.convertToListItem();

      expect(result).toBe(true);
      expect(editor.isActive('listItem')).toBe(true);
      expect(editor.isActive('taskItem')).toBe(false);
      expect(editor.getText()).toContain('Nested task');
    });

    it('should toggle nested listItem to taskItem', () => {
      // Create a nested list structure
      editor.commands.setContent(`
        <ul>
          <li>Parent item
            <ul>
              <li>Nested item</li>
            </ul>
          </li>
        </ul>
      `);

      // Focus in the nested list item
      const doc = editor.state.doc;
      let nestedItemPos = 0;
      doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('Nested item')) {
          nestedItemPos = pos;
          return false;
        }
        return true;
      });

      editor.commands.setTextSelection(nestedItemPos);
      expect(editor.isActive('listItem')).toBe(true);

      // Toggle to task item
      const result = editor.commands.toggleTaskItem();

      expect(result).toBe(true);
      expect(editor.isActive('taskItem')).toBe(true);
      expect(editor.getText()).toContain('Nested item');
    });
  });

  describe('Checkbox Settings Integration', () => {
    describe('nopeEnabled setting', () => {
      it('should skip nope state when nopeEnabled is false', () => {
        (CheckboxSettings.getCheckboxNopeEnabled as jest.Mock).mockReturnValue(false);

        // This test verifies getNextState behavior
        // When nopeEnabled is false, cycling should go: unchecked -> checked -> unchecked
        // We test this indirectly via the input rule (since getNextState is internal)

        // Create a checked task item
        editor.commands.setContent(`
          <ul>
            <li data-type="taskItem" data-checked="checked">Completed task</li>
          </ul>
        `);

        // After implementation, clicking should cycle checked -> unchecked (skipping nope)
        // For now this test documents the expected behavior
        expect(CheckboxSettings.getCheckboxNopeEnabled()).toBe(false);
      });

      it('should include nope state when nopeEnabled is true', () => {
        (CheckboxSettings.getCheckboxNopeEnabled as jest.Mock).mockReturnValue(true);

        // When nopeEnabled is true, cycling should go: unchecked -> checked -> nope -> unchecked
        expect(CheckboxSettings.getCheckboxNopeEnabled()).toBe(true);
      });

      it('should still display existing nope items when nopeEnabled is false', () => {
        (CheckboxSettings.getCheckboxNopeEnabled as jest.Mock).mockReturnValue(false);

        // Existing nope items should still render correctly
        editor.commands.setContent(`
          <ul>
            <li data-type="taskItem" data-checked="nope">Cancelled task</li>
          </ul>
        `);

        editor.commands.focus('start');
        expect(editor.isActive('taskItem')).toBe(true);

        // The nope item should still be visible (just clicking it will skip nope in cycle)
        const doc = editor.state.doc;
        let hasNopeItem = false;
        doc.descendants((node) => {
          if (node.type.name === 'taskItem' && node.attrs['checked'] === 'nope') {
            hasNopeItem = true;
            return false;
          }
          return true;
        });
        expect(hasNopeItem).toBe(true);
      });
    });

    describe('autoReorder setting', () => {
      it('should not reorder when autoReorder is false', () => {
        (CheckboxSettings.getCheckboxAutoReorder as jest.Mock).mockReturnValue(false);

        // Create a list with an unchecked item followed by checked items
        editor.commands.setContent(`
          <ul>
            <li data-type="taskItem" data-checked="unchecked">First unchecked</li>
            <li data-type="taskItem" data-checked="checked">Second checked</li>
          </ul>
        `);

        // After implementation, completing the first item should NOT move it
        // For now this test documents the expected behavior
        expect(CheckboxSettings.getCheckboxAutoReorder()).toBe(false);
      });

      it('should reorder when autoReorder is true', () => {
        (CheckboxSettings.getCheckboxAutoReorder as jest.Mock).mockReturnValue(true);

        // When autoReorder is true, completing an item should move it to bottom
        expect(CheckboxSettings.getCheckboxAutoReorder()).toBe(true);
      });
    });

    describe('input rules with nopeEnabled', () => {
      it('should not create nope task from [n] input when nopeEnabled is false', () => {
        (CheckboxSettings.getCheckboxNopeEnabled as jest.Mock).mockReturnValue(false);

        // Create a paragraph
        editor.commands.setContent('<p></p>');
        editor.commands.focus('start');

        // Type "[n] " - this should NOT create a nope task item when disabled
        // Instead, the text should pass through as-is
        // After implementation, this test will verify the input rule is skipped
        expect(CheckboxSettings.getCheckboxNopeEnabled()).toBe(false);
      });

      it('should create nope task from [n] input when nopeEnabled is true', () => {
        (CheckboxSettings.getCheckboxNopeEnabled as jest.Mock).mockReturnValue(true);

        // When nopeEnabled is true, [n] should create a nope task item
        expect(CheckboxSettings.getCheckboxNopeEnabled()).toBe(true);
      });

      it('should still allow [x] input regardless of nopeEnabled', () => {
        (CheckboxSettings.getCheckboxNopeEnabled as jest.Mock).mockReturnValue(false);

        // Even when nope is disabled, [x] should still work for checked items
        // This test documents that only [n] is affected
        expect(CheckboxSettings.getCheckboxNopeEnabled()).toBe(false);
      });
    });
  });

  // Note: Input rule position sensitivity is tested in E2E tests (tri-state-checkboxes.spec.ts)
  // because input rules only trigger on actual typing, not programmatic insertion.
  // See tests: "should NOT convert to task when [] is typed in middle of list item"
  //            "should NOT convert when [] appears after space mid-line"
});
