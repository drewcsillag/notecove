/**
 * CutLine Extension
 *
 * Provides VS Code/Sublime-like behavior where Cmd+X (or Ctrl+X) with no selection
 * cuts the entire current line instead of doing nothing.
 *
 * Behavior:
 * - No selection: Cut the entire line (block) to clipboard and delete it
 * - Has selection: Return false to let default cut behavior handle it
 *
 * The line text is copied to clipboard as plain text with a trailing newline.
 */

import { Extension } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

// Extend TipTap's Commands interface
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cutLine: {
      /**
       * Cut the current line when there is no selection
       */
      cutLine: () => ReturnType;
    };
  }
}

export const CutLine = Extension.create({
  name: 'cutLine',

  addCommands() {
    return {
      cutLine:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;

          // Only handle when there's no selection (cursor is collapsed)
          if (!selection.empty) {
            return false;
          }

          const { $from } = selection;

          // Find the block (paragraph, heading, list item, etc.) containing the cursor
          // depth 0 = doc, depth 1+ = blocks
          let blockDepth = $from.depth;

          // Find the actual text block - for list items, we want the inner paragraph
          while (blockDepth > 0) {
            const node = $from.node(blockDepth);
            if (node.isTextblock) {
              break;
            }
            blockDepth--;
          }

          if (blockDepth < 1) {
            // Couldn't find a text block
            return false;
          }

          // Get the text content of the block
          const blockNode = $from.node(blockDepth);
          const lineText = blockNode.textContent;

          // Get the position range of the entire block
          const blockStart = $from.start(blockDepth);
          const blockEnd = $from.end(blockDepth);

          if (dispatch) {
            // Copy to clipboard (async, but we don't wait for it)
            void navigator.clipboard.writeText(lineText + '\n');

            // For top-level blocks, delete the entire node including its wrapper
            // For nested blocks (like list items), just clear the content
            const tr = state.tr;

            if (blockDepth === 1) {
              // Top-level block: delete the whole node
              const nodeStart = $from.before(blockDepth);
              const nodeEnd = $from.after(blockDepth);

              // If this is the only block in the document, just clear it
              if (state.doc.childCount === 1) {
                tr.delete(blockStart, blockEnd);
              } else {
                tr.delete(nodeStart, nodeEnd);
              }
            } else {
              // Nested block (e.g., paragraph inside list item): delete the list item
              // Find the nearest deletable parent (like listItem or taskItem)
              let deleteDepth = blockDepth;
              for (let d = blockDepth - 1; d >= 1; d--) {
                const parentNode = $from.node(d);
                if (parentNode.type.name === 'listItem' || parentNode.type.name === 'taskItem') {
                  deleteDepth = d;
                  break;
                }
              }

              const nodeStart = $from.before(deleteDepth);
              const nodeEnd = $from.after(deleteDepth);

              // Check if this is the only item in its parent list
              const parentNode = $from.node(deleteDepth - 1);
              if (parentNode.childCount === 1) {
                // Delete the entire list
                const listStart = $from.before(deleteDepth - 1);
                const listEnd = $from.after(deleteDepth - 1);
                tr.delete(listStart, listEnd);
              } else {
                tr.delete(nodeStart, nodeEnd);
              }
            }

            // Try to preserve a reasonable cursor position
            const newPos = Math.min(tr.doc.content.size - 1, blockStart);
            if (newPos > 0) {
              const $newPos = tr.doc.resolve(newPos);
              tr.setSelection(TextSelection.near($newPos));
            }

            dispatch(tr);
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-x': () => this.editor.commands.cutLine(),
    };
  },
});
