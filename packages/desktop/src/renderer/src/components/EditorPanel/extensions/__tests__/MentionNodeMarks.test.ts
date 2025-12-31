/**
 * MentionNode Marks Tests
 *
 * Tests that MentionNode (atomic inline node) can accept text marks
 * (bold, italic, underline, strikethrough).
 *
 * Key behavior: MentionNode is an atomic node that should accept marks.
 * Marks wrap around the entire node. The node remains atomic (can't place cursor inside).
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MentionNode } from '../MentionNode';

/**
 * Helper to check if a mark wraps the mention node
 */
function mentionHasMark(editor: Editor, markName: string): boolean {
  let found = false;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'mentionNode') {
      // Check if the position before the node has the mark
      // For atomic nodes, marks are stored on the node itself
      const $pos = editor.state.doc.resolve(pos);
      const marks = $pos.marksAcross($pos);
      if (marks?.some((m) => m.type.name === markName)) {
        found = true;
        return false;
      }
      // Also check the node's stored marks (if applicable)
      if (node.marks.some((m) => m.type.name === markName)) {
        found = true;
        return false;
      }
    }
    return true;
  });
  return found;
}

/**
 * Helper to find mention node position
 */
function findMentionPosition(editor: Editor): { from: number; to: number } | null {
  let result: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'mentionNode') {
      result = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return true;
  });
  return result;
}

describe('MentionNode with marks', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit.configure({ undoRedo: false }), MentionNode.configure({})],
      content: '<p>Hello world</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('mark acceptance', () => {
    it('should accept bold mark', () => {
      // Insert a mention node
      editor.commands.insertMention({
        profileId: 'user-123',
        handle: '@alice',
        displayName: 'Alice Smith',
      });

      // Find the mention and apply bold
      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      // Select the mention node (use NodeSelection for atomic nodes)
      editor.commands.setTextSelection(mentionPos!.from);
      editor.commands.setNodeSelection(mentionPos!.from);

      // Apply bold - for atomic nodes, we need to wrap with the mark
      editor.chain().focus().toggleBold().run();

      // Verify the mention node has the bold mark
      expect(mentionHasMark(editor, 'bold')).toBe(true);
    });

    it('should accept italic mark', () => {
      editor.commands.insertMention({
        profileId: 'user-123',
        handle: '@alice',
        displayName: 'Alice Smith',
      });

      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleItalic().run();

      expect(mentionHasMark(editor, 'italic')).toBe(true);
    });

    it('should accept strike mark', () => {
      editor.commands.insertMention({
        profileId: 'user-123',
        handle: '@alice',
        displayName: 'Alice Smith',
      });

      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleStrike().run();

      expect(mentionHasMark(editor, 'strike')).toBe(true);
    });

    it('should accept multiple marks', () => {
      editor.commands.insertMention({
        profileId: 'user-123',
        handle: '@alice',
        displayName: 'Alice Smith',
      });

      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleBold().toggleItalic().run();

      expect(mentionHasMark(editor, 'bold')).toBe(true);
      expect(mentionHasMark(editor, 'italic')).toBe(true);
    });
  });

  describe('mark toggling', () => {
    it('should toggle bold mark off', () => {
      editor.commands.insertMention({
        profileId: 'user-123',
        handle: '@alice',
        displayName: 'Alice Smith',
      });

      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      // Apply bold
      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleBold().run();
      expect(mentionHasMark(editor, 'bold')).toBe(true);

      // Toggle off
      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleBold().run();
      expect(mentionHasMark(editor, 'bold')).toBe(false);
    });
  });

  describe('mark persistence', () => {
    it('should preserve marks when getting HTML', () => {
      editor.commands.insertMention({
        profileId: 'user-123',
        handle: '@alice',
        displayName: 'Alice Smith',
      });

      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleBold().run();

      // Get HTML and verify the mention is wrapped in bold
      const html = editor.getHTML();
      // The structure should be <strong><span data-mention-node>...</span></strong>
      // or marks should be preserved on the node
      expect(html).toContain('<strong>');
      expect(html).toContain('data-mention-node');
      // Bold should wrap the mention span
      expect(html).toMatch(/<strong>.*data-mention-node.*<\/strong>/s);
    });
  });

  describe('marks on mentions in different contexts', () => {
    it('should work with bold mention in a list item', () => {
      // Create a list first
      editor.commands.setContent('<ul><li><p>Assigned to </p></li></ul>');

      // Move cursor to end of list item and insert mention
      editor.commands.focus('end');
      editor.commands.insertMention({
        profileId: 'user-123',
        handle: '@alice',
        displayName: 'Alice Smith',
      });

      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleBold().run();

      expect(mentionHasMark(editor, 'bold')).toBe(true);
    });

    it('should work with italic mention in a heading', () => {
      editor.commands.setContent('<h2>Contact </h2>');
      editor.commands.focus('end');
      editor.commands.insertMention({
        profileId: 'user-456',
        handle: '@bob',
        displayName: 'Bob Jones',
      });

      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleItalic().run();

      expect(mentionHasMark(editor, 'italic')).toBe(true);
    });

    it('should work with bold+italic mention', () => {
      editor.commands.insertMention({
        profileId: 'user-789',
        handle: '@charlie',
        displayName: 'Charlie Brown',
      });

      const mentionPos = findMentionPosition(editor);
      expect(mentionPos).not.toBeNull();

      editor.commands.setNodeSelection(mentionPos!.from);
      editor.chain().focus().toggleBold().toggleItalic().run();

      expect(mentionHasMark(editor, 'bold')).toBe(true);
      expect(mentionHasMark(editor, 'italic')).toBe(true);

      // Verify HTML has both marks
      const html = editor.getHTML();
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
    });
  });
});
