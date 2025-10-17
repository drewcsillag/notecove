import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface NoteLinkOptions {
  HTMLAttributes: Record<string, any>;
  onNavigate?: (title: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteLink: {
      setNoteLink: (title: string) => ReturnType;
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
        (title: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { title });
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

              // Replace [[Note Title]] with just "Note Title" and apply mark
              tr.delete(matchStart, matchEnd)
                .insertText(noteTitle, matchStart)
                .addMark(
                  matchStart,
                  matchStart + noteTitle.length,
                  state.schema.marks.noteLink.create({ title: noteTitle })
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
              const title = noteLinkMark.attrs.title;
              if (title) {
                onNavigate(title);
              }
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
