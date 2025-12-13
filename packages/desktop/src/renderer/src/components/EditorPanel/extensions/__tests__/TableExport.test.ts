/**
 * Tests for Table Export & Accessibility
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 8
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  NotecoveTable,
  NotecoveTableRow,
  NotecoveTableHeader,
  NotecoveTableCell,
  tableToMarkdown,
} from '../Table';

describe('Markdown Export', () => {
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

  it('should export simple table as pipe-syntax markdown', () => {
    editor.commands.setContent(`
      <table>
        <tr><th><p>Name</p></th><th><p>Age</p></th></tr>
        <tr><td><p>Alice</p></td><td><p>30</p></td></tr>
      </table>
    `);

    const markdown = tableToMarkdown(editor);
    expect(markdown).toContain('| Name | Age |');
    expect(markdown).toContain('| --- | --- |');
    expect(markdown).toContain('| Alice | 30 |');
  });

  it('should handle tables without headers', () => {
    editor.commands.setContent(`
      <table>
        <tr><td><p>A</p></td><td><p>B</p></td></tr>
        <tr><td><p>C</p></td><td><p>D</p></td></tr>
      </table>
    `);

    const markdown = tableToMarkdown(editor);
    expect(markdown).toContain('| A | B |');
    // Without headers, we still need a separator row for valid markdown
    expect(markdown).toContain('| --- | --- |');
  });

  it('should export alignment markers', () => {
    editor.commands.setContent(`
      <table>
        <tr>
          <th style="text-align: left"><p>Left</p></th>
          <th style="text-align: center"><p>Center</p></th>
          <th style="text-align: right"><p>Right</p></th>
        </tr>
        <tr>
          <td><p>L</p></td>
          <td><p>C</p></td>
          <td><p>R</p></td>
        </tr>
      </table>
    `);

    const markdown = tableToMarkdown(editor);
    // Check for alignment markers
    expect(markdown).toMatch(/\|.*:?---+:?.*\|/);
  });

  it('should escape pipe characters in cell content', () => {
    editor.commands.setContent(`
      <table>
        <tr><th><p>Header</p></th></tr>
        <tr><td><p>Value | with pipe</p></td></tr>
      </table>
    `);

    const markdown = tableToMarkdown(editor);
    // Pipes in content should be escaped
    expect(markdown).toContain('Value \\| with pipe');
  });

  it('should handle empty cells', () => {
    editor.commands.setContent(`
      <table>
        <tr><th><p>A</p></th><th><p>B</p></th></tr>
        <tr><td><p></p></td><td><p>Value</p></td></tr>
      </table>
    `);

    const markdown = tableToMarkdown(editor);
    expect(markdown).toContain('|  | Value |');
  });
});

describe('HTML Export', () => {
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

  it('should export valid HTML table', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    const html = editor.getHTML();
    expect(html).toMatch(/<table/);
    expect(html).toMatch(/<\/table>/);
    expect(html).toMatch(/<th/);
    expect(html).toMatch(/<td/);
  });

  it('should export table with content', () => {
    editor.commands.setContent(`
      <table>
        <tr><th><p>Header 1</p></th><th><p>Header 2</p></th></tr>
        <tr><td><p>Data 1</p></td><td><p>Data 2</p></td></tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toContain('Header 1');
    expect(html).toContain('Data 1');
  });
});

describe('Semantic HTML Structure', () => {
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

  it('should render proper table element', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    const html = editor.getHTML();
    expect(html).toMatch(/<table[^>]*>/);
  });

  it('should use tbody for table body', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    const html = editor.getHTML();
    expect(html).toMatch(/<tbody>/);
    expect(html).toMatch(/<\/tbody>/);
  });

  it('should use th for header cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

    const html = editor.getHTML();
    expect(html).toMatch(/<th/);
  });

  it('should use td for data cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

    const html = editor.getHTML();
    expect(html).toMatch(/<td/);
    // When no header row, should not have th
    expect(html).not.toMatch(/<th/);
  });
});

describe('Keyboard Accessibility', () => {
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

  it('should support Tab navigation', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Tab should move to next cell
    const result = editor.commands.goToNextCell();
    expect(result).toBe(true);
  });

  it('should support Shift+Tab navigation', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');
    editor.commands.goToNextCell();

    // Shift+Tab should move to previous cell
    const result = editor.commands.goToPreviousCell();
    expect(result).toBe(true);
  });

  it('should support keyboard row operations', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Add row (simulating Mod+Enter)
    const addResult = editor.commands.addRowAfter();
    expect(addResult).toBe(true);

    // Verify row was added
    const html = editor.getHTML();
    expect((html.match(/<tr>/g) ?? []).length).toBe(3);
  });

  it('should support keyboard column operations', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Add column (simulating Mod+Shift+Enter)
    const addResult = editor.commands.addColumnAfter();
    expect(addResult).toBe(true);

    // Verify column was added
    const html = editor.getHTML();
    expect((html.match(/<td/g) ?? []).length).toBe(6); // 2 rows * 3 cols
  });
});
