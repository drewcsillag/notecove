import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface NoteLinkOptions {
  HTMLAttributes: Record<string, any>;
  onNavigate?: (noteId: string, title: string) => void;
  findNoteByTitle?: (title: string) => { id: string; title: string } | null;
  validateNoteLink?: (noteId: string | null, title: string) => boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteLink: {
      setNoteLink: (title: string, noteId?: string) => ReturnType;
      unsetNoteLink: () => ReturnType;
    };
  }
}

/**
 * NoteLink mark extension
 * Creates clickable wiki-style links with [[Note Title]] syntax
 */
export const NoteLink = Mark.create<NoteLinkOptions>({
  name: 'noteLink',

  addOptions() {
    return {
      HTMLAttributes: {},
      onNavigate: undefined,
      findNoteByTitle: undefined,
      validateNoteLink: undefined,
    };
  },

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: element => element.getAttribute('data-note-title'),
        renderHTML: attributes => {
          if (!attributes.title) {
            return {};
          }
          return {
            'data-note-title': attributes.title,
          };
        },
      },
      noteId: {
        default: null,
        parseHTML: element => element.getAttribute('data-note-id'),
        renderHTML: attributes => {
          if (!attributes.noteId) {
            return {};
          }
          return {
            'data-note-id': attributes.noteId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-note-link]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        { 'data-note-link': '' }
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setNoteLink:
        (title: string, noteId?: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { title, noteId });
        },
      unsetNoteLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    const onNavigate = this.options.onNavigate;
    const findNoteByTitle = this.options.findNoteByTitle;

    return [
      // Input rule plugin to detect [[...]] as user types
      new Plugin({
        key: new PluginKey('noteLinkInput'),
        props: {
          handleTextInput(view, from, to, text) {
            const { state, dispatch } = view;
            const { tr } = state;

            // Get text before cursor
            const $from = state.doc.resolve(from);
            const textBefore = $from.parent.textBetween(
              Math.max(0, $from.parentOffset - 100),
              $from.parentOffset,
              undefined,
              '\ufffc'
            ) + text;

            // Check if we just completed a [[...]] pattern
            const linkMatch = textBefore.match(/\[\[([^\]]+)\]\]$/);

            if (linkMatch) {
              const noteTitle = linkMatch[1];
              const matchStart = from - linkMatch[0].length + text.length;
              const matchEnd = from + text.length;

              // Look up the note to get its ID
              let noteId: string | null = null;
              if (findNoteByTitle) {
                const foundNote = findNoteByTitle(noteTitle);
                if (foundNote) {
                  noteId = foundNote.id;
                }
              }

              // Replace [[Note Title]] with just "Note Title" and apply mark
              // Store both title and noteId (if found)
              tr.delete(matchStart, matchEnd)
                .insertText(noteTitle, matchStart)
                .addMark(
                  matchStart,
                  matchStart + noteTitle.length,
                  state.schema.marks.noteLink.create({
                    title: noteTitle,
                    noteId: noteId
                  })
                );

              dispatch(tr);
              return true;
            }

            return false;
          },

          // Handle clicks on note links
          handleClick(view, pos, event) {
            if (!onNavigate) return false;

            const { doc } = view.state;
            const $pos = doc.resolve(pos);
            const marks = $pos.marks();

            const noteLinkMark = marks.find(mark => mark.type.name === 'noteLink');
            if (noteLinkMark) {
              event.preventDefault();
              const noteId = noteLinkMark.attrs.noteId;
              const title = noteLinkMark.attrs.title;
              // Prefer noteId if available, fallback to title
              if (noteId || title) {
                onNavigate(noteId, title);
              }
              return true;
            }

            return false;
          },
        },
      }),

      // Decoration plugin to mark broken links
      new Plugin({
        key: new PluginKey('noteLinkValidation'),
        state: {
          init(_, { doc }) {
            return findBrokenLinks(doc, this.spec?.validateNoteLink);
          },
          apply(transaction, oldState) {
            if (!transaction.docChanged) return oldState;
            return findBrokenLinks(transaction.doc, this.spec?.validateNoteLink);
          }
        },
        props: {
          decorations(state) {
            return this.getState(state);
          }
        },
        spec: {
          validateNoteLink: this.options.validateNoteLink
        }
      }),
    ];
  },
});

/**
 * Find all note links and create decorations for broken ones
 */
function findBrokenLinks(
  doc: ProseMirrorNode,
  validateNoteLink?: (noteId: string | null, title: string) => boolean
): DecorationSet {
  const decorations: Decoration[] = [];

  if (!validateNoteLink) {
    return DecorationSet.empty;
  }

  doc.descendants((node, pos) => {
    if (!node.marks) return;

    node.marks.forEach(mark => {
      if (mark.type.name === 'noteLink') {
        const noteId = mark.attrs.noteId;
        const title = mark.attrs.title;

        // Check if this link is broken
        const isValid = validateNoteLink(noteId, title);
        if (!isValid) {
          decorations.push(
            Decoration.inline(pos, pos + node.nodeSize, {
              class: 'note-link-broken'
            })
          );
        }
      }
    });
  });

  return DecorationSet.create(doc, decorations);
}
