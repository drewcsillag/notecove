/**
 * CollapseDecorations Plugin
 *
 * A TipTap extension that applies decorations to hide content under collapsed headings.
 *
 * How it works:
 * 1. Scans the document for collapsed headings
 * 2. For each collapsed heading at level N, calculates the range to hide:
 *    - From immediately after the heading
 *    - Until a heading of level ≤ N (same or higher importance), or end of document
 * 3. Applies node decorations with class 'collapsed-content' to hidden nodes
 *
 * The actual hiding is done via CSS: .collapsed-content { display: none }
 *
 * @see plans/collapsible-headings/PLAN.md
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

const COLLAPSE_DECORATIONS_KEY = new PluginKey('collapseDecorations');

/**
 * Calculate which document positions should be hidden based on collapsed headings.
 *
 * Returns an array of [startPos, endPos] ranges for nodes that should be hidden.
 */
function calculateHiddenRanges(doc: ProseMirrorNode): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];

  // Track collapsed headings we're currently "inside" of
  // Each entry is { level, startPos } where startPos is the position after the heading
  const activeCollapses: { level: number; hideFrom: number }[] = [];

  doc.forEach((node, offset) => {
    const nodeStart = offset;
    const nodeEnd = offset + node.nodeSize;

    if (node.type.name === 'heading') {
      const level = node.attrs['level'] as number;
      const collapsed = node.attrs['collapsed'] as boolean;

      // This heading terminates any active collapse of same or lower level number
      // (lower number = higher importance, e.g., h1 terminates h2)
      let active = activeCollapses.at(-1);
      while (active) {
        if (level <= active.level) {
          // This heading terminates the active collapse
          // Add the range from hideFrom to the start of this heading
          if (active.hideFrom < nodeStart) {
            ranges.push({ from: active.hideFrom, to: nodeStart });
          }
          activeCollapses.pop();
          active = activeCollapses.at(-1);
        } else {
          break;
        }
      }

      // If this heading is collapsed, start a new active collapse
      if (collapsed) {
        activeCollapses.push({
          level,
          hideFrom: nodeEnd, // Start hiding from after this heading
        });
      }
    }
  });

  // Handle any remaining active collapses that extend to end of document
  const docEnd = doc.content.size;
  for (const active of activeCollapses) {
    if (active.hideFrom < docEnd) {
      ranges.push({ from: active.hideFrom, to: docEnd });
    }
  }

  return ranges;
}

/**
 * Create decorations for the hidden ranges.
 * Uses node decorations to add 'collapsed-content' class to each hidden node.
 */
function createDecorations(
  doc: ProseMirrorNode,
  ranges: { from: number; to: number }[]
): DecorationSet {
  const decorations: Decoration[] = [];

  if (ranges.length === 0) {
    return DecorationSet.empty;
  }

  // Sort ranges by start position
  const sortedRanges = [...ranges].sort((a, b) => a.from - b.from);

  // Merge overlapping ranges
  const mergedRanges: { from: number; to: number }[] = [];
  for (const range of sortedRanges) {
    const last = mergedRanges.at(-1);
    if (!last) {
      mergedRanges.push(range);
    } else if (range.from <= last.to) {
      // Overlapping or adjacent, merge them
      last.to = Math.max(last.to, range.to);
    } else {
      mergedRanges.push(range);
    }
  }

  // Apply decorations to each node within the hidden ranges
  for (const range of mergedRanges) {
    doc.nodesBetween(range.from, range.to, (node, pos) => {
      // Only decorate top-level nodes (direct children of doc)
      // We check if the node position + node size is within the range
      if (pos >= range.from && pos < range.to) {
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: 'collapsed-content',
          })
        );
        // Don't recurse into children - we're hiding the whole node
        return false;
      }
      return true;
    });
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * CollapseDecorations extension
 *
 * Adds a ProseMirror plugin that manages hiding decorations for collapsed headings.
 */
export const CollapseDecorations = Extension.create({
  name: 'collapseDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: COLLAPSE_DECORATIONS_KEY,

        state: {
          init(_, { doc }) {
            const ranges = calculateHiddenRanges(doc);
            return createDecorations(doc, ranges);
          },

          apply(tr, decorationSet) {
            // If the document changed, recalculate decorations
            if (tr.docChanged) {
              const ranges = calculateHiddenRanges(tr.doc);
              return createDecorations(tr.doc, ranges);
            }

            // Map existing decorations through the transaction
            return decorationSet.map(tr.mapping, tr.doc);
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

export default CollapseDecorations;
