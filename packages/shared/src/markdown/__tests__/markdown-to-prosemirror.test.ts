/**
 * Tests for Markdown to ProseMirror JSON conversion
 *
 * This converter parses markdown using the `marked` library's lexer
 * and transforms the tokens into ProseMirror JSON format.
 */

import { markdownToProsemirror } from '../markdown-to-prosemirror';
import type { ProseMirrorNode } from '../prosemirror-to-yjs';

describe('markdownToProsemirror', () => {
  describe('paragraphs', () => {
    it('should convert a single paragraph', () => {
      const markdown = 'Hello, World!';
      const result = markdownToProsemirror(markdown);

      expect(result.type).toBe('doc');
      expect(result.content).toHaveLength(1);
      expect(result.content![0].type).toBe('paragraph');
      expect(result.content![0].content).toHaveLength(1);
      expect(result.content![0].content![0]).toEqual({
        type: 'text',
        text: 'Hello, World!',
      });
    });

    it('should convert multiple paragraphs', () => {
      const markdown = 'First paragraph.\n\nSecond paragraph.';
      const result = markdownToProsemirror(markdown);

      expect(result.content).toHaveLength(2);
      expect(result.content![0].content![0].text).toBe('First paragraph.');
      expect(result.content![1].content![0].text).toBe('Second paragraph.');
    });

    it('should handle empty input', () => {
      const result = markdownToProsemirror('');
      expect(result.type).toBe('doc');
      expect(result.content).toHaveLength(0);
    });
  });

  describe('headings', () => {
    it('should convert h1 heading', () => {
      const markdown = '# Hello';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0]).toEqual({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Hello' }],
      });
    });

    it('should convert h2-h6 headings', () => {
      const markdown = '## Level 2\n\n### Level 3\n\n#### Level 4';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0].attrs!['level']).toBe(2);
      expect(result.content![1].attrs!['level']).toBe(3);
      expect(result.content![2].attrs!['level']).toBe(4);
    });
  });

  describe('text formatting', () => {
    it('should convert bold text', () => {
      const markdown = 'This is **bold** text.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      expect(content).toHaveLength(3);
      expect(content[0]).toEqual({ type: 'text', text: 'This is ' });
      expect(content[1]).toEqual({
        type: 'text',
        text: 'bold',
        marks: [{ type: 'bold' }],
      });
      expect(content[2]).toEqual({ type: 'text', text: ' text.' });
    });

    it('should convert italic text', () => {
      const markdown = 'This is *italic* text.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      expect(content[1]).toEqual({
        type: 'text',
        text: 'italic',
        marks: [{ type: 'italic' }],
      });
    });

    it('should convert inline code', () => {
      const markdown = 'Use `const x = 1` here.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      expect(content[1]).toEqual({
        type: 'text',
        text: 'const x = 1',
        marks: [{ type: 'code' }],
      });
    });

    it('should convert links', () => {
      const markdown = 'Visit [Example](https://example.com) now.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      expect(content[1]).toEqual({
        type: 'text',
        text: 'Example',
        marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
      });
    });

    it('should convert strikethrough', () => {
      const markdown = 'This is ~~deleted~~ text.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      expect(content[1]).toEqual({
        type: 'text',
        text: 'deleted',
        marks: [{ type: 'strike' }],
      });
    });

    it('should handle nested formatting', () => {
      const markdown = 'This is ***bold and italic*** text.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      expect(content[1].marks).toContainEqual({ type: 'bold' });
      expect(content[1].marks).toContainEqual({ type: 'italic' });
    });
  });

  describe('code blocks', () => {
    it('should convert code blocks with language', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0]).toEqual({
        type: 'codeBlock',
        attrs: { language: 'javascript' },
        content: [{ type: 'text', text: 'const x = 1;' }],
      });
    });

    it('should convert code blocks without language', () => {
      const markdown = '```\nplain code\n```';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0].type).toBe('codeBlock');
      expect(result.content![0].attrs!['language']).toBe('');
    });
  });

  describe('lists', () => {
    it('should convert bullet lists', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0].type).toBe('bulletList');
      expect(result.content![0].content).toHaveLength(3);
      expect(result.content![0].content![0].type).toBe('listItem');
    });

    it('should convert ordered lists', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0].type).toBe('orderedList');
      expect(result.content![0].content).toHaveLength(3);
    });

    it('should convert task lists', () => {
      const markdown = '- [ ] Unchecked\n- [x] Checked';
      const result = markdownToProsemirror(markdown);

      const list = result.content![0];
      expect(list.type).toBe('bulletList');

      const item1 = list.content![0];
      expect(item1.type).toBe('taskItem');
      expect(item1.attrs!['checked']).toBe('unchecked');

      const item2 = list.content![1];
      expect(item2.type).toBe('taskItem');
      expect(item2.attrs!['checked']).toBe('checked');
    });

    it('should handle nested lists', () => {
      const markdown = '- Item 1\n  - Nested item\n- Item 2';
      const result = markdownToProsemirror(markdown);

      const list = result.content![0];
      expect(list.type).toBe('bulletList');
      // First item should contain a nested list
      const firstItem = list.content![0];
      expect(firstItem.content!.some((n: ProseMirrorNode) => n.type === 'bulletList')).toBe(true);
    });
  });

  describe('blockquotes', () => {
    it('should convert blockquotes', () => {
      const markdown = '> This is a quote.';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0].type).toBe('blockquote');
      expect(result.content![0].content![0].type).toBe('paragraph');
    });

    it('should convert multi-paragraph blockquotes', () => {
      const markdown = '> First para.\n>\n> Second para.';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0].type).toBe('blockquote');
      expect(result.content![0].content!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('horizontal rules', () => {
    it('should convert horizontal rules', () => {
      const markdown = 'Before\n\n---\n\nAfter';
      const result = markdownToProsemirror(markdown);

      expect(result.content![1].type).toBe('horizontalRule');
    });
  });

  describe('images', () => {
    it('should convert images to notecoveImage placeholder', () => {
      const markdown = '![Alt text](./image.png)';
      const result = markdownToProsemirror(markdown);

      // For now, images are converted to a paragraph with the path info
      // The actual image import will be handled separately
      const para = result.content![0];
      expect(para.type).toBe('paragraph');
      // Check that image info is preserved in some form
    });
  });

  describe('tables', () => {
    it('should convert simple tables', () => {
      const markdown = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = markdownToProsemirror(markdown);

      expect(result.content![0].type).toBe('table');
      // Table should have rows
      expect(result.content![0].content!.length).toBeGreaterThan(0);
    });
  });
});
