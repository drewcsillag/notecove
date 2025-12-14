/**
 * CommentMark Extension Tests
 *
 * Tests for the TipTap comment mark extension.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CommentMark } from '../CommentMark';

describe('CommentMark Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit.configure({ history: false }), CommentMark],
      content: '<p>Hello World</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('should register the commentMark extension', () => {
    const markTypes = editor.extensionManager.extensions.filter(
      (ext) => ext.type === 'mark' && ext.name === 'commentMark'
    );
    expect(markTypes.length).toBe(1);
  });

  it('should set a comment mark on selection', () => {
    // Select "World"
    editor.commands.setTextSelection({ from: 7, to: 12 });

    // Apply comment mark
    editor.commands.setCommentMark('thread-123');

    // Check that the mark was applied (check position 8, inside the marked text)
    const marks = editor.state.doc.resolve(8).marks();
    const commentMark = marks.find((m) => m.type.name === 'commentMark');

    expect(commentMark).toBeDefined();
    expect(commentMark?.attrs['threadId']).toBe('thread-123');
  });

  it('should toggle a comment mark', () => {
    // Select "World"
    editor.commands.setTextSelection({ from: 7, to: 12 });

    // Apply comment mark
    editor.commands.toggleCommentMark('thread-456');

    // Check that the mark was applied
    let marks = editor.state.doc.resolve(8).marks();
    let commentMark = marks.find((m) => m.type.name === 'commentMark');
    expect(commentMark).toBeDefined();

    // Toggle again to remove
    editor.commands.setTextSelection({ from: 7, to: 12 });
    editor.commands.toggleCommentMark('thread-456');

    marks = editor.state.doc.resolve(8).marks();
    commentMark = marks.find((m) => m.type.name === 'commentMark');
    expect(commentMark).toBeUndefined();
  });

  it('should unset a comment mark', () => {
    // Select "World"
    editor.commands.setTextSelection({ from: 7, to: 12 });

    // Apply comment mark
    editor.commands.setCommentMark('thread-789');

    // Verify it was applied
    let marks = editor.state.doc.resolve(8).marks();
    expect(marks.find((m) => m.type.name === 'commentMark')).toBeDefined();

    // Unset the mark
    editor.commands.setTextSelection({ from: 7, to: 12 });
    editor.commands.unsetCommentMark('thread-789');

    // Check that the mark was removed
    marks = editor.state.doc.resolve(8).marks();
    expect(marks.find((m) => m.type.name === 'commentMark')).toBeUndefined();
  });

  it('should remove comment mark by thread ID from entire document', () => {
    // Set content with multiple words
    editor.commands.setContent('<p>Hello World Test</p>');

    // Apply comment mark to "Hello"
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.commands.setCommentMark('thread-abc');

    // Apply same comment mark to "Test"
    editor.commands.setTextSelection({ from: 13, to: 17 });
    editor.commands.setCommentMark('thread-abc');

    // Verify marks were applied
    let marks = editor.state.doc.resolve(2).marks();
    expect(marks.find((m) => m.type.name === 'commentMark')).toBeDefined();
    marks = editor.state.doc.resolve(14).marks();
    expect(marks.find((m) => m.type.name === 'commentMark')).toBeDefined();

    // Remove all marks with thread ID
    editor.commands.removeCommentMarkById('thread-abc');

    // Check that marks were removed from both locations
    marks = editor.state.doc.resolve(2).marks();
    expect(marks.find((m) => m.type.name === 'commentMark')).toBeUndefined();
    marks = editor.state.doc.resolve(14).marks();
    expect(marks.find((m) => m.type.name === 'commentMark')).toBeUndefined();
  });

  it('should render with correct HTML attributes', () => {
    // Select "World"
    editor.commands.setTextSelection({ from: 7, to: 12 });
    editor.commands.setCommentMark('thread-html');

    // Get HTML output
    const html = editor.getHTML();

    expect(html).toContain('data-comment-mark');
    expect(html).toContain('data-thread-id="thread-html"');
    expect(html).toContain('class="comment-highlight"');
  });

  it('should parse HTML with comment marks', () => {
    const htmlContent =
      '<p>Hello <span data-comment-mark data-thread-id="parsed-thread">World</span></p>';

    editor.commands.setContent(htmlContent);

    // Check that the mark was parsed correctly
    const marks = editor.state.doc.resolve(8).marks();
    const commentMark = marks.find((m) => m.type.name === 'commentMark');

    expect(commentMark).toBeDefined();
    expect(commentMark?.attrs['threadId']).toBe('parsed-thread');
  });
});
