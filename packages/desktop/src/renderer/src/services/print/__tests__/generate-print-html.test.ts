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

  describe('bullet lists', () => {
    it('should render a simple bullet list', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'First item' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second item' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<ul>');
      expect(html).toContain('<li>');
      expect(html).toContain('First item');
      expect(html).toContain('Second item');
      expect(html).toContain('</li>');
      expect(html).toContain('</ul>');
    });

    it('should render nested bullet lists', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Parent item' }],
                  },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [
                          {
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Child item' }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('Parent item');
      expect(html).toContain('Child item');
      // Should have nested ul
      expect((html.match(/<ul>/g) ?? []).length).toBe(2);
    });
  });

  describe('ordered lists', () => {
    it('should render a simple ordered list', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'First item' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second item' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<ol>');
      expect(html).toContain('<li>');
      expect(html).toContain('First item');
      expect(html).toContain('Second item');
      expect(html).toContain('</li>');
      expect(html).toContain('</ol>');
    });

    it('should render ordered list with custom start', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            attrs: { start: 5 },
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item five' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<ol start="5">');
    });
  });

  describe('blockquotes', () => {
    it('should render a blockquote', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'This is a quote' }],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<blockquote>');
      expect(html).toContain('This is a quote');
      expect(html).toContain('</blockquote>');
    });

    it('should render nested blockquotes', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Outer quote' }],
              },
              {
                type: 'blockquote',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Inner quote' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('Outer quote');
      expect(html).toContain('Inner quote');
      expect((html.match(/<blockquote>/g) ?? []).length).toBe(2);
    });
  });

  describe('hashtags', () => {
    it('should render hashtag with colored styling', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Check out ' },
              { type: 'text', text: '#typescript' },
              { type: 'text', text: ' for more info' },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<span class="hashtag">#typescript</span>');
    });

    it('should handle multiple hashtags in text', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '#one and #two and #three' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<span class="hashtag">#one</span>');
      expect(html).toContain('<span class="hashtag">#two</span>');
      expect(html).toContain('<span class="hashtag">#three</span>');
    });

    it('should not match hashtag-like patterns with invalid characters', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Not a hashtag: #123 or #-invalid' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      // #123 doesn't start with letter, #-invalid has invalid char
      expect(html).not.toContain('class="hashtag">#123');
      expect(html).not.toContain('class="hashtag">#-invalid');
    });
  });

  describe('tables', () => {
    it('should render a simple table', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Cell 1' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Cell 2' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<table');
      expect(html).toContain('<tr>');
      expect(html).toContain('<td>');
      expect(html).toContain('Cell 1');
      expect(html).toContain('Cell 2');
      expect(html).toContain('</td>');
      expect(html).toContain('</tr>');
      expect(html).toContain('</table>');
    });

    it('should render table headers', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Header 1' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Header 2' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<th>');
      expect(html).toContain('Header 1');
      expect(html).toContain('Header 2');
      expect(html).toContain('</th>');
    });

    it('should handle colspan and rowspan', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    attrs: { colspan: 2, rowspan: 1 },
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Merged' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('colspan="2"');
    });
  });

  describe('images', () => {
    it('should render an image with src', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: { src: 'https://example.com/image.jpg' },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<img');
      expect(html).toContain('src="https://example.com/image.jpg"');
    });

    it('should include alt text when provided', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'https://example.com/image.jpg',
              alt: 'A beautiful sunset',
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('alt="A beautiful sunset"');
    });

    it('should include title when provided', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'https://example.com/image.jpg',
              title: 'Image title',
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('title="Image title"');
    });

    it('should include width and height when provided', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'https://example.com/image.jpg',
              width: 400,
              height: 300,
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('width="400"');
      expect(html).toContain('height="300"');
    });

    it('should escape HTML in image attributes', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'https://example.com/image.jpg',
              alt: 'Image with "quotes" and <tags>',
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).not.toContain('<tags>');
      expect(html).toContain('&lt;tags&gt;');
    });
  });

  describe('code blocks', () => {
    it('should render a code block', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<pre');
      expect(html).toContain('<code');
      expect(html).toContain('const x = 1;');
      expect(html).toContain('</code>');
      expect(html).toContain('</pre>');
    });

    it('should include language class when specified', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('language-javascript');
    });

    it('should handle code block without language', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: 'plain text' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('plain text');
      expect(html).not.toContain('language-');
    });

    it('should escape HTML in code blocks', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: '<div>html</div>' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).not.toContain('<div>html</div>');
      expect(html).toContain('&lt;div&gt;html&lt;/div&gt;');
    });
  });

  describe('task lists', () => {
    it('should render unchecked task item with ☐ symbol', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Todo item' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('☐');
      expect(html).toContain('Todo item');
    });

    it('should render checked task item with ☑ symbol', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Done item' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('☑');
      expect(html).toContain('Done item');
    });

    it('should render cancelled task item with ☒ symbol', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: 'cancelled' },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Cancelled item' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('☒');
      expect(html).toContain('Cancelled item');
    });

    it('should render multiple task items', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'First' }],
                  },
                ],
              },
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second' }],
                  },
                ],
              },
              {
                type: 'taskItem',
                attrs: { checked: 'cancelled' },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Third' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('☐');
      expect(html).toContain('☑');
      expect(html).toContain('☒');
      expect(html).toContain('First');
      expect(html).toContain('Second');
      expect(html).toContain('Third');
    });
  });
});
