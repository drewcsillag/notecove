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
          const dims = getTableDimensionsFromEditor(this.editor);
          if (dims && dims.rows >= TABLE_CONSTRAINTS.MAX_ROWS) {
            debugLog(`Cannot add row: already at max (${TABLE_CONSTRAINTS.MAX_ROWS})`);
            return false;
          }
          debugLog('Adding row below (Mod+Enter)');
          return this.editor.commands.addRowAfter();
        }
        return false;
      },
      'Mod-Shift-Enter': () => {
        if (this.editor.isActive('table')) {
          const dims = getTableDimensionsFromEditor(this.editor);
          if (dims && dims.cols >= TABLE_CONSTRAINTS.MAX_COLS) {
            debugLog(`Cannot add column: already at max (${TABLE_CONSTRAINTS.MAX_COLS})`);
            return false;
          }
          debugLog('Adding column after (Mod+Shift+Enter)');
          return this.editor.commands.addColumnAfter();
        }
        return false;
      },
      'Mod-Backspace': () => {
        if (this.editor.isActive('table')) {
          const dims = getTableDimensionsFromEditor(this.editor);
          if (dims && dims.rows <= TABLE_CONSTRAINTS.MIN_ROWS) {
            debugLog(`Cannot delete row: already at min (${TABLE_CONSTRAINTS.MIN_ROWS})`);
            return false;
          }
          debugLog('Deleting row (Mod+Backspace)');
          return this.editor.commands.deleteRow();
        }
        return false;
      },
      'Mod-Shift-Backspace': () => {
        if (this.editor.isActive('table')) {
          const dims = getTableDimensionsFromEditor(this.editor);
          if (dims && dims.cols <= TABLE_CONSTRAINTS.MIN_COLS) {
            debugLog(`Cannot delete column: already at min (${TABLE_CONSTRAINTS.MIN_COLS})`);
            return false;
          }
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

/**
 * Get table dimensions from editor state
 * Finds the table node containing the current selection and returns its dimensions.
 */
export function getTableDimensionsFromEditor(editor: {
  state: {
    selection: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $from: any;
    };
  };
}): { rows: number; cols: number } | null {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { $from } = editor.state.selection;

  // Walk up the node tree to find the table
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const depth = $from.depth;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  for (let d = depth; d > 0; d--) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const node = $from.node(d);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-optional-chain
    if (node && node.type.name === 'table') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return getTableDimensions(node);
    }
  }

  return null;
}

/**
 * Check if we can add a row (haven't reached max rows)
 */
export function canAddRow(editor: Parameters<typeof getTableDimensionsFromEditor>[0]): boolean {
  const dims = getTableDimensionsFromEditor(editor);
  return !dims || dims.rows < TABLE_CONSTRAINTS.MAX_ROWS;
}

/**
 * Check if we can add a column (haven't reached max columns)
 */
export function canAddColumn(editor: Parameters<typeof getTableDimensionsFromEditor>[0]): boolean {
  const dims = getTableDimensionsFromEditor(editor);
  return !dims || dims.cols < TABLE_CONSTRAINTS.MAX_COLS;
}

/**
 * Check if we can delete a row (haven't reached min rows)
 */
export function canDeleteRow(editor: Parameters<typeof getTableDimensionsFromEditor>[0]): boolean {
  const dims = getTableDimensionsFromEditor(editor);
  return !dims || dims.rows > TABLE_CONSTRAINTS.MIN_ROWS;
}

/**
 * Check if we can delete a column (haven't reached min columns)
 */
export function canDeleteColumn(
  editor: Parameters<typeof getTableDimensionsFromEditor>[0]
): boolean {
  const dims = getTableDimensionsFromEditor(editor);
  return !dims || dims.cols > TABLE_CONSTRAINTS.MIN_COLS;
}

// =============================================================================
// Markdown Table Parsing Utilities
// =============================================================================

/**
 * Parse a markdown table row into cell contents.
 * Returns null if the text is not a valid table row.
 *
 * @example
 * parseMarkdownTableRow('| col1 | col2 |') // ['col1', 'col2']
 * parseMarkdownTableRow('not a table') // null
 */
export function parseMarkdownTableRow(text: string): string[] | null {
  const trimmed = text.trim();

  // Must start and end with pipe (or just have pipes)
  if (!trimmed.includes('|')) {
    return null;
  }

  // Split by pipe and filter
  const parts = trimmed.split('|');

  // Remove empty first/last elements from leading/trailing pipes
  const cells = parts
    .map((p) => p.trim())
    .filter((p, i, arr) => {
      // Keep middle elements, skip empty first/last
      if (i === 0 && p === '') return false;
      if (i === arr.length - 1 && p === '') return false;
      return true;
    });

  // Must have at least one cell
  if (cells.length === 0) {
    return null;
  }

  return cells;
}

/**
 * Check if a row is a markdown table separator (|---|---|)
 */
export function isMarkdownTableSeparator(text: string): boolean {
  const cells = parseMarkdownTableRow(text);
  if (!cells) return false;

  // Each cell must be a separator pattern: optional :, at least one -, optional :
  const separatorPattern = /^:?-+:?$/;
  return cells.every((cell) => separatorPattern.test(cell));
}

/**
 * Parse alignment from a separator cell
 * :--- = left, :---: = center, ---: = right, --- = left (default)
 */
export function parseMarkdownAlignment(separator: string): 'left' | 'center' | 'right' {
  const trimmed = separator.trim();
  const startsWithColon = trimmed.startsWith(':');
  const endsWithColon = trimmed.endsWith(':');

  if (startsWithColon && endsWithColon) {
    return 'center';
  } else if (endsWithColon) {
    return 'right';
  }
  return 'left';
}

/**
 * Parse a complete markdown table into structured data.
 * Returns null if the lines don't form a valid table.
 */
export function parseMarkdownTable(lines: string[]): {
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  rows: string[][];
} | null {
  const headerLine = lines[0];
  const separatorLine = lines[1];

  if (!headerLine || !separatorLine) {
    return null;
  }

  // First line should be header
  const headers = parseMarkdownTableRow(headerLine);
  if (!headers) return null;

  // Second line should be separator
  if (!isMarkdownTableSeparator(separatorLine)) {
    return null;
  }

  // Parse alignments from separator
  const separatorCells = parseMarkdownTableRow(separatorLine) ?? [];
  const alignments = separatorCells.map(parseMarkdownAlignment);

  // Ensure alignments match header count
  while (alignments.length < headers.length) {
    alignments.push('left');
  }

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const row = parseMarkdownTableRow(line);
    if (row) {
      // Pad row to match header count
      while (row.length < headers.length) {
        row.push('');
      }
      rows.push(row);
    }
  }

  return { headers, alignments, rows };
}

/**
 * Convert a parsed markdown table to HTML string.
 * This HTML can be inserted into TipTap editor.
 */
export function markdownTableToHtml(
  table: NonNullable<ReturnType<typeof parseMarkdownTable>>
): string {
  const { headers, rows } = table;

  // Build header row
  const headerCells = headers.map((h) => `<th><p>${escapeHtml(h)}</p></th>`).join('');
  const headerRow = `<tr>${headerCells}</tr>`;

  // Build data rows
  const dataRows = rows
    .map((row) => {
      const cells = row.map((cell) => `<td><p>${escapeHtml(cell)}</p></td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table>${headerRow}${dataRows}</table>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
