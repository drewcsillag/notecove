import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Custom TaskItem extension with three states: TODO, DONE, NOPE
 * Based on TipTap's TaskItem but with an additional "nope" state
 */
export const TaskItem = Node.create({
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
        parseHTML: element => {
          const checked = element.getAttribute('data-checked');
          if (checked === 'done') return 'done';
          if (checked === 'nope') return 'nope';
          return null;
        },
        renderHTML: attributes => {
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
      }),
      [
        'label',
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked === 'done' ? true : null,
            disabled: node.attrs.checked === 'nope' ? true : null,
          },
        ],
        ['span', 0],
      ],
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
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', event => {
        // Prevent default to handle our custom tri-state logic
        event.preventDefault();
      });

      // Handle click for tri-state logic
      checkboxWrapper.addEventListener('click', event => {
        event.preventDefault();
        if (typeof getPos === 'function') {
          const currentState = node.attrs.checked;
          let newState;

          if (currentState === null) {
            newState = 'done';
          } else if (currentState === 'done') {
            newState = 'nope';
          } else {
            newState = null;
          }

          editor.commands.command(({ tr }) => {
            const pos = getPos();
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              checked: newState,
            });
            return true;
          });
        }
      });

      // Set data-type attribute for the task item
      listItem.setAttribute('data-type', 'taskItem');

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      listItem.dataset.checked = node.attrs.checked || 'todo';
      checkboxWrapper.appendChild(checkboxStyler);
      checkboxWrapper.appendChild(checkbox);
      listItem.append(checkboxWrapper, content);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      // Update visual state
      const updateCheckbox = () => {
        const state = node.attrs.checked;

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

      updateCheckbox();

      return {
        dom: listItem,
        contentDOM: content,
        update: updatedNode => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          updateCheckbox();
          return true;
        },
      };
    };
  },
});
