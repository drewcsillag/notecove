/**
 * Tests for Table Interactions & Visual Polish
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 5
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { NotecoveTable, NotecoveTableRow, NotecoveTableHeader, NotecoveTableCell } from '../Table';

describe('Table Column Resizing', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should have resizing enabled on table extension', () => {
    // The table extension should have resizable configured
    const tableExtension = editor.extensionManager.extensions.find((ext) => ext.name === 'table');
    expect(tableExtension).toBeDefined();
    expect(tableExtension?.options?.resizable).toBe(true);
  });

  it('should render table with colgroup for column widths', () => {
    editor.commands.insertTable({ rows: 2, cols: 3, withHeaderRow: true });

    const html = editor.getHTML();
    // TipTap tables with resizing enabled include colgroup element
    expect(html).toMatch(/<table/);
    // The colgroup is added by the table extension when resizing is enabled
    expect(html).toMatch(/<colgroup>/);
  });

  it('should have col elements for columns', () => {
    editor.commands.insertTable({ rows: 2, cols: 3, withHeaderRow: true });

    const html = editor.getHTML();
    // Each column gets a col element in the colgroup
    // TipTap may add an extra col element for resize handles
    const colMatches = html.match(/<col/g);
    expect(colMatches?.length).toBeGreaterThanOrEqual(3);
  });

  it('should allow setting column widths programmatically', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

    // Focus on first cell
    editor.commands.focus('start');

    // Set cell attributes - this affects the cell width
    const result = editor.commands.setCellAttribute('colwidth', [100]);
    expect(result).toBe(true);
  });

  it('should persist column width when set', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Set width on the cell
    editor.commands.setCellAttribute('colwidth', [150]);

    const html = editor.getHTML();
    // The colwidth should be reflected in the col element or cell style
    expect(html).toContain('150');
  });
});

describe('Table Cell Alignment', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should have setCellAttribute command available', () => {
    expect(typeof editor.commands.setCellAttribute).toBe('function');
  });

  it('should set cell alignment to center', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Set alignment on the cell
    const result = editor.commands.setCellAttribute('textAlign', 'center');
    expect(result).toBe(true);

    const html = editor.getHTML();
    expect(html).toContain('text-align: center');
  });

  it('should set cell alignment to right', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    const result = editor.commands.setCellAttribute('textAlign', 'right');
    expect(result).toBe(true);

    const html = editor.getHTML();
    expect(html).toContain('text-align: right');
  });

  it('should not add style for left alignment (default)', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // First set to center
    editor.commands.setCellAttribute('textAlign', 'center');
    expect(editor.getHTML()).toContain('text-align: center');

    // Then change back to left (default)
    const result = editor.commands.setCellAttribute('textAlign', 'left');
    expect(result).toBe(true);

    // Check that text-align: left is not explicitly set (it's the default)
    const html = editor.getHTML();
    expect(html).not.toContain('text-align: left');
    expect(html).not.toContain('text-align: center');
  });

  it('should support alignment on header cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    editor.commands.focus('start');

    // Set alignment on header cell
    const result = editor.commands.setCellAttribute('textAlign', 'center');
    expect(result).toBe(true);

    const html = editor.getHTML();
    expect(html).toContain('text-align: center');
  });
});

describe('Column-Level Alignment', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should have setColumnAlignment command available', () => {
    expect(typeof (editor.commands as any).setColumnAlignment).toBe('function');
  });

  it('should set alignment on all cells in a column', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
    editor.commands.focus('start');

    // Set column alignment to center

    const result = (editor.commands as any).setColumnAlignment('center');
    expect(result).toBe(true);

    const html = editor.getHTML();
    // Should have multiple cells with center alignment
    const centerAlignMatches = html.match(/text-align: center/g);
    expect(centerAlignMatches?.length).toBeGreaterThanOrEqual(3);
  });

  it('should align column including header cells', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
    editor.commands.focus('start');

    // Set column alignment to right

    const result = (editor.commands as any).setColumnAlignment('right');
    expect(result).toBe(true);

    const html = editor.getHTML();
    // Should affect all cells in the column (header + body cells)
    const rightAlignMatches = html.match(/text-align: right/g);
    expect(rightAlignMatches?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Multi-Cell Selection', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should have cell selection enabled', () => {
    const tableExtension = editor.extensionManager.extensions.find((ext) => ext.name === 'table');
    expect(tableExtension?.options?.allowTableNodeSelection).toBe(true);
  });

  it('should have table selection commands available', () => {
    const commands = Object.keys(editor.commands);
    // Cell selection related commands
    expect(commands).toContain('selectNodeForward');
    expect(commands).toContain('selectNodeBackward');
  });

  it('should allow selecting entire table', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

    // Select the table node (TipTap's allowTableNodeSelection enables this)
    const result = editor.commands.selectParentNode();
    expect(result).toBe(true);
  });

  // Note: Shift+click multi-cell selection is handled by TipTap's CellSelection
  // and cannot be fully tested in JSDOM (requires mouse events).
  // The extension correctly configures allowTableNodeSelection: true
  // which enables the built-in multi-cell selection behavior.
});

describe('Row Hover Highlighting', () => {
  // Note: CSS hover effects can't be tested in JSDOM
  // These tests verify the structure supports hover styling

  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should render table rows with tr elements', () => {
    editor.commands.insertTable({ rows: 3, cols: 2, withHeaderRow: true });

    const html = editor.getHTML();
    // Verify tr elements are present for CSS hover targeting
    const rowMatches = html.match(/<tr>/g);
    expect(rowMatches?.length).toBe(3);
  });
});

describe('Table Focus Indicator', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should detect when cursor is in table', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // The isActive check is used by the toolbar for showing table-specific buttons
    expect(editor.isActive('table')).toBe(true);
  });

  it('should detect when cursor leaves table', () => {
    // Insert a paragraph, then a table
    editor.commands.setContent('<p>Before table</p>');
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

    // Focus at the very beginning (the paragraph)
    editor.commands.focus('start');

    // When focused on paragraph, table should not be active
    expect(editor.isActive('table')).toBe(false);
  });
});
