/**
 * Unit tests for InterNoteLink extension
 *
 * Tests the findDoubleBracketMatch function which calculates the range
 * for autocomplete replacement when user types [[.
 *
 * Bug being fixed: "link-eats-space" - the range calculation was incorrect,
 * causing preceding whitespace/newlines to be deleted when inserting a link.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { findDoubleBracketMatch } from '../InterNoteLink';

describe('InterNoteLink - findDoubleBracketMatch', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  /**
   * Helper to set content and position cursor at the end
   */
  function setContentAndGetPosition(html: string) {
    editor.commands.setContent(html);
    // Move cursor to end of document
    editor.commands.focus('end');
    return editor.state.selection.$from;
  }

  describe('range calculation', () => {
    it('should match [[ at the start of a paragraph', () => {
      const $pos = setContentAndGetPosition('<p>[[</p>');

      const match = findDoubleBracketMatch($pos);

      expect(match).not.toBeNull();
      expect(match?.text).toBe('[[');
      expect(match?.query).toBe('');
      // The range should only cover the [[ characters
      expect(match!.range.to - match!.range.from).toBe(2);
    });

    it('should match [[ with query text', () => {
      const $pos = setContentAndGetPosition('<p>[[test</p>');

      const match = findDoubleBracketMatch($pos);

      expect(match).not.toBeNull();
      expect(match?.text).toBe('[[test');
      expect(match?.query).toBe('test');
      // The range should cover [[test (6 characters)
      expect(match!.range.to - match!.range.from).toBe(6);
    });

    it('should preserve space before [[ - range must not include preceding space', () => {
      // This is the "link-eats-space" bug
      // When user types "foo [[", the range should only include "[[", not " [["
      const $pos = setContentAndGetPosition('<p>foo [[</p>');

      const match = findDoubleBracketMatch($pos);

      expect(match).not.toBeNull();
      expect(match?.text).toBe('[[');
      expect(match?.query).toBe('');

      // CRITICAL: Range should be exactly 2 characters (just "[[")
      // If range.from is wrong, it will include the space before [[
      const rangeLength = match!.range.to - match!.range.from;
      expect(rangeLength).toBe(2);

      // Verify by checking the actual text in the range
      const textInRange = editor.state.doc.textBetween(match!.range.from, match!.range.to);
      expect(textInRange).toBe('[[');
    });

    it('should preserve text before [[ when there is a query', () => {
      const $pos = setContentAndGetPosition('<p>foo [[bar</p>');

      const match = findDoubleBracketMatch($pos);

      expect(match).not.toBeNull();
      expect(match?.text).toBe('[[bar');
      expect(match?.query).toBe('bar');

      // Range should be exactly 5 characters ([[bar)
      const rangeLength = match!.range.to - match!.range.from;
      expect(rangeLength).toBe(5);

      // Verify the actual text in range
      const textInRange = editor.state.doc.textBetween(match!.range.from, match!.range.to);
      expect(textInRange).toBe('[[bar');
    });

    it('should work in a paragraph after a heading', () => {
      // This tests the scenario where link ends up in heading
      const $pos = setContentAndGetPosition('<h1>Title</h1><p>[[</p>');

      const match = findDoubleBracketMatch($pos);

      expect(match).not.toBeNull();
      expect(match?.text).toBe('[[');

      // Range should be exactly 2 characters
      const rangeLength = match!.range.to - match!.range.from;
      expect(rangeLength).toBe(2);

      // The range.from should be INSIDE the paragraph, not in the heading
      // Verify by checking that deleting this range doesn't affect the heading
      const textInRange = editor.state.doc.textBetween(match!.range.from, match!.range.to);
      expect(textInRange).toBe('[[');
    });

    it('should not match if no [[ present', () => {
      const $pos = setContentAndGetPosition('<p>hello world</p>');

      const match = findDoubleBracketMatch($pos);

      expect(match).toBeNull();
    });

    it('should not match single [', () => {
      const $pos = setContentAndGetPosition('<p>test [</p>');

      const match = findDoubleBracketMatch($pos);

      expect(match).toBeNull();
    });

    it('should not match completed link [[...]]', () => {
      // Once the link is complete (has closing ]]), autocomplete shouldn't trigger
      const $pos = setContentAndGetPosition('<p>[[test]]</p>');

      const match = findDoubleBracketMatch($pos);

      // The regex /\[\[([^\]]*?)$/ should not match because ]] closes it
      expect(match).toBeNull();
    });
  });

  describe('document structure preservation', () => {
    it('should calculate range that keeps paragraph separate from heading', () => {
      // Set up: heading followed by paragraph with [[
      editor.commands.setContent('<h1>Title</h1><p>[[test</p>');
      editor.commands.focus('end');
      const $pos = editor.state.selection.$from;

      const match = findDoubleBracketMatch($pos);
      expect(match).not.toBeNull();

      // Simulate what the command does: delete range and insert link
      editor
        .chain()
        .focus()
        .deleteRange({ from: match!.range.from, to: match!.range.to })
        .insertContent('[[fake-uuid]]')
        .run();

      // After insertion, we should still have separate heading and paragraph
      const doc = editor.state.doc;

      // Document should have 2 children: heading and paragraph
      expect(doc.childCount).toBe(2);
      expect(doc.child(0).type.name).toBe('heading');
      expect(doc.child(1).type.name).toBe('paragraph');

      // Heading should still just contain "Title"
      expect(doc.child(0).textContent).toBe('Title');

      // Paragraph should contain the link
      expect(doc.child(1).textContent).toBe('[[fake-uuid]]');
    });

    it('should preserve space when inserting link after text', () => {
      // Set up: paragraph with "foo [[test"
      editor.commands.setContent('<p>foo [[test</p>');
      editor.commands.focus('end');
      const $pos = editor.state.selection.$from;

      const match = findDoubleBracketMatch($pos);
      expect(match).not.toBeNull();

      // Simulate link insertion
      editor
        .chain()
        .focus()
        .deleteRange({ from: match!.range.from, to: match!.range.to })
        .insertContent('[[fake-uuid]]')
        .run();

      // The paragraph should now have "foo [[fake-uuid]]" with space preserved
      const paragraphText = editor.state.doc.child(0).textContent;
      expect(paragraphText).toBe('foo [[fake-uuid]]');
    });
  });
});
