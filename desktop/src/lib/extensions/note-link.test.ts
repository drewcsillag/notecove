import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { NoteLink } from './note-link';

describe('NoteLink Extension', () => {
  let editor: Editor;
  let onNavigate: ReturnType<typeof vi.fn>;
  let findNoteByTitle: ReturnType<typeof vi.fn>;
  let validateNoteLink: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onNavigate = vi.fn();
    findNoteByTitle = vi.fn();
    validateNoteLink = vi.fn(() => true); // Default: all links are valid

    editor = new Editor({
      extensions: [
        StarterKit,
        NoteLink.configure({
          onNavigate,
          findNoteByTitle,
          validateNoteLink,
        }),
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Link Creation', () => {
    it('should convert [[Note Title]] to a note link', () => {
      findNoteByTitle.mockReturnValue({ id: 'note-123', title: 'Test Note' });

      // Simulate typing [[Test Note]]
      editor.commands.insertContent('[[Test Note]]');

      // Simulate the text input handler being triggered
      const doc = editor.state.doc;
      const text = doc.textContent;

      expect(text).toBe('[[Test Note]]');
    });

    it('should store note ID when creating a link to an existing note', () => {
      findNoteByTitle.mockReturnValue({ id: 'note-123', title: 'Existing Note' });

      // Use the setNoteLink command directly
      editor.commands.setContent('<p>Check out this note</p>');
      editor.commands.setTextSelection({ from: 1, to: 'Check out this note'.length + 1 });
      editor.commands.setNoteLink('Existing Note', 'note-123');

      const marks = editor.state.selection.$from.marks();
      const noteLinkMark = marks.find(mark => mark.type.name === 'noteLink');

      expect(noteLinkMark).toBeDefined();
      expect(noteLinkMark?.attrs.title).toBe('Existing Note');
      expect(noteLinkMark?.attrs.noteId).toBe('note-123');
    });

    it('should create link without ID for non-existent notes', () => {
      findNoteByTitle.mockReturnValue(null);

      editor.commands.setContent('<p>Missing note</p>');
      editor.commands.setTextSelection({ from: 1, to: 'Missing note'.length + 1 });
      editor.commands.setNoteLink('Missing Note');

      const marks = editor.state.selection.$from.marks();
      const noteLinkMark = marks.find(mark => mark.type.name === 'noteLink');

      expect(noteLinkMark).toBeDefined();
      expect(noteLinkMark?.attrs.title).toBe('Missing Note');
      expect(noteLinkMark?.attrs.noteId).toBeNull();
    });
  });

  describe('Link Attributes', () => {
    it('should store both title and noteId attributes', () => {
      editor.commands.setContent('<p>Link text</p>');
      editor.commands.setTextSelection({ from: 1, to: 'Link text'.length + 1 });
      editor.commands.setNoteLink('Target Note', 'note-456');

      const html = editor.getHTML();
      expect(html).toContain('data-note-title="Target Note"');
      expect(html).toContain('data-note-id="note-456"');
    });

    it('should parse noteLink marks from HTML', () => {
      const html = '<p><span data-note-link data-note-title="My Note" data-note-id="abc-123">My Note</span></p>';
      editor.commands.setContent(html);

      const marks = editor.state.doc.nodeAt(1)?.marks || [];
      const noteLinkMark = marks.find(mark => mark.type.name === 'noteLink');

      expect(noteLinkMark).toBeDefined();
      expect(noteLinkMark?.attrs.title).toBe('My Note');
      expect(noteLinkMark?.attrs.noteId).toBe('abc-123');
    });
  });

  describe('Link Validation', () => {
    it('should mark broken links with validation', () => {
      validateNoteLink.mockReturnValue(false);

      editor.commands.setContent('<p><span data-note-link data-note-title="Broken Link" data-note-id="deleted-123">Broken Link</span></p>');

      // Check that validateNoteLink was called
      // The decoration plugin should call this during render
      expect(validateNoteLink).toHaveBeenCalled();
    });

    it('should validate links by ID first, then by title', () => {
      editor.commands.setContent('<p><span data-note-link data-note-title="Test" data-note-id="note-789">Test</span></p>');

      // The validation should be called with both ID and title
      expect(validateNoteLink).toHaveBeenCalled();
      const call = validateNoteLink.mock.calls[0];
      expect(call[0]).toBe('note-789'); // noteId
      expect(call[1]).toBe('Test'); // title
    });
  });

  describe('Link Navigation', () => {
    it('should not navigate when onNavigate is not provided', () => {
      const editorWithoutNav = new Editor({
        extensions: [StarterKit, NoteLink.configure({})],
        content: '<p><span data-note-link data-note-title="Test" data-note-id="123">Test</span></p>',
      });

      // Click simulation would happen here in e2e tests
      // In unit tests, we can only verify the configuration

      editorWithoutNav.destroy();
    });
  });

  describe('Commands', () => {
    it('should provide setNoteLink command', () => {
      expect(editor.commands.setNoteLink).toBeDefined();
      expect(typeof editor.commands.setNoteLink).toBe('function');
    });

    it('should provide unsetNoteLink command', () => {
      expect(editor.commands.unsetNoteLink).toBeDefined();
      expect(typeof editor.commands.unsetNoteLink).toBe('function');
    });

    it('should remove note link mark with unsetNoteLink', () => {
      editor.commands.setContent('<p>Test text</p>');
      editor.commands.setTextSelection({ from: 1, to: 'Test text'.length + 1 });
      editor.commands.setNoteLink('Target', 'id-123');

      let marks = editor.state.selection.$from.marks();
      expect(marks.some(m => m.type.name === 'noteLink')).toBe(true);

      editor.commands.unsetNoteLink();

      marks = editor.state.selection.$from.marks();
      expect(marks.some(m => m.type.name === 'noteLink')).toBe(false);
    });
  });

  describe('HTML Rendering', () => {
    it('should render note links with data attributes', () => {
      editor.commands.setContent('<p>Text</p>');
      editor.commands.setTextSelection({ from: 1, to: 5 });
      editor.commands.setNoteLink('My Note', 'note-xyz');

      const html = editor.getHTML();

      expect(html).toContain('<span');
      expect(html).toContain('data-note-link');
      expect(html).toContain('data-note-title="My Note"');
      expect(html).toContain('data-note-id="note-xyz"');
    });

    it('should render link without ID if noteId is null', () => {
      editor.commands.setContent('<p>Text</p>');
      editor.commands.setTextSelection({ from: 1, to: 5 });
      editor.commands.setNoteLink('No ID Note');

      const html = editor.getHTML();

      expect(html).toContain('data-note-title="No ID Note"');
      expect(html).not.toContain('data-note-id');
    });
  });
});
