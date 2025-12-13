/**
 * Tests for Markdown table parsing and conversion
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 3
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
  parseMarkdownTableRow,
  isMarkdownTableSeparator,
  parseMarkdownAlignment,
} from '../Table';

describe('Markdown Table Conversion', () => {
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

  describe('parseMarkdownTable', () => {
    it('should parse simple two-column table', () => {
      const result = parseMarkdownTable(['| col1 | col2 |', '|---|---|']);
      expect(result).toEqual({
        headers: ['col1', 'col2'],
        alignments: ['left', 'left'],
        rows: [],
      });
    });

    it('should parse table with data rows', () => {
      const result = parseMarkdownTable([
        '| Name | Age |',
        '|------|-----|',
        '| Alice | 30 |',
        '| Bob | 25 |',
      ]);
      expect(result).toEqual({
        headers: ['Name', 'Age'],
        alignments: ['left', 'left'],
        rows: [
          ['Alice', '30'],
          ['Bob', '25'],
        ],
      });
    });

    it('should parse table with alignments', () => {
      const result = parseMarkdownTable(['| Left | Center | Right |', '|:---|:---:|---:|']);
      expect(result).toEqual({
        headers: ['Left', 'Center', 'Right'],
        alignments: ['left', 'center', 'right'],
        rows: [],
      });
    });

    it('should return null for invalid table (no separator)', () => {
      const result = parseMarkdownTable(['| col1 | col2 |', '| data1 | data2 |']);
      expect(result).toBe(null);
    });

    it('should return null for single line', () => {
      const result = parseMarkdownTable(['| col1 | col2 |']);
      expect(result).toBe(null);
    });
  });

  describe('markdownTableToHtml', () => {
    it('should convert parsed table to HTML', () => {
      const parsed = parseMarkdownTable(['| A | B |', '|---|---|', '| 1 | 2 |']);
      const html = markdownTableToHtml(parsed!);

      expect(html).toContain('<table>');
      expect(html).toContain('<th>');
      expect(html).toContain('<td>');
      expect(html).toContain('A');
      expect(html).toContain('B');
      expect(html).toContain('1');
      expect(html).toContain('2');
    });

    it('should handle empty data rows', () => {
      const parsed = parseMarkdownTable(['| Header |', '|---|']);
      const html = markdownTableToHtml(parsed!);

      expect(html).toContain('<table>');
      expect(html).toContain('<th>');
      expect(html).toContain('Header');
    });
  });

  describe('HTML table insertion', () => {
    it('should insert converted markdown table HTML', () => {
      const parsed = parseMarkdownTable(['| Col1 | Col2 |', '|---|---|', '| Data1 | Data2 |']);
      const html = markdownTableToHtml(parsed!);

      editor.commands.setContent(html);

      const output = editor.getHTML();
      expect(output).toMatch(/<table/);
      expect(output).toContain('Col1');
      expect(output).toContain('Data1');
    });
  });
});

describe('Markdown Table Parsing Utilities', () => {
  it('should parse pipe-separated row', () => {
    const result = parseMarkdownTableRow('| col1 | col2 | col3 |');
    expect(result).toEqual(['col1', 'col2', 'col3']);
  });

  it('should handle extra whitespace', () => {
    const result = parseMarkdownTableRow('|  foo  |  bar  |');
    expect(result).toEqual(['foo', 'bar']);
  });

  it('should return null for non-table row', () => {
    const result = parseMarkdownTableRow('not a table row');
    expect(result).toBe(null);
  });

  it('should detect separator row', () => {
    expect(isMarkdownTableSeparator('|---|---|')).toBe(true);
    expect(isMarkdownTableSeparator('|:---|---:|')).toBe(true);
    expect(isMarkdownTableSeparator('| --- | --- |')).toBe(true);
    expect(isMarkdownTableSeparator('| col1 | col2 |')).toBe(false);
  });

  it('should parse alignment from separator', () => {
    expect(parseMarkdownAlignment(':---')).toBe('left');
    expect(parseMarkdownAlignment(':---:')).toBe('center');
    expect(parseMarkdownAlignment('---:')).toBe('right');
    expect(parseMarkdownAlignment('---')).toBe('left'); // default
  });
});
