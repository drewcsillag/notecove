/**
 * Tests for markdown-export utilities
 */

import {
  prosemirrorToMarkdown,
  sanitizeFilename,
  truncateFilename,
  resolveFilenameCollision,
  extractImageReferences,
  replaceImagePlaceholders,
  type NoteTitleLookup,
} from '../markdown-export';

describe('prosemirrorToMarkdown', () => {
  const noopLookup: NoteTitleLookup = () => undefined;

  describe('basic content', () => {
    it('should return empty string for empty content', () => {
      const result = prosemirrorToMarkdown({ type: 'doc', content: [] }, noopLookup);
      expect(result).toBe('');
    });

    it('should return empty string for undefined content', () => {
      const result = prosemirrorToMarkdown({ type: 'doc' }, noopLookup);
      expect(result).toBe('');
    });
  });

  describe('paragraphs', () => {
    it('should convert simple paragraph', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('Hello world');
    });

    it('should convert multiple paragraphs with double newlines', () => {
      const content = {
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
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('First paragraph\n\nSecond paragraph');
    });

    it('should handle empty paragraph', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('');
    });
  });

  describe('headings', () => {
    it('should convert h1 heading', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Main Title' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('# Main Title');
    });

    it('should convert h2 heading', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Sub Title' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('## Sub Title');
    });

    it('should convert h3 heading', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Section' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('### Section');
    });

    it('should handle heading without content', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 1 } }],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('# ');
    });
  });

  describe('text formatting', () => {
    it('should convert bold text', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('**Bold**');
    });

    it('should convert italic text', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Italic', marks: [{ type: 'italic' }] }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('*Italic*');
    });

    it('should convert underline text to HTML', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Underline', marks: [{ type: 'underline' }] }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('<u>Underline</u>');
    });

    it('should convert strikethrough text', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Strike', marks: [{ type: 'strike' }] }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('~~Strike~~');
    });

    it('should convert inline code', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'code', marks: [{ type: 'code' }] }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('`code`');
    });

    it('should convert links', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click here',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              },
            ],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('[Click here](https://example.com)');
    });

    it('should apply multiple marks', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Bold Italic',
                marks: [{ type: 'bold' }, { type: 'italic' }],
              },
            ],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('***Bold Italic***');
    });
  });

  describe('bullet lists', () => {
    it('should convert simple bullet list', () => {
      const content = {
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
                    content: [{ type: 'text', text: 'Item 1' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item 2' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('- Item 1\n- Item 2');
    });

    it('should convert nested bullet list', () => {
      const content = {
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
                    content: [{ type: 'text', text: 'Parent' }],
                  },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [
                          {
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Child' }],
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
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toContain('- Parent');
      expect(result).toContain('  - Child');
    });
  });

  describe('ordered lists', () => {
    it('should convert simple ordered list', () => {
      const content = {
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
                    content: [{ type: 'text', text: 'First' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('1. First\n2. Second');
    });
  });

  describe('task lists', () => {
    it('should convert unchecked task item', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
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
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('- [ ] Todo item');
    });

    it('should convert checked task item', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
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
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('- [x] Done item');
    });

    it('should convert nope/cancelled task item', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: 'nope' },
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
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('- [-] Cancelled item');
    });
  });

  describe('blockquotes', () => {
    it('should convert blockquote', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Quote text' }],
              },
            ],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('> Quote text');
    });

    it('should handle multi-line blockquote', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Line 1' }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Line 2' }],
              },
            ],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      // Paragraphs in blockquotes are separated by newlines
      expect(result).toBe('> Line 1\n> Line 2');
    });

    it('should handle empty blockquote', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'blockquote' }],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('>');
    });
  });

  describe('code blocks', () => {
    it('should convert code block without language', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('```\nconst x = 1;\n```');
    });

    it('should convert code block with language', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('```javascript\nconst x = 1;\n```');
    });

    it('should handle empty code block', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'codeBlock', attrs: { language: 'python' } }],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('```python\n\n```');
    });
  });

  describe('horizontal rule', () => {
    it('should convert horizontal rule', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'horizontalRule' }],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('---');
    });
  });

  describe('inter-note links', () => {
    it('should resolve inter-note links to titles', () => {
      const lookup: NoteTitleLookup = (id) => {
        if (id === 'note-123') return 'My Note Title';
        return undefined;
      };
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'See [[note-123]] for more.' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, lookup);
      expect(result).toBe('See [[My Note Title]] for more.');
    });

    it('should preserve original ID when title not found', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'See [[unknown-id]] for more.' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('See [[unknown-id]] for more.');
    });

    it('should handle multiple links in same text', () => {
      const lookup: NoteTitleLookup = (id) => {
        if (id === 'note-1') return 'First Note';
        if (id === 'note-2') return 'Second Note';
        return undefined;
      };
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Link to [[note-1]] and [[note-2]].' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, lookup);
      expect(result).toBe('Link to [[First Note]] and [[Second Note]].');
    });

    it('should be case-insensitive for note ID lookup', () => {
      const lookup: NoteTitleLookup = (id) => {
        if (id === 'note-abc') return 'ABC Note';
        return undefined;
      };
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'See [[Note-ABC]].' }],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, lookup);
      expect(result).toBe('See [[ABC Note]].');
    });
  });

  describe('legacy triStateCheckbox', () => {
    it('should convert checked checkbox', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'triStateCheckbox',
            attrs: { checked: 'checked' },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('[x]');
    });

    it('should convert unchecked checkbox', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'triStateCheckbox',
            attrs: { checked: 'unchecked' },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('[ ]');
    });

    it('should convert nope checkbox', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'triStateCheckbox',
            attrs: { checked: 'nope' },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('[-]');
    });
  });

  describe('unknown node types', () => {
    it('should extract text content from unknown nodes', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'customNode',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Inner text' }],
              },
            ],
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('Inner text');
    });

    it('should return null for nodes without content', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'emptyUnknownNode' }],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toBe('');
    });
  });
});

describe('sanitizeFilename', () => {
  it('should return Untitled for empty string', () => {
    expect(sanitizeFilename('')).toBe('Untitled');
  });

  it('should return Untitled for whitespace-only string', () => {
    expect(sanitizeFilename('   ')).toBe('Untitled');
  });

  it('should replace invalid characters with underscore', () => {
    expect(sanitizeFilename('file/with:invalid*chars?')).toBe('file_with_invalid_chars');
  });

  it('should replace multiple consecutive underscores with single underscore', () => {
    expect(sanitizeFilename('file___name')).toBe('file_name');
  });

  it('should trim underscores from ends', () => {
    expect(sanitizeFilename('__filename__')).toBe('filename');
  });

  it('should return Untitled if result is empty after sanitization', () => {
    expect(sanitizeFilename('***')).toBe('Untitled');
  });

  it('should prefix Windows reserved names', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('NUL')).toBe('_NUL');
    expect(sanitizeFilename('PRN')).toBe('_PRN');
    expect(sanitizeFilename('AUX')).toBe('_AUX');
  });

  it('should prefix reserved names case-insensitively', () => {
    expect(sanitizeFilename('con')).toBe('_con');
    expect(sanitizeFilename('Con')).toBe('_Con');
  });

  it('should handle reserved names with extensions', () => {
    expect(sanitizeFilename('CON.txt')).toBe('_CON.txt');
  });

  it('should preserve valid filenames', () => {
    expect(sanitizeFilename('My Note Title')).toBe('My Note Title');
    expect(sanitizeFilename('notes-2024')).toBe('notes-2024');
  });
});

describe('truncateFilename', () => {
  it('should not truncate filenames shorter than max length', () => {
    expect(truncateFilename('short', 100)).toBe('short');
  });

  it('should truncate at word boundary when possible', () => {
    const longName = 'This is a very long filename that needs truncation';
    const result = truncateFilename(longName, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).toBe('This is a very long filename');
  });

  it('should truncate without word boundary if no good boundary found', () => {
    const longName = 'NoSpacesInThisVeryLongFileName';
    const result = truncateFilename(longName, 15);
    expect(result.length).toBeLessThanOrEqual(15);
    expect(result).toBe('NoSpacesInThisV');
  });

  it('should use default max length of 255', () => {
    const name = 'a'.repeat(300);
    const result = truncateFilename(name);
    expect(result.length).toBeLessThanOrEqual(255);
  });
});

describe('resolveFilenameCollision', () => {
  it('should return original filename if no collision', () => {
    const usedNames = new Set<string>();
    const result = resolveFilenameCollision('myfile', usedNames);
    expect(result).toBe('myfile');
    // The set stores lowercase versions
    expect(usedNames.has('myfile')).toBe(true);
  });

  it('should append number (starting at 2) if filename exists', () => {
    const usedNames = new Set(['myfile']); // lowercase in set
    const result = resolveFilenameCollision('myfile', usedNames);
    expect(result).toBe('myfile (2)');
    expect(usedNames.has('myfile (2)')).toBe(true);
  });

  it('should increment number for multiple collisions', () => {
    const usedNames = new Set(['myfile', 'myfile (2)', 'myfile (3)']);
    const result = resolveFilenameCollision('myfile', usedNames);
    expect(result).toBe('myfile (4)');
  });

  it('should handle case-insensitive collisions', () => {
    // The set stores lowercase, so 'myfile' matches lowercase version
    const usedNames = new Set(['myfile']); // lowercase in set - would match MyFile too
    const result = resolveFilenameCollision('MyFile', usedNames);
    expect(result).toBe('MyFile (2)');
  });
});

describe('image export', () => {
  const noopLookup: NoteTitleLookup = () => undefined;

  describe('notecoveImage nodes', () => {
    it('should export simple left-aligned image as markdown', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'abc123',
              sdId: 'sd-1',
              alt: 'Screenshot of dashboard',
              caption: '',
              alignment: 'left',
              width: null,
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      // Simple left-aligned images use pure markdown syntax
      expect(result).toBe('![Screenshot of dashboard]({ATTACHMENTS}/abc123)');
    });

    it('should export image with width as HTML (markdown has no width support)', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'abc123',
              sdId: 'sd-1',
              alt: 'Screenshot of dashboard',
              caption: '',
              alignment: 'center',
              width: '50%',
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      // Images with width use HTML because markdown doesn't support width
      expect(result).toContain('alt="Screenshot of dashboard"');
      expect(result).toContain('abc123');
      expect(result).toContain('width="50%"');
    });

    it('should export image with caption using HTML figure/figcaption', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-456',
              sdId: 'sd-1',
              alt: 'My photo',
              caption: 'A beautiful sunset',
              alignment: 'center',
              width: null,
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toContain('<figure');
      expect(result).toContain('<figcaption>A beautiful sunset</figcaption>');
      expect(result).toContain('alt="My photo"');
    });

    it('should export centered image with center alignment style', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-center',
              sdId: 'sd-1',
              alt: 'Centered image',
              caption: '',
              alignment: 'center',
              width: null,
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toContain('margin-left: auto');
      expect(result).toContain('margin-right: auto');
    });

    it('should export left-aligned image with float:left style', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-left',
              sdId: 'sd-1',
              alt: 'Left image',
              caption: '',
              alignment: 'left',
              width: null,
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      // Left aligned images should have no special style (natural flow)
      expect(result).not.toContain('margin-left: auto');
    });

    it('should export right-aligned image with float:right style', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-right',
              sdId: 'sd-1',
              alt: 'Right image',
              caption: '',
              alignment: 'right',
              width: null,
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toContain('margin-left: auto');
    });

    it('should export image with link wrapper', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-link',
              sdId: 'sd-1',
              alt: 'Linked image',
              caption: '',
              alignment: 'center',
              width: null,
              linkHref: 'https://example.com',
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain('</a>');
    });

    it('should include width attribute when specified', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-width',
              sdId: 'sd-1',
              alt: 'Sized image',
              caption: '',
              alignment: 'center',
              width: '300px',
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toContain('width="300px"');
    });

    it('should handle image without sdId (missing image)', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'missing-img',
              sdId: null,
              alt: 'Missing image',
              caption: '',
              alignment: 'center',
              width: null,
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      // Should still export a placeholder reference
      expect(result).toContain('missing-img');
    });

    it('should extract all image references for export', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Some text' }],
          },
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-1',
              sdId: 'sd-1',
              alt: 'First image',
              caption: '',
              alignment: 'center',
              width: null,
              linkHref: null,
            },
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'More text' }],
          },
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-2',
              sdId: 'sd-1',
              alt: 'Second image',
              caption: '',
              alignment: 'left',
              width: null,
              linkHref: null,
            },
          },
        ],
      };
      const result = prosemirrorToMarkdown(content, noopLookup);
      expect(result).toContain('img-1');
      expect(result).toContain('img-2');
      expect(result).toContain('First image');
      expect(result).toContain('Second image');
    });
  });

  describe('extractImageReferences', () => {
    it('should extract single image reference', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'img-123',
              sdId: 'sd-1',
              alt: 'My image',
            },
          },
        ],
      };
      const refs = extractImageReferences(content);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({
        imageId: 'img-123',
        sdId: 'sd-1',
        alt: 'My image',
      });
    });

    it('should extract multiple image references', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: { imageId: 'img-1', sdId: 'sd-1', alt: 'First' },
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Some text' }],
          },
          {
            type: 'notecoveImage',
            attrs: { imageId: 'img-2', sdId: 'sd-1', alt: 'Second' },
          },
        ],
      };
      const refs = extractImageReferences(content);
      expect(refs).toHaveLength(2);
      expect(refs[0]?.imageId).toBe('img-1');
      expect(refs[1]?.imageId).toBe('img-2');
    });

    it('should return empty array for content without images', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'No images here' }],
          },
        ],
      };
      const refs = extractImageReferences(content);
      expect(refs).toHaveLength(0);
    });

    it('should skip images without imageId', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: { imageId: null, sdId: 'sd-1', alt: 'Broken' },
          },
        ],
      };
      const refs = extractImageReferences(content);
      expect(refs).toHaveLength(0);
    });

    it('should handle nested content', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'notecoveImage',
                attrs: { imageId: 'nested-img', sdId: 'sd-1', alt: 'Nested' },
              },
            ],
          },
        ],
      };
      const refs = extractImageReferences(content);
      expect(refs).toHaveLength(1);
      expect(refs[0]?.imageId).toBe('nested-img');
    });
  });

  describe('replaceImagePlaceholders', () => {
    it('should replace single placeholder', () => {
      const markdown = '![Alt]({ATTACHMENTS}/img-123)';
      const extensions = new Map([['img-123', '.png']]);
      const result = replaceImagePlaceholders(markdown, 'Note_attachments', extensions);
      expect(result).toBe('![Alt](Note_attachments/img-123.png)');
    });

    it('should replace multiple placeholders', () => {
      const markdown = '![One]({ATTACHMENTS}/img-1)\n\n![Two]({ATTACHMENTS}/img-2)';
      const extensions = new Map([
        ['img-1', '.png'],
        ['img-2', '.jpg'],
      ]);
      const result = replaceImagePlaceholders(markdown, 'My Note_attachments', extensions);
      expect(result).toContain('My%20Note_attachments/img-1.png');
      expect(result).toContain('My%20Note_attachments/img-2.jpg');
    });

    it('should URL-encode folder names with spaces', () => {
      const markdown = '![Alt]({ATTACHMENTS}/img-1)';
      const extensions = new Map([['img-1', '.png']]);
      const result = replaceImagePlaceholders(markdown, 'My Note Title_attachments', extensions);
      expect(result).toBe('![Alt](My%20Note%20Title_attachments/img-1.png)');
    });

    it('should handle missing extension gracefully', () => {
      const markdown = '![Alt]({ATTACHMENTS}/unknown-img)';
      const extensions = new Map<string, string>();
      const result = replaceImagePlaceholders(markdown, 'Note_attachments', extensions);
      expect(result).toBe('![Alt](Note_attachments/unknown-img)');
    });

    it('should handle HTML img tags', () => {
      const markdown = '<img src="{ATTACHMENTS}/img-1" alt="Test" />';
      const extensions = new Map([['img-1', '.png']]);
      const result = replaceImagePlaceholders(markdown, 'Attachments', extensions);
      expect(result).toBe('<img src="Attachments/img-1.png" alt="Test" />');
    });
  });
});
