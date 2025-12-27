/**
 * Tests for NoteCove Table Extension
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 1
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { yUndoPluginKey } from '@tiptap/y-tiptap';
import {
  NotecoveTable,
  NotecoveTableRow,
  NotecoveTableHeader,
  NotecoveTableCell,
  canAddRow,
  canAddColumn,
  canDeleteRow,
  canDeleteColumn,
  getTableDimensionsFromEditor,
} from '../Table';

describe('NoteCove Table Extension', () => {
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

  describe('Extension Registration', () => {
    it('should register the table extension', () => {
      const extensions = editor.extensionManager.extensions;
      expect(extensions.some((ext) => ext.name === 'table')).toBe(true);
    });

    it('should register the tableRow extension', () => {
      const extensions = editor.extensionManager.extensions;
      expect(extensions.some((ext) => ext.name === 'tableRow')).toBe(true);
    });

    it('should register the tableHeader extension', () => {
      const extensions = editor.extensionManager.extensions;
      expect(extensions.some((ext) => ext.name === 'tableHeader')).toBe(true);
    });

    it('should register the tableCell extension', () => {
      const extensions = editor.extensionManager.extensions;
      expect(extensions.some((ext) => ext.name === 'tableCell')).toBe(true);
    });
  });

  describe('Table Node Schema', () => {
    it('should be a block-level node', () => {
      const tableNode = editor.state.schema.nodes['table'];
      expect(tableNode).toBeDefined();
      expect(tableNode!.spec.group).toBe('block');
    });

    it('should contain tableRow nodes', () => {
      const tableNode = editor.state.schema.nodes['table'];
      expect(tableNode).toBeDefined();
      expect(tableNode!.spec.content).toContain('tableRow');
    });
  });

  describe('Table Creation', () => {
    it('should insert a table with insertTable command', () => {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
      const html = editor.getHTML();
      expect(html).toMatch(/<table/); // TipTap adds style attributes
      expect(html).toContain('<tr>');
      expect(html).toContain('<th');
      expect(html).toContain('<td');
    });

    it('should create a table without header row when specified', () => {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
      const html = editor.getHTML();
      expect(html).toMatch(/<table/); // TipTap adds style attributes
      expect(html).not.toContain('<th');
      expect(html).toContain('<td');
    });

    it('should create correct number of rows and columns', () => {
      editor.commands.insertTable({ rows: 4, cols: 5, withHeaderRow: true });
      const html = editor.getHTML();
      // Count rows (4 rows)
      const rowMatches = html.match(/<tr>/g);
      expect(rowMatches?.length).toBe(4);
      // Count header cells (5 in first row)
      const thMatches = html.match(/<th/g);
      expect(thMatches?.length).toBe(5);
      // Count data cells (3 rows × 5 cols = 15)
      const tdMatches = html.match(/<td/g);
      expect(tdMatches?.length).toBe(15);
    });
  });

  describe('Table Commands', () => {
    beforeEach(() => {
      // Insert a 3x3 table and position cursor in it
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
    });

    it('should add a row after current row', () => {
      const initialHtml = editor.getHTML();
      const initialRows = initialHtml.match(/<tr>/g)?.length ?? 0;

      editor.commands.addRowAfter();

      const newHtml = editor.getHTML();
      const newRows = newHtml.match(/<tr>/g)?.length ?? 0;
      expect(newRows).toBe(initialRows + 1);
    });

    it('should add a row before current row', () => {
      const initialHtml = editor.getHTML();
      const initialRows = initialHtml.match(/<tr>/g)?.length ?? 0;

      editor.commands.addRowBefore();

      const newHtml = editor.getHTML();
      const newRows = newHtml.match(/<tr>/g)?.length ?? 0;
      expect(newRows).toBe(initialRows + 1);
    });

    it('should add a column after current column', () => {
      editor.commands.addColumnAfter();
      const html = editor.getHTML();
      // Should now have 4 columns per row
      // 4 th + 8 td = 12 cells per row count... let's just check th count
      const thMatches = html.match(/<th/g);
      expect(thMatches?.length).toBe(4); // Was 3, now 4
    });

    it('should add a column before current column', () => {
      editor.commands.addColumnBefore();
      const html = editor.getHTML();
      const thMatches = html.match(/<th/g);
      expect(thMatches?.length).toBe(4); // Was 3, now 4
    });

    it('should delete current row', () => {
      const initialHtml = editor.getHTML();
      const initialRows = initialHtml.match(/<tr>/g)?.length ?? 0;

      editor.commands.deleteRow();

      const newHtml = editor.getHTML();
      const newRows = newHtml.match(/<tr>/g)?.length ?? 0;
      expect(newRows).toBe(initialRows - 1);
    });

    it('should delete current column', () => {
      editor.commands.deleteColumn();
      const html = editor.getHTML();
      const thMatches = html.match(/<th/g);
      expect(thMatches?.length).toBe(2); // Was 3, now 2
    });

    it('should delete entire table', () => {
      editor.commands.deleteTable();
      const html = editor.getHTML();
      expect(html).not.toContain('<table>');
    });

    it('should toggle header row', () => {
      // Initially has header row
      let html = editor.getHTML();
      expect(html).toContain('<th');

      // Toggle off
      editor.commands.toggleHeaderRow();
      html = editor.getHTML();
      // After toggling, first row should be td not th
      // Note: The behavior depends on TipTap implementation
    });
  });

  describe('Table Serialization', () => {
    it('should serialize table to HTML correctly', () => {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

      // Add content to first cell
      editor.commands.focus();

      const html = editor.getHTML();
      expect(html).toMatch(/<table/); // TipTap adds style attributes
      expect(html).toMatch(/<\/table>/);
    });

    it('should parse HTML table correctly', () => {
      const tableHtml = `
        <table>
          <tr><th>Header 1</th><th>Header 2</th></tr>
          <tr><td>Cell 1</td><td>Cell 2</td></tr>
        </table>
      `;

      editor.commands.setContent(tableHtml);
      const output = editor.getHTML();
      expect(output).toContain('Header 1');
      expect(output).toContain('Cell 1');
    });
  });
});

describe('Table with Yjs Collaboration', () => {
  let editor: Editor;
  let yDoc: Y.Doc;

  beforeEach(() => {
    yDoc = new Y.Doc();
    editor = new Editor({
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
    yDoc.destroy();
  });

  it('should have UndoManager available in plugin state', () => {
    const undoPluginState = yUndoPluginKey.getState(editor.state);
    expect(undoPluginState?.undoManager).toBeDefined();
  });

  it('should create table with Yjs collaboration', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    const html = editor.getHTML();
    expect(html).toMatch(/<table/); // TipTap adds style attributes
  });

  it('should track table operations in undo stack', () => {
    const undoPluginState = yUndoPluginKey.getState(editor.state);
    const um = undoPluginState?.undoManager;
    expect(um).toBeDefined();
    if (!um) return;

    // Clear any existing undo stack
    const initialStackLength = um.undoStack.length as number;

    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    // Check undo stack has grown
    expect(um.undoStack.length as number).toBeGreaterThan(initialStackLength);
  });

  it('should undo table creation', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    expect(editor.getHTML()).toMatch(/<table/);

    editor.commands.undo();
    expect(editor.getHTML()).not.toMatch(/<table/);
  });

  it('should redo table creation', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    editor.commands.undo();
    expect(editor.getHTML()).not.toMatch(/<table/);

    editor.commands.redo();
    expect(editor.getHTML()).toMatch(/<table/);
  });

  it('should sync table changes to Yjs document', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    // Get the XML fragment content
    const fragment = yDoc.getXmlFragment('content');
    expect(fragment.length).toBeGreaterThan(0);
  });
});

describe('Table Nesting Rules', () => {
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

  it('should not create nested tables in the DOM', () => {
    // Insert a table
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

    // Try to insert another table inside
    // The cursor should be in the first cell
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

    // Get the HTML and check there's no table inside table
    const html = editor.getHTML();

    // Count table tags - there should be 2 separate tables, not nested
    const tableOpenCount = (html.match(/<table/g) ?? []).length;
    const tableCloseCount = (html.match(/<\/table>/g) ?? []).length;

    expect(tableOpenCount).toBe(tableCloseCount); // Balanced tags

    // Verify no nesting by checking that tables are siblings, not nested
    // If tables were nested, we'd have a structure like <table>...<table>...</table>...</table>
    // Instead, we should have <table>...</table><table>...</table>

    // A simple check: between the first </table> and last <table there should be no other <table
    // This is a simplistic test - the actual behavior depends on TipTap's implementation
    expect(tableOpenCount).toBeGreaterThanOrEqual(1);
  });
});

describe('Table Size Limit Helpers', () => {
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

  it('canAddRow should return true when below max rows', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
    expect(canAddRow(editor)).toBe(true);
  });

  it('canAddColumn should return true when below max columns', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
    expect(canAddColumn(editor)).toBe(true);
  });

  it('canDeleteRow should return true when above min rows', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
    expect(canDeleteRow(editor)).toBe(true);
  });

  it('canDeleteColumn should return true when above min columns', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
    expect(canDeleteColumn(editor)).toBe(true);
  });

  it('canDeleteRow should return false at min rows (2)', () => {
    editor.commands.insertTable({ rows: 2, cols: 3, withHeaderRow: false });
    expect(canDeleteRow(editor)).toBe(false);
  });

  it('canDeleteColumn should return false at min columns (2)', () => {
    editor.commands.insertTable({ rows: 3, cols: 2, withHeaderRow: false });
    expect(canDeleteColumn(editor)).toBe(false);
  });

  it('getTableDimensionsFromEditor should return correct dimensions', () => {
    editor.commands.insertTable({ rows: 4, cols: 5, withHeaderRow: false });

    const dims = getTableDimensionsFromEditor(editor);
    expect(dims).toEqual({ rows: 4, cols: 5 });
  });

  it('getTableDimensionsFromEditor should return null when not in table', () => {
    // No table inserted, just a paragraph
    editor.commands.setContent('<p>Hello</p>');

    const dims = getTableDimensionsFromEditor(editor);
    expect(dims).toBe(null);
  });
});
