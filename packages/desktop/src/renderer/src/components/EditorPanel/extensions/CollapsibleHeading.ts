/**
 * CollapsibleHeading Extension
 *
 * Extends TipTap's Heading node with collapsible functionality.
 * Users can click a toggle to collapse/expand content under a heading.
 *
 * Features:
 * - `collapsed` attribute (boolean, default: false)
 * - Toggle button (▶/▼) next to heading
 * - Keyboard shortcuts: Mod-. to toggle, Mod-Shift-. to collapse/expand all (Step 4)
 *
 * The hiding of collapsed content is handled by CollapseDecorations plugin (Step 3).
 *
 * @see plans/collapsible-headings/PLAN.md
 */

import { Heading } from '@tiptap/extension-heading';
import type { Level } from '@tiptap/extension-heading';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface CollapsibleHeadingOptions {
  /**
   * The available heading levels.
   * @default [1, 2, 3]
   */
  levels: Level[];

  /**
   * The HTML attributes for a heading node.
   * @default {}
   */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapsibleHeading: {
      /**
       * Toggle the collapsed state of the heading at cursor
       */
      toggleHeadingCollapse: () => ReturnType;
      /**
       * Collapse all headings in the document
       */
      collapseAllHeadings: () => ReturnType;
      /**
       * Expand all headings in the document
       */
      expandAllHeadings: () => ReturnType;
    };
  }
}

/**
 * CollapsibleHeading extension
 *
 * Extends the base Heading extension with:
 * - `collapsed` attribute for tracking collapse state
 * - `keepOnSplit: false` ensures new headings from Enter are expanded
 */
export const CollapsibleHeading = Heading.extend<CollapsibleHeadingOptions>({
  addOptions() {
    return {
      levels: [1, 2, 3] as Level[],
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        // Don't keep collapsed state when splitting (Enter in heading)
        keepOnSplit: false,
        parseHTML: (element: HTMLElement) => {
          const attr = element.getAttribute('data-collapsed');
          return attr === 'true';
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          // Only render the attribute if collapsed is true
          if (!attributes['collapsed']) {
            return {};
          }
          return { 'data-collapsed': 'true' };
        },
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      // Mod-. toggles collapse on heading at cursor
      'Mod-.': () => this.editor.commands.toggleHeadingCollapse(),
      // Mod-Shift-. collapses all if any expanded, expands all if all collapsed
      'Mod-Shift-.': () => {
        // Check if any heading is expanded by collecting headings first
        const headings: boolean[] = [];
        this.editor.state.doc.descendants((node) => {
          if (node.type.name === 'heading') {
            headings.push(node.attrs['collapsed'] as boolean);
          }
          return true;
        });

        const anyExpanded = headings.some((collapsed) => !collapsed);
        if (anyExpanded) {
          return this.editor.commands.collapseAllHeadings();
        } else {
          return this.editor.commands.expandAllHeadings();
        }
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      toggleHeadingCollapse:
        () =>
        ({ tr, state, dispatch }) => {
          const { $from } = state.selection;

          // Find the heading node containing the cursor
          let headingPos: number | null = null;
          let headingNode = null;

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'heading') {
              headingPos = $from.before(depth);
              headingNode = node;
              break;
            }
          }

          // If not in a heading, do nothing
          if (headingPos === null || headingNode === null) {
            return false;
          }

          if (dispatch) {
            tr.setNodeMarkup(headingPos, undefined, {
              ...headingNode.attrs,
              collapsed: !headingNode.attrs['collapsed'],
            });
          }

          return true;
        },
      collapseAllHeadings:
        () =>
        ({ tr, state, dispatch }) => {
          let changed = false;

          state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && !node.attrs['collapsed']) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  collapsed: true,
                });
              }
              changed = true;
            }
          });

          return changed;
        },
      expandAllHeadings:
        () =>
        ({ tr, state, dispatch }) => {
          let changed = false;

          state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && node.attrs['collapsed']) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  collapsed: false,
                });
              }
              changed = true;
            }
          });

          return changed;
        },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      // Create wrapper div (position: relative for absolute toggle)
      const wrapper = document.createElement('div');
      wrapper.className = 'heading-wrapper';

      // Create toggle button (will be absolutely positioned in left margin)
      const toggleButton = document.createElement('button');
      toggleButton.className = 'heading-collapse-toggle';
      toggleButton.contentEditable = 'false';
      toggleButton.type = 'button';
      toggleButton.tabIndex = -1; // Keep out of tab order to not interfere with editor focus
      toggleButton.setAttribute('aria-label', 'Toggle heading collapse');

      // Create the actual heading element
      const level = node.attrs['level'] as Level;
      const headingElement = document.createElement(`h${level}`);

      // Apply HTML attributes to heading
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (key !== 'data-collapsed' && key !== 'data-level') {
          headingElement.setAttribute(key, String(value));
        }
      });

      // Update visual state based on collapsed attribute
      const updateVisualState = (collapsed: boolean, headingLevel: Level) => {
        wrapper.setAttribute('data-collapsed', String(collapsed));
        wrapper.setAttribute('data-level', String(headingLevel));
        // Use smaller triangles that look cleaner
        toggleButton.textContent = collapsed ? '▸' : '▾';
        toggleButton.setAttribute('aria-expanded', String(!collapsed));
      };

      // Initial state
      updateVisualState(node.attrs['collapsed'] as boolean, level);

      // Click handler for toggle button
      toggleButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!editor.isEditable) return;
        if (typeof getPos !== 'function') return;

        const position = getPos();
        if (typeof position !== 'number') return;

        const currentNode = editor.state.doc.nodeAt(position);
        if (!currentNode) return;

        const currentCollapsed = currentNode.attrs['collapsed'] as boolean;

        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .command(({ tr }) => {
            const pos = getPos();
            if (typeof pos !== 'number') return false;

            tr.setNodeMarkup(pos, undefined, {
              ...currentNode.attrs,
              collapsed: !currentCollapsed,
            });

            return true;
          })
          .run();
      });

      // Assemble the DOM - toggle button first, then heading
      wrapper.appendChild(toggleButton);
      wrapper.appendChild(headingElement);

      return {
        dom: wrapper,
        contentDOM: headingElement,
        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type !== this.type) return false;

          const newLevel = updatedNode.attrs['level'] as Level;
          const newCollapsed = updatedNode.attrs['collapsed'] as boolean;

          // Update visual state
          updateVisualState(newCollapsed, newLevel);

          // If level changed, we need to recreate the heading element
          // Return false to force re-render
          if (newLevel !== level) {
            return false;
          }

          return true;
        },
      };
    };
  },
});

export default CollapsibleHeading;
