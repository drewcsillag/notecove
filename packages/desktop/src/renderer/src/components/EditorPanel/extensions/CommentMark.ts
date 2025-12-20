/**
 * CommentMark TipTap Extension
 *
 * A mark extension for highlighting text that has comments attached.
 * Each mark stores the thread ID and can be clicked to select that thread
 * in the comment panel.
 *
 * This is a collaborative mark that syncs via Yjs.
 */

import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
  onCommentClick?: (threadId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      /**
       * Set a comment mark on the current selection
       */
      setCommentMark: (threadId: string) => ReturnType;
      /**
       * Toggle a comment mark on the current selection
       */
      toggleCommentMark: (threadId: string) => ReturnType;
      /**
       * Remove a comment mark from the current selection
       */
      unsetCommentMark: (threadId: string) => ReturnType;
      /**
       * Remove all comment marks with a specific thread ID from the entire document
       */
      removeCommentMarkById: (threadId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'commentMark',

  // Allow multiple comment marks to stack on the same text range
  // Each mark has a unique threadId, so they represent different comment threads
  excludes: '',

  addOptions(): CommentMarkOptions {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-thread-id'),
        renderHTML: (attributes) => {
          if (!attributes['threadId']) {
            return {};
          }
          return {
            'data-thread-id': attributes['threadId'] as string,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-mark]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-comment-mark': '',
        class: 'comment-highlight',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCommentMark:
        (threadId: string) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          // Use addMark to allow stacking multiple comment marks
          const mark = markType.create({ threadId });
          if (dispatch) {
            tr.addMark(from, to, mark);
            dispatch(tr);
          }
          return true;
        },
      toggleCommentMark:
        (threadId: string) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { threadId });
        },
      unsetCommentMark:
        (_threadId: string) =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      removeCommentMarkById:
        (threadId: string) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          let modified = false;

          doc.descendants((node, pos) => {
            if (node.isText) {
              const marks = node.marks.filter(
                (mark) => mark.type.name === this.name && mark.attrs['threadId'] === threadId
              );
              if (marks.length > 0) {
                marks.forEach((mark) => {
                  tr.removeMark(pos, pos + node.nodeSize, mark);
                  modified = true;
                });
              }
            }
          });

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (modified && dispatch) {
            dispatch(tr);
          }

          return modified;
        },
    };
  },
});
