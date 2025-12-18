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
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { HASHTAG_PATTERN, MAX_TAG_LENGTH } from '@notecove/shared';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { TagSuggestionList, type TagSuggestionListRef } from './TagSuggestionList';
import type { SuggestionOptions } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';

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
          let popup: TippyInstance[] | undefined;

          return {
            onStart: (props) => {
              component = new ReactRenderer(TagSuggestionList, {
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

            onUpdate(props) {
              component?.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }

              return (
                (component?.ref as TagSuggestionListRef | undefined)?.onKeyDown(props) ?? false
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
    return [
      // Decoration plugin for styling existing hashtags
      new Plugin({
        key: new PluginKey('hashtag'),
        state: {
          init(_, { doc }) {
            return findHashtags(doc);
          },
          apply(transaction, oldState) {
            // Always recalculate decorations when document changes
            // This ensures hashtags render correctly even after loading from CRDT
            if (transaction.docChanged) {
              return findHashtags(transaction.doc);
            }
            // Map old decorations through the transaction
            return oldState.map(transaction.mapping, transaction.doc);
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

/**
 * Find all hashtags in the document and create decorations for them
 *
 * Hashtags inside links (like URL fragments) are NOT decorated.
 * For example, in "https://example.com#section", the "#section" is a URL fragment
 * and will not be styled as a hashtag.
 */
function findHashtags(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  // Create a new RegExp instance from the shared pattern
  const regex = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    // Skip text nodes that are inside links (URL fragments should not be hashtags)
    // Check if the node has a link mark
    const hasLinkMark = node.marks.some((mark) => mark.type.name === 'link');
    if (hasLinkMark) {
      return;
    }

    const text = node.text;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      // Remove # prefix and normalize to lowercase for consistency with database
      let tag = match[0].slice(1).toLowerCase();

      // Enforce max length (truncate if needed)
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
  });

  return DecorationSet.create(doc, decorations);
}
