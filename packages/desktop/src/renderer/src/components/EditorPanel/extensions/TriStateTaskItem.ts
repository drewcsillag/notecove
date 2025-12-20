/**
 * TriStateTaskItem - Task list item with three states
 *
 * A list item node with three states: unchecked, checked, nope
 * - Must be nested under a bullet or ordered list
 * - Checked/nope items show strikethrough
 * - Auto-sorts: checked/nope items float to bottom of parent list
 *
 * Based on @tiptap/extension-task-item but extended for tri-state support.
 */
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { Node as ProseMirrorNode, Fragment } from '@tiptap/pm/model';

export type TaskItemState = 'unchecked' | 'checked' | 'nope';

// Extend TipTap's Commands interface
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    triStateTaskItem: {
      /**
       * Set the checked state of a task item
       */
      setTaskItemState: (state: TaskItemState) => ReturnType;
      /**
       * Convert the current list item to a task item
       */
      convertToTaskItem: (state?: TaskItemState) => ReturnType;
      /**
       * Convert the current task item to a regular list item
       */
      convertToListItem: () => ReturnType;
      /**
       * Toggle between list item and task item
       */
      toggleTaskItem: () => ReturnType;
    };
  }
}

function getNextState(currentState: TaskItemState): TaskItemState {
  if (currentState === 'unchecked') return 'checked';
  if (currentState === 'checked') return 'nope';
  return 'unchecked';
}

function isCompletedState(state: TaskItemState): boolean {
  return state === 'checked' || state === 'nope';
}

/**
 * Find the target position for reordering a task item after a state change.
 *
 * Rules:
 * - Unchecked items stay at top of list
 * - Completed (checked/nope) items go to bottom of list
 * - When completing: insert at START of completed group (just after last unchecked)
 * - When uncompleting: insert at END of unchecked group (just before first completed)
 *
 * @returns Target position to insert the node, or null if no move needed
 */
function findReorderTargetPosition(
  doc: ProseMirrorNode,
  taskItemPos: number,
  willBeCompleted: boolean
): number | null {
  const $pos = doc.resolve(taskItemPos);

  // Find the parent list (bulletList or orderedList)
  let listDepth = -1;
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      listDepth = d;
      break;
    }
  }
  if (listDepth === -1) return null;

  const listNode = $pos.node(listDepth);
  const listStart = $pos.start(listDepth);

  // Find the index of the current task item within the list
  let currentIndex = -1;
  let offset = 0;
  for (let i = 0; i < listNode.childCount; i++) {
    const childPos = listStart + offset;
    if (childPos === taskItemPos) {
      currentIndex = i;
      break;
    }
    offset += listNode.child(i).nodeSize;
  }
  if (currentIndex === -1) return null;

  // Find the boundary between unchecked and completed items
  // (index of first completed item, or childCount if none)
  let firstCompletedIndex = listNode.childCount;
  offset = 0;
  for (let i = 0; i < listNode.childCount; i++) {
    if (i === currentIndex) {
      offset += listNode.child(i).nodeSize;
      continue; // Skip the item being moved
    }
    const child = listNode.child(i);
    const childState = child.attrs['checked'] as TaskItemState | undefined;
    if (childState && isCompletedState(childState)) {
      firstCompletedIndex = i;
      break;
    }
    offset += child.nodeSize;
  }

  // Determine target index
  let targetIndex: number;
  if (willBeCompleted) {
    // Insert at start of completed group (position of first completed item)
    // But if current item is before firstCompletedIndex, we need to account for removal
    targetIndex =
      currentIndex < firstCompletedIndex ? firstCompletedIndex - 1 : firstCompletedIndex;
  } else {
    // Insert at end of unchecked group (just before first completed)
    // But if current item is after firstCompletedIndex, we account for removal shifting things
    targetIndex =
      currentIndex > firstCompletedIndex ? firstCompletedIndex : firstCompletedIndex - 1;
  }

  // Check if item is already in the correct position
  if (targetIndex === currentIndex) {
    return null; // No move needed
  }

  // Calculate the actual document position to insert at
  // We need to find the position AFTER the item at targetIndex
  // (or at the start of the list if targetIndex < 0)
  let targetPos = listStart;
  const adjustedTargetIndex = targetIndex < currentIndex ? targetIndex : targetIndex + 1;
  for (let i = 0; i < adjustedTargetIndex && i < listNode.childCount; i++) {
    targetPos += listNode.child(i).nodeSize;
  }

  return targetPos;
}

export interface TriStateTaskItemOptions {
  nested: boolean;
  HTMLAttributes: Record<string, unknown>;
}

export const TriStateTaskItem = Node.create<TriStateTaskItemOptions>({
  name: 'taskItem',

  addOptions() {
    return {
      nested: true,
      HTMLAttributes: {},
    };
  },

  content() {
    return this.options.nested ? 'paragraph block*' : 'paragraph+';
  },

  defining: true,

  addAttributes() {
    return {
      checked: {
        default: 'unchecked' as TaskItemState,
        keepOnSplit: false,
        parseHTML: (element: HTMLElement) => {
          const dataChecked = element.getAttribute('data-checked');
          if (dataChecked === 'checked' || dataChecked === 'true') return 'checked';
          if (dataChecked === 'nope') return 'nope';
          return 'unchecked';
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-checked': attributes['checked'],
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
      }),
      [
        'label',
        { class: 'task-checkbox-wrapper', contenteditable: 'false' },
        ['span', { class: 'task-checkbox' }],
      ],
      ['div', { class: 'task-content' }, 0],
    ];
  },

  addKeyboardShortcuts() {
    const shortcuts: Record<string, () => boolean> = {
      Enter: () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => {
        // Only lift (outdent) if cursor is at start of content
        // Otherwise, let TabIndent handle it (remove tab character)
        const { $from } = this.editor.state.selection;

        // Check if we're in a taskItem and cursor is at the start of its text content
        // The taskItem has structure: taskItem > paragraph > text
        // We check if the cursor is at offset 0 within its parent (paragraph)
        if ($from.parentOffset === 0) {
          return this.editor.commands.liftListItem(this.name);
        }

        // Not at start - let TabIndent handle it
        return false;
      },
    };

    if (this.options.nested) {
      shortcuts['Tab'] = () => {
        // Only sink (indent) if cursor is at start of content
        // Otherwise, let TabIndent handle it (insert tab character)
        const { $from } = this.editor.state.selection;

        // Check if cursor is at the start of its parent node's content
        if ($from.parentOffset === 0) {
          return this.editor.commands.sinkListItem(this.name);
        }

        // Not at start - let TabIndent handle it
        return false;
      };
    }

    return shortcuts;
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('li');
      const checkboxWrapper = document.createElement('label');
      const checkbox = document.createElement('span');
      const content = document.createElement('div');

      checkboxWrapper.className = 'task-checkbox-wrapper';
      checkboxWrapper.contentEditable = 'false';
      checkbox.className = 'task-checkbox';
      content.className = 'task-content';

      const updateVisualState = (state: TaskItemState) => {
        listItem.dataset['checked'] = state;
        listItem.dataset['type'] = 'taskItem';

        // Update checkbox visual
        checkbox.textContent = '';
        checkbox.className = 'task-checkbox';

        if (state === 'checked') {
          checkbox.textContent = '✓';
          checkbox.classList.add('task-checkbox-checked');
        } else if (state === 'nope') {
          checkbox.textContent = '✗';
          checkbox.classList.add('task-checkbox-nope');
        }
      };

      // Click handler for cycling through states
      checkboxWrapper.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!editor.isEditable) return;
        if (typeof getPos !== 'function') return;

        const position = getPos();
        if (typeof position !== 'number') return;

        const currentNode = editor.state.doc.nodeAt(position);
        if (!currentNode) return;

        const currentState = currentNode.attrs['checked'] as TaskItemState;
        const nextState = getNextState(currentState);
        const wasCompleted = isCompletedState(currentState);
        const willBeCompleted = isCompletedState(nextState);
        const needsReorder = wasCompleted !== willBeCompleted;

        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .command(({ tr }) => {
            const pos = getPos();
            if (typeof pos !== 'number') return false;

            const nodeToMove = tr.doc.nodeAt(pos);
            if (!nodeToMove) return false;

            // Calculate reorder target BEFORE modifying the document
            const targetPos = needsReorder
              ? findReorderTargetPosition(tr.doc, pos, willBeCompleted)
              : null;

            if (targetPos !== null) {
              // Create the node with updated state
              const newNode = nodeToMove.type.create(
                { ...nodeToMove.attrs, checked: nextState },
                nodeToMove.content,
                nodeToMove.marks
              );

              // Move the node: delete from current position, insert at target
              if (targetPos < pos) {
                // Moving backward: insert first, then delete
                tr.insert(targetPos, Fragment.from(newNode));
                // After insert, original position shifted by inserted size
                const shiftedPos = pos + newNode.nodeSize;
                tr.delete(shiftedPos, shiftedPos + nodeToMove.nodeSize);
              } else {
                // Moving forward: delete first, then insert
                tr.delete(pos, pos + nodeToMove.nodeSize);
                // After delete, target shifted back by deleted size
                tr.insert(targetPos - nodeToMove.nodeSize, Fragment.from(newNode));
              }
            } else {
              // No reorder needed, just update the state
              tr.setNodeMarkup(pos, undefined, {
                ...currentNode.attrs,
                checked: nextState,
              });
            }

            return true;
          })
          .run();
      });

      // Apply HTML attributes
      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, String(value));
      });
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, String(value));
      });

      // Set initial state
      const initialState = node.attrs['checked'] as TaskItemState;
      updateVisualState(initialState);

      checkboxWrapper.appendChild(checkbox);
      listItem.appendChild(checkboxWrapper);
      listItem.appendChild(content);

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type !== this.type) return false;
          const newState = updatedNode.attrs['checked'] as TaskItemState;
          updateVisualState(newState);
          return true;
        },
      };
    };
  },

  addInputRules() {
    const taskItemType = this.type;

    // Helper to create input rule handler for task items
    const createTaskInputHandler = (checkedState: TaskItemState) => {
      return ({
        state,
        range,
        chain,
      }: {
        state: import('@tiptap/pm/state').EditorState;
        range: { from: number; to: number };
        chain: () => import('@tiptap/core').ChainedCommands;
      }) => {
        const $from = state.doc.resolve(range.from);

        // Case 1: Already in a list - convert the list item to a task item
        if (isInList($from)) {
          const listItemPos = findParentListItemPos($from);
          if (listItemPos === null) return;

          chain()
            .deleteRange(range)
            .command(({ tr }: { tr: import('@tiptap/pm/state').Transaction }) => {
              tr.setNodeMarkup(listItemPos, taskItemType, { checked: checkedState });
              return true;
            })
            .run();
          return;
        }

        // Case 2: Not in a list - check if we're at the start of a paragraph
        // Create a bullet list with a task item
        const parentNode = $from.parent;
        if (parentNode.type.name !== 'paragraph') return;

        // Check if the match is at the start of the paragraph
        const textBefore = parentNode.textBetween(0, $from.parentOffset - (range.to - range.from));
        if (textBefore.trim() !== '') return;

        // Delete the typed text and toggle bullet list, then convert to task item
        chain()
          .deleteRange(range)
          .toggleBulletList()
          .command(
            ({
              tr,
              state: newState,
            }: {
              tr: import('@tiptap/pm/state').Transaction;
              state: import('@tiptap/pm/state').EditorState;
            }) => {
              // Find the list item we just created and convert it to a task item
              const { $from: newFrom } = newState.selection;
              const listItemPos = findParentListItemPos(newFrom);
              if (listItemPos === null) return false;

              tr.setNodeMarkup(listItemPos, taskItemType, { checked: checkedState });
              return true;
            }
          )
          .run();
      };
    };

    return [
      // Match "[] " or "[ ] " - creates/converts to unchecked task item
      // The regex matches either at start of textblock (^) or after any whitespace
      new InputRule({
        find: /(?:^|\s)\[\s?\]\s$/,
        handler: createTaskInputHandler('unchecked'),
      }),
      // Match "[x] " or "[X] " - checked task item
      new InputRule({
        find: /(?:^|\s)\[[xX]\]\s$/,
        handler: createTaskInputHandler('checked'),
      }),
      // Match "[n] " or "[N] " - nope task item
      new InputRule({
        find: /(?:^|\s)\[[nN]\]\s$/,
        handler: createTaskInputHandler('nope'),
      }),
    ];
  },

  addCommands() {
    return {
      setTaskItemState:
        (state: TaskItemState) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { checked: state });
        },
      convertToTaskItem:
        (state: TaskItemState = 'unchecked') =>
        ({ tr, state: editorState, dispatch }) => {
          const { selection } = editorState;
          const $from = selection.$from;

          const listItemPos = findParentListItemPos($from);
          if (listItemPos === null) return false;

          if (dispatch) {
            tr.setNodeMarkup(listItemPos, this.type, { checked: state });
          }
          return true;
        },
      convertToListItem:
        () =>
        ({ tr, state: editorState, dispatch, editor }) => {
          const { selection } = editorState;
          const $from = selection.$from;

          // Find the parent taskItem
          let taskItemDepth = -1;
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'taskItem') {
              taskItemDepth = depth;
              break;
            }
          }

          // If not in a taskItem, return false
          if (taskItemDepth === -1) return false;

          const taskItemPos = $from.before(taskItemDepth);
          const listItemType = editor.schema.nodes['listItem'];

          if (!listItemType) return false;

          if (dispatch) {
            // Convert taskItem to listItem (remove the checked attribute)
            tr.setNodeMarkup(taskItemPos, listItemType, {});
          }
          return true;
        },
      toggleTaskItem:
        () =>
        ({ state: editorState, chain, editor }) => {
          const { selection } = editorState;
          const $from = selection.$from;

          // Check if we're in a taskItem
          let inTaskItem = false;
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'taskItem') {
              inTaskItem = true;
              break;
            }
          }

          if (inTaskItem) {
            // Convert taskItem to listItem
            return chain().convertToListItem().run();
          }

          // Check if we're in a listItem
          let inListItem = false;
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'listItem') {
              inListItem = true;
              break;
            }
          }

          if (inListItem) {
            // Convert listItem to taskItem
            return chain().convertToTaskItem().run();
          }

          // Not in a list - create a bullet list with a task item
          // First toggle bullet list, then convert to task item
          const listItemType = editor.schema.nodes['listItem'];
          if (!listItemType) return false;

          return chain().toggleBulletList().convertToTaskItem().run();
        },
    };
  },
});

/**
 * Check if the resolved position is within a list (bulletList or orderedList)
 */
function isInList(
  $pos: ReturnType<typeof import('@tiptap/pm/model').Node.prototype.resolve>
): boolean {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      return true;
    }
  }
  return false;
}

/**
 * Find the position of the parent list item (listItem or taskItem)
 */
function findParentListItemPos(
  $pos: ReturnType<typeof import('@tiptap/pm/model').Node.prototype.resolve>
): number | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
      return $pos.before(depth);
    }
  }
  return null;
}

export default TriStateTaskItem;
