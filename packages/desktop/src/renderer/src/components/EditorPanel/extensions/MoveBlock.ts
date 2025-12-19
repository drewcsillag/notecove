/**
 * MoveBlock Extension
 *
 * Provides keyboard shortcuts to move blocks (list items, paragraphs, headings,
 * blockquotes, code blocks) up and down within their parent container.
 *
 * Shortcuts:
 * - Alt-Up: Move block up
 * - Alt-Down: Move block down
 *
 * Behavior:
 * - List items move within their parent list
 * - Nested list items move with their children
 * - Top-level blocks swap with siblings
 * - Does nothing at container boundaries
 * - Tables are not supported (returns false)
 */

import { Extension } from '@tiptap/core';
import { Fragment, Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { TextSelection, Transaction } from '@tiptap/pm/state';

// Extend TipTap's Commands interface
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    moveBlock: {
      /**
       * Move the current block up
       */
      moveBlockUp: () => ReturnType;
      /**
       * Move the current block down
       */
      moveBlockDown: () => ReturnType;
    };
  }
}

interface ListItemInfo {
  pos: number;
  node: ProseMirrorNode;
  index: number;
  listNode: ProseMirrorNode;
  listStart: number;
  listDepth: number;
}

interface BlockInfo {
  pos: number;
  node: ProseMirrorNode;
  index: number;
}

/**
 * Find information about the list item containing the cursor.
 * Returns null if not in a list item.
 */
function findListItemInfo($from: ResolvedPos): ListItemInfo | null {
  // Search up from cursor position to find a list item
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
      // Found a list item, now find its parent list
      const itemPos = $from.before(depth);

      for (let listDepth = depth - 1; listDepth > 0; listDepth--) {
        const parentNode = $from.node(listDepth);
        if (parentNode.type.name === 'bulletList' || parentNode.type.name === 'orderedList') {
          const listStart = $from.start(listDepth);

          // Find the index of this item in the list
          let index = -1;
          let offset = 0;
          for (let i = 0; i < parentNode.childCount; i++) {
            const childPos = listStart + offset;
            if (childPos === itemPos) {
              index = i;
              break;
            }
            offset += parentNode.child(i).nodeSize;
          }

          if (index !== -1) {
            return {
              pos: itemPos,
              node,
              index,
              listNode: parentNode,
              listStart,
              listDepth,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Find information about the top-level block containing the cursor.
 * Returns null if in a table or at document root.
 */
function findTopLevelBlockInfo(doc: ProseMirrorNode, $from: ResolvedPos): BlockInfo | null {
  // Check if we're in a table - don't support moving table rows
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'table') {
      return null;
    }
  }

  // Find the top-level block (depth 1 = direct child of doc)
  if ($from.depth < 1) return null;

  const blockNode = $from.node(1);
  const blockPos = $from.before(1);

  // Find the index of this block in the document
  let index = -1;
  let offset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    if (offset === blockPos) {
      index = i;
      break;
    }
    offset += doc.child(i).nodeSize;
  }

  if (index === -1) return null;

  return {
    pos: blockPos,
    node: blockNode,
    index,
  };
}

/**
 * Move a node from one position to another within a transaction.
 * Handles the position shifting that occurs when inserting/deleting.
 */
function moveNode(
  tr: Transaction,
  fromPos: number,
  toPos: number,
  node: ProseMirrorNode
): { newPos: number } {
  if (toPos < fromPos) {
    // Moving backward: insert first, then delete
    tr.insert(toPos, Fragment.from(node));
    const shiftedFromPos = fromPos + node.nodeSize;
    tr.delete(shiftedFromPos, shiftedFromPos + node.nodeSize);
    return { newPos: toPos };
  } else {
    // Moving forward: delete first, then insert
    tr.delete(fromPos, fromPos + node.nodeSize);
    tr.insert(toPos - node.nodeSize, Fragment.from(node));
    return { newPos: toPos - node.nodeSize };
  }
}

export const MoveBlock = Extension.create({
  name: 'moveBlock',

  addCommands() {
    return {
      moveBlockUp:
        () =>
        ({ tr, state, dispatch }) => {
          const { $from } = state.selection;
          const cursorOffset = $from.pos;

          // First, check if we're in a list item
          const listItemInfo = findListItemInfo($from);
          if (listItemInfo) {
            // Can't move up if already at top of list
            if (listItemInfo.index === 0) {
              return false;
            }

            // Get the previous sibling's position
            let prevSiblingPos = listItemInfo.listStart;
            for (let i = 0; i < listItemInfo.index - 1; i++) {
              prevSiblingPos += listItemInfo.listNode.child(i).nodeSize;
            }

            if (dispatch) {
              // Calculate cursor offset within the item
              const offsetInItem = cursorOffset - listItemInfo.pos;

              // Move the item
              const { newPos } = moveNode(tr, listItemInfo.pos, prevSiblingPos, listItemInfo.node);

              // Restore cursor position
              const newCursorPos = newPos + offsetInItem;
              tr.setSelection(TextSelection.near(tr.doc.resolve(newCursorPos)));
            }

            return true;
          }

          // Not in a list, try top-level block
          const blockInfo = findTopLevelBlockInfo(tr.doc, $from);
          if (blockInfo) {
            // Can't move up if already at top of document
            if (blockInfo.index === 0) {
              return false;
            }

            // Get the previous sibling's position
            let prevSiblingPos = 0;
            for (let i = 0; i < blockInfo.index - 1; i++) {
              prevSiblingPos += tr.doc.child(i).nodeSize;
            }

            if (dispatch) {
              // Calculate cursor offset within the block
              const offsetInBlock = cursorOffset - blockInfo.pos;

              // Move the block
              const { newPos } = moveNode(tr, blockInfo.pos, prevSiblingPos, blockInfo.node);

              // Restore cursor position
              const newCursorPos = newPos + offsetInBlock;
              tr.setSelection(TextSelection.near(tr.doc.resolve(newCursorPos)));
            }

            return true;
          }

          return false;
        },

      moveBlockDown:
        () =>
        ({ tr, state, dispatch }) => {
          const { $from } = state.selection;
          const cursorOffset = $from.pos;

          // First, check if we're in a list item
          const listItemInfo = findListItemInfo($from);
          if (listItemInfo) {
            // Can't move down if already at bottom of list
            if (listItemInfo.index >= listItemInfo.listNode.childCount - 1) {
              return false;
            }

            // Get the position after the next sibling
            let nextSiblingEndPos = listItemInfo.listStart;
            for (let i = 0; i <= listItemInfo.index + 1; i++) {
              nextSiblingEndPos += listItemInfo.listNode.child(i).nodeSize;
            }

            if (dispatch) {
              // Calculate cursor offset within the item
              const offsetInItem = cursorOffset - listItemInfo.pos;

              // Move the item (target is after the next sibling)
              const { newPos } = moveNode(
                tr,
                listItemInfo.pos,
                nextSiblingEndPos,
                listItemInfo.node
              );

              // Restore cursor position
              const newCursorPos = newPos + offsetInItem;
              tr.setSelection(TextSelection.near(tr.doc.resolve(newCursorPos)));
            }

            return true;
          }

          // Not in a list, try top-level block
          const blockInfo = findTopLevelBlockInfo(tr.doc, $from);
          if (blockInfo) {
            // Can't move down if already at bottom of document
            if (blockInfo.index >= tr.doc.childCount - 1) {
              return false;
            }

            // Get the position after the next sibling
            let nextSiblingEndPos = 0;
            for (let i = 0; i <= blockInfo.index + 1; i++) {
              nextSiblingEndPos += tr.doc.child(i).nodeSize;
            }

            if (dispatch) {
              // Calculate cursor offset within the block
              const offsetInBlock = cursorOffset - blockInfo.pos;

              // Move the block (target is after the next sibling)
              const { newPos } = moveNode(tr, blockInfo.pos, nextSiblingEndPos, blockInfo.node);

              // Restore cursor position
              const newCursorPos = newPos + offsetInBlock;
              tr.setSelection(TextSelection.near(tr.doc.resolve(newCursorPos)));
            }

            return true;
          }

          return false;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Alt-Up': () => this.editor.commands.moveBlockUp(),
      'Alt-Down': () => this.editor.commands.moveBlockDown(),
    };
  },
});
