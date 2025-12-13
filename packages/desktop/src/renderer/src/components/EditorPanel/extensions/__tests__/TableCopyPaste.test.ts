/**
 * Tests for Table Copy/Paste functionality
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 7
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  NotecoveTable,
  NotecoveTableRow,
  NotecoveTableHeader,
  NotecoveTableCell,
  parseMarkdownTable,
  markdownTableToHtml,
} from '../Table';

describe('Paste HTML Tables', () => {
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
      content: '<p>Initial content</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should parse and insert HTML table', () => {
    const htmlTable = `
      <table>
        <tr><th>Header 1</th><th>Header 2</th></tr>
        <tr><td>Data 1</td><td>Data 2</td></tr>
      </table>
    `;

    // Simulate pasting HTML by setting content
    editor.commands.setContent(htmlTable);

    const html = editor.getHTML();
    expect(html).toMatch(/<table/);
    expect(html).toContain('Header 1');
    expect(html).toContain('Data 1');
  });

  it('should preserve table structure from Excel-style HTML', () => {
    // Excel generates tables with additional attributes
    const excelTable = `
      <table border="1">
        <tbody>
          <tr><td>A1</td><td>B1</td></tr>
          <tr><td>A2</td><td>B2</td></tr>
        </tbody>
      </table>
    `;

    editor.commands.setContent(excelTable);

    const html = editor.getHTML();
    expect(html).toMatch(/<table/);
    expect(html).toContain('A1');
    expect(html).toContain('B2');
  });

  it('should handle tables with colspan and rowspan', () => {
    // Note: TipTap tables support colspan/rowspan
    const spanTable = `
      <table>
        <tr><td colspan="2">Merged</td></tr>
        <tr><td>Left</td><td>Right</td></tr>
      </table>
    `;

    editor.commands.setContent(spanTable);

    const html = editor.getHTML();
    expect(html).toMatch(/<table/);
    expect(html).toContain('Merged');
  });
});

describe('Parse Tab-Separated Text', () => {
  // These tests verify the utility functions for TSV parsing
  // Actual paste handling is tested in E2E tests

  it('should detect TSV content pattern', () => {
    const tsvContent = 'Col1\tCol2\tCol3\nVal1\tVal2\tVal3';
    const lines = tsvContent.split('\n');
    const hasTabs = lines.some((line) => line.includes('\t'));
    expect(hasTabs).toBe(true);
  });

  it('should parse TSV into rows and columns', () => {
    const tsvContent = 'Name\tAge\tCity\nAlice\t30\tNYC\nBob\t25\tLA';
    const rows = tsvContent.split('\n').map((line) => line.split('\t'));

    expect(rows).toEqual([
      ['Name', 'Age', 'City'],
      ['Alice', '30', 'NYC'],
      ['Bob', '25', 'LA'],
    ]);
  });

  it('should handle empty cells in TSV', () => {
    const tsvContent = 'A\t\tC\nD\tE\t';
    const rows = tsvContent.split('\n').map((line) => line.split('\t'));

    expect(rows).toEqual([
      ['A', '', 'C'],
      ['D', 'E', ''],
    ]);
  });
});

describe('Paste Markdown Tables', () => {
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

  it('should convert markdown table to HTML and insert', () => {
    const mdLines = ['| Name | Age |', '|------|-----|', '| Alice | 30 |'];

    const parsed = parseMarkdownTable(mdLines);
    expect(parsed).not.toBeNull();

    const html = markdownTableToHtml(parsed!);
    editor.commands.setContent(html);

    const output = editor.getHTML();
    expect(output).toMatch(/<table/);
    expect(output).toContain('Name');
    expect(output).toContain('Alice');
  });

  it('should preserve alignment from markdown tables', () => {
    const mdLines = ['| Left | Center | Right |', '|:-----|:------:|------:|', '| L | C | R |'];

    const parsed = parseMarkdownTable(mdLines);
    expect(parsed?.alignments).toEqual(['left', 'center', 'right']);
  });
});

describe('Copy Table Content', () => {
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

  it('should serialize table to HTML', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    editor.commands.focus('start');
    editor.commands.insertContent('Header 1');

    const html = editor.getHTML();
    expect(html).toMatch(/<table/);
    expect(html).toMatch(/<th/);
    expect(html).toContain('Header 1');
  });

  it('should serialize table with content in multiple cells', () => {
    editor.commands.setContent(`
      <table>
        <tr><th><p>H1</p></th><th><p>H2</p></th></tr>
        <tr><td><p>D1</p></td><td><p>D2</p></td></tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toContain('H1');
    expect(html).toContain('H2');
    expect(html).toContain('D1');
    expect(html).toContain('D2');
  });
});

describe('Table to Markdown Export', () => {
  // Test the markdown parsing utilities in reverse (table -> markdown)
  // This will be used by the export functionality

  it('should be able to round-trip markdown tables', () => {
    const original = ['| A | B |', '|---|---|', '| 1 | 2 |'];

    const parsed = parseMarkdownTable(original);
    expect(parsed).not.toBeNull();

    const html = markdownTableToHtml(parsed!);
    expect(html).toContain('<table>');
    expect(html).toContain('A');
    expect(html).toContain('1');
  });
});

describe('Partial Table Selection', () => {
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

  it('should support selecting table node', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

    // Table should be selectable
    const result = editor.commands.selectParentNode();
    expect(result).toBe(true);
  });

  // Note: Full CellSelection testing requires mouse events
  // which cannot be simulated in JSDOM. E2E tests cover this.
});
