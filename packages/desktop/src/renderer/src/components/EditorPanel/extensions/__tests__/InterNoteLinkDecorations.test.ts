/**
 * Tests for InterNoteLink decoration handling
 *
 * Tests that decorations are properly managed during document edits,
 * specifically that widget decorations don't duplicate when typing.
 *
 * Bug: When typing in a note with checkboxes and wikilinks, each keystroke
 * caused the wikilink widget to visually duplicate.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { InterNoteLink, clearNoteTitleCache } from '../InterNoteLink';
import { TriStateTaskItem } from '../TriStateTaskItem';

// Sample UUID for testing - matches the LINK_PATTERN format
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';

// Mock window.electronAPI for InterNoteLink extension
const mockElectronAPI = {
  link: {
    searchNotesForAutocomplete: jest.fn().mockResolvedValue([
      { id: TEST_UUID, title: 'Test Note' },
      { id: TEST_UUID_2, title: 'Another Note' },
    ]),
  },
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!global.window) {
  // @ts-expect-error - mocking global
  global.window = {};
}
// @ts-expect-error - mocking electronAPI
global.window.electronAPI = mockElectronAPI;

describe('InterNoteLink Decoration Management', () => {
  let editor: Editor;

  beforeEach(() => {
    clearNoteTitleCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (editor) {
      editor.destroy();
    }
  });

  /**
   * Helper to count link widget elements in the DOM
   */
  function countLinkWidgets(): number {
    return editor.view.dom.querySelectorAll('.inter-note-link').length;
  }

  /**
   * Helper to type text at the current cursor position
   */
  function typeText(text: string) {
    editor.commands.insertContent(text);
  }

  describe('widget decoration count stability', () => {
    it('should have exactly one widget decoration per link after initial render', async () => {
      editor = new Editor({
        extensions: [
          StarterKit,
          InterNoteLink.configure({
            suggestion: { items: async () => [] },
          }),
        ],
        content: `<p>text [[${TEST_UUID}]]</p>`,
      });

      // Wait for async title fetch
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have exactly 1 widget element
      expect(countLinkWidgets()).toBe(1);
    });

    it('should maintain one widget per link when typing before the link', async () => {
      editor = new Editor({
        extensions: [
          StarterKit,
          InterNoteLink.configure({
            suggestion: { items: async () => [] },
          }),
        ],
        content: `<p>sometext [[${TEST_UUID}]]</p>`,
      });

      // Wait for async title fetch
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Position cursor at start of "sometext" (after paragraph open)
      editor.commands.setTextSelection(1);

      // Verify initial state: 1 widget
      expect(countLinkWidgets()).toBe(1);

      // Type a character
      typeText('a');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should still have exactly 1 widget
      expect(countLinkWidgets()).toBe(1);

      // Type another character
      typeText('b');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should still have exactly 1 widget
      expect(countLinkWidgets()).toBe(1);
    });

    it('should maintain one widget per link when typing in a task item before a link', async () => {
      // This is the exact repro scenario from the bug report:
      // # Repro Note
      // [ ] sometext
      // [ ] [[Repro Note]]
      // [[Repro Note]]
      //
      // Position cursor before "sometext" and type - link on another line duplicates

      editor = new Editor({
        extensions: [
          StarterKit,
          TriStateTaskItem,
          InterNoteLink.configure({
            suggestion: { items: async () => [] },
          }),
        ],
        content: '',
      });

      // Set content with task items and a link (simulating the repro scenario)
      // Using bulletList with taskItem children
      editor.commands.setContent(`
        <ul>
          <li data-type="taskItem" data-checked="unchecked"><p>sometext</p></li>
          <li data-type="taskItem" data-checked="unchecked"><p>[[${TEST_UUID}]]</p></li>
        </ul>
        <p>[[${TEST_UUID}]]</p>
      `);

      // Wait for async title fetch
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have 2 widgets (one for each link)
      expect(countLinkWidgets()).toBe(2);

      // Find position at start of "sometext" - need to navigate into the first task item's paragraph
      // Structure: doc > bulletList > taskItem > paragraph > text
      const doc = editor.state.doc;
      let targetPos = 1;

      // Find the text node containing "sometext"
      doc.descendants((node, pos) => {
        if (node.isText && node.text?.includes('sometext')) {
          targetPos = pos;
          return false;
        }
        return true;
      });

      // Position cursor at start of "sometext"
      editor.commands.setTextSelection(targetPos);

      // Type a character - this is where the bug manifests
      typeText('x');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // BUG: Without fix, this count would be > 2 due to widget duplication
      expect(countLinkWidgets()).toBe(2);

      // Type another character - each keystroke was adding more duplicates
      typeText('y');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should still have exactly 2 widgets
      expect(countLinkWidgets()).toBe(2);
    });

    it('should handle multiple links correctly when typing', async () => {
      editor = new Editor({
        extensions: [
          StarterKit,
          InterNoteLink.configure({
            suggestion: { items: async () => [] },
          }),
        ],
        content: `<p>text [[${TEST_UUID}]] more [[${TEST_UUID_2}]]</p>`,
      });

      // Wait for async title fetch
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify initial state: 2 widgets (one per link)
      expect(countLinkWidgets()).toBe(2);

      // Position cursor at start
      editor.commands.setTextSelection(1);

      // Type multiple characters
      typeText('abc');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should still have exactly 2 widget elements
      expect(countLinkWidgets()).toBe(2);
    });

    it('should handle typing between consecutive links', async () => {
      editor = new Editor({
        extensions: [
          StarterKit,
          InterNoteLink.configure({
            suggestion: { items: async () => [] },
          }),
        ],
        content: `<p>[[${TEST_UUID}]][[${TEST_UUID_2}]]</p>`,
      });

      // Wait for async title fetch
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify initial state
      expect(countLinkWidgets()).toBe(2);

      // Find position between the two links (after first link)
      const linkLength = `[[${TEST_UUID}]]`.length;
      const posAfterFirstLink = 1 + linkLength;
      editor.commands.setTextSelection(posAfterFirstLink);

      // Type a space between them
      typeText(' ');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should still have exactly 2 widgets
      expect(countLinkWidgets()).toBe(2);
    });
  });
});
