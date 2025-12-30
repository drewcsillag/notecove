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

    it('should render notecoveImage with imageId and sdId', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-123',
              sdId: 'sd-456',
              alt: 'Test image',
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('<img');
      expect(html).toContain('data-image-id="img-123"');
      expect(html).toContain('data-sd-id="sd-456"');
      expect(html).toContain('src=""');
      expect(html).toContain('alt="Test image"');
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
    it('should render unchecked task item with empty checkbox', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: 'unchecked' },
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

      expect(html).toContain('task-item--unchecked');
      expect(html).toContain('task-checkbox');
      expect(html).toContain('Todo item');
    });

    it('should render checked task item with checkmark', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: 'checked' },
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

      expect(html).toContain('task-item--checked');
      expect(html).toContain('✓');
      expect(html).toContain('Done item');
    });

    it('should render nope task item with X', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: 'nope' },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Nope item' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('task-item--nope');
      expect(html).toContain('✕');
      expect(html).toContain('Nope item');
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
                attrs: { checked: 'unchecked' },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'First' }],
                  },
                ],
              },
              {
                type: 'taskItem',
                attrs: { checked: 'checked' },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second' }],
                  },
                ],
              },
              {
                type: 'taskItem',
                attrs: { checked: 'nope' },
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

      expect(html).toContain('task-item--unchecked');
      expect(html).toContain('task-item--checked');
      expect(html).toContain('task-item--nope');
      expect(html).toContain('First');
      expect(html).toContain('Second');
      expect(html).toContain('Third');
    });
  });

  describe('link chips (Phase 3)', () => {
    it('should render link mark as chip by default', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click here',
                marks: [{ type: 'link', attrs: { href: 'https://example.com/page' } }],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('link-chip');
      expect(html).toContain('Click here');
      expect(html).toContain('example.com');
    });

    it('should render link mark with chip displayMode', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'My Link',
                marks: [
                  { type: 'link', attrs: { href: 'https://github.com/test', displayMode: 'chip' } },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('link-chip');
      expect(html).toContain('My Link');
      expect(html).toContain('github.com');
    });

    it('should render link mark with link displayMode as plain link', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Plain Link',
                marks: [
                  { type: 'link', attrs: { href: 'https://example.com', displayMode: 'link' } },
                ],
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('print-link');
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('Plain Link');
    });
  });

  describe('inter-note links (Phase 3)', () => {
    it('should render inter-note link pattern [[uuid]]', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'See [[a1b2c3d4-e5f6-7890-abcd-ef1234567890]]' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('inter-note-link');
      expect(html).toContain('data-note-id="a1b2c3d4-e5f6-7890-abcd-ef1234567890"');
    });

    it('should handle multiple inter-note links', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '[[11111111-1111-1111-1111-111111111111]] and [[22222222-2222-2222-2222-222222222222]]',
              },
            ],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect((html.match(/inter-note-link/g) ?? []).length).toBe(2);
      expect(html).toContain('11111111-1111-1111-1111-111111111111');
      expect(html).toContain('22222222-2222-2222-2222-222222222222');
    });
  });

  describe('date chips (Phase 3)', () => {
    it('should render date pattern YYYY-MM-DD as chip', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Due on 2024-12-25' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('date-chip');
      expect(html).toContain('data-date="2024-12-25"');
      expect(html).toContain('Dec 25, 2024');
    });

    it('should handle multiple dates', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'From 2024-01-01 to 2024-12-31' }],
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect((html.match(/date-chip/g) ?? []).length).toBe(2);
      expect(html).toContain('Jan 1, 2024');
      expect(html).toContain('Dec 31, 2024');
    });
  });

  describe('oEmbed unfurls (Phase 3)', () => {
    it('should render oEmbed unfurl card with title and description', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'oembedUnfurl',
            attrs: {
              url: 'https://example.com/article',
              title: 'Example Article',
              description: 'This is an example article description',
              providerName: 'Example',
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('unfurl-card');
      expect(html).toContain('Example Article');
      expect(html).toContain('This is an example article description');
      expect(html).toContain('Example');
      expect(html).toContain('https://example.com/article');
    });

    it('should render oEmbed unfurl with thumbnail', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'oembedUnfurl',
            attrs: {
              url: 'https://youtube.com/watch?v=123',
              title: 'Video Title',
              thumbnailUrl: 'https://i.ytimg.com/vi/123/hqdefault.jpg',
              providerName: 'YouTube',
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('unfurl-card');
      expect(html).toContain('unfurl-thumbnail');
      expect(html).toContain('https://i.ytimg.com/vi/123/hqdefault.jpg');
      expect(html).toContain('Video Title');
    });

    it('should render loading unfurl as plain link', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'oembedUnfurl',
            attrs: {
              url: 'https://example.com',
              isLoading: true,
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('print-link');
      expect(html).toContain('href="https://example.com"');
      expect(html).not.toContain('unfurl-card');
    });

    it('should render error unfurl as plain link', () => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'oembedUnfurl',
            attrs: {
              url: 'https://example.com',
              error: 'Failed to fetch',
            },
          },
        ],
      };

      const html = generatePrintHtml(content, [], defaultOptions);

      expect(html).toContain('print-link');
      expect(html).not.toContain('unfurl-card');
    });
  });
});
