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
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { ResolvedPos } from '@tiptap/pm/model';
import { LINK_PATTERN, isFullUuid } from '@notecove/shared';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionMatch } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { LinkSuggestionList, type LinkSuggestionListRef } from './LinkSuggestionList';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { createFloatingPopup, type FloatingPopup } from './utils/floating-popup';

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
 * Pre-fetch all note titles into the cache.
 * Call this before loading a note to avoid "Loading..." flicker.
 * Returns a promise that resolves when all titles are cached.
 */
export async function prefetchNoteTitles(): Promise<void> {
  try {
    const notes = await window.electronAPI.link.searchNotesForAutocomplete('');
    for (const note of notes) {
      noteTitleCache.set(note.id, note.title);
      brokenLinkCache.delete(note.id);
    }
  } catch (error) {
    console.error('[InterNoteLink] Failed to prefetch note titles:', error);
  }
}

/**
 * Custom find suggestion match function for [[ trigger
 * Based on TipTap's default findSuggestionMatch but modified for [[ pattern
 *
 * @param $position - The resolved position in the document where the cursor is
 * @returns A SuggestionMatch with the range to replace and query text, or null if no match
 */
export function findDoubleBracketMatch($position: ResolvedPos): SuggestionMatch {
  // Get the text before the current position within the current text block.
  // IMPORTANT: Use $position.start() not $position.before()
  // - $position.before() returns position BEFORE the parent node (includes opening tag)
  // - $position.start() returns position at the START of the parent node's content
  // Using before() caused the "link-eats-space" bug where range.from was off by 1,
  // causing preceding whitespace/newlines to be deleted when inserting links.
  const textFrom = $position.start();
  const textTo = $position.pos;
  const text = $position.doc.textBetween(textFrom, textTo, '\0', '\0');

  // Look for [[ followed by any characters that aren't ] (the query)
  // Must be at the end of the text (where cursor is)
  // Pattern: [[ followed by any non-] characters, ending at cursor position
  const regex = /\[\[([^\]]*?)$/;
  const match = regex.exec(text);

  if (!match) {
    return null;
  }

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

/**
 * Find a complete [[uuid]] link ending exactly at the given position
 * @param doc - The ProseMirror document
 * @param pos - The position to check (cursor position)
 * @returns The range { from, to } of the link, or null if no link ends at this position
 */
export function findLinkEndingAt(doc: PMNode, pos: number): { from: number; to: number } | null {
  // Get the text node at this position by looking backwards
  const $pos = doc.resolve(pos);

  // Get text content of the parent node up to the cursor
  const parentStart = $pos.start();
  const textBefore = doc.textBetween(parentStart, pos, '\0', '\0');

  // Check if there's a complete [[uuid]] pattern ending at the cursor
  // The pattern must end exactly at the cursor position
  const regex = new RegExp(LINK_PATTERN.source + '$', 'i');
  const match = regex.exec(textBefore);

  if (!match) {
    return null;
  }

  const from = parentStart + match.index;
  const to = pos;

  return { from, to };
}

/**
 * Find a complete [[uuid]] link starting exactly at the given position
 * @param doc - The ProseMirror document
 * @param pos - The position to check (cursor position)
 * @returns The range { from, to } of the link, or null if no link starts at this position
 */
export function findLinkStartingAt(doc: PMNode, pos: number): { from: number; to: number } | null {
  const $pos = doc.resolve(pos);

  // Get text content from cursor to end of parent node
  const parentEnd = $pos.end();
  const textAfter = doc.textBetween(pos, parentEnd, '\0', '\0');

  // Check if there's a complete [[uuid]] pattern starting at the cursor
  // The pattern must start exactly at position 0 of the textAfter
  const regex = new RegExp('^' + LINK_PATTERN.source, 'i');
  const match = regex.exec(textAfter);

  if (!match) {
    return null;
  }

  const from = pos;
  const to = pos + match[0].length;

  return { from, to };
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
            const notes = await window.electronAPI.link.searchNotesForAutocomplete(query);
            return notes.slice(0, 10);
          } catch (error) {
            console.error('[InterNoteLink] Failed to fetch notes for autocomplete:', error);
            return [];
          }
        },

        render: () => {
          let component: ReactRenderer | undefined;
          let popup: FloatingPopup | undefined;

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(LinkSuggestionList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = createFloatingPopup({
                getReferenceClientRect: props.clientRect as () => DOMRect,
                content: component.element,
              });
            },

            onUpdate(props: SuggestionProps) {
              component?.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup?.setReferenceClientRect(props.clientRect as () => DOMRect);
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === 'Escape') {
                popup?.hide();
                return true;
              }

              return (
                (component?.ref as LinkSuggestionListRef | undefined)?.onKeyDown(props) ?? false
              );
            },

            onExit() {
              popup?.destroy();
              component?.destroy();
            },
          };
        },
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Only handle collapsed selections (cursor, no range)
        if (!selection.empty) {
          return false;
        }

        const pos = selection.from;

        // Check if there's a link ending at the cursor position
        const linkRange = findLinkEndingAt(state.doc, pos);
        if (!linkRange) {
          return false;
        }

        // Check if the link is already selected
        // (selection spans exactly the link range)
        if (selection.from === linkRange.from && selection.to === linkRange.to) {
          // Link already selected, let default behavior delete it
          return false;
        }

        // Select the link
        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, linkRange.from, linkRange.to)
        );
        view.dispatch(tr);
        return true;
      },

      Delete: () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Only handle collapsed selections (cursor, no range)
        if (!selection.empty) {
          return false;
        }

        const pos = selection.from;

        // Check if there's a link starting at the cursor position
        const linkRange = findLinkStartingAt(state.doc, pos);
        if (!linkRange) {
          return false;
        }

        // Check if the link is already selected
        if (selection.from === linkRange.from && selection.to === linkRange.to) {
          // Link already selected, let default behavior delete it
          return false;
        }

        // Select the link
        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, linkRange.from, linkRange.to)
        );
        view.dispatch(tr);
        return true;
      },

      'Shift-ArrowLeft': () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // For TextSelection, $head is the moving end when extending selection
        // When pressing Shift+Left, the head moves left
        const headPos = selection.$head.pos;

        // Check if there's a link ending at the current head position
        const linkRange = findLinkEndingAt(state.doc, headPos);
        if (!linkRange) {
          return false; // Let default behavior handle it
        }

        // Calculate new selection:
        // - anchor stays where it is (the fixed end)
        // - head moves to the start of the link
        const anchor = selection.$anchor.pos;
        const newHead = linkRange.from;

        // Create selection with proper anchor/head order
        const newFrom = Math.min(anchor, newHead);
        const newTo = Math.max(anchor, newHead);

        const tr = state.tr.setSelection(TextSelection.create(state.doc, newFrom, newTo));
        view.dispatch(tr);
        return true;
      },

      'Mod-Shift-ArrowLeft': () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Get the anchor position (fixed end of selection)
        const anchor = selection.$anchor.pos;
        // Get the start of the current paragraph (where head should move to)
        const paragraphStart = selection.$head.start();

        // If already at the start of paragraph, let default behavior handle it
        // (might need to select to previous paragraph)
        if (selection.$head.pos === paragraphStart) {
          return false;
        }

        // Create selection from paragraph start to anchor
        const newFrom = Math.min(anchor, paragraphStart);
        const newTo = Math.max(anchor, paragraphStart);

        const tr = state.tr.setSelection(TextSelection.create(state.doc, newFrom, newTo));
        view.dispatch(tr);
        return true;
      },

      ArrowLeft: () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Only handle collapsed selections (cursor, no range)
        if (!selection.empty) {
          return false;
        }

        const pos = selection.from;

        // Check if there's a link ending at the cursor position
        // If so, moving left would enter the link - skip over it
        const linkRange = findLinkEndingAt(state.doc, pos);
        if (linkRange) {
          const tr = state.tr.setSelection(TextSelection.create(state.doc, linkRange.from));
          view.dispatch(tr);
          return true;
        }

        return false;
      },

      ArrowRight: () => {
        const { state, view } = this.editor;
        const { selection } = state;

        // Only handle collapsed selections (cursor, no range)
        if (!selection.empty) {
          return false;
        }

        const pos = selection.from;

        // Check if there's a link starting at the cursor position
        // If so, moving right would enter the link - skip over it
        const linkRange = findLinkStartingAt(state.doc, pos);
        if (linkRange) {
          const tr = state.tr.setSelection(TextSelection.create(state.doc, linkRange.to));
          view.dispatch(tr);
          return true;
        }

        return false;
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
            // forceDecoration is used when title cache updates
            if (transaction.getMeta('forceDecoration')) {
              return findAndDecorateLinks(transaction.doc, editorView);
            }

            // No document change - just return old state
            if (!transaction.docChanged) {
              return oldState;
            }

            // Always do full recalculation on document changes.
            // Previously used incremental updates via updateLinksIncrementally(),
            // but this had edge cases where widget decorations with side: -1
            // weren't properly removed, causing visual duplication when typing
            // near task items with links.
            // Full recalculation is reliable and fast enough for typical note sizes.
            return findAndDecorateLinks(transaction.doc, editorView);
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

// Counter for testing - tracks how many times decorations are regenerated
let decorationRegenerationCount = 0;

/**
 * Get the number of times decorations have been regenerated.
 * Used for testing to verify we're not doing unnecessary work.
 */
export function getDecorationRegenerationCount(): number {
  return decorationRegenerationCount;
}

/**
 * Reset the regeneration counter. Call this at the start of each test.
 */
export function resetDecorationRegenerationCount(): void {
  decorationRegenerationCount = 0;
}

/**
 * Find all inter-note links in the document and create decorations for them
 * This function needs to:
 * 1. Find [[note-id]] patterns
 * 2. Look up the note title for each ID
 * 3. Create decorations that display the title instead of the ID
 */
function findAndDecorateLinks(doc: PMNode, editorView?: EditorView | null): DecorationSet {
  decorationRegenerationCount++;
  const decorations = findLinksInRange(doc, 0, doc.content.size, editorView);
  return DecorationSet.create(doc, decorations);
}

/**
 * Find inter-note links within a specific range of the document.
 *
 * @param doc - The document node
 * @param rangeFrom - Start of the range to search
 * @param rangeTo - End of the range to search
 * @param editorView - Optional editor view for triggering title fetches
 * @returns Array of decorations for links found in the range
 */
function findLinksInRange(
  doc: PMNode,
  rangeFrom: number,
  rangeTo: number,
  editorView?: EditorView | null
): Decoration[] {
  const decorations: Decoration[] = [];
  const regex = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);

  doc.nodesBetween(rangeFrom, rangeTo, (node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    const text = node.text;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      // Include decorations that OVERLAP with the specified range
      // This matches the behavior of DecorationSet.find() used when removing stale decorations
      if (from < rangeTo && to > rangeFrom) {
        // Only lowercase full UUIDs (36-char format) - compact UUIDs are case-sensitive
        const rawId = match[1] ?? '';
        const noteId = isFullUuid(rawId) ? rawId.toLowerCase() : rawId;

        // If we don't have the title cached, fetch it asynchronously
        if (!noteTitleCache.has(noteId)) {
          noteTitleCache.set(noteId, 'Loading...');
          void fetchNoteTitle(noteId, editorView);
        }

        // Create a widget that replaces the [[note-id]] text
        const widget = Decoration.widget(
          to,
          () => {
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
            span.textContent = `[[${title}]]`;
            return span;
          },
          {
            side: -1,
          }
        );

        // Hide the original [[note-id]] text
        const hideDecoration = Decoration.inline(from, to, {
          class: 'inter-note-link-hidden',
        });

        decorations.push(hideDecoration, widget);
      }
    }
  });

  return decorations;
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      editorView.dispatch(tr);
    }
  }
}
