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
 * Performs a paste operation: reads clipboard and inserts at position
 */
async function performPaste(editor: Editor, position: number): Promise<void> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        const html = await readBlobAsText(blob);
        editor.chain().focus().setTextSelection(position).insertContent(html).run();
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
});
