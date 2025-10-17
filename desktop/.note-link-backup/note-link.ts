import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { InputRule } from '@tiptap/core';

export interface NoteLinkOptions {
  /**
   * Callback to get note by title
   */
  getNoteByTitle?: (title: string) => { id: string; title: string } | null;

  /**
   * Callback to get note by ID
   */
  getNoteById?: (id: string) => { id: string; title: string } | null;

  /**
   * Callback when a note link is clicked
   */
  onClickLink?: (noteId: string, noteTitle: string, exists: boolean) => void;

  /**
   * Callback when user types >> to trigger autocomplete
   */
  onTriggerAutocomplete?: (query: string, range: { from: number; to: number }) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteLink: {
      /**
       * Insert a note link
       */
      insertNoteLink: (title: string, noteId?: string) => ReturnType;
    };
  }
}

/**
 * NoteLink extension for TipTap (as an inline Node)
 * Handles >>note title and >>"note with spaces" syntax for inter-note links
 */
export const NoteLink = Node.create<NoteLinkOptions>({
  name: 'noteLink',

  priority: 1000,

  // Inline node that acts like text
  inline: true,

  // Node is atomic (cannot select inside it)
  atom: true,

  // Node can appear anywhere inline content is allowed
  group: 'inline',

  addOptions() {
    return {
      getNoteByTitle: () => null,
      getNoteById: () => null,
      onClickLink: () => {},
      onTriggerAutocomplete: () => {},
    };
  },

  addAttributes() {
    return {
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
      noteTitle: {
        default: null,
        parseHTML: element => element.getAttribute('data-note-title'),
        renderHTML: attributes => {
          if (!attributes.noteTitle) {
            return {};
          }
          return {
            'data-note-title': attributes.noteTitle,
          };
        },
      },
      hasSpaces: {
        default: false,
        parseHTML: element => element.getAttribute('data-has-spaces') === 'true',
        renderHTML: attributes => {
          return {
            'data-has-spaces': attributes.hasSpaces ? 'true' : 'false',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-note-link]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          return {
            noteId: element.getAttribute('data-note-id'),
            noteTitle: element.getAttribute('data-note-title'),
            hasSpaces: element.getAttribute('data-has-spaces') === 'true',
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const noteId = node.attrs.noteId;
    const noteTitle = node.attrs.noteTitle;
    const hasSpaces = node.attrs.hasSpaces;

    // Check if note exists
    const note = noteId ? this.options.getNoteById?.(noteId) : null;
    const exists = !!note;

    // Display title (use current title from note if it exists, otherwise stored title)
    const displayTitle = exists && note ? note.title : noteTitle;

    // Format the display text with >> prefix and quotes if needed
    const formattedText = hasSpaces
      ? `>>"${displayTitle}"`
      : `>>${displayTitle}`;

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-note-link': 'true',
        'class': exists ? 'note-link note-link-exists' : 'note-link note-link-missing',
        'title': exists ? `Go to "${displayTitle}"` : `Create note "${displayTitle}"`,
      }),
      formattedText,
    ];
  },

  addCommands() {
    return {
      insertNoteLink: (title: string, noteId?: string, hasSpaces?: boolean) => ({ commands }) => {
        // If no noteId provided, try to find note by title
        if (!noteId) {
          const note = this.options.getNoteByTitle?.(title);
          noteId = note?.id || undefined;
        }

        // Detect if title has spaces if not explicitly provided
        if (hasSpaces === undefined) {
          hasSpaces = title.includes(' ');
        }

        return commands.insertContent({
          type: this.name,
          attrs: {
            noteTitle: title,
            noteId: noteId || null,
            hasSpaces,
          },
        });
      },
    };
  },

  addInputRules() {
    return [
      // Match >>note_title (without quotes, no spaces) - triggered by space
      new InputRule({
        find: />>([a-zA-Z0-9_-]+)\s$/,
        handler: ({ state, range, match }) => {
          const title = match[1];
          const note = this.options.getNoteByTitle?.(title);
          const noteId = note?.id || null;

          const { tr } = state;
          const { from, to } = range;

          // Create the noteLink node
          const node = this.type.create({
            noteTitle: title,
            noteId: noteId,
            hasSpaces: false,
          });

          // Replace the entire matched range (including space) with: node + space text node
          tr.replaceWith(from, to, [node, state.schema.text(' ')]);
        },
      }),
      // Match >>"note title with spaces" (with quotes) - triggered by space or closing quote
      new InputRule({
        find: />>"([^"]+)"\s?$/,
        handler: ({ state, range, match }) => {
          const title = match[1];
          const note = this.options.getNoteByTitle?.(title);
          const noteId = note?.id || null;

          const { tr } = state;
          const { from, to } = range;

          // Check if there's a trailing space in the match
          const hasTrailingSpace = match[0].endsWith(' ');

          // Create the noteLink node
          const node = this.type.create({
            noteTitle: title,
            noteId: noteId,
            hasSpaces: true,
          });

          // Replace with node and optionally a space
          const nodes = hasTrailingSpace
            ? [node, state.schema.text(' ')]
            : [node];
          tr.replaceWith(from, to, nodes);
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: new PluginKey('noteLinkClick'),
        props: {
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;

            // Check if clicked element is a note link
            if (target.hasAttribute('data-note-link')) {
              event.preventDefault();

              const noteId = target.getAttribute('data-note-id');
              const noteTitle = target.getAttribute('data-note-title') || '';
              const exists = target.classList.contains('note-link-exists');

              if (options.onClickLink) {
                options.onClickLink(noteId || '', noteTitle, exists);
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
