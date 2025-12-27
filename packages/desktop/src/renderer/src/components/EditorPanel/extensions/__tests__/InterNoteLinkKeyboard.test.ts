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

  /**
   * Helper to simulate Shift+Left arrow
   */
  function pressShiftLeft() {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
      bubbles: true,
    });
    editor.view.dom.dispatchEvent(event);
  }

  /**
   * Helper to simulate Left arrow (no modifiers)
   */
  function pressLeft() {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
    });
    editor.view.dom.dispatchEvent(event);
  }

  /**
   * Helper to simulate Right arrow (no modifiers)
   */
  function pressRight() {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    });
    editor.view.dom.dispatchEvent(event);
  }

  /**
   * Helper to simulate Shift+Cmd+Left arrow (Mac: select to beginning of line)
   * Note: In jsdom, we use ctrlKey since jsdom doesn't recognize itself as Mac.
   * TipTap's `Mod` maps to Ctrl in non-Mac environments.
   */
  function pressShiftCmdLeft() {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
      ctrlKey: true, // Mod maps to Ctrl in jsdom (non-Mac)
      bubbles: true,
    });
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

  describe('Shift+Left selection behavior', () => {
    it('should extend selection to include entire link when cursor is after link', () => {
      // Content: "foo [[uuid]] bar" with cursor after the link: "foo [[uuid]]|bar"
      const linkText = `[[${TEST_UUID}]]`;
      const cursorPos = 4 + linkText.length; // position after ]]
      setContentAndCursor(`<p>foo${linkText}bar</p>`, cursorPos);

      // Verify initial cursor position
      expect(getSelection().empty).toBe(true);
      expect(getSelection().from).toBe(cursorPos);

      // Press Shift+Left - should select the entire link atomically
      pressShiftLeft();

      const sel = getSelection();
      // Selection should span the entire link
      expect(sel.from).toBe(4); // start of link
      expect(sel.to).toBe(cursorPos); // original cursor position
    });

    it('should extend selection through link when head is at link boundary', () => {
      // Content: "foo [[uuid]]bar" with cursor after "bar", having already selected back to link end
      // This simulates: user at end of "bar", presses Shift+Left twice to select "ar",
      // then the next Shift+Left should jump to include the entire link
      const linkText = `[[${TEST_UUID}]]`;
      const linkEnd = 4 + linkText.length;
      // Create a backward selection: anchor at end of "bar", head at end of link
      // This is like having selected "bar" by pressing Shift+Left three times
      setContentAndCursor(`<p>foo${linkText}bar</p>`, linkEnd + 3); // cursor after "bar"
      // Anchor stays at linkEnd+3 (end of "bar"), head moves to linkEnd (end of link)
      const { state } = editor;
      const tr = state.tr.setSelection(TextSelection.create(state.doc, linkEnd + 3, linkEnd));
      editor.view.dispatch(tr);

      // Now head is at linkEnd (end of link), pressing Shift+Left should select through the link
      pressShiftLeft();

      const sel = getSelection();
      // Selection should now include the link (head moved to start of link)
      expect(sel.from).toBe(4); // start of link (new head position)
      expect(sel.to).toBe(linkEnd + 3); // end of "bar" (anchor stayed)
    });

    it('should not interfere when no link precedes cursor', () => {
      setContentAndCursor('<p>foobar</p>', 4); // after "foo"

      const initialPos = getSelection().from;

      // Press Shift+Left - default behavior should apply
      pressShiftLeft();

      // In jsdom, default selection behavior may not work fully,
      // but our handler should return false to allow it
      // Just verify we didn't crash or incorrectly select something
      const sel = getSelection();
      expect(sel.to).toBe(initialPos); // selection head/anchor should be at original or moved left
    });

    it('should select only the immediately preceding link when multiple links exist', () => {
      const link1 = `[[${TEST_UUID}]]`;
      const link2 = `[[${TEST_UUID_2}]]`;
      const link2End = 1 + link1.length + link2.length;
      setContentAndCursor(`<p>${link1}${link2}bar</p>`, link2End);

      pressShiftLeft();

      const sel = getSelection();
      // Should only select link2, not link1
      expect(sel.from).toBe(1 + link1.length); // start of link2
      expect(sel.to).toBe(link2End);
    });
  });

  describe('Shift+Cmd+Left selection behavior (select to beginning of line)', () => {
    it('should include entire link when selecting to beginning of line', () => {
      // Content: "foo [[uuid]]| bar" - cursor immediately after link
      const linkText = `[[${TEST_UUID}]]`;
      const cursorPos = 4 + linkText.length; // after ]]
      setContentAndCursor(`<p>foo${linkText} bar</p>`, cursorPos);

      // Press Shift+Cmd+Left - should select to beginning of line, including link
      pressShiftCmdLeft();

      const sel = getSelection();
      // Selection should start at beginning of paragraph content (pos 1)
      expect(sel.from).toBe(1);
      expect(sel.to).toBe(cursorPos);
    });

    it('should include link when selecting from end of line through link', () => {
      // Content: "foo [[uuid]] bar|" - cursor at end
      const linkText = `[[${TEST_UUID}]]`;
      const endPos = 4 + linkText.length + 4; // "foo" + link + " bar"
      setContentAndCursor(`<p>foo${linkText} bar</p>`, endPos);

      pressShiftCmdLeft();

      const sel = getSelection();
      // Should select entire line content
      expect(sel.from).toBe(1);
      expect(sel.to).toBe(endPos);
    });

    it('should handle multiple links in line', () => {
      const link1 = `[[${TEST_UUID}]]`;
      const link2 = `[[${TEST_UUID_2}]]`;
      // Content: "foo [[uuid1]] bar [[uuid2]]|"
      const endPos = 4 + link1.length + 5 + link2.length; // "foo" + link1 + " bar " + link2
      setContentAndCursor(`<p>foo${link1} bar ${link2}</p>`, endPos);

      pressShiftCmdLeft();

      const sel = getSelection();
      // Should select entire line including both links
      expect(sel.from).toBe(1);
      expect(sel.to).toBe(endPos);
    });

    it('should handle link at start of line', () => {
      // Content: "[[uuid]]| bar" - link at start, cursor after link
      const linkText = `[[${TEST_UUID}]]`;
      const cursorPos = 1 + linkText.length;
      setContentAndCursor(`<p>${linkText} bar</p>`, cursorPos);

      pressShiftCmdLeft();

      const sel = getSelection();
      // Should select from start of line (including link) to cursor
      expect(sel.from).toBe(1);
      expect(sel.to).toBe(cursorPos);
    });
  });

  describe('Arrow key navigation (skip over links)', () => {
    it('should skip over link when pressing Left arrow after link', () => {
      // Content: "foo[[uuid]]bar" with cursor after the link: "foo[[uuid]]|bar"
      const linkText = `[[${TEST_UUID}]]`;
      const cursorPos = 4 + linkText.length; // position after ]]
      setContentAndCursor(`<p>foo${linkText}bar</p>`, cursorPos);

      // Verify initial cursor position
      expect(getSelection().from).toBe(cursorPos);

      // Press Left - should skip over the link to position 4 (before [[)
      pressLeft();

      expect(getSelection().from).toBe(4); // before the link
    });

    it('should skip over link when pressing Right arrow before link', () => {
      // Content: "foo[[uuid]]bar" with cursor before the link: "foo|[[uuid]]bar"
      const linkText = `[[${TEST_UUID}]]`;
      setContentAndCursor(`<p>foo${linkText}bar</p>`, 4); // before [[

      // Verify initial cursor position
      expect(getSelection().from).toBe(4);

      // Press Right - should skip over the link to position after ]]
      pressRight();

      expect(getSelection().from).toBe(4 + linkText.length); // after the link
    });

    it('should not interfere when not adjacent to a link (Left)', () => {
      setContentAndCursor('<p>foobar</p>', 4); // after "foo"

      const initialPos = getSelection().from;

      // Press Left - default behavior should apply (move one char left)
      pressLeft();

      // Our handler returns false, default behavior moves cursor
      // In jsdom this may not actually move, but we verify our handler didn't interfere
      const sel = getSelection();
      // The position should either be 3 (if default worked) or 4 (if jsdom didn't move it)
      expect(sel.from).toBeLessThanOrEqual(initialPos);
    });

    it('should not interfere when not adjacent to a link (Right)', () => {
      setContentAndCursor('<p>foobar</p>', 3); // after "fo"

      const initialPos = getSelection().from;

      // Press Right - default behavior should apply
      pressRight();

      // Our handler returns false, allowing default behavior
      const sel = getSelection();
      expect(sel.from).toBeGreaterThanOrEqual(initialPos);
    });

    it('should handle consecutive links with Left arrow', () => {
      const link1 = `[[${TEST_UUID}]]`;
      const link2 = `[[${TEST_UUID_2}]]`;
      // Position after link2: "[[uuid1]][[uuid2]]|bar"
      const cursorPos = 1 + link1.length + link2.length;
      setContentAndCursor(`<p>${link1}${link2}bar</p>`, cursorPos);

      // First Left - skip over link2
      pressLeft();
      expect(getSelection().from).toBe(1 + link1.length); // between links

      // Second Left - skip over link1
      pressLeft();
      expect(getSelection().from).toBe(1); // before link1
    });

    it('should handle consecutive links with Right arrow', () => {
      const link1 = `[[${TEST_UUID}]]`;
      const link2 = `[[${TEST_UUID_2}]]`;
      // Position before link1: "|[[uuid1]][[uuid2]]bar"
      setContentAndCursor(`<p>${link1}${link2}bar</p>`, 1);

      // First Right - skip over link1
      pressRight();
      expect(getSelection().from).toBe(1 + link1.length); // between links

      // Second Right - skip over link2
      pressRight();
      expect(getSelection().from).toBe(1 + link1.length + link2.length); // after link2
    });
  });
});
