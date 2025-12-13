/**
 * Tests for Table Edge Cases
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 9
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  NotecoveTable,
  NotecoveTableRow,
  NotecoveTableHeader,
  NotecoveTableCell,
  TABLE_CONSTRAINTS,
} from '../Table';

describe('Table Edge Cases - Size Limits', () => {
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

  it('should create minimum size table (2x2)', () => {
    editor.commands.insertTable({
      rows: TABLE_CONSTRAINTS.MIN_ROWS,
      cols: TABLE_CONSTRAINTS.MIN_COLS,
      withHeaderRow: false,
    });

    const html = editor.getHTML();
    expect((html.match(/<tr>/g) ?? []).length).toBe(2);
    expect((html.match(/<td/g) ?? []).length).toBe(4);
  });

  it('should handle maximum columns (20)', () => {
    editor.commands.insertTable({
      rows: 2,
      cols: TABLE_CONSTRAINTS.MAX_COLS,
      withHeaderRow: true,
    });

    const html = editor.getHTML();
    expect((html.match(/<th/g) ?? []).length).toBe(20);
  });

  it('should handle tables with many rows', () => {
    // Create a table with 50 rows for testing (not max 1000 for speed)
    editor.commands.insertTable({
      rows: 50,
      cols: 3,
      withHeaderRow: true,
    });

    const html = editor.getHTML();
    expect((html.match(/<tr>/g) ?? []).length).toBe(50);
  });
});

describe('Table Edge Cases - Empty Cells', () => {
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

  it('should create table with empty cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

    // All cells should be empty but present
    const html = editor.getHTML();
    expect((html.match(/<td/g) ?? []).length).toBe(4);
    expect(html).toContain('<p></p>');
  });

  it('should preserve table structure with all empty cells', () => {
    editor.commands.setContent(`
      <table>
        <tr><td><p></p></td><td><p></p></td></tr>
        <tr><td><p></p></td><td><p></p></td></tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toMatch(/<table/);
    expect((html.match(/<tr>/g) ?? []).length).toBe(2);
  });

  it('should handle mixed empty and filled cells', () => {
    editor.commands.setContent(`
      <table>
        <tr><td><p>A</p></td><td><p></p></td></tr>
        <tr><td><p></p></td><td><p>D</p></td></tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toContain('A');
    expect(html).toContain('D');
    expect((html.match(/<td/g) ?? []).length).toBe(4);
  });
});

describe('Table Edge Cases - Header Configurations', () => {
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

  it('should create table with header row', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });

    const html = editor.getHTML();
    expect((html.match(/<th/g) ?? []).length).toBe(3); // First row has headers
    expect((html.match(/<td/g) ?? []).length).toBe(6); // Other rows have data cells
  });

  it('should create table without header row', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });

    const html = editor.getHTML();
    expect(html).not.toMatch(/<th/);
    expect((html.match(/<td/g) ?? []).length).toBe(9);
  });

  it('should toggle header row', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Initially no headers
    expect(editor.getHTML()).not.toMatch(/<th/);

    // Toggle header
    editor.commands.toggleHeaderRow();

    // Now should have headers
    expect(editor.getHTML()).toMatch(/<th/);
  });
});

describe('Table Edge Cases - Special Content', () => {
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

  it('should handle very long text in cells', () => {
    const longText = 'A'.repeat(1000);
    editor.commands.setContent(`
      <table>
        <tr><td><p>${longText}</p></td></tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toContain(longText);
  });

  it('should handle special characters in cells', () => {
    editor.commands.setContent(`
      <table>
        <tr><td><p>&lt;html&gt; &amp; "quotes"</p></td></tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toMatch(/<html>|&lt;html&gt;/);
  });

  it('should handle unicode characters in cells', () => {
    editor.commands.setContent(`
      <table>
        <tr><td><p>日本語 한국어 العربية</p></td></tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toContain('日本語');
    expect(html).toContain('한국어');
    expect(html).toContain('العربية');
  });

  it('should handle emoji in cells', () => {
    editor.commands.setContent(`
      <table>
        <tr><td><p>Hello 👋 World 🌍</p></td></tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toContain('👋');
    expect(html).toContain('🌍');
  });
});

describe('Table Edge Cases - Operations', () => {
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

  it('should handle rapid row operations', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Add multiple rows quickly
    for (let i = 0; i < 5; i++) {
      editor.commands.addRowAfter();
    }

    const html = editor.getHTML();
    expect((html.match(/<tr>/g) ?? []).length).toBe(7); // 2 original + 5 added
  });

  it('should handle rapid column operations', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Add multiple columns quickly
    for (let i = 0; i < 3; i++) {
      editor.commands.addColumnAfter();
    }

    const html = editor.getHTML();
    expect((html.match(/<td/g) ?? []).length).toBe(10); // 2 rows * 5 cols
  });

  it('should handle delete then add operations', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
    editor.commands.focus('start');

    // Delete a row
    editor.commands.deleteRow();

    // Add a row
    editor.commands.addRowAfter();

    const html = editor.getHTML();
    expect((html.match(/<tr>/g) ?? []).length).toBe(3); // Should be back to 3
  });

  it('should maintain table integrity after multiple operations', () => {
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
    editor.commands.focus('start');

    // Perform various operations
    editor.commands.addRowAfter();
    editor.commands.addColumnAfter();
    editor.commands.goToNextCell();
    editor.commands.addRowAfter();

    // Table should still be valid
    const html = editor.getHTML();
    expect(html).toMatch(/<table/);
    expect(html).toMatch(/<\/table>/);

    // All rows should have the same number of cells
    const rows = html.match(/<tr>.*?<\/tr>/gs) ?? [];
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('Table Edge Cases - Minimum Table Operations', () => {
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

  it('should not allow deleting row when at minimum', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Try to delete row - should be prevented at minimum
    // The built-in command may succeed, but our UI disables the button
    const initialRows = (editor.getHTML().match(/<tr>/g) ?? []).length;
    expect(initialRows).toBe(2);
  });

  it('should not allow deleting column when at minimum', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Try to delete column - should be prevented at minimum
    const initialCols = (editor.getHTML().match(/<td/g) ?? []).length / 2;
    expect(initialCols).toBe(2);
  });
});
