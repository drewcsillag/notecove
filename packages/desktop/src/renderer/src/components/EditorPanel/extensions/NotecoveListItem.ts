/**
 * NotecoveListItem Extension
 *
 * Extends TipTap's ListItem to make Tab/Shift-Tab cursor-position aware:
 * - At start of content: indent/outdent the item (default behavior)
 * - Elsewhere in content: let TabIndent handle it (insert/remove tab character)
 */

import ListItem from '@tiptap/extension-list-item';

export const NotecoveListItem = ListItem.extend({
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => {
        // Only sink (indent) if cursor is at start of content
        // Otherwise, let TabIndent handle it (insert tab character)
        const { $from } = this.editor.state.selection;

        // Check if cursor is at the start of its parent node's content
        if ($from.parentOffset === 0) {
          return this.editor.commands.sinkListItem(this.name);
        }

        // Not at start - let TabIndent handle it
        return false;
      },
      'Shift-Tab': () => {
        // Only lift (outdent) if cursor is at start of content
        // Otherwise, let TabIndent handle it (remove tab character)
        const { $from } = this.editor.state.selection;

        if ($from.parentOffset === 0) {
          return this.editor.commands.liftListItem(this.name);
        }

        // Not at start - let TabIndent handle it
        return false;
      },
    };
  },
});
