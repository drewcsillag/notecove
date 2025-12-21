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
import type { Transaction } from '@tiptap/pm/state';
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
import { getChangedRanges, expandRanges, isFullDocumentReload } from './utils/transaction-ranges';

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
            // forceDecoration is used when title cache updates
            // We still need full regeneration for this case
            if (transaction.getMeta('forceDecoration')) {
              return findAndDecorateLinks(transaction.doc, editorView);
            }

            // No document change - just return old state
            if (!transaction.docChanged) {
              return oldState;
            }

            // Full document reload (CRDT sync, etc) - do full re-scan
            if (isFullDocumentReload(transaction)) {
              return findAndDecorateLinks(transaction.doc, editorView);
            }

            // Incremental update: only re-scan changed regions
            return updateLinksIncrementally(transaction, oldState, editorView);
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
        const noteId = (match[1] ?? '').toLowerCase();

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
 * Incrementally update link decorations based on transaction changes.
 * Only re-scans the changed regions instead of the entire document.
 *
 * @param transaction - The transaction that caused the change
 * @param oldState - The previous decoration set
 * @param editorView - Optional editor view for triggering title fetches
 * @returns Updated decoration set
 */
function updateLinksIncrementally(
  transaction: Transaction,
  oldState: DecorationSet,
  editorView?: EditorView | null
): DecorationSet {
  const doc = transaction.doc;

  // Get the ranges that were changed
  let changedRanges = getChangedRanges(transaction);

  // If no specific changes detected, fall back to full scan
  if (changedRanges.length === 0) {
    return findAndDecorateLinks(doc, editorView);
  }

  // Expand ranges to catch links that might span the edit boundary
  // A link like [[uuid]] could be up to 50 chars
  changedRanges = expandRanges(changedRanges, 50, doc.content.size);

  // Map old decorations through the transaction (updates positions)
  let decorations = oldState.map(transaction.mapping, doc);

  // Process each changed range
  for (const range of changedRanges) {
    let searchFrom = range.from;
    let searchTo = range.to;

    // Find existing decorations in this range
    const existingInRange = decorations.find(searchFrom, searchTo, () => true);

    // CRITICAL: If we have existing decorations, we MUST include their full range
    // in our search. Otherwise, we might remove a decoration but not re-add it
    // because part of it falls outside our search range.
    for (const deco of existingInRange) {
      searchFrom = Math.min(searchFrom, deco.from);
      searchTo = Math.max(searchTo, deco.to);
    }

    // Remove decorations that overlap with this range
    decorations = decorations.remove(existingInRange);

    // Find new links in the expanded range and add them
    const newDecorations = findLinksInRange(doc, searchFrom, searchTo, editorView);
    if (newDecorations.length > 0) {
      decorations = decorations.add(doc, newDecorations);
    }
  }

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
