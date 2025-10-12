import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Hashtag extension for TipTap
 * Automatically detects and styles #hashtags in the editor
 */
export const Hashtag = Extension.create({
  name: 'hashtag',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('hashtag'),
        state: {
          init(_, { doc }) {
            return findHashtags(doc);
          },
          apply(transaction, oldState) {
            return transaction.docChanged ? findHashtags(transaction.doc) : oldState;
          }
        },
        props: {
          decorations(state) {
            return this.getState(state);
          }
        }
      })
    ];
  }
});

function findHashtags(doc) {
  const decorations = [];
  const hashtagRegex = /#[\w-]+/g;

  doc.descendants((node, pos) => {
    if (!node.isText) {
      return;
    }

    const text = node.text;
    let match;

    while ((match = hashtagRegex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      decorations.push(
        Decoration.inline(from, to, {
          class: 'hashtag',
          'data-tag': match[0].substring(1)
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
