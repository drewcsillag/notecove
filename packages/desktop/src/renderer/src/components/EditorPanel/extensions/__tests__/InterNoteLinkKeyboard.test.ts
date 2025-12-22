/**
 * Tests for InterNoteLink keyboard handling
 *
 * Tests the two-stage Backspace/Delete behavior for inter-note links:
 * - First press: Select the link
 * - Second press: Delete it (handled by default ProseMirror behavior)
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from '@tiptap/pm/state';
import { InterNoteLink, findLinkEndingAt, findLinkStartingAt } from '../InterNoteLink';

// Sample UUID for testing - matches the LINK_PATTERN format
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';

describe('InterNoteLink Keyboard Handling', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        InterNoteLink.configure({
          // Minimal config - we don't need click handlers for these tests
          suggestion: {
            items: async () => [],
          },
        }),
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  /**
   * Helper to set content and position cursor at a specific position
   */
  function setContentAndCursor(html: string, cursorPos: number) {
    editor.commands.setContent(html);
    editor.commands.setTextSelection(cursorPos);
  }

  /**
   * Helper to set a range selection
   */
  function setRangeSelection(from: number, to: number) {
    const { state } = editor;
    const tr = state.tr.setSelection(TextSelection.create(state.doc, from, to));
    editor.view.dispatch(tr);
  }

  /**
   * Helper to get current selection range
   */
  function getSelection() {
    const { from, to } = editor.state.selection;
    return { from, to, empty: from === to };
  }

  /**
   * Helper to simulate Backspace key via TipTap's keyboard shortcut mechanism
   */
  function pressBackspace() {
    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
    editor.view.dom.dispatchEvent(event);
  }

  /**
   * Helper to simulate Delete key
   */
  function pressDelete() {
    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    editor.view.dom.dispatchEvent(event);
  }

  describe('Helper function: findLinkEndingAt', () => {
    it('should find a link ending at the given position', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}bar</p>`, 1);

      const result = findLinkEndingAt(editor.state.doc, 4 + linkText.length);

      expect(result).not.toBeNull();
      expect(result!.from).toBe(4);
      expect(result!.to).toBe(4 + linkText.length);
    });

    it('should return null when no link ends at position', () => {
      setContentAndCursor('<p>foobar</p>', 4);

      const result = findLinkEndingAt(editor.state.doc, 4);

      expect(result).toBeNull();
    });

    it('should find link at start of paragraph', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>${linkText}bar</p>`, 1);

      const result = findLinkEndingAt(editor.state.doc, 1 + linkText.length);

      expect(result).not.toBeNull();
      expect(result!.from).toBe(1);
    });
  });

  describe('Helper function: findLinkStartingAt', () => {
    it('should find a link starting at the given position', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}bar</p>`, 1);

      const result = findLinkStartingAt(editor.state.doc, 4);

      expect(result).not.toBeNull();
      expect(result!.from).toBe(4);
      expect(result!.to).toBe(4 + linkText.length);
    });

    it('should return null when no link starts at position', () => {
      setContentAndCursor('<p>foobar</p>', 4);

      const result = findLinkStartingAt(editor.state.doc, 4);

      expect(result).toBeNull();
    });
  });

  describe('Backspace behavior', () => {
    it('should select the link when cursor is immediately after ]]', () => {
      const linkText = `[[${TEST_UUID}]]`;
      const cursorPos = 4 + linkText.length; // after ]]
      setContentAndCursor(`<p>foo${linkText}bar</p>`, cursorPos);

      // Verify initial cursor position
      expect(getSelection().empty).toBe(true);
      expect(getSelection().from).toBe(cursorPos);

      pressBackspace();

      // Link should now be selected
      const sel = getSelection();
      expect(sel.empty).toBe(false);
      expect(sel.from).toBe(4); // start of link
      expect(sel.to).toBe(4 + linkText.length); // end of link
    });

    it('should delete link when pressed twice (link selected then deleted)', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}bar</p>`, 4 + linkText.length);

      // First backspace selects
      pressBackspace();
      expect(getSelection().empty).toBe(false);

      // Second backspace deletes
      pressBackspace();

      // Link should be deleted, content should be "foobar"
      expect(editor.getText()).toBe('foobar');
    });

    it('should not interfere when cursor is not after a link', () => {
      setContentAndCursor('<p>foobar</p>', 4); // after "foo"

      // Verify no link is found at this position
      const linkRange = findLinkEndingAt(editor.state.doc, 4);
      expect(linkRange).toBeNull();

      // Our handler will return false, allowing default behavior
      // (jsdom doesn't actually perform the deletion, so we just verify the handler logic)
    });

    it('should not interfere with range selection deletion', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}bar</p>`, 1);
      setRangeSelection(1, 4); // select "foo"

      pressBackspace();

      // "foo" should be deleted, link and "bar" should remain
      expect(editor.getText()).toBe(`${linkText}bar`);
    });

    it('should only select the immediately preceding link with consecutive links', () => {
      const link1 = `[[${TEST_UUID}]]`;
      const link2 = `[[${TEST_UUID_2}]]`;
      const cursorPos = 1 + link1.length + link2.length; // after link2
      setContentAndCursor(`<p>${link1}${link2}bar</p>`, cursorPos);

      pressBackspace();

      const sel = getSelection();
      // Should only select link2
      expect(sel.from).toBe(1 + link1.length); // start of link2
      expect(sel.to).toBe(cursorPos); // end of link2
    });
  });

  describe('Delete behavior', () => {
    it('should select the link when cursor is immediately before [[', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}bar</p>`, 4); // before [[

      pressDelete();

      // Link should now be selected
      const sel = getSelection();
      expect(sel.empty).toBe(false);
      expect(sel.from).toBe(4);
      expect(sel.to).toBe(4 + linkText.length);
    });

    it('should delete link when pressed twice', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}bar</p>`, 4);

      // First delete selects
      pressDelete();
      expect(getSelection().empty).toBe(false);

      // Second delete deletes
      pressDelete();

      expect(editor.getText()).toBe('foobar');
    });

    it('should not interfere when cursor is not before a link', () => {
      setContentAndCursor('<p>foobar</p>', 3); // after "fo", before "obar"

      // Verify no link is found at this position
      const linkRange = findLinkStartingAt(editor.state.doc, 3);
      expect(linkRange).toBeNull();

      // Our handler will return false, allowing default behavior
      // (jsdom doesn't actually perform the deletion, so we just verify the handler logic)
    });

    it('should not interfere with range selection deletion', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}bar</p>`, 1);
      setRangeSelection(1, 4); // select "foo"

      pressDelete();

      // "foo" should be deleted
      expect(editor.getText()).toBe(`${linkText}bar`);
    });
  });

  describe('Edge cases', () => {
    it('should handle link at start of paragraph (Backspace)', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>${linkText}bar</p>`, 1 + linkText.length);

      pressBackspace();

      const sel = getSelection();
      expect(sel.from).toBe(1);
      expect(sel.to).toBe(1 + linkText.length);
    });

    it('should handle link at start of paragraph (Delete)', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>${linkText}bar</p>`, 1);

      pressDelete();

      const sel = getSelection();
      expect(sel.from).toBe(1);
      expect(sel.to).toBe(1 + linkText.length);
    });

    it('should handle link at end of paragraph', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}</p>`, 4 + linkText.length);

      pressBackspace();

      const sel = getSelection();
      expect(sel.from).toBe(4);
      expect(sel.to).toBe(4 + linkText.length);
    });

    it('should handle link as only content in paragraph', () => {
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>${linkText}</p>`, 1 + linkText.length);

      pressBackspace();

      const sel = getSelection();
      expect(sel.from).toBe(1);
      expect(sel.to).toBe(1 + linkText.length);
    });
  });
});
