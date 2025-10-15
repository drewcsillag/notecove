import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface TaskItemOptions {
  nested: boolean;
  HTMLAttributes: Record<string, any>;
}

type CheckedState = 'done' | 'nope' | null;

/**
 * Custom TaskItem extension with three states: TODO, DONE, NOPE
 * Based on TipTap's TaskItem but with an additional "nope" state
 */
export const TaskItem = Node.create<TaskItemOptions>({
  name: 'taskItem',

  addOptions() {
    return {
      nested: false,
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
        default: null,
        parseHTML: (element: HTMLElement): CheckedState => {
          const checked = element.getAttribute('data-checked');
          if (checked === 'done') return 'done';
          if (checked === 'nope') return 'nope';
          return null;
        },
        renderHTML: (attributes: { checked?: CheckedState }): Record<string, any> => {
          if (!attributes.checked) {
            return {};
          }
          return {
            'data-checked': attributes.checked,
          };
        },
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

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        'data-checked': node.attrs.checked || 'todo',
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    const shortcuts = {
      Enter: () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    };

    if (!this.options.nested) {
      return shortcuts;
    }

    return {
      ...shortcuts,
      Tab: () => this.editor.commands.sinkListItem(this.name),
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('li');
      const checkboxWrapper = document.createElement('label');
      const checkboxStyler = document.createElement('span');
      checkboxStyler.classList.add('task-checkbox');
      const checkbox = document.createElement('input');
      const content = document.createElement('div');

      checkboxWrapper.contentEditable = 'false';
      checkboxWrapper.style.cursor = 'pointer';
      checkbox.type = 'checkbox';
      checkbox.style.display = 'none'; // Hide the actual checkbox, show only our custom one
      checkbox.addEventListener('change', (event: Event) => {
        // Prevent default to handle our custom tri-state logic
        event.preventDefault();
      });

      // Handle click for tri-state logic
      checkboxWrapper.addEventListener('click', (event: Event) => {
        event.preventDefault();
        if (typeof getPos === 'function') {
          // Get the current node from the editor's state, not the closure variable
          const pos = getPos();
          const currentNode = editor.state.doc.nodeAt(pos);
          const currentState = currentNode?.attrs.checked as CheckedState;
          let newState: CheckedState;

          if (currentState === null) {
            newState = 'done';
          } else if (currentState === 'done') {
            newState = 'nope';
          } else {
            newState = null;
          }

          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...currentNode?.attrs,
              checked: newState,
            });
            return true;
          });
        }
      });

      // Set data-type attribute for the task item
      listItem.setAttribute('data-type', 'taskItem');

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, String(value));
      });

      listItem.dataset.checked = node.attrs.checked || 'todo';
      checkboxWrapper.appendChild(checkboxStyler);
      checkboxWrapper.appendChild(checkbox);
      listItem.append(checkboxWrapper, content);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, String(value));
      });

      // Update visual state
      const updateCheckbox = (currentNode: ProseMirrorNode) => {
        const state = currentNode.attrs.checked as CheckedState;

        if (state === 'done') {
          checkbox.checked = true;
          checkbox.disabled = false;
          checkboxStyler.classList.remove('nope');
          checkboxStyler.classList.add('done');
          listItem.dataset.checked = 'done';
        } else if (state === 'nope') {
          checkbox.checked = false;
          checkbox.disabled = true;
          checkboxStyler.classList.remove('done');
          checkboxStyler.classList.add('nope');
          listItem.dataset.checked = 'nope';
        } else {
          checkbox.checked = false;
          checkbox.disabled = false;
          checkboxStyler.classList.remove('done', 'nope');
          listItem.dataset.checked = 'todo';
        }
      };

      updateCheckbox(node);

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          // Update checkbox with new node
          updateCheckbox(updatedNode);
          return true;
        },
      };
    };
  },
});
