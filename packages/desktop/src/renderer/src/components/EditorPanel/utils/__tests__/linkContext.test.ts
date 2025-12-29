/**
 * Link Context Detection Tests
 *
 * Tests for detecting the block context of web links
 * and determining appropriate display modes.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { WebLink } from '../../extensions/WebLink';
import {
  detectLinkContext,
  getDefaultDisplayMode,
  countLinksInParagraph,
  getEffectiveDisplayMode,
} from '../linkContext';

// Mock the global preference to return 'chip' by default for predictable tests
jest.mock('../../../../contexts/LinkDisplayPreferenceContext', () => ({
  getCurrentLinkDisplayPreference: jest.fn(() => 'chip'),
}));

describe('linkContext', () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
  });

  function createEditor(content: string): Editor {
    return new Editor({
      extensions: [StarterKit.configure({ link: false }), WebLink],
      content,
    });
  }

  describe('detectLinkContext', () => {
    it('should detect link in heading', () => {
      editor = createEditor('<h1>Hello <a href="https://example.com">link</a></h1>');

      // Position 7 is inside "Hello " (after the opening <h1>)
      // Actually, let's find the link position more carefully
      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const context = detectLinkContext(editor.state, linkPos);
      expect(context).toBe('heading');
    });

    it('should detect link in bullet list', () => {
      editor = createEditor(
        '<ul><li><p>Item with <a href="https://example.com">link</a></p></li></ul>'
      );

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const context = detectLinkContext(editor.state, linkPos);
      expect(context).toBe('list');
    });

    it('should detect link in ordered list', () => {
      editor = createEditor(
        '<ol><li><p>Item with <a href="https://example.com">link</a></p></li></ol>'
      );

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const context = detectLinkContext(editor.state, linkPos);
      expect(context).toBe('list');
    });

    it('should detect link in blockquote', () => {
      editor = createEditor(
        '<blockquote><p>Quote with <a href="https://example.com">link</a></p></blockquote>'
      );

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const context = detectLinkContext(editor.state, linkPos);
      expect(context).toBe('blockquote');
    });

    it('should detect link in standalone paragraph', () => {
      editor = createEditor('<p>Paragraph with <a href="https://example.com">link</a></p>');

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const context = detectLinkContext(editor.state, linkPos);
      expect(context).toBe('paragraph');
    });

    it('should detect link in code block as code', () => {
      editor = createEditor('<pre><code>Code with https://example.com</code></pre>');

      // Code blocks don't have links as marks, but let's test position detection
      // Position 1 is inside the code block
      const context = detectLinkContext(editor.state, 1);
      expect(context).toBe('code');
    });
  });

  describe('getDefaultDisplayMode', () => {
    it('should return chip for heading', () => {
      expect(getDefaultDisplayMode('heading')).toBe('chip');
    });

    it('should return chip for list', () => {
      expect(getDefaultDisplayMode('list')).toBe('chip');
    });

    it('should return chip for blockquote', () => {
      expect(getDefaultDisplayMode('blockquote')).toBe('chip');
    });

    it('should return chip for table', () => {
      expect(getDefaultDisplayMode('table')).toBe('chip');
    });

    it('should return chip for paragraph with chip preference (mocked)', () => {
      // With 'chip' preference mocked, paragraph should return 'chip'
      expect(getDefaultDisplayMode('paragraph')).toBe('chip');
    });

    it('should return unfurl for paragraph with explicit unfurl preference', () => {
      expect(getDefaultDisplayMode('paragraph', 'unfurl')).toBe('unfurl');
    });

    it('should return chip for paragraph with explicit chip preference', () => {
      expect(getDefaultDisplayMode('paragraph', 'chip')).toBe('chip');
    });

    it('should return link for paragraph with explicit none preference', () => {
      expect(getDefaultDisplayMode('paragraph', 'none')).toBe('link');
    });

    it('should return link for code', () => {
      expect(getDefaultDisplayMode('code')).toBe('link');
    });

    it('should return chip for other', () => {
      expect(getDefaultDisplayMode('other')).toBe('chip');
    });
  });

  describe('countLinksInParagraph', () => {
    it('should count single link', () => {
      editor = createEditor('<p>Text with <a href="https://example.com">one link</a></p>');

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const count = countLinksInParagraph(editor.state, linkPos);
      expect(count).toBe(1);
    });

    it('should count multiple links', () => {
      editor = createEditor(
        '<p>Text with <a href="https://example.com">first</a> and <a href="https://example2.com">second</a> links</p>'
      );

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const count = countLinksInParagraph(editor.state, linkPos);
      expect(count).toBe(2);
    });

    it('should return 0 for position not in paragraph', () => {
      editor = createEditor('<h1>Heading</h1>');

      // Position 1 is in heading, not paragraph
      const count = countLinksInParagraph(editor.state, 1);
      expect(count).toBe(0);
    });
  });

  describe('getEffectiveDisplayMode', () => {
    it('should respect explicit chip preference', () => {
      editor = createEditor('<p>Text with <a href="https://example.com">link</a></p>');

      const mode = getEffectiveDisplayMode(editor.state, 1, 'chip');
      expect(mode).toBe('chip');
    });

    it('should respect explicit unfurl preference in paragraph', () => {
      editor = createEditor('<p><a href="https://example.com">link</a></p>');

      // Unfurl in paragraph should work
      const mode = getEffectiveDisplayMode(editor.state, 1, 'unfurl');
      expect(mode).toBe('unfurl');
    });

    it('should fall back to chip for explicit unfurl in non-paragraph context', () => {
      editor = createEditor('<h1><a href="https://example.com">link</a></h1>');

      // Unfurl in heading should fall back to chip (unfurls only work in paragraphs)
      const mode = getEffectiveDisplayMode(editor.state, 1, 'unfurl');
      expect(mode).toBe('chip');
    });

    it('should respect explicit link preference', () => {
      editor = createEditor('<p>Text with <a href="https://example.com">link</a></p>');

      const mode = getEffectiveDisplayMode(editor.state, 1, 'link');
      expect(mode).toBe('link');
    });

    it('should use chip for multiple links in paragraph with auto mode', () => {
      editor = createEditor(
        '<p>Text with <a href="https://example.com">first</a> and <a href="https://example2.com">second</a></p>'
      );

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      // With auto mode and multiple links, should use chip
      const mode = getEffectiveDisplayMode(editor.state, linkPos, 'auto');
      expect(mode).toBe('chip');
    });

    it('should use chip for single link in paragraph with auto mode', () => {
      editor = createEditor('<p>Text with <a href="https://example.com">link</a></p>');

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const mode = getEffectiveDisplayMode(editor.state, linkPos, 'auto');
      expect(mode).toBe('chip');
    });

    it('should use chip for link in heading with auto mode', () => {
      editor = createEditor('<h1>Heading with <a href="https://example.com">link</a></h1>');

      const doc = editor.state.doc;
      let linkPos = 0;
      doc.descendants((node, pos) => {
        if (node.marks.some((m) => m.type.name === 'link')) {
          linkPos = pos;
          return false;
        }
        return true;
      });

      const mode = getEffectiveDisplayMode(editor.state, linkPos, 'auto');
      expect(mode).toBe('chip');
    });

    it('should use link (no decoration) for code block with auto mode', () => {
      editor = createEditor('<pre><code>Code block</code></pre>');

      // Position inside code block
      const mode = getEffectiveDisplayMode(editor.state, 1, 'auto');
      expect(mode).toBe('link');
    });
  });
});
