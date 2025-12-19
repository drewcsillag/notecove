/**
 * TabIndent Extension
 *
 * Handles Tab key to insert tab characters instead of moving focus.
 * This extension is context-aware - it defers to other handlers for:
 * - Tables (Tab navigates cells)
 * - List/Task items at content start (Tab indents the item)
 *
 * Tab: Insert literal '\t' character
 * Shift+Tab: Remove '\t' character before cursor if present
 */

import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabIndent: {
      /**
       * Insert a tab character at the current cursor position
       */
      insertTab: () => ReturnType;
      /**
       * Remove a tab character before the cursor if present
       */
      removeTab: () => ReturnType;
    };
  }
}

/**
 * Check if we should defer Tab handling to another extension
 */
function shouldDeferTab(editor: Editor): boolean {
  // Defer to Table extension for cell navigation
  if (editor.isActive('table')) {
    return true;
  }

  // For list items and task items, defer only if cursor is at content start
  // (so they can indent the item)
  if (editor.isActive('listItem') || editor.isActive('taskItem')) {
    const { $from } = editor.state.selection;
    // If at start of content, let list/task item extension handle it
    if ($from.parentOffset === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Check if we should defer Shift-Tab handling to another extension
 */
function shouldDeferShiftTab(editor: Editor): boolean {
  // Defer to Table extension for cell navigation
  if (editor.isActive('table')) {
    return true;
  }

  // For list items and task items, defer only if cursor is at content start
  // (so they can outdent the item)
  if (editor.isActive('listItem') || editor.isActive('taskItem')) {
    const { $from } = editor.state.selection;
    // If at start of content, let list/task item extension handle it
    if ($from.parentOffset === 0) {
      return true;
    }
  }

  return false;
}

export const TabIndent = Extension.create({
  name: 'tabIndent',

  addCommands() {
    return {
      insertTab:
        () =>
        ({ commands }) => {
          return commands.insertContent('\t');
        },

      removeTab:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection;

          // Check if there's a tab character immediately before the cursor
          if ($from.parentOffset === 0) {
            // At start of node, nothing to remove
            return false;
          }

          // Get the character before the cursor
          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 1),
            $from.parentOffset
          );

          if (textBefore !== '\t') {
            // No tab character before cursor
            return false;
          }

          // Delete the tab character
          if (dispatch) {
            const tr = state.tr.delete($from.pos - 1, $from.pos);
            dispatch(tr);
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Check if another extension should handle this
        if (shouldDeferTab(this.editor)) {
          return false; // Let other extension handle it
        }
        return this.editor.commands.insertTab();
      },
      'Shift-Tab': () => {
        // Check if another extension should handle this
        if (shouldDeferShiftTab(this.editor)) {
          return false; // Let other extension handle it
        }
        return this.editor.commands.removeTab();
      },
    };
  },
});
