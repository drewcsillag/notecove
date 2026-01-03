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
import { LINK_WITH_HEADING_PATTERN, parseLink, isCompactUuid, isFullUuid } from '@notecove/shared';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionMatch } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { LinkSuggestionList, type LinkSuggestionListRef } from './LinkSuggestionList';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { createFloatingPopup, type FloatingPopup } from './utils/floating-popup';

export interface InterNoteLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Omit<SuggestionOptions, 'editor'>;
  onLinkClick?: (noteId: string, headingId?: string) => void;
  onLinkDoubleClick?: (noteId: string, headingId?: string) => void;
  /** Callback to get the current note ID for same-note heading autocomplete */
  getCurrentNoteId?: () => string | null;
}

// Cache for note titles to avoid excessive IPC calls
const noteTitleCache = new Map<string, string>();

// Cache for broken link status (note doesn't exist or is deleted)
const brokenLinkCache = new Set<string>();

// Cache for heading text: key is "noteId:headingId", value is heading text
const headingTextCache = new Map<string, string | null>();

// Track pending heading fetches to avoid duplicate requests
const pendingHeadingFetches = new Set<string>();

// Pending note selection for heading mode
// When user selects a note, we store its info here instead of showing the UUID
let pendingNoteSelection: { noteId: string; noteTitle: string } | null = null;

/**
 * Clear the pending note selection (called when autocomplete completes or cancels)
 */
export function clearPendingNoteSelection(): void {
  pendingNoteSelection = null;
}

/**
 * Clear the title cache for a specific note ID
 * This should be called when a note's title changes
 */
export function clearNoteTitleCache(noteId?: string): void {
  if (noteId) {
    noteTitleCache.delete(noteId);
    brokenLinkCache.delete(noteId);
    // Clear heading cache entries for this note
    for (const key of headingTextCache.keys()) {
      if (key.startsWith(`${noteId}:`)) {
        headingTextCache.delete(key);
      }
    }
  } else {
    // Clear all caches
    noteTitleCache.clear();
    brokenLinkCache.clear();
    headingTextCache.clear();
    pendingHeadingFetches.clear();
  }
}

/**
 * Represents a note suggestion item for autocomplete
 */
export interface NoteSuggestionItem {
  type: 'note';
  id: string;
  title: string;
  sdId: string;
  folderId: string | null;
  folderPath: string;
  created: number;
  modified: number;
}

/**
 * Represents a heading suggestion item for autocomplete
 */
export interface HeadingSuggestionItem {
  type: 'heading';
  id: string; // The heading ID (h_XXXXXXXX)
  text: string; // The heading text
  level: number; // Heading level 1-6
  noteId: string; // The parent note ID
  noteTitle: string; // The parent note title (for display)
}

/**
 * Represents an "entire note" option shown in heading mode
 */
export interface EntireNoteSuggestionItem {
  type: 'entireNote';
  id: string; // The note ID
  noteTitle: string; // The note title for display
}

/**
 * Union type for all suggestion items
 */
export type SuggestionItem = NoteSuggestionItem | HeadingSuggestionItem | EntireNoteSuggestionItem;

/**
 * Parse the autocomplete query to determine the mode (note or heading).
 *
 * @param query The text after [[ in the autocomplete trigger
 * @returns Object describing the autocomplete mode and relevant parameters
 */
// Marker used in heading mode to show note title instead of UUID
const HEADING_MODE_MARKER = '→';

export function parseAutocompleteQuery(query: string): {
  mode: 'note' | 'heading' | 'sameNoteHeading' | 'pendingHeading';
  noteId?: string;
  noteTitle?: string;
  headingQuery: string;
} {
  // Check if we're in pending heading mode (user selected a note, now picking heading)
  // Format: "Note Title →query" where query is the heading search
  const markerIndex = query.indexOf(HEADING_MODE_MARKER);
  if (markerIndex !== -1 && pendingNoteSelection) {
    const headingQuery = query.substring(markerIndex + 1);
    return {
      mode: 'pendingHeading',
      noteId: pendingNoteSelection.noteId,
      noteTitle: pendingNoteSelection.noteTitle,
      headingQuery,
    };
  }

  // Check if query contains # to indicate heading mode
  const hashIndex = query.indexOf('#');

  if (hashIndex === -1) {
    // No # found, we're in note mode
    return { mode: 'note', headingQuery: query };
  }

  // Split by # to get note identifier and heading query
  const beforeHash = query.substring(0, hashIndex);
  const afterHash = query.substring(hashIndex + 1);

  // If query starts with # (no note specified), it's same-note heading mode
  if (!beforeHash) {
    return {
      mode: 'sameNoteHeading',
      headingQuery: afterHash,
    };
  }

  // Check if the part before # is a valid note ID (UUID)
  if (isFullUuid(beforeHash) || isCompactUuid(beforeHash)) {
    return {
      mode: 'heading',
      noteId: beforeHash,
      headingQuery: afterHash,
    };
  }

  // If the part before # is not a valid UUID, it might be a partial note title
  // In this case, we're still in note mode (searching for notes matching the title)
  return { mode: 'note', headingQuery: query };
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
 * Find a complete [[uuid]] or [[uuid#heading]] link ending exactly at the given position
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

  // Check if there's a complete [[uuid]] or [[uuid#heading]] pattern ending at the cursor
  // The pattern must end exactly at the cursor position
  const regex = new RegExp(LINK_WITH_HEADING_PATTERN.source + '$', 'i');
  const match = regex.exec(textBefore);

  if (!match) {
    return null;
  }

  const from = parentStart + match.index;
  const to = pos;

  return { from, to };
}

/**
 * Find a complete [[uuid]] or [[uuid#heading]] link starting exactly at the given position
 * @param doc - The ProseMirror document
 * @param pos - The position to check (cursor position)
 * @returns The range { from, to } of the link, or null if no link starts at this position
 */
export function findLinkStartingAt(doc: PMNode, pos: number): { from: number; to: number } | null {
  const $pos = doc.resolve(pos);

  // Get text content from cursor to end of parent node
  const parentEnd = $pos.end();
  const textAfter = doc.textBetween(pos, parentEnd, '\0', '\0');

  // Check if there's a complete [[uuid]] or [[uuid#heading]] pattern starting at the cursor
  // The pattern must start exactly at position 0 of the textAfter
  const regex = new RegExp('^' + LINK_WITH_HEADING_PATTERN.source, 'i');
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
          // props contains the selected item (note, heading, or entireNote)
          const item = props as SuggestionItem;

          if (item.type === 'note') {
            // Note selected: check if it has multiple headings
            // If only 0-1 headings, insert link directly; otherwise enter heading mode
            void (async () => {
              try {
                const headings = await window.electronAPI.link.getHeadingsForNote(item.id);

                if (headings.length <= 1) {
                  // No meaningful headings (just title or none) - insert link directly
                  pendingNoteSelection = null;
                  editor
                    .chain()
                    .focus()
                    .deleteRange({ from: range.from, to: range.to })
                    .insertContent(`[[${item.id}]]`)
                    .run();
                } else {
                  // Multiple headings - enter heading mode with title displayed
                  pendingNoteSelection = { noteId: item.id, noteTitle: item.title };
                  // Cache the title for later use
                  noteTitleCache.set(item.id, item.title);
                  editor
                    .chain()
                    .focus()
                    .deleteRange({ from: range.from, to: range.to })
                    .insertContent(`[[${item.title} ${HEADING_MODE_MARKER}`)
                    .run();
                }
              } catch (error) {
                console.error('[InterNoteLink] Failed to fetch headings:', error);
                // On error, just insert the link directly
                pendingNoteSelection = null;
                editor
                  .chain()
                  .focus()
                  .deleteRange({ from: range.from, to: range.to })
                  .insertContent(`[[${item.id}]]`)
                  .run();
              }
            })();
          } else if (item.type === 'heading') {
            // Heading selected: complete the link with heading-id]]
            // Check if this is a same-note heading by looking at the original text
            const originalText = editor.state.doc.textBetween(range.from, range.to, '\0', '\0');
            const isSameNoteHeading = originalText.startsWith('[[#');

            // Get the note ID - either from pending selection or from the item
            const noteId = pendingNoteSelection?.noteId ?? item.noteId;
            pendingNoteSelection = null;

            if (isSameNoteHeading) {
              // Same-note heading: use [[#heading-id]] format
              editor
                .chain()
                .focus()
                .deleteRange({ from: range.from, to: range.to })
                .insertContent(`[[#${item.id}]]`)
                .run();
            } else {
              // Cross-note heading: use [[note-id#heading-id]] format
              editor
                .chain()
                .focus()
                .deleteRange({ from: range.from, to: range.to })
                .insertContent(`[[${noteId}#${item.id}]]`)
                .run();
            }
          } else {
            // "Link to entire note" selected
            // Get the note ID from pending selection or from the item
            const noteId = pendingNoteSelection?.noteId ?? item.id;
            pendingNoteSelection = null;

            editor
              .chain()
              .focus()
              .deleteRange({ from: range.from, to: range.to })
              .insertContent(`[[${noteId}]]`)
              .run();
          }
        },

        items: async ({ query, editor }) => {
          try {
            // Parse the query to determine mode (note or heading)
            const parsed = parseAutocompleteQuery(query);

            if (parsed.mode === 'sameNoteHeading') {
              // Same-note heading mode: fetch headings for the current note
              // Access the getCurrentNoteId callback from extension options
              const interNoteLinkExt = editor.extensionManager.extensions.find(
                (ext) => ext.name === 'interNoteLink'
              );
              const options = interNoteLinkExt?.options as InterNoteLinkOptions | undefined;
              const currentNoteId = options?.getCurrentNoteId?.();

              if (!currentNoteId) {
                console.warn('[InterNoteLink] No current note ID for same-note heading autocomplete');
                return [];
              }

              const headings = await window.electronAPI.link.getHeadingsForNote(currentNoteId);
              const noteTitle = noteTitleCache.get(currentNoteId) ?? 'This note';

              // Filter headings by the heading query (case-insensitive)
              const filteredHeadings = parsed.headingQuery
                ? headings.filter((h) =>
                    h.text.toLowerCase().includes(parsed.headingQuery.toLowerCase())
                  )
                : headings;

              // Build result: show headings only (no "entire note" option for same-note)
              const result: SuggestionItem[] = [];

              for (const h of filteredHeadings.slice(0, 10)) {
                result.push({
                  type: 'heading',
                  id: h.id,
                  text: h.text,
                  level: h.level,
                  noteId: currentNoteId,
                  noteTitle,
                });
              }

              return result;
            } else if (parsed.mode === 'pendingHeading' && parsed.noteId) {
              // Pending heading mode: user selected a note, now picking heading
              // We have the note ID from pendingNoteSelection
              const headings = await window.electronAPI.link.getHeadingsForNote(parsed.noteId);
              const noteTitle = parsed.noteTitle ?? noteTitleCache.get(parsed.noteId) ?? 'Note';
              const targetNoteId = parsed.noteId;

              // Filter headings by the heading query (case-insensitive)
              const filteredHeadings = parsed.headingQuery
                ? headings.filter((h) =>
                    h.text.toLowerCase().includes(parsed.headingQuery.toLowerCase())
                  )
                : headings;

              // Build result: "Link to entire note" option first, then headings
              const result: SuggestionItem[] = [];

              // Add "Link to entire note" option at the top
              result.push({
                type: 'entireNote',
                id: targetNoteId,
                noteTitle,
              });

              // Add filtered headings
              for (const h of filteredHeadings.slice(0, 9)) {
                result.push({
                  type: 'heading',
                  id: h.id,
                  text: h.text,
                  level: h.level,
                  noteId: targetNoteId,
                  noteTitle,
                });
              }

              return result;
            } else if (parsed.mode === 'heading' && parsed.noteId) {
              // Heading mode (legacy - UUID in document): fetch headings for the note
              const headings = await window.electronAPI.link.getHeadingsForNote(parsed.noteId);
              const noteTitle = noteTitleCache.get(parsed.noteId) ?? 'Note';
              const targetNoteId = parsed.noteId;

              // Filter headings by the heading query (case-insensitive)
              const filteredHeadings = parsed.headingQuery
                ? headings.filter((h) =>
                    h.text.toLowerCase().includes(parsed.headingQuery.toLowerCase())
                  )
                : headings;

              // Build result: "Link to entire note" option first, then headings
              const result: SuggestionItem[] = [];

              // Add "Link to entire note" option at the top
              result.push({
                type: 'entireNote',
                id: targetNoteId,
                noteTitle,
              });

              // Add filtered headings
              for (const h of filteredHeadings.slice(0, 9)) {
                result.push({
                  type: 'heading',
                  id: h.id,
                  text: h.text,
                  level: h.level,
                  noteId: targetNoteId,
                  noteTitle,
                });
              }

              return result;
            } else {
              // Note mode: search for notes
              const notes = await window.electronAPI.link.searchNotesForAutocomplete(query);

              // Convert to NoteSuggestionItem format
              return notes.slice(0, 10).map(
                (note): NoteSuggestionItem => ({
                  type: 'note',
                  id: note.id,
                  title: note.title,
                  sdId: note.sdId,
                  folderId: note.folderId,
                  folderPath: note.folderPath,
                  created: note.created,
                  modified: note.modified,
                })
              );
            }
          } catch (error) {
            console.error('[InterNoteLink] Failed to fetch items for autocomplete:', error);
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
              // Clear pending note selection when autocomplete closes
              pendingNoteSelection = null;
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
    const getCurrentNoteId = this.options.getCurrentNoteId;

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
            return findAndDecorateLinks(doc, editorView, getCurrentNoteId);
          },
          apply(transaction, oldState) {
            // forceDecoration is used when title cache updates
            if (transaction.getMeta('forceDecoration')) {
              return findAndDecorateLinks(transaction.doc, editorView, getCurrentNoteId);
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
            return findAndDecorateLinks(transaction.doc, editorView, getCurrentNoteId);
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

            // Get optional heading ID
            const headingId = target.getAttribute('data-heading-id') ?? undefined;

            // Clear any pending click timeout
            if (clickTimeout) {
              clearTimeout(clickTimeout);
              clickTimeout = null;
            }

            if (onLinkClick) {
              // Set timeout to handle single click after double-click window
              clickTimeout = setTimeout(() => {
                onLinkClick(noteId, headingId);
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

            // Get optional heading ID
            const headingId = target.getAttribute('data-heading-id') ?? undefined;

            // Cancel pending single-click action
            if (clickTimeout) {
              clearTimeout(clickTimeout);
              clickTimeout = null;
            }

            if (onLinkDoubleClick) {
              onLinkDoubleClick(noteId, headingId);
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
function findAndDecorateLinks(
  doc: PMNode,
  editorView?: EditorView | null,
  getCurrentNoteId?: () => string | null
): DecorationSet {
  decorationRegenerationCount++;
  const decorations = findLinksInRange(doc, 0, doc.content.size, editorView, getCurrentNoteId);
  return DecorationSet.create(doc, decorations);
}

/**
 * Find inter-note links within a specific range of the document.
 *
 * @param doc - The document node
 * @param rangeFrom - Start of the range to search
 * @param rangeTo - End of the range to search
 * @param editorView - Optional editor view for triggering title fetches
 * @param getCurrentNoteId - Optional callback to get current note ID for same-note links
 * @returns Array of decorations for links found in the range
 */
function findLinksInRange(
  doc: PMNode,
  rangeFrom: number,
  rangeTo: number,
  editorView?: EditorView | null,
  getCurrentNoteId?: () => string | null
): Decoration[] {
  const decorations: Decoration[] = [];
  // Use pattern that supports both note-only links and note+heading links
  const regex = new RegExp(LINK_WITH_HEADING_PATTERN.source, LINK_WITH_HEADING_PATTERN.flags);

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
        // Parse the link to extract note ID and heading ID
        const parsed = parseLink(match[0]);
        if (!parsed || (!parsed.noteId && !parsed.headingId)) {
          continue; // Skip invalid links
        }

        const headingId = parsed.headingId ?? undefined;
        const isSameNoteLink = !parsed.noteId && !!headingId;

        // Resolve note ID (either from link or current note for same-note links)
        let resolvedNoteId: string | null = parsed.noteId;
        if (isSameNoteLink) {
          resolvedNoteId = getCurrentNoteId?.() ?? null;
        }

        // Skip if we can't resolve the note ID
        if (!resolvedNoteId) {
          continue;
        }

        // Now we know noteId is definitely a string
        const noteId: string = resolvedNoteId;

        // If we don't have the title cached, fetch it asynchronously
        if (!noteTitleCache.has(noteId)) {
          noteTitleCache.set(noteId, 'Loading...');
          void fetchNoteTitle(noteId, editorView);
        }

        // If there's a heading ID, fetch the heading text
        const headingCacheKey = headingId ? `${noteId}:${headingId}` : null;
        if (headingId && headingCacheKey && !headingTextCache.has(headingCacheKey)) {
          void fetchHeadingText(noteId, headingId, editorView);
        }

        // Capture values for use in widget factory (closures)
        const capturedNoteId = noteId;
        const capturedIsSameNoteLink = isSameNoteLink;

        // Create a widget that replaces the [[note-id]] or [[note-id#heading-id]] text
        const widget = Decoration.widget(
          to,
          () => {
            const title = noteTitleCache.get(capturedNoteId) ?? 'Loading...';
            const isNoteBroken = brokenLinkCache.has(capturedNoteId);

            // Check if the heading is broken (note exists but heading doesn't)
            let isHeadingBroken = false;
            if (headingId && headingCacheKey && !isNoteBroken) {
              const headingText = headingTextCache.get(headingCacheKey);
              // null means we fetched and heading wasn't found
              isHeadingBroken = headingText === null;
            }

            const span = document.createElement('span');
            // Apply appropriate class based on what's broken
            if (isNoteBroken) {
              span.className = 'inter-note-link-broken';
            } else if (isHeadingBroken) {
              span.className = 'inter-note-link-heading-broken';
            } else {
              span.className = 'inter-note-link';
            }
            span.setAttribute('data-note-id', capturedNoteId);
            if (headingId) {
              span.setAttribute('data-heading-id', headingId);
            }
            // Mark same-note links for click handler
            if (capturedIsSameNoteLink) {
              span.setAttribute('data-same-note', 'true');
            }
            span.setAttribute('role', isNoteBroken ? 'text' : 'link');

            // Build display text
            let displayText: string;
            if (capturedIsSameNoteLink) {
              // Same-note link: show [[#Heading Text]] format
              if (headingId && headingCacheKey) {
                const headingText = headingTextCache.get(headingCacheKey);
                if (headingText) {
                  displayText = `[[#${headingText}]]`;
                } else if (headingText === null) {
                  displayText = '[[#[heading not found]]]';
                } else {
                  displayText = '[[#...]]'; // Loading
                }
              } else {
                displayText = '[[#]]'; // Shouldn't happen
              }
            } else {
              // Cross-note link: show [[Note Title]] or [[Note Title#Heading Text]] format
              displayText = `[[${title}`;
              if (headingId && headingCacheKey) {
                const headingText = headingTextCache.get(headingCacheKey);
                if (headingText) {
                  displayText += `#${headingText}`;
                } else if (headingText === null) {
                  displayText += '#[heading not found]';
                }
                // If undefined, we're still loading - don't show anything yet
              }
              displayText += ']]';
            }

            // Set appropriate aria-label
            let ariaLabel: string;
            if (isNoteBroken) {
              ariaLabel = `Broken link to ${title}`;
            } else if (isHeadingBroken) {
              const headingLabel = capturedIsSameNoteLink ? 'this note' : title;
              ariaLabel = `Link to ${headingLabel} (heading not found)`;
            } else if (capturedIsSameNoteLink) {
              const headingText = headingCacheKey ? headingTextCache.get(headingCacheKey) : null;
              ariaLabel = `Link to heading ${headingText ?? 'loading...'}`;
            } else {
              ariaLabel = `Link to ${title}`;
            }
            span.setAttribute('aria-label', ariaLabel);

            if (!isNoteBroken) {
              span.setAttribute('tabindex', '0');
            }
            span.textContent = displayText;
            return span;
          },
          {
            side: -1,
          }
        );

        // Hide the original [[note-id]] or [[note-id#heading-id]] text
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

/**
 * Fetch heading text from database and cache it
 */
async function fetchHeadingText(
  noteId: string,
  headingId: string,
  editorView?: EditorView | null
): Promise<void> {
  const cacheKey = `${noteId}:${headingId}`;

  // Avoid duplicate fetches
  if (pendingHeadingFetches.has(cacheKey)) {
    return;
  }

  pendingHeadingFetches.add(cacheKey);

  try {
    const headings = await window.electronAPI.link.getHeadingsForNote(noteId);
    const heading = headings.find((h) => h.id === headingId);

    if (heading) {
      headingTextCache.set(cacheKey, heading.text);
    } else {
      // Heading not found - might be deleted
      headingTextCache.set(cacheKey, null);
    }

    // Trigger editor update to re-render with heading text
    if (editorView) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const tr = (editorView.state as any).tr;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      tr.setMeta('forceDecoration', true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      editorView.dispatch(tr);
    }
  } catch (error) {
    console.error('[InterNoteLink] Failed to fetch heading text:', error);
    headingTextCache.set(cacheKey, null);
  } finally {
    pendingHeadingFetches.delete(cacheKey);
  }
}
