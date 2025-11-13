/**
 * Inter-Note Link TipTap Extension
 *
 * Parses and renders [[note-id]] syntax in notes.
 * - User types [[Note Title]] and autocomplete suggests notes
 * - When selected, inserts [[note-id]] into document
 * - When rendering, displays the note title (looked up from database)
 *
 * This uses a ProseMirror decoration plugin to identify and style inter-note links
 * without modifying the document structure itself.
 */

import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { ResolvedPos } from '@tiptap/pm/model';
import { LINK_PATTERN } from '@notecove/shared';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionMatch } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { LinkSuggestionList, type LinkSuggestionListRef } from './LinkSuggestionList';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';

export interface InterNoteLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Omit<SuggestionOptions, 'editor'>;
  onLinkClick?: (noteId: string) => void;
  onLinkDoubleClick?: (noteId: string) => void;
}

// Cache for note titles to avoid excessive IPC calls
const noteTitleCache = new Map<string, string>();

// Cache for broken link status (note doesn't exist or is deleted)
const brokenLinkCache = new Set<string>();

/**
 * Clear the title cache for a specific note ID
 * This should be called when a note's title changes
 */
export function clearNoteTitleCache(noteId?: string): void {
  if (noteId) {
    noteTitleCache.delete(noteId);
    brokenLinkCache.delete(noteId);
  } else {
    // Clear all caches
    noteTitleCache.clear();
    brokenLinkCache.clear();
  }
}

/**
 * Custom find suggestion match function for [[ trigger
 * Based on TipTap's default findSuggestionMatch but modified for [[ pattern
 */
function findDoubleBracketMatch($position: ResolvedPos): SuggestionMatch | null {
  // Get the text before the current position
  // We search within the current text block (paragraph)
  const textFrom = $position.before();
  const textTo = $position.pos;
  const text = $position.doc.textBetween(textFrom, textTo, '\0', '\0');

  console.log('[findDoubleBracketMatch] text:', JSON.stringify(text), 'pos:', $position.pos);

  // Look for [[ followed by any characters that aren't ] (the query)
  // Must be at the end of the text (where cursor is)
  // Pattern: [[ followed by any non-] characters, ending at cursor position
  const regex = /\[\[([^\]]*?)$/;
  const match = regex.exec(text);

  if (!match) {
    console.log('[findDoubleBracketMatch] no match found');
    return null;
  }

  console.log('[findDoubleBracketMatch] match found:', match[0], 'query:', match[1]);

  // Calculate the actual position in the document
  const matchStart = textFrom + match.index;
  // Use current cursor position as the end, not the matched text end
  // This ensures we include any character being typed when autocomplete is triggered
  const matchEnd = $position.pos;

  return {
    range: {
      from: matchStart,
      to: matchEnd,
    },
    query: match[1] ?? '', // The text after [[
    text: match[0], // The full match including [[
  };
}

export const InterNoteLink = Extension.create<InterNoteLinkOptions>({
  name: 'interNoteLink',

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        // Use custom findSuggestionMatch for [[ trigger
        findSuggestionMatch: ({ $position }: { $position: ResolvedPos }) => {
          return findDoubleBracketMatch($position);
        },
        pluginKey: new PluginKey('interNoteLinkSuggestion'),

        command: ({ editor, range, props }) => {
          // props contains the selected note
          const note = props as { id: string; title: string };

          // Delete the [[ and any query text
          // Then insert [[note-id]]
          editor
            .chain()
            .focus()
            .deleteRange({
              from: range.from,
              to: range.to,
            })
            .insertContent(`[[${note.id}]]`)
            .run();
        },

        items: async ({ query }) => {
          try {
            console.log('[InterNoteLink] items() called with query:', JSON.stringify(query));
            // Fetch notes matching the query
            const notes = await window.electronAPI.link.searchNotesForAutocomplete(query);
            console.log(
              '[InterNoteLink] searchNotesForAutocomplete returned',
              notes.length,
              'notes'
            );
            if (notes.length > 0) {
              console.log('[InterNoteLink] First note:', notes[0]?.title);
            }
            return notes.slice(0, 10);
          } catch (error) {
            console.error('[InterNoteLink] Failed to fetch notes for autocomplete:', error);
            return [];
          }
        },

        render: () => {
          let component: ReactRenderer | undefined;
          let popup: TippyInstance[] | undefined;

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(LinkSuggestionList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },

            onUpdate(props: SuggestionProps) {
              component?.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }

              return (
                (component?.ref as LinkSuggestionListRef | undefined)?.onKeyDown(props) ?? false
              );
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const onLinkClick = this.options.onLinkClick;
    const onLinkDoubleClick = this.options.onLinkDoubleClick;

    // Store a reference to the editor view for triggering re-renders
    let editorView: EditorView | null = null;
    // Track click timeout to prevent single-click action when double-clicking
    let clickTimeout: NodeJS.Timeout | null = null;

    return [
      // Decoration plugin for styling existing inter-note links
      new Plugin({
        key: new PluginKey('interNoteLink'),
        state: {
          init(_, { doc }) {
            return findAndDecorateLinks(doc, editorView);
          },
          apply(transaction, oldState) {
            // Regenerate decorations if document changed or if forced via metadata
            if (transaction.docChanged || transaction.getMeta('forceDecoration')) {
              return findAndDecorateLinks(transaction.doc, editorView);
            }
            return oldState.map(transaction.mapping, transaction.doc);
          },
        },
        view(view) {
          editorView = view;
          return {
            destroy() {
              editorView = null;
            },
          };
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            if (!target.classList.contains('inter-note-link')) {
              return false;
            }

            const noteId = target.getAttribute('data-note-id');
            if (!noteId) {
              return false;
            }

            // Clear any pending click timeout
            if (clickTimeout) {
              clearTimeout(clickTimeout);
              clickTimeout = null;
            }

            if (onLinkClick) {
              // Set timeout to handle single click after double-click window
              clickTimeout = setTimeout(() => {
                onLinkClick(noteId);
                clickTimeout = null;
              }, 300);
            }

            return true;
          },
          handleDoubleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            if (!target.classList.contains('inter-note-link')) {
              return false;
            }

            const noteId = target.getAttribute('data-note-id');
            if (!noteId) {
              return false;
            }

            // Cancel pending single-click action
            if (clickTimeout) {
              clearTimeout(clickTimeout);
              clickTimeout = null;
            }

            if (onLinkDoubleClick) {
              onLinkDoubleClick(noteId);
            }

            return true;
          },
        },
      }),
      // Suggestion plugin for autocomplete
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

/**
 * Find all inter-note links in the document and create decorations for them
 * This function needs to:
 * 1. Find [[note-id]] patterns
 * 2. Look up the note title for each ID
 * 3. Create decorations that display the title instead of the ID
 */
function findAndDecorateLinks(doc: PMNode, editorView?: EditorView | null): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    const text = node.text;
    // Create a new regex for each text node to avoid stateful lastIndex issues
    const regex = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      const noteId = (match[1] ?? '').toLowerCase();

      // If we don't have the title cached, fetch it asynchronously
      if (!noteTitleCache.has(noteId)) {
        // Set placeholder immediately to prevent multiple fetches
        noteTitleCache.set(noteId, 'Loading...');
        void fetchNoteTitle(noteId, editorView);
      }

      // Create a widget that replaces the [[note-id]] text
      const widget = Decoration.widget(
        to,
        () => {
          // Read from cache inside the factory function so it picks up updates
          const title = noteTitleCache.get(noteId) ?? 'Loading...';
          const isBroken = brokenLinkCache.has(noteId);

          const span = document.createElement('span');
          span.className = isBroken ? 'inter-note-link-broken' : 'inter-note-link';
          span.setAttribute('data-note-id', noteId);
          span.setAttribute('role', isBroken ? 'text' : 'link');
          span.setAttribute(
            'aria-label',
            isBroken ? `Broken link to ${title}` : `Link to ${title}`
          );
          if (!isBroken) {
            span.setAttribute('tabindex', '0');
          }
          // Display as [[title]] to make it clear it's a link
          span.textContent = `[[${title}]]`;
          return span;
        },
        {
          side: -1, // Place widget before the position
        }
      );

      // Hide the original [[note-id]] text
      const hideDecoration = Decoration.inline(from, to, {
        class: 'inter-note-link-hidden',
      });

      decorations.push(hideDecoration, widget);
    }
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Fetch note title from database and cache it
 */
async function fetchNoteTitle(noteId: string, editorView?: EditorView | null): Promise<void> {
  try {
    // Fetch all notes to find the title
    // This is not efficient but works for MVP
    const notes = await window.electronAPI.link.searchNotesForAutocomplete('');
    const note = notes.find((n) => n.id === noteId);

    if (note) {
      noteTitleCache.set(noteId, note.title);
      brokenLinkCache.delete(noteId); // Mark as valid
    } else {
      noteTitleCache.set(noteId, '[Note not found]');
      brokenLinkCache.add(noteId); // Mark as broken
    }

    // Trigger editor update to re-render with new title
    // Use metadata flag to force decoration regeneration
    if (editorView) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const tr = (editorView.state as any).tr;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      tr.setMeta('forceDecoration', true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      editorView.dispatch(tr);
    }
  } catch (error) {
    console.error('[InterNoteLink] Failed to fetch note title:', error);
    noteTitleCache.set(noteId, '[Error loading title]');
    brokenLinkCache.add(noteId); // Mark as broken on error

    // Still trigger re-render to show error message
    if (editorView) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const tr = (editorView.state as any).tr;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      tr.setMeta('forceDecoration', true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      editorView.dispatch(tr);
    }
  }
}
