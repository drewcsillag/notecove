/**
 * DateChip TipTap Extension
 *
 * Provides decoration for YYYY-MM-DD date patterns in the editor.
 * Dates are styled as chips and can be clicked to open a date picker.
 *
 * This uses a ProseMirror decoration plugin to identify and style dates
 * without modifying the document structure itself.
 */

import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Pattern for YYYY-MM-DD dates
 */
export const DATE_PATTERN = /\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g;

/**
 * Find all date matches in a string
 */
export function findDateMatches(text: string): Array<{ index: number; date: string }> {
  const matches: Array<{ index: number; date: string }> = [];
  const regex = new RegExp(DATE_PATTERN.source, DATE_PATTERN.flags);
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      date: match[0],
    });
  }

  return matches;
}

export interface DateChipOptions {
  HTMLAttributes: Record<string, unknown>;
  onDateClick?: (date: string, from: number, to: number) => void;
}

const dateChipPluginKey = new PluginKey('dateChip');

export const DateChip = Extension.create<DateChipOptions>({
  name: 'dateChip',

  addOptions(): DateChipOptions {
    return {
      HTMLAttributes: {},
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: dateChipPluginKey,
        state: {
          init(_, { doc }) {
            return findDates(doc);
          },
          apply(transaction, oldState) {
            // Recalculate decorations when document changes
            if (transaction.docChanged) {
              return findDates(transaction.doc);
            }
            // Map old decorations through the transaction
            return oldState.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
          handleClick(_view, _pos, event) {
            // Check if click is on a date chip
            const target = event.target as HTMLElement;
            if (target.classList.contains('date-chip') || target.closest('.date-chip')) {
              const dateEl = target.classList.contains('date-chip')
                ? target
                : (target.closest('.date-chip') as HTMLElement);
              const date = dateEl?.getAttribute('data-date');
              const from = parseInt(dateEl?.getAttribute('data-from') || '0', 10);
              const to = parseInt(dateEl?.getAttribute('data-to') || '0', 10);

              if (date && options.onDateClick) {
                options.onDateClick(date, from, to);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

/**
 * Find all dates in the document and create decorations for them
 */
function findDates(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    // Skip text nodes that are inside links (dates in URLs should not be chips)
    const hasLinkMark = node.marks.some((mark) => mark.type.name === 'link');
    if (hasLinkMark) {
      return;
    }

    const text = node.text;
    const matches = findDateMatches(text);

    for (const match of matches) {
      const from = pos + match.index;
      const to = from + match.date.length;

      decorations.push(
        Decoration.inline(from, to, {
          class: 'date-chip',
          'data-date': match.date,
          'data-from': String(from),
          'data-to': String(to),
          role: 'button',
          'aria-label': `Date: ${match.date}`,
          tabindex: '0',
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
