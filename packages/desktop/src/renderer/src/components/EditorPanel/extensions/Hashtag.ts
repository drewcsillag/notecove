/**
 * Hashtag TipTap Extension
 *
 * Parses and renders #hashtag syntax in notes.
 * Syntax: #tagname (must start with a letter, followed by letters, numbers, or underscores)
 *
 * This uses a ProseMirror decoration plugin to identify and style hashtags
 * without modifying the document structure itself.
 */

import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { HASHTAG_PATTERN, MAX_TAG_LENGTH } from '@notecove/shared';

export interface HashtagOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const Hashtag = Extension.create<HashtagOptions>({
  name: 'hashtag',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addProseMirrorPlugins() {
    return [
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
    ];
  },
});

/**
 * Find all hashtags in the document and create decorations for them
 */
function findHashtags(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  // Create a new RegExp instance from the shared pattern
  const regex = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
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
