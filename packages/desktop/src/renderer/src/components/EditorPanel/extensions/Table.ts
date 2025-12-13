/**
 * NoteCove Table Extension
 *
 * A block node extension for displaying tables in notes.
 * Wraps TipTap's official table extensions with custom configuration.
 *
 * Features:
 * - Block-level tables (no nesting in blockquotes, lists, or other tables)
 * - Header row and header column support
 * - Column resizing
 * - Cell selection
 *
 * Constraints:
 * - Min size: 2×2
 * - Max columns: 20
 * - Max rows: 1000
 *
 * @see plans/tables-in-notes/PLAN.md
 */

import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

// Debug logging enabled in development mode
const DEBUG: boolean =
  typeof window !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).__NOTECOVE_DEV_MODE__ === true;

/**
 * Log debug messages for table operations
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.log(`[NotecoveTable] ${message}`, ...args);
  }
}

/**
 * Table size constraints
 */
export const TABLE_CONSTRAINTS = {
  MIN_ROWS: 2,
  MIN_COLS: 2,
  MAX_ROWS: 1000,
  MAX_COLS: 20,
  DEFAULT_ROWS: 3,
  DEFAULT_COLS: 3,
} as const;

/**
 * NoteCove Table Extension
 *
 * Configured to:
 * - Allow resizing
 * - Support cell selection
 * - Be a top-level block (no nesting)
 */
export const NotecoveTable = Table.configure({
  resizable: true,
  // Allow last column to be resized
  lastColumnResizable: true,
  // Handle cell selection
  allowTableNodeSelection: true,
}).extend({
  // Override to add debug logging
  onCreate() {
    debugLog('Table extension initialized');
  },

  addKeyboardShortcuts() {
    return {
      // Tab navigates to next cell (built-in behavior)
      // Shift-Tab navigates to previous cell (built-in behavior)

      // Custom shortcuts for table manipulation
      'Mod-Enter': () => {
        if (this.editor.isActive('table')) {
          debugLog('Adding row below (Mod+Enter)');
          return this.editor.commands.addRowAfter();
        }
        return false;
      },
      'Mod-Shift-Enter': () => {
        if (this.editor.isActive('table')) {
          debugLog('Adding column after (Mod+Shift+Enter)');
          return this.editor.commands.addColumnAfter();
        }
        return false;
      },
      'Mod-Backspace': () => {
        if (this.editor.isActive('table')) {
          debugLog('Deleting row (Mod+Backspace)');
          return this.editor.commands.deleteRow();
        }
        return false;
      },
      'Mod-Shift-Backspace': () => {
        if (this.editor.isActive('table')) {
          debugLog('Deleting column (Mod+Shift+Backspace)');
          return this.editor.commands.deleteColumn();
        }
        return false;
      },
    };
  },
});

/**
 * NoteCove Table Row Extension
 */
export const NotecoveTableRow = TableRow.configure({});

/**
 * NoteCove Table Header Extension
 *
 * Used for header cells (<th>) in the first row or first column.
 */
export const NotecoveTableHeader = TableHeader.configure({});

/**
 * NoteCove Table Cell Extension
 *
 * Regular table cells (<td>).
 */
export const NotecoveTableCell = TableCell.configure({});

/**
 * Check if a table size is valid
 */
export function isValidTableSize(rows: number, cols: number): boolean {
  return (
    rows >= TABLE_CONSTRAINTS.MIN_ROWS &&
    rows <= TABLE_CONSTRAINTS.MAX_ROWS &&
    cols >= TABLE_CONSTRAINTS.MIN_COLS &&
    cols <= TABLE_CONSTRAINTS.MAX_COLS
  );
}

/**
 * Check if a table exceeds size limits (for paste warning)
 */
export function exceedsTableSizeLimits(rows: number, cols: number): boolean {
  return rows > TABLE_CONSTRAINTS.MAX_ROWS || cols > TABLE_CONSTRAINTS.MAX_COLS;
}

/**
 * Get table dimensions from a table node
 */
export function getTableDimensions(
  tableNode: {
    content: { childCount: number; child: (i: number) => { content: { childCount: number } } };
  } | null
): { rows: number; cols: number } {
  if (!tableNode) {
    return { rows: 0, cols: 0 };
  }

  const rows = tableNode.content.childCount;
  const cols = rows > 0 ? tableNode.content.child(0).content.childCount : 0;

  return { rows, cols };
}
