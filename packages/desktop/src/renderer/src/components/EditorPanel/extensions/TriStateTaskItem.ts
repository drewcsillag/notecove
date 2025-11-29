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
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

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
    };
  }
}

function getNextState(currentState: TaskItemState): TaskItemState {
  if (currentState === 'unchecked') return 'checked';
  if (currentState === 'checked') return 'nope';
  return 'unchecked';
}

// Note: Auto-sort feature disabled for now. When re-enabled, use this:
// function isCompletedState(state: TaskItemState): boolean {
//   return state === 'checked' || state === 'nope';
// }

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
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    };

    if (this.options.nested) {
      shortcuts['Tab'] = () => this.editor.commands.sinkListItem(this.name);
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
        // Note: wasCompleted and willBeCompleted are computed but unused since auto-sort is disabled
        // const wasCompleted = isCompletedState(currentState);
        // const willBeCompleted = isCompletedState(nextState);

        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .command(({ tr }) => {
            const pos = getPos();
            if (typeof pos !== 'number') return false;

            // Update the node's state
            tr.setNodeMarkup(pos, undefined, {
              ...currentNode.attrs,
              checked: nextState,
            });

            return true;
          })
          .run();

        // Auto-sort: disabled for now due to complexity with node view re-creation
        // TODO: Implement auto-sort in a future iteration
        // if (wasCompleted !== willBeCompleted) {
        //   setTimeout(() => {
        //     reorderTaskItems(editor, getPos, willBeCompleted);
        //   }, 10);
        // }
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

// Auto-sort feature disabled for now due to complexity with ProseMirror node view lifecycle.
// When a task item is toggled, the node view gets re-created, causing issues with position tracking.
// TODO: Implement auto-sort in a future iteration. The reorderTaskItems function was here but
// has been removed to clean up TypeScript warnings. See git history if needed.

export default TriStateTaskItem;
