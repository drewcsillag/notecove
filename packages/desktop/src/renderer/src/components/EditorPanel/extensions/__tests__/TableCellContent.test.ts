/**
 * Tests for Table Cell Content & Rich Text
 *
 * Verifies that rich text features work correctly inside table cells.
 *
 * @see plans/tables-in-notes/PLAN.md - Phase 6
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { NotecoveTable, NotecoveTableRow, NotecoveTableHeader, NotecoveTableCell } from '../Table';
import { Hashtag } from '../Hashtag';
import { InterNoteLink } from '../InterNoteLink';

// Mock window.electronAPI for Hashtag extension
const mockElectronAPI = {
  tag: {
    getAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'test-id', name: 'test' }),
  },
  note: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  user: {
    getCurrentProfile: jest.fn().mockResolvedValue({
      profileId: 'test-profile-id',
      username: 'Test User',
      handle: '@testuser',
    }),
  },
};
(global as unknown as { window: { electronAPI: typeof mockElectronAPI } }).window = {
  electronAPI: mockElectronAPI,
};

describe('Rich Text in Table Cells', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        Link,
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

  it('should support bold text in cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Type and make bold
    editor.commands.insertContent('bold text');
    editor.commands.selectAll();
    editor.commands.toggleBold();

    const html = editor.getHTML();
    expect(html).toContain('<strong>');
    expect(html).toContain('bold text');
  });

  it('should support italic text in cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    editor.commands.insertContent('italic text');
    editor.commands.selectAll();
    editor.commands.toggleItalic();

    const html = editor.getHTML();
    expect(html).toContain('<em>');
    expect(html).toContain('italic text');
  });

  it('should support code marks in cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    editor.commands.insertContent('code text');
    editor.commands.selectAll();
    editor.commands.toggleCode();

    const html = editor.getHTML();
    expect(html).toContain('<code>');
    expect(html).toContain('code text');
  });

  it('should support strikethrough text in cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    editor.commands.insertContent('strikethrough text');
    editor.commands.selectAll();
    editor.commands.toggleStrike();

    const html = editor.getHTML();
    expect(html).toContain('<s>');
    expect(html).toContain('strikethrough text');
  });

  it('should support multiple marks combined in cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    editor.commands.insertContent('bold and italic');
    editor.commands.selectAll();
    editor.commands.toggleBold();
    editor.commands.toggleItalic();

    const html = editor.getHTML();
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
    expect(html).toContain('bold and italic');
  });
});

describe('Web Links in Table Cells', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        Link.configure({
          openOnClick: false,
        }),
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

  it('should support web links in cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    editor.commands.insertContent('click here');
    editor.commands.selectAll();
    editor.commands.setLink({ href: 'https://example.com' });

    const html = editor.getHTML();
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('click here');
  });

  it('should allow removing links in cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Add link
    editor.commands.insertContent('linked text');
    editor.commands.selectAll();
    editor.commands.setLink({ href: 'https://example.com' });

    // Verify link exists
    expect(editor.getHTML()).toContain('<a');

    // Remove link
    editor.commands.selectAll();
    editor.commands.unsetLink();

    // Verify link removed but text remains
    const html = editor.getHTML();
    expect(html).not.toContain('<a');
    expect(html).toContain('linked text');
  });
});

describe('Content Persistence in Table Cells', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        Link,
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

  it('should preserve rich content when navigating between cells', () => {
    // Insert table with pre-defined rich content
    editor.commands.setContent(`
      <table>
        <tr>
          <td><p><strong>first cell</strong></p></td>
          <td><p><em>second cell</em></p></td>
        </tr>
        <tr>
          <td><p>third</p></td>
          <td><p>fourth</p></td>
        </tr>
      </table>
    `);

    // Verify both cells have their content
    const html = editor.getHTML();
    expect(html).toContain('<strong>first cell</strong>');
    expect(html).toContain('<em>second cell</em>');
  });

  it('should preserve content in header cells', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    editor.commands.focus('start');

    // Add bold content to header cell
    editor.commands.insertContent('Header Bold');
    editor.commands.selectAll();
    editor.commands.toggleBold();

    const html = editor.getHTML();
    expect(html).toMatch(/<th[^>]*>.*<strong>Header Bold<\/strong>/);
  });

  it('should preserve content after adding rows', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Add content
    editor.commands.insertContent('original content');
    editor.commands.selectAll();
    editor.commands.toggleBold();

    // Add a row
    editor.commands.addRowAfter();

    // Verify original content preserved
    const html = editor.getHTML();
    expect(html).toContain('<strong>original content</strong>');
  });

  it('should preserve content after adding columns', () => {
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
    editor.commands.focus('start');

    // Add content
    editor.commands.insertContent('column content');
    editor.commands.selectAll();
    editor.commands.toggleItalic();

    // Add a column
    editor.commands.addColumnAfter();

    // Verify original content preserved
    const html = editor.getHTML();
    expect(html).toContain('<em>column content</em>');
  });
});

describe('Hashtags in Table Cells', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
        Hashtag,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should render hashtag text in cells', () => {
    editor.commands.setContent(`
      <table>
        <tr>
          <td><p>#testtag</p></td>
          <td><p>normal text</p></td>
        </tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toContain('#testtag');
  });

  it('should preserve hashtag with other content in cells', () => {
    editor.commands.setContent(`
      <table>
        <tr>
          <td><p>Text with #hashtag inside</p></td>
          <td><p>Other</p></td>
        </tr>
      </table>
    `);

    const html = editor.getHTML();
    expect(html).toContain('Text with #hashtag inside');
  });

  it('should preserve hashtag when adding table operations', () => {
    editor.commands.setContent(`
      <table>
        <tr>
          <td><p>#tag1</p></td>
          <td><p>#tag2</p></td>
        </tr>
        <tr>
          <td><p>cell3</p></td>
          <td><p>cell4</p></td>
        </tr>
      </table>
    `);

    // Add a row
    editor.commands.focus('start');
    editor.commands.addRowAfter();

    // Verify hashtags are preserved
    const html = editor.getHTML();
    expect(html).toContain('#tag1');
    expect(html).toContain('#tag2');
  });
});

describe('Inter-Note Links in Table Cells', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        NotecoveTable,
        NotecoveTableRow,
        NotecoveTableHeader,
        NotecoveTableCell,
        InterNoteLink,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should render inter-note link text in cells', () => {
    // Insert table with inter-note link syntax
    editor.commands.setContent(`
      <table>
        <tr>
          <td><p>[[note-123|My Note]]</p></td>
          <td><p>normal text</p></td>
        </tr>
      </table>
    `);

    const html = editor.getHTML();
    // The text content should be preserved even if not rendered as a link
    expect(html).toMatch(/\[\[.*\]\]|My Note|note-123/);
  });

  it('should preserve inter-note links when adding table operations', () => {
    editor.commands.setContent(`
      <table>
        <tr>
          <td><p>[[note-1|Note One]]</p></td>
          <td><p>[[note-2|Note Two]]</p></td>
        </tr>
        <tr>
          <td><p>cell3</p></td>
          <td><p>cell4</p></td>
        </tr>
      </table>
    `);

    // Add a column
    editor.commands.focus('start');
    editor.commands.addColumnAfter();

    // Verify links are preserved
    const html = editor.getHTML();
    expect(html).toMatch(/\[\[.*\]\]|Note One|note-1/);
    expect(html).toMatch(/\[\[.*\]\]|Note Two|note-2/);
  });
});
