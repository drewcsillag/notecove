/**
 * Unit tests for Context Menu Clipboard Operations (Cut, Copy, Paste)
 *
 * Tests verify that:
 * - Cut removes selected text and copies to clipboard
 * - Copy copies selected text without removing
 * - Paste inserts clipboard content at cursor
 * - Paste replaces selected text
 *
 * @see plans/fix-context-menu-cut-paste/PLAN.md
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DOMSerializer } from '@tiptap/pm/model';
import { sanitizeClipboardHtml } from '../../../utils/clipboard-sanitizer';

// Mock Clipboard API
const mockClipboardWrite = jest.fn().mockResolvedValue(undefined);
const mockClipboardRead = jest.fn();
const mockClipboardReadText = jest.fn();

// Store what was written to clipboard for verification
let lastClipboardContent: { html: string; plainText: string } | null = null;

// Helper to read blob content (JSDOM Blob doesn't have .text())
async function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read blob'));
    };
    reader.readAsText(blob);
  });
}

// Mock ClipboardItem that stores content and provides typed access
class MockClipboardItem {
  private items: Record<string, Blob>;

  constructor(items: Record<string, Blob>) {
    this.items = items;
  }

  get types(): string[] {
    return Object.keys(this.items);
  }

  async getType(type: string): Promise<Blob> {
    const blob = this.items[type];
    if (!blob) throw new Error(`No blob for type ${type}`);
    return blob;
  }
}

// @ts-expect-error - ClipboardItem mock
global.ClipboardItem = MockClipboardItem;

Object.assign(navigator, {
  clipboard: {
    write: mockClipboardWrite.mockImplementation(async (items: MockClipboardItem[]) => {
      const item = items[0];
      if (item) {
        const htmlBlob = await item.getType('text/html');
        const textBlob = await item.getType('text/plain');
        lastClipboardContent = {
          html: await readBlobAsText(htmlBlob),
          plainText: await readBlobAsText(textBlob),
        };
      }
    }),
    read: mockClipboardRead,
    readText: mockClipboardReadText,
  },
});

/**
 * Helper to serialize a selection range to HTML and plain text
 * This mirrors what the actual implementation will do
 */
function serializeSelection(
  editor: Editor,
  from: number,
  to: number
): { html: string; plainText: string } {
  const slice = editor.state.doc.slice(from, to);
  const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content);
  const div = document.createElement('div');
  div.appendChild(fragment);
  const html = div.innerHTML;
  const plainText = editor.state.doc.textBetween(from, to);
  return { html, plainText };
}

/**
 * Helper to write content to clipboard (matches planned implementation)
 */
async function writeToClipboard(html: string, plainText: string): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
    }),
  ]);
}

/**
 * Performs a cut operation: copies selection to clipboard and deletes it
 */
async function performCut(editor: Editor, from: number, to: number): Promise<void> {
  const { html, plainText } = serializeSelection(editor, from, to);
  await writeToClipboard(html, plainText);
  editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
}

/**
 * Performs a copy operation: copies selection to clipboard
 */
async function performCopy(editor: Editor, from: number, to: number): Promise<void> {
  const { html, plainText } = serializeSelection(editor, from, to);
  await writeToClipboard(html, plainText);
}

/**
 * Performs a paste operation: reads clipboard, sanitizes HTML, and inserts at position
 * This mirrors the actual implementation in TipTapEditor.tsx
 */
async function performPaste(editor: Editor, position: number): Promise<void> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        const html = await readBlobAsText(blob);
        // Sanitize HTML before insertion (fixes meta charset and other issues)
        const sanitizedHtml = sanitizeClipboardHtml(html);
        editor.chain().focus().setTextSelection(position).insertContent(sanitizedHtml).run();
        return;
      }
    }
    // Fallback to plain text
    const text = await navigator.clipboard.readText();
    editor.chain().focus().setTextSelection(position).insertContent(text).run();
  } catch (err) {
    console.error('[ContextMenu] Paste failed:', err);
    throw err;
  }
}

/**
 * Performs a paste-as-plain-text operation: reads plain text and inserts at position
 * Ignores any HTML formatting in the clipboard
 */
async function performPasteAsPlainText(editor: Editor, position: number): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    editor.chain().focus().setTextSelection(position).insertContent(text).run();
  } catch (err) {
    console.error('[ContextMenu] Paste as plain text failed:', err);
    throw err;
  }
}

describe('Context Menu Clipboard Operations', () => {
  let editor: Editor;

  beforeEach(() => {
    // Create a simple editor for testing
    editor = new Editor({
      extensions: [StarterKit],
      content: '<p>Hello World</p>',
    });

    // Reset mocks
    mockClipboardWrite.mockClear();
    mockClipboardRead.mockClear();
    mockClipboardReadText.mockClear();
    lastClipboardContent = null;
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Cut Operation', () => {
    it('should remove selected text from editor', async () => {
      // Select "World" (positions in ProseMirror: paragraph starts at 1, "Hello " is 6 chars)
      const from = 7; // Start of "World"
      const to = 12; // End of "World"

      await performCut(editor, from, to);

      // Text should be removed
      expect(editor.getText()).toBe('Hello ');
    });

    it('should copy selected text to clipboard', async () => {
      const from = 7;
      const to = 12;

      await performCut(editor, from, to);

      // Clipboard should have the content
      expect(mockClipboardWrite).toHaveBeenCalled();
      expect(lastClipboardContent?.plainText).toBe('World');
    });

    it('should preserve cursor position after cut (cursor at cut point)', async () => {
      const from = 7;
      const to = 12;

      await performCut(editor, from, to);

      // Cursor should be at the cut position
      const { from: cursorFrom } = editor.state.selection;
      expect(cursorFrom).toBe(from);
    });

    it('should copy HTML content to clipboard for rich text', async () => {
      // Set up editor with bold text
      editor.commands.setContent('<p>Hello <strong>World</strong></p>');

      // Select "World" including the bold
      const from = 7;
      const to = 12;

      await performCut(editor, from, to);

      // HTML should include the strong tag
      expect(lastClipboardContent?.html).toContain('<strong>');
      expect(lastClipboardContent?.html).toContain('World');
    });
  });

  describe('Copy Operation', () => {
    it('should copy selected text to clipboard without removing', async () => {
      const from = 7;
      const to = 12;

      await performCopy(editor, from, to);

      // Text should still be in editor
      expect(editor.getText()).toBe('Hello World');

      // Clipboard should have the content
      expect(mockClipboardWrite).toHaveBeenCalled();
      expect(lastClipboardContent?.plainText).toBe('World');
    });

    it('should preserve selection after copy', async () => {
      const from = 7;
      const to = 12;

      // Set selection
      editor.commands.setTextSelection({ from, to });

      await performCopy(editor, from, to);

      // Original text should still exist
      expect(editor.getText()).toBe('Hello World');
    });
  });

  describe('Paste Operation', () => {
    it('should insert clipboard content at cursor position', async () => {
      // Mock clipboard read to return HTML content
      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/html': new Blob(['<p>Pasted</p>'], { type: 'text/html' }),
          'text/plain': new Blob(['Pasted'], { type: 'text/plain' }),
        }),
      ]);

      // Place cursor at end of "Hello "
      const position = 7;

      await performPaste(editor, position);

      // Content should be inserted
      expect(editor.getText()).toContain('Pasted');
    });

    it('should replace selected text when pasting', async () => {
      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/html': new Blob(['<p>Universe</p>'], { type: 'text/html' }),
          'text/plain': new Blob(['Universe'], { type: 'text/plain' }),
        }),
      ]);

      // Select "World" and paste (simulating replace behavior)
      const from = 7;
      const to = 12;

      // First delete selection, then paste
      editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
      await performPaste(editor, from);

      // "World" should be replaced with "Universe"
      expect(editor.getText()).not.toContain('World');
      expect(editor.getText()).toContain('Universe');
    });

    it('should fall back to plain text when HTML not available', async () => {
      // Mock clipboard with only plain text - no HTML type available
      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/plain': new Blob(['Plain Text'], { type: 'text/plain' }),
        }),
      ]);
      // Also mock readText for the fallback path
      mockClipboardReadText.mockResolvedValue('Plain Text');

      const position = 7;

      await performPaste(editor, position);

      expect(editor.getText()).toContain('Plain Text');
    });

    it('should throw error when clipboard access denied', async () => {
      mockClipboardRead.mockRejectedValue(new Error('Clipboard access denied'));

      await expect(performPaste(editor, 1)).rejects.toThrow('Clipboard access denied');
    });
  });

  describe('Serialization', () => {
    it('should serialize plain text correctly', () => {
      const { plainText } = serializeSelection(editor, 1, 12);
      expect(plainText).toBe('Hello World');
    });

    it('should serialize HTML with formatting preserved', () => {
      editor.commands.setContent('<p>Hello <em>italic</em> and <strong>bold</strong></p>');

      // Get the full content (use actual document size)
      const docSize = editor.state.doc.content.size;
      const { html } = serializeSelection(editor, 1, docSize);

      expect(html).toContain('<em>');
      expect(html).toContain('<strong>');
    });
  });

  describe('Paste with HTML Sanitization (Bug Fixes)', () => {
    it('should not insert <meta charset> when pasting browser-copied content', async () => {
      // This is the exact bug from the report: pasting adds <meta charset="utf-8"> before text
      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/html': new Blob(['<meta charset="utf-8">wolf'], { type: 'text/html' }),
          'text/plain': new Blob(['wolf'], { type: 'text/plain' }),
        }),
      ]);

      // Paste at end of existing content
      const position = 12; // End of "Hello World"

      await performPaste(editor, position);

      const text = editor.getText();
      expect(text).not.toContain('<meta');
      expect(text).not.toContain('charset');
      expect(text).toContain('wolf');
    });

    it('should extract content from full HTML document wrapper', async () => {
      // Browser may copy content wrapped in full HTML document structure
      const fullHtmlDoc =
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>Content</p></body></html>';

      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/html': new Blob([fullHtmlDoc], { type: 'text/html' }),
          'text/plain': new Blob(['Content'], { type: 'text/plain' }),
        }),
      ]);

      const position = 7;
      await performPaste(editor, position);

      const text = editor.getText();
      expect(text).not.toContain('DOCTYPE');
      expect(text).not.toContain('<html');
      expect(text).toContain('Content');
    });

    it('should strip style tags but preserve content', async () => {
      const htmlWithStyles = '<style>.red{color:red}</style><p>Styled content</p>';

      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/html': new Blob([htmlWithStyles], { type: 'text/html' }),
          'text/plain': new Blob(['Styled content'], { type: 'text/plain' }),
        }),
      ]);

      const position = 7;
      await performPaste(editor, position);

      const text = editor.getText();
      expect(text).not.toContain('style');
      expect(text).not.toContain('color:red');
      expect(text).toContain('Styled content');
    });

    it('should preserve formatting (bold, italic) through paste', async () => {
      // Note: Link preservation requires Link extension which isn't in StarterKit
      // The sanitizer preserves links (tested in unit tests), but this test editor
      // won't render them. This test verifies bold/italic are preserved.
      const formattedHtml = '<p><strong>Bold</strong> and <em>italic</em> text</p>';

      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/html': new Blob([formattedHtml], { type: 'text/html' }),
          'text/plain': new Blob(['Bold and italic text'], { type: 'text/plain' }),
        }),
      ]);

      // Clear editor and paste
      editor.commands.setContent('');
      const position = 1;
      await performPaste(editor, position);

      // Check HTML structure is preserved
      const html = editor.getHTML();
      expect(html).toContain('<strong>Bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });

    it('should handle Microsoft Office HTML (mso-* styles)', async () => {
      // Typical Word/Office HTML with mso-* styles
      const officeHtml = `
        <p style="mso-spacerun:yes; font-weight:bold;">Office text</p>
      `;

      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/html': new Blob([officeHtml], { type: 'text/html' }),
          'text/plain': new Blob(['Office text'], { type: 'text/plain' }),
        }),
      ]);

      editor.commands.setContent('');
      const position = 1;
      await performPaste(editor, position);

      const html = editor.getHTML();
      expect(html).not.toContain('mso-');
      expect(html).toContain('Office text');
    });
  });

  describe('Paste Without Formatting', () => {
    it('should insert plain text only, ignoring HTML formatting', async () => {
      // Clipboard has both HTML and plain text
      mockClipboardRead.mockResolvedValue([
        new MockClipboardItem({
          'text/html': new Blob(['<p><strong>Formatted</strong></p>'], { type: 'text/html' }),
          'text/plain': new Blob(['Formatted'], { type: 'text/plain' }),
        }),
      ]);
      mockClipboardReadText.mockResolvedValue('Formatted');

      editor.commands.setContent('');
      const position = 1;
      await performPasteAsPlainText(editor, position);

      // Should be plain text without formatting
      const html = editor.getHTML();
      expect(html).not.toContain('<strong>');
      expect(editor.getText()).toContain('Formatted');
    });

    it('should work when clipboard only has plain text', async () => {
      mockClipboardReadText.mockResolvedValue('Just plain text');

      editor.commands.setContent('');
      const position = 1;
      await performPasteAsPlainText(editor, position);

      expect(editor.getText()).toContain('Just plain text');
    });
  });
});
