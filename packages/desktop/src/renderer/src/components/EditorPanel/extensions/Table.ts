/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

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
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';

// Type declaration for our custom command (used in tests)
export interface TableCommands {
  setColumnAlignment: (alignment: 'left' | 'center' | 'right') => boolean;
}

// Debug logging enabled in development mode
const DEBUG: boolean =
  typeof window !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  addCommands() {
    return {
      ...this.parent?.(),
      /**
       * Set text alignment for all cells in the current column
       */
      setColumnAlignment:
        (alignment: 'left' | 'center' | 'right') =>
        ({
          editor,
          tr,
          dispatch,
        }: {
          editor: Editor;
          tr: Transaction;
          dispatch?: (tr: Transaction) => void;
        }) => {
          if (!editor.isActive('table')) {
            return false;
          }

          const { $from } = editor.state.selection;
          const tableDepth = findTableDepth($from);
          if (tableDepth === null) {
            return false;
          }

          // Find the column index of the current cell
          const columnIndex = findColumnIndex($from, tableDepth);
          if (columnIndex === null) {
            return false;
          }

          // Get the table node
          const tableNode = $from.node(tableDepth);
          const tableStart = $from.start(tableDepth);

          if (!dispatch) {
            return true;
          }

          // Iterate through all rows and set alignment on cells at the column index
          let pos = tableStart;
          for (let rowIdx = 0; rowIdx < tableNode.content.childCount; rowIdx++) {
            const row = tableNode.content.child(rowIdx);
            let cellPos = pos + 1; // Skip the row opening tag

            for (let colIdx = 0; colIdx < row.content.childCount; colIdx++) {
              const cell = row.content.child(colIdx);

              if (colIdx === columnIndex) {
                // Set the alignment on this cell
                tr.setNodeMarkup(cellPos, undefined, {
                  ...cell.attrs,
                  textAlign: alignment,
                });
              }

              cellPos += cell.nodeSize;
            }

            pos += row.nodeSize;
          }

          debugLog(`Set column ${columnIndex} alignment to ${alignment}`);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Include parent shortcuts (Tab/Shift+Tab cell navigation)
      ...this.parent?.(),

      // Explicit Tab handling for cell navigation
      Tab: () => {
        if (this.editor.isActive('table')) {
          return this.editor.commands.goToNextCell();
        }
        return false;
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('table')) {
          return this.editor.commands.goToPreviousCell();
        }
        return false;
      },

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
 * Find the depth of the table in the document structure
 */
function findTableDepth($from: ResolvedPos): number | null {
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table') {
      return d;
    }
  }
  return null;
}

/**
 * Find the column index of the cell containing the selection
 */
function findColumnIndex($from: ResolvedPos, tableDepth: number): number | null {
  // Find the cell depth (should be tableDepth + 2: table > row > cell)
  const cellDepth = tableDepth + 2;
  if ($from.depth < cellDepth) {
    return null;
  }

  // Get the row containing the cell
  const row = $from.node(tableDepth + 1);
  const cell = $from.node(cellDepth);

  // Find the column index by iterating through the row's cells
  for (let i = 0; i < row.content.childCount; i++) {
    if (row.content.child(i) === cell) {
      return i;
    }
  }

  return null;
}

/**
 * NoteCove Table Row Extension
 */
export const NotecoveTableRow = TableRow.configure({});

/**
 * Valid text alignment values for table cells
 */
export type TableCellAlignment = 'left' | 'center' | 'right';

/**
 * NoteCove Table Header Extension
 *
 * Used for header cells (<th>) in the first row or first column.
 * Extended to support text alignment.
 */
export const NotecoveTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: 'left',
        parseHTML: (element: HTMLElement) => element.style.textAlign || 'left',
        renderHTML: (attributes: Record<string, unknown>) => {
          const align = attributes['textAlign'] as string;
          if (align === 'left') {
            return {};
          }
          return {
            style: `text-align: ${align}`,
          };
        },
      },
    };
  },
});

/**
 * NoteCove Table Cell Extension
 *
 * Regular table cells (<td>).
 * Extended to support text alignment.
 */
export const NotecoveTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: 'left',
        parseHTML: (element: HTMLElement) => element.style.textAlign || 'left',
        renderHTML: (attributes: Record<string, unknown>) => {
          const align = attributes['textAlign'] as string;
          if (align === 'left') {
            return {};
          }
          return {
            style: `text-align: ${align}`,
          };
        },
      },
    };
  },
});

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
  const { $from } = editor.state.selection;

  // Walk up the node tree to find the table

  const depth = $from.depth;

  for (let d = depth; d > 0; d--) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const node = $from.node(d);
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain, @typescript-eslint/no-unsafe-member-access
    if (node && node.type.name === 'table') {
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

// =============================================================================
// Table to Markdown Export
// =============================================================================

/**
 * Convert a table in the editor to Markdown pipe-syntax.
 * Finds the first table in the document and converts it.
 */
export function tableToMarkdown(editor: {
  state: {
    doc: ProseMirrorNode;
  };
}): string {
  let tableNode: ProseMirrorNode | undefined;

  // Find the first table node

  editor.state.doc.descendants((node: ProseMirrorNode) => {
    if (node.type.name === 'table' && !tableNode) {
      tableNode = node;
      return false; // Stop iteration
    }
    return undefined;
  });

  if (!tableNode) {
    return '';
  }

  const rows: string[][] = [];
  const alignments: ('left' | 'center' | 'right')[] = [];
  let hasHeaderRow = false;

  const tableContent = tableNode.content;

  for (let rowIdx = 0; rowIdx < tableContent.childCount; rowIdx++) {
    const row = tableContent.child(rowIdx);
    const cells: string[] = [];
    const rowContent = row.content;

    for (let cellIdx = 0; cellIdx < rowContent.childCount; cellIdx++) {
      const cell = rowContent.child(cellIdx);

      // Check if first row is a header row
      if (rowIdx === 0 && cell.type.name === 'tableHeader') {
        hasHeaderRow = true;
      }

      // Get text content from the cell
      const textContent = cell.textContent;
      // Escape pipe characters in content
      const escapedContent = textContent.replace(/\|/g, '\\|');
      cells.push(escapedContent);

      // Get alignment from first row (applies to whole column)
      if (rowIdx === 0) {
        const textAlign = (cell.attrs['textAlign'] as string | undefined) ?? 'left';

        alignments.push(textAlign as 'left' | 'center' | 'right');
      }
    }

    rows.push(cells);
  }

  if (rows.length === 0) {
    return '';
  }

  // Build markdown output
  const lines: string[] = [];

  // First row (header or first data row)
  const firstRow = rows[0];
  if (firstRow) {
    lines.push('| ' + firstRow.join(' | ') + ' |');
  }

  // Separator row with alignment markers
  const separatorCells = alignments.map((align) => {
    if (align === 'center') return ':---:';
    if (align === 'right') return '---:';
    return '---';
  });
  lines.push('| ' + separatorCells.join(' | ') + ' |');

  // Data rows (skip first if it was header)
  const dataStart = hasHeaderRow ? 1 : 1; // Always start from index 1 since we've already output row 0
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (row) {
      lines.push('| ' + row.join(' | ') + ' |');
    }
  }

  return lines.join('\n');
}
