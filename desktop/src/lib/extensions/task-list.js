import { Node, mergeAttributes } from '@tiptap/core';
import { wrappingInputRule } from '@tiptap/core';

/**
 * TaskList extension - container for TaskItems
 */
export const TaskList = Node.create({
  name: 'taskList',

  addOptions() {
    return {
      itemTypeName: 'taskItem',
      HTMLAttributes: {},
    };
  },

  group: 'block list',

  content() {
    return `${this.options.itemTypeName}+`;
  },

  parseHTML() {
    return [
      {
        tag: `ul[data-type="${this.name}"]`,
        priority: 51,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'ul',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleTaskList: () => ({ commands }) => {
        return commands.toggleList(this.name, this.options.itemTypeName);
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-9': () => this.editor.commands.toggleTaskList(),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^\s*\[\]\s$/,
        type: this.type,
        getAttributes: () => ({}),
      }),
    ];
  },
});
