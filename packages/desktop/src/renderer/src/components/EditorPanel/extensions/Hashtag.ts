/**
 * Hashtag TipTap Extension
 *
 * Parses and renders #hashtag syntax in notes.
 * Syntax: #tagname (must start with a letter, followed by letters, numbers, or underscores)
 *
 * This uses a ProseMirror decoration plugin to identify and style hashtags
 * without modifying the document structure itself.
 *
 * Also provides autocomplete suggestions when typing `#` using TipTap's suggestion API.
 */

import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { HASHTAG_PATTERN, MAX_TAG_LENGTH, isValidHeadingId } from '@notecove/shared';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { TagSuggestionList, type TagSuggestionListRef } from './TagSuggestionList';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { createFloatingPopup, type FloatingPopup } from './utils/floating-popup';
import { getChangedRanges, isFullDocumentReload } from './utils/transaction-ranges';

export interface HashtagOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

export const Hashtag = Extension.create<HashtagOptions>({
  name: 'hashtag',

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: '#',
        pluginKey: new PluginKey('hashtagSuggestion'),
        command: ({ editor, range, props }) => {
          // Replace the # and partial query with the full tag plus a space
          const tagName = (props as { name: string }).name;
          editor.chain().focus().deleteRange(range).insertContent(`#${tagName} `).run();
        },
        items: async ({ query }) => {
          try {
            // Fetch all tags from database
            const allTags = await window.electronAPI.tag.getAll();

            // Filter tags based on the query
            const filtered = allTags.filter((tag) =>
              tag.name.toLowerCase().includes(query.toLowerCase())
            );

            // Limit to 10 suggestions
            return filtered.slice(0, 10);
          } catch (error) {
            console.error('Failed to fetch tags:', error);
            return [];
          }
        },
        render: () => {
          let component: ReactRenderer | undefined;
          let popup: FloatingPopup | undefined;

          return {
            onStart: (props) => {
              component = new ReactRenderer(TagSuggestionList, {
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

            onUpdate(props) {
              component?.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup?.setReferenceClientRect(props.clientRect as () => DOMRect);
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup?.hide();
                return true;
              }

              return (
                (component?.ref as TagSuggestionListRef | undefined)?.onKeyDown(props) ?? false
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

  addProseMirrorPlugins() {
    return [
      // Decoration plugin for styling existing hashtags
      new Plugin({
        key: new PluginKey('hashtag'),
        state: {
          init(_, { doc }) {
            return findHashtags(doc);
          },
          apply(transaction, oldState) {
            // No document change - just return old state
            if (!transaction.docChanged) {
              return oldState;
            }

            // Full document reload (CRDT sync, etc) - do full re-scan
            if (isFullDocumentReload(transaction)) {
              console.log(
                '[Hashtag] Full reload triggered, origin:',
                transaction.getMeta('y-sync$')
              );
              return findHashtags(transaction.doc);
            }

            // Incremental update: only re-scan changed regions
            return updateHashtagsIncrementally(transaction, oldState);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
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
export function getHashtagDecorationRegenerationCount(): number {
  return decorationRegenerationCount;
}

/**
 * Reset the regeneration counter. Call this at the start of each test.
 */
export function resetHashtagDecorationRegenerationCount(): void {
  decorationRegenerationCount = 0;
}

/**
 * Find all hashtags in the document and create decorations for them
 *
 * Hashtags inside links (like URL fragments) are NOT decorated.
 * For example, in "https://example.com#section", the "#section" is a URL fragment
 * and will not be styled as a hashtag.
 */
function findHashtags(doc: PMNode): DecorationSet {
  decorationRegenerationCount++;
  const decorations = findHashtagsInRange(doc, 0, doc.content.size);
  return DecorationSet.create(doc, decorations);
}

/**
 * Find hashtags within a specific range of the document.
 *
 * @param doc - The document node
 * @param rangeFrom - Start of the range to search
 * @param rangeTo - End of the range to search
 * @returns Array of decorations for hashtags found in the range
 */
function findHashtagsInRange(doc: PMNode, rangeFrom: number, rangeTo: number): Decoration[] {
  const decorations: Decoration[] = [];
  const regex = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);

  doc.nodesBetween(rangeFrom, rangeTo, (node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    // Skip text nodes that are inside links (URL fragments should not be hashtags)
    const hasLinkMark = node.marks.some((mark) => mark.type.name === 'link');
    if (hasLinkMark) {
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
        // Get the tag without the # prefix
        const tagWithoutHash = match[0].slice(1);

        // Skip if this looks like a heading ID (h_XXXXXXXX format)
        // These appear in same-note heading links like [[#h_abc12xyz]]
        if (isValidHeadingId(tagWithoutHash)) {
          continue;
        }

        let tag = tagWithoutHash.toLowerCase();

        if (tag.length > MAX_TAG_LENGTH) {
          tag = tag.slice(0, MAX_TAG_LENGTH);
        }

        decorations.push(
          Decoration.inline(from, to, {
            class: 'hashtag',
            'data-tag': tag,
            role: 'button',
            'aria-label': `Tag: ${tag}`,
            tabindex: '0',
          })
        );
      }
    }
  });

  return decorations;
}

/**
 * Incrementally update hashtag decorations based on transaction changes.
 * Only re-scans the changed regions instead of the entire document.
 *
 * @param transaction - The transaction that caused the change
 * @param oldState - The previous decoration set
 * @returns Updated decoration set
 */
function updateHashtagsIncrementally(
  transaction: Transaction,
  oldState: DecorationSet
): DecorationSet {
  const doc = transaction.doc;

  // Get the ranges that were changed
  const changedRanges = getChangedRanges(transaction);

  // If no specific changes detected, fall back to full scan
  if (changedRanges.length === 0) {
    return findHashtags(doc);
  }

  // Map old decorations through the transaction (updates positions automatically)
  let decorations = oldState.map(transaction.mapping, doc);

  // For each changed range, check if we actually need to update decorations
  for (const range of changedRanges) {
    // Expand the search area slightly to catch hashtags at boundaries
    let searchFrom = Math.max(0, range.from - 30);
    let searchTo = Math.min(doc.content.size, range.to + 30);

    // Check if any existing decoration overlaps with this range
    const existingInRange = decorations.find(searchFrom, searchTo);

    // CRITICAL: If we have existing decorations, we MUST include their full range
    // in our search. Otherwise, we might remove a decoration but not re-add it
    // because part of it falls outside our search range.
    for (const deco of existingInRange) {
      searchFrom = Math.min(searchFrom, deco.from);
      searchTo = Math.max(searchTo, deco.to);
    }

    // Get the text in this range to see if it might contain hashtags
    const textInRange = doc.textBetween(searchFrom, searchTo, ' ');
    const mightHaveHashtag = textInRange.includes('#');

    // Only update if there are existing decorations OR we might have new hashtags
    if (existingInRange.length > 0 || mightHaveHashtag) {
      // Remove only the decorations that overlap with the change
      decorations = decorations.remove(existingInRange);

      // Re-scan for hashtags in this area
      const newDecorations = findHashtagsInRange(doc, searchFrom, searchTo);
      if (newDecorations.length > 0) {
        decorations = decorations.add(doc, newDecorations);
      }
    }
    // If no decorations overlap AND no # in the text, do nothing - mapping handled it
  }

  return decorations;
}
