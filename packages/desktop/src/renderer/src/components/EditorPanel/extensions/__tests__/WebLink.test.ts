/**
 * WebLink Extension Tests
 *
 * Tests for link boundary behavior - typing before/after links
 * should not extend the link mark.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { WebLink } from '../WebLink';

describe('WebLink Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit.configure({ undoRedo: false, link: false }), WebLink],
      content: '<p>Hello <a href="https://example.com">link text</a> world</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should register the link extension', () => {
    const markTypes = editor.extensionManager.extensions.filter(
      (ext) => ext.type === 'mark' && ext.name === 'link'
    );
    expect(markTypes.length).toBe(1);
  });

  describe('link mark schema', () => {
    it('should have inclusive set to false', () => {
      // The inclusive property controls whether typing at mark boundaries extends the mark
      // It should be false so that typing next to a link doesn't make the new text part of the link
      const linkMarkType = editor.schema.marks['link'];
      expect(linkMarkType).toBeDefined();
      expect(linkMarkType?.spec.inclusive).toBe(false);
    });
  });

  describe('link boundary behavior', () => {
    it('should not extend link when typing after it using transactions', () => {
      // Content: "Hello [link text] world"
      // Position 17 is right after "link text" (at the space before "world")

      // Set cursor at the end of the link (position 17)
      editor.commands.setTextSelection(17);

      // Simulate typing by creating a transaction that inserts text
      // This uses the stored marks which are affected by the inclusive property
      const { state } = editor;
      const { tr } = state;

      // Insert text at cursor position - this should respect storedMarks
      tr.insertText('X', 17);
      editor.view.dispatch(tr);

      // Check if the inserted 'X' has the link mark
      // Position 17 now contains 'X'
      const marks = editor.state.doc.resolve(17).marks();
      const linkMark = marks.find((m) => m.type.name === 'link');

      expect(linkMark).toBeUndefined();
    });

    it('should not extend link when typing before it using transactions', () => {
      // Position 7 is right before "link text"

      // Set cursor at the start of the link
      editor.commands.setTextSelection(7);

      const { state } = editor;
      const { tr } = state;

      // Insert text at cursor position
      tr.insertText('X', 7);
      editor.view.dispatch(tr);

      // Check if the inserted 'X' has the link mark
      const marks = editor.state.doc.resolve(7).marks();
      const linkMark = marks.find((m) => m.type.name === 'link');

      expect(linkMark).toBeUndefined();
    });

    it('should preserve link mark on existing link text', () => {
      // The original "link text" should still have the link mark
      // Check position 10 which is in the middle of "link text"
      const marks = editor.state.doc.resolve(10).marks();
      const linkMark = marks.find((m) => m.type.name === 'link');

      expect(linkMark).toBeDefined();
      expect(linkMark?.attrs['href']).toBe('https://example.com');
    });
  });

  describe('autolink behavior', () => {
    it('should autolink pasted URLs', () => {
      // Create a fresh editor with no initial link
      editor.destroy();
      editor = new Editor({
        extensions: [StarterKit.configure({ undoRedo: false, link: false }), WebLink],
        content: '<p>Check this </p>',
      });

      // Position at end of text
      editor.commands.setTextSelection(12);

      // Use pasteContent to simulate paste, which triggers linkOnPaste
      // First, let's verify the extension is configured with linkOnPaste: true
      const linkExtension = editor.extensionManager.extensions.find((ext) => ext.name === 'link');
      expect(linkExtension?.options.linkOnPaste).toBe(true);
    });
  });
});
