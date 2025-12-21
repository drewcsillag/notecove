/**
 * Transaction Range Utilities
 *
 * Utilities for working with ProseMirror transaction mappings to determine
 * which document ranges were affected by a transaction. Used for incremental
 * decoration updates.
 */

import type { Transaction } from '@tiptap/pm/state';

export interface ChangedRange {
  from: number;
  to: number;
}

/**
 * Get document ranges that were modified by this transaction.
 * Uses transaction.mapping to find affected positions.
 *
 * @param transaction - The ProseMirror transaction
 * @returns Array of ranges that were changed, merged if overlapping
 */
export function getChangedRanges(transaction: Transaction): ChangedRange[] {
  const ranges: ChangedRange[] = [];

  // Iterate through each step's mapping
  transaction.mapping.maps.forEach((stepMap) => {
    stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      // The callback receives (oldStart, oldEnd, newStart, newEnd)
      // We want the NEW positions (after the transaction)
      ranges.push({ from: newStart, to: newEnd });
    });
  });

  return mergeOverlappingRanges(ranges);
}

/**
 * Merge overlapping or adjacent ranges into larger contiguous ranges.
 *
 * @param ranges - Array of ranges, potentially overlapping
 * @returns Array of non-overlapping ranges
 */
export function mergeOverlappingRanges(ranges: ChangedRange[]): ChangedRange[] {
  if (ranges.length === 0) return [];

  // Sort by start position
  const sorted = [...ranges].sort((a, b) => a.from - b.from);

  const merged: ChangedRange[] = [];
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let current = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const next = sorted[i]!;

    // If ranges overlap or are adjacent, merge them
    if (next.from <= current.to + 1) {
      current = {
        from: current.from,
        to: Math.max(current.to, next.to),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Check if a position falls within any of the changed ranges.
 *
 * @param pos - Document position to check
 * @param ranges - Array of changed ranges
 * @returns true if position is within a changed range
 */
export function isInChangedRange(pos: number, ranges: ChangedRange[]): boolean {
  return ranges.some((range) => pos >= range.from && pos <= range.to);
}

/**
 * Expand ranges to include complete text nodes or patterns.
 * This is useful when a change might affect adjacent content (e.g., completing a hashtag).
 *
 * @param ranges - Original changed ranges
 * @param expansion - Number of characters to expand on each side
 * @param docSize - Total document size (to clamp ranges)
 * @returns Expanded ranges
 */
export function expandRanges(
  ranges: ChangedRange[],
  expansion: number,
  docSize: number
): ChangedRange[] {
  const expanded = ranges.map((range) => ({
    from: Math.max(0, range.from - expansion),
    to: Math.min(docSize, range.to + expansion),
  }));

  return mergeOverlappingRanges(expanded);
}

/**
 * Check if this transaction is a full document reload (from CRDT sync).
 * These transactions should trigger a full decoration re-scan.
 *
 * @param transaction - The ProseMirror transaction
 * @returns true if this appears to be a full document reload
 */
export function isFullDocumentReload(transaction: Transaction): boolean {
  // Check for y-sync metadata that indicates full reload
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const ySyncOrigin = transaction.getMeta('y-sync$');
  if (ySyncOrigin === 'remote' || ySyncOrigin === 'load') {
    return true;
  }

  // Check for other reload indicators
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const isReload = transaction.getMeta('reload');
  if (isReload) {
    return true;
  }

  // If there are no steps but the document changed, it might be a replacement
  // This is a heuristic - better to over-scan than miss decorations
  if (transaction.docChanged && transaction.steps.length === 0) {
    return true;
  }

  return false;
}

/**
 * Check if any of the changed ranges overlap with existing decoration positions.
 *
 * @param ranges - Changed ranges from the transaction
 * @param decorationPositions - Array of {from, to} positions of existing decorations
 * @returns true if any decoration is in a changed range
 */
export function decorationsAffected(
  ranges: ChangedRange[],
  decorationPositions: { from: number; to: number }[]
): boolean {
  return decorationPositions.some((deco) =>
    ranges.some((range) => !(deco.to < range.from || deco.from > range.to))
  );
}
