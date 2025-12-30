/**
 * Tests for Print HTML Generator
 */

import { generatePrintHtml, type PrintOptions } from '../generate-print-html';
import type { JSONContent } from '@tiptap/core';

describe('generatePrintHtml', () => {
  const defaultOptions: PrintOptions = {
    includeResolvedComments: false,
  };

  describe('basic content', () => {
    it('should generate HTML for a paragraph', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello, world!' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<p>Hello, world!</p>');
    });

    it('should generate HTML for multiple paragraphs', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First paragraph' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<p>First paragraph</p>');
      expect(html).toContain('<p>Second paragraph</p>');
    });

    it('should handle empty paragraphs', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<p></p>');
    });
  });

  describe('headings', () => {
    it('should generate h1', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Main Title' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<h1>Main Title</h1>');
    });

    it('should generate h2', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Section Title' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<h2>Section Title</h2>');
    });

    it('should generate h3 through h6', () => {
      for (let level = 3; level <= 6; level++) {
        const content: JSONContent = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level },
              content: [{ type: 'text', text: `Heading ${level}` }],
            },
          ],
        };

        const html = generatePrintHtml(content, [], defaultOptions);

        expect(html).toContain(`<h${level}>Heading ${level}</h${level}>`);
      }
    });

    it('should default to h1 if level not specified', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            content: [{ type: 'text', text: 'Default Heading' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<h1>Default Heading</h1>');
    });
  });

  describe('text formatting', () => {
    it('should render bold text', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'bold text',
                marks: [{ type: 'bold' }],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<strong>bold text</strong>');
    });

    it('should render italic text', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'italic text',
                marks: [{ type: 'italic' }],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<em>italic text</em>');
    });

    it('should render strikethrough text', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'strikethrough text',
                marks: [{ type: 'strike' }],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<s>strikethrough text</s>');
    });

    it('should render code inline', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'const x = 1',
                marks: [{ type: 'code' }],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<code>const x = 1</code>');
    });

    it('should render combined marks (bold + italic)', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'bold and italic',
                marks: [{ type: 'bold' }, { type: 'italic' }],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<strong><em>bold and italic</em></strong>');
    });
  });

  describe('empty document', () => {
    it('should handle empty document', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toBe('');
    });

    it('should handle document with no content array', () => {
      const content: JSONContent = {
        type: 'doc',
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toBe('');
    });
  });

  describe('HTML escaping', () => {
    it('should escape HTML entities in text', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '<script>alert("xss")</script>' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
