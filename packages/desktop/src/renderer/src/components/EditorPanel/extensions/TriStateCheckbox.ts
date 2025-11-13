/**
 * TriStateCheckbox - Inline tri-state checkbox node
 *
 * An inline checkbox with three states: unchecked, checked, nope
 * Can appear anywhere in text:
 * - [] text (in lists)
 * - foo [] bar (inline in text)
 * - [] text (at start of paragraph)
 */
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export type CheckboxState = 'unchecked' | 'checked' | 'nope';

// Extend TipTap's Commands interface to include our custom command
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    triStateCheckbox: {
      /**
       * Insert a tri-state checkbox at the current cursor position
       */
      insertTriStateCheckbox: (state?: CheckboxState) => ReturnType;
    };
  }
}

function getNextState(currentState: CheckboxState): CheckboxState {
  if (currentState === 'unchecked') return 'checked';
  if (currentState === 'checked') return 'nope';
  return 'unchecked';
}

export const TriStateCheckbox = Node.create({
  name: 'triStateCheckbox',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      checked: {
        default: 'unchecked' as CheckboxState,
        parseHTML: (element: HTMLElement) => {
          const dataChecked = element.getAttribute('data-checked');
          if (dataChecked === 'checked') return 'checked';
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
        tag: 'span[data-type="tri-state-checkbox"]',
        priority: 51,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'tri-state-checkbox' })];
  },

  addCommands() {
    return {
      insertTriStateCheckbox:
        (state: CheckboxState = 'unchecked') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { checked: state },
          });
        },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const checkbox = document.createElement('span');
      const checkboxContent = document.createElement('span');

      let currentNodeRef = node;

      const updateState = (state: CheckboxState) => {
        checkbox.dataset['checked'] = state;
        checkbox.dataset['type'] = 'tri-state-checkbox';
        checkbox.className = 'tri-state-checkbox';
        checkboxContent.className = 'tri-state-checkbox-content';

        if (state === 'unchecked') {
          checkboxContent.textContent = '';
        } else if (state === 'checked') {
          checkboxContent.textContent = '✓';
        } else {
          checkboxContent.textContent = 'N';
        }
      };

      checkbox.contentEditable = 'false';
      checkbox.style.display = 'inline-flex';
      checkbox.style.alignItems = 'center';
      checkbox.style.justifyContent = 'center';
      checkbox.style.cursor = 'pointer';
      checkbox.style.userSelect = 'none';

      checkbox.addEventListener('click', (event) => {
        event.preventDefault();
        if (!editor.isEditable) return;

        const currentState = currentNodeRef.attrs['checked'] as CheckboxState;
        const nextState = getNextState(currentState);

        if (typeof getPos === 'function') {
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .command(({ tr }) => {
              const position = getPos();
              if (typeof position !== 'number') return false;
              const nodeAtPos = tr.doc.nodeAt(position);
              tr.setNodeMarkup(position, undefined, {
                ...nodeAtPos?.attrs,
                checked: nextState,
              });
              return true;
            })
            .run();
        }
      });

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        checkbox.setAttribute(key, String(value));
      });

      const initialState = node.attrs['checked'] as CheckboxState;
      updateState(initialState);

      checkbox.appendChild(checkboxContent);

      return {
        dom: checkbox,
        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type !== this.type) return false;
          currentNodeRef = updatedNode;
          const newState = updatedNode.attrs['checked'] as CheckboxState;
          updateState(newState);
          return true;
        },
      };
    };
  },

  addInputRules() {
    return [
      // Match "[] " - unchecked
      new InputRule({
        find: /\[\s*\]\s$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.replaceWith(start, end, this.type.create({ checked: 'unchecked' }));
        },
      }),
      // Match "[x] " - checked
      new InputRule({
        find: /\[x\]\s$/i,
        handler: ({ state, range }) => {
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ checked: 'checked' }));
        },
      }),
      // Match "[n] " - nope
      new InputRule({
        find: /\[n\]\s$/i,
        handler: ({ state, range }) => {
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ checked: 'nope' }));
        },
      }),
    ];
  },
});

export default TriStateCheckbox;
