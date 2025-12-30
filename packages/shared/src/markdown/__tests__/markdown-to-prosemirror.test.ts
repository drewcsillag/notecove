/**
 * Tests for Markdown to ProseMirror JSON conversion
 *
 * This converter parses markdown using the `marked` library's lexer
 * and transforms the tokens into ProseMirror JSON format.
 */

import {
  markdownToProsemirror,
  extractImageReferences,
  resolveImportImages,
  liftImagesToBlockLevel,
  extractLinkReferences,
  convertLinksToImportMarkers,
  resolveImportLinkMarkers,
} from '../markdown-to-prosemirror';
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

    it('should preserve table alignment', () => {
      const markdown = '| Left | Center | Right |\n|:-----|:------:|------:|\n| a | b | c |';
      const result = markdownToProsemirror(markdown);

      const table = result.content![0];
      expect(table.type).toBe('table');

      // Header row
      const headerRow = table.content![0];
      expect(headerRow.type).toBe('tableRow');

      // Left-aligned cell (default, no attrs)
      const leftCell = headerRow.content![0];
      expect(leftCell.type).toBe('tableHeader');
      expect(leftCell.attrs).toBeUndefined(); // left is default, no attr needed

      // Center-aligned cell
      const centerCell = headerRow.content![1];
      expect(centerCell.type).toBe('tableHeader');
      expect(centerCell.attrs).toEqual({ textAlign: 'center' });

      // Right-aligned cell
      const rightCell = headerRow.content![2];
      expect(rightCell.type).toBe('tableHeader');
      expect(rightCell.attrs).toEqual({ textAlign: 'right' });

      // Data row should also have alignment
      const dataRow = table.content![1];
      const dataLeftCell = dataRow.content![0];
      expect(dataLeftCell.attrs).toBeUndefined(); // left is default

      const dataCenterCell = dataRow.content![1];
      expect(dataCenterCell.attrs).toEqual({ textAlign: 'center' });

      const dataRightCell = dataRow.content![2];
      expect(dataRightCell.attrs).toEqual({ textAlign: 'right' });
    });

    it('should handle mixed alignment in tables', () => {
      const markdown = '| Default | Right |\n|---------|------:|\n| 1 | 2 |';
      const result = markdownToProsemirror(markdown);

      const table = result.content![0];
      const headerRow = table.content![0];

      // Default alignment (no colon = left)
      expect(headerRow.content![0].attrs).toBeUndefined();

      // Right alignment
      expect(headerRow.content![1].attrs).toEqual({ textAlign: 'right' });
    });
  });
});

describe('image import helpers', () => {
  describe('extractImageReferences', () => {
    it('should extract image references from markdown with images', () => {
      const markdown = '# Title\n\n![My Image](./images/photo.png)';
      const doc = markdownToProsemirror(markdown);
      const refs = extractImageReferences(doc);

      expect(refs).toHaveLength(1);
      expect(refs[0].src).toBe('./images/photo.png');
      expect(refs[0].alt).toBe('My Image');
      expect(refs[0].path).toBeDefined();
    });

    it('should extract multiple images', () => {
      const markdown = '![First](a.png)\n\n![Second](b.png)';
      const doc = markdownToProsemirror(markdown);
      const refs = extractImageReferences(doc);

      expect(refs).toHaveLength(2);
      expect(refs[0].src).toBe('a.png');
      expect(refs[1].src).toBe('b.png');
    });

    it('should return empty array for markdown without images', () => {
      const markdown = '# Just text\n\nNo images here.';
      const doc = markdownToProsemirror(markdown);
      const refs = extractImageReferences(doc);

      expect(refs).toHaveLength(0);
    });
  });

  describe('resolveImportImages', () => {
    it('should convert importImage to notecoveImage when image is in map', () => {
      const markdown = '![My Photo](photo.jpg)';
      const doc = markdownToProsemirror(markdown);

      const imageMap = new Map([['photo.jpg', { imageId: 'abc-123', sdId: 'default' }]]);

      resolveImportImages(doc, imageMap);

      // Find the notecoveImage node
      const para = doc.content![0];
      const imageNode = para.content![0];

      expect(imageNode.type).toBe('notecoveImage');
      expect(imageNode.attrs).toEqual({
        imageId: 'abc-123',
        sdId: 'default',
        alt: 'My Photo',
        caption: '',
        width: null,
        linkHref: null,
      });
    });

    it('should convert importImage to text placeholder when image not in map', () => {
      const markdown = '![Missing](missing.png)';
      const doc = markdownToProsemirror(markdown);

      const imageMap = new Map<string, { imageId: string; sdId: string }>();

      resolveImportImages(doc, imageMap);

      const para = doc.content![0];
      const textNode = para.content![0];

      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('[Image: Missing]');
    });
  });

  describe('liftImagesToBlockLevel', () => {
    it('should lift notecoveImage from paragraph to block level', () => {
      const markdown = '![Photo](photo.jpg)';
      const doc = markdownToProsemirror(markdown);

      const imageMap = new Map([['photo.jpg', { imageId: 'abc-123', sdId: 'default' }]]);

      resolveImportImages(doc, imageMap);
      liftImagesToBlockLevel(doc);

      // The image should be a top-level block now
      expect(doc.content![0].type).toBe('notecoveImage');
    });

    it('should split paragraph when image is inline with text', () => {
      // Create a doc manually with text + image + text in a paragraph
      const doc: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Before ' },
              {
                type: 'notecoveImage',
                attrs: {
                  imageId: 'abc',
                  sdId: 'sd1',
                  alt: '',
                  caption: '',
                  width: null,
                  linkHref: null,
                },
              },
              { type: 'text', text: ' After' },
            ],
          },
        ],
      };

      liftImagesToBlockLevel(doc);

      // Should have: paragraph (Before), image, paragraph (After)
      expect(doc.content!.length).toBe(3);
      expect(doc.content![0].type).toBe('paragraph');
      expect(doc.content![0].content![0].text).toBe('Before ');
      expect(doc.content![1].type).toBe('notecoveImage');
      expect(doc.content![2].type).toBe('paragraph');
      expect(doc.content![2].content![0].text).toBe(' After');
    });
  });
});

describe('link display mode attributes', () => {
  describe('basic displayMode parsing', () => {
    it('should parse {.link} attribute on links', () => {
      const markdown = 'Visit [Example](https://example.com){.link} now.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      // Link should have displayMode: 'link'
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      expect(linkNode).toBeDefined();
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');
      expect(linkMark!.attrs).toEqual({
        href: 'https://example.com',
        displayMode: 'link',
      });

      // The {.link} text should be removed
      const allText = content.map((n) => n.text || '').join('');
      expect(allText).not.toContain('{.link}');
      expect(allText).toBe('Visit Example now.');
    });

    it('should parse {.chip} attribute on links', () => {
      const markdown = 'Check out [GitHub](https://github.com){.chip} for code.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');
      expect(linkMark!.attrs).toEqual({
        href: 'https://github.com',
        displayMode: 'chip',
      });

      const allText = content.map((n) => n.text || '').join('');
      expect(allText).toBe('Check out GitHub for code.');
    });

    it('should parse {.unfurl} attribute on links', () => {
      const markdown = 'Watch [Video](https://youtube.com/watch?v=abc){.unfurl} here.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');
      expect(linkMark!.attrs).toEqual({
        href: 'https://youtube.com/watch?v=abc',
        displayMode: 'unfurl',
      });

      const allText = content.map((n) => n.text || '').join('');
      expect(allText).toBe('Watch Video here.');
    });

    it('should not add displayMode for links without attribute', () => {
      const markdown = 'Visit [Example](https://example.com) now.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');
      // Should only have href, no displayMode
      expect(linkMark!.attrs).toEqual({
        href: 'https://example.com',
      });
    });
  });

  describe('edge cases', () => {
    it('should ignore invalid display mode attributes', () => {
      const markdown = 'Visit [Example](https://example.com){.invalid} now.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');
      // Should not have displayMode
      expect(linkMark!.attrs).toEqual({
        href: 'https://example.com',
      });

      // The {.invalid} should remain as text
      const allText = content.map((n) => n.text || '').join('');
      expect(allText).toContain('{.invalid}');
    });

    it('should handle whitespace before attribute', () => {
      const markdown = 'Visit [Example](https://example.com) {.chip} now.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');
      expect(linkMark!.attrs).toEqual({
        href: 'https://example.com',
        displayMode: 'chip',
      });

      // Both the space and {.chip} should be removed
      const allText = content.map((n) => n.text || '').join('');
      expect(allText).toBe('Visit Example now.');
    });

    it('should handle multiple links with different attributes', () => {
      const markdown =
        'See [Link A](https://a.com){.link} and [Link B](https://b.com){.chip} and [Link C](https://c.com){.unfurl}.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      const linkNodes = content.filter((n) => n.marks?.some((m) => m.type === 'link'));

      expect(linkNodes).toHaveLength(3);

      const linkA = linkNodes[0].marks!.find((m) => m.type === 'link');
      expect(linkA!.attrs).toEqual({ href: 'https://a.com', displayMode: 'link' });

      const linkB = linkNodes[1].marks!.find((m) => m.type === 'link');
      expect(linkB!.attrs).toEqual({ href: 'https://b.com', displayMode: 'chip' });

      const linkC = linkNodes[2].marks!.find((m) => m.type === 'link');
      expect(linkC!.attrs).toEqual({ href: 'https://c.com', displayMode: 'unfurl' });

      // All attribute text should be removed
      const allText = content.map((n) => n.text || '').join('');
      expect(allText).toBe('See Link A and Link B and Link C.');
    });

    it('should handle link at end of paragraph with attribute', () => {
      const markdown = 'Visit [Example](https://example.com){.chip}';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');
      expect(linkMark!.attrs).toEqual({
        href: 'https://example.com',
        displayMode: 'chip',
      });

      const allText = content.map((n) => n.text || '').join('');
      expect(allText).toBe('Visit Example');
    });

    it('should not match {.chip} without preceding link', () => {
      const markdown = 'Some text {.chip} here.';
      const result = markdownToProsemirror(markdown);

      const content = result.content![0].content!;
      const allText = content.map((n) => n.text || '').join('');
      // Should remain as-is since there's no preceding link
      expect(allText).toBe('Some text {.chip} here.');
    });
  });

  describe('oEmbedUnfurl block creation', () => {
    it('should create oEmbedUnfurl block after paragraph with unfurl link', () => {
      const markdown = '[Video](https://youtube.com/watch?v=abc){.unfurl}';
      const result = markdownToProsemirror(markdown);

      // Should have paragraph followed by oembedUnfurl block
      expect(result.content).toHaveLength(2);
      expect(result.content![0].type).toBe('paragraph');
      expect(result.content![1].type).toBe('oembedUnfurl');
      expect(result.content![1].attrs).toMatchObject({
        url: 'https://youtube.com/watch?v=abc',
        isLoading: true,
      });
    });

    it('should not create unfurl block for unfurl link in list', () => {
      const markdown = '- [Video](https://youtube.com/watch?v=abc){.unfurl}';
      const result = markdownToProsemirror(markdown);

      // Should only have the list, no oembedUnfurl block
      expect(result.content).toHaveLength(1);
      expect(result.content![0].type).toBe('bulletList');
    });

    it('should not create unfurl block for chip links', () => {
      const markdown = '[Link](https://example.com){.chip}';
      const result = markdownToProsemirror(markdown);

      // Should only have paragraph, no oembedUnfurl block
      expect(result.content).toHaveLength(1);
      expect(result.content![0].type).toBe('paragraph');
    });

    it('should create multiple unfurl blocks for multiple unfurl links', () => {
      const markdown =
        '[Video 1](https://youtube.com/1){.unfurl}\n\n[Video 2](https://youtube.com/2){.unfurl}';
      const result = markdownToProsemirror(markdown);

      // Should have: paragraph, unfurl, paragraph, unfurl
      expect(result.content).toHaveLength(4);
      expect(result.content![0].type).toBe('paragraph');
      expect(result.content![1].type).toBe('oembedUnfurl');
      expect(result.content![2].type).toBe('paragraph');
      expect(result.content![3].type).toBe('oembedUnfurl');
    });
  });
});

describe('inter-note link helpers', () => {
  describe('extractLinkReferences', () => {
    it('should extract links to .md files', () => {
      const markdown = 'See [Other Note](./other-note.md) for details.';
      const doc = markdownToProsemirror(markdown);
      const refs = extractLinkReferences(doc);

      expect(refs).toHaveLength(1);
      expect(refs[0].href).toBe('./other-note.md');
      expect(refs[0].text).toBe('Other Note');
      expect(refs[0].path).toBeDefined();
    });

    it('should extract multiple inter-note links', () => {
      const markdown = 'See [Note A](a.md) and [Note B](b.md).';
      const doc = markdownToProsemirror(markdown);
      const refs = extractLinkReferences(doc);

      expect(refs).toHaveLength(2);
      expect(refs[0].href).toBe('a.md');
      expect(refs[1].href).toBe('b.md');
    });

    it('should ignore external URLs', () => {
      const markdown = 'Visit [Google](https://google.com) and [Note](note.md).';
      const doc = markdownToProsemirror(markdown);
      const refs = extractLinkReferences(doc);

      expect(refs).toHaveLength(1);
      expect(refs[0].href).toBe('note.md');
    });

    it('should return empty array for markdown without .md links', () => {
      const markdown = 'Visit [Google](https://google.com) now.';
      const doc = markdownToProsemirror(markdown);
      const refs = extractLinkReferences(doc);

      expect(refs).toHaveLength(0);
    });
  });

  describe('convertLinksToImportMarkers', () => {
    it('should convert .md links to import markers', () => {
      const markdown = 'See [My Note](./notes/my-note.md) for details.';
      const doc = markdownToProsemirror(markdown);

      convertLinksToImportMarkers(doc);

      // Find the text node that was the link
      const para = doc.content![0];
      const textContent = para.content!.map((n) => n.text).join('');

      expect(textContent).toContain('[[import:./notes/my-note.md|My Note]]');
    });

    it('should preserve external links unchanged', () => {
      const markdown = 'Visit [Google](https://google.com).';
      const doc = markdownToProsemirror(markdown);

      convertLinksToImportMarkers(doc);

      // External link should still have link mark
      const para = doc.content![0];
      const linkNode = para.content!.find((n) => n.marks && n.marks.some((m) => m.type === 'link'));

      expect(linkNode).toBeDefined();
      expect(linkNode!.text).toBe('Google');
    });
  });

  describe('resolveImportLinkMarkers', () => {
    it('should resolve import markers to note IDs', () => {
      // Create a doc with import marker
      const doc: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'See [[import:other-note.md|Other Note]] for details.',
              },
            ],
          },
        ],
      };

      const pathToNoteId = new Map([['other-note.md', 'uuid-123-456']]);

      resolveImportLinkMarkers(doc, pathToNoteId);

      const text = doc.content![0].content![0].text;
      expect(text).toBe('See [[uuid-123-456]] for details.');
    });

    it('should resolve markers with leading ./', () => {
      const doc: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'See [[import:./folder/note.md|Note]] here.',
              },
            ],
          },
        ],
      };

      const pathToNoteId = new Map([['folder/note.md', 'uuid-789']]);

      resolveImportLinkMarkers(doc, pathToNoteId);

      const text = doc.content![0].content![0].text;
      expect(text).toBe('See [[uuid-789]] here.');
    });

    it('should convert unresolved markers to plain text', () => {
      const doc: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'See [[import:missing.md|Missing Note]] here.',
              },
            ],
          },
        ],
      };

      const pathToNoteId = new Map<string, string>();

      resolveImportLinkMarkers(doc, pathToNoteId);

      const text = doc.content![0].content![0].text;
      expect(text).toBe('See [Missing Note] here.');
    });

    it('should handle multiple markers in same text node', () => {
      const doc: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'See [[import:a.md|Note A]] and [[import:b.md|Note B]].',
              },
            ],
          },
        ],
      };

      const pathToNoteId = new Map([
        ['a.md', 'uuid-a'],
        ['b.md', 'uuid-b'],
      ]);

      resolveImportLinkMarkers(doc, pathToNoteId);

      const text = doc.content![0].content![0].text;
      expect(text).toBe('See [[uuid-a]] and [[uuid-b]].');
    });
  });
});

describe('secure mode', () => {
  describe('display mode stripping', () => {
    it('should strip {.chip} display mode in secure mode', () => {
      const markdown = 'Check out [GitHub](https://github.com){.chip} for code.';
      const result = markdownToProsemirror(markdown, { secureMode: true });

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');

      // Should only have href, NO displayMode
      expect(linkMark!.attrs).toEqual({
        href: 'https://github.com',
      });

      // The {.chip} text should still be removed
      const allText = content.map((n) => n.text || '').join('');
      expect(allText).toBe('Check out GitHub for code.');
    });

    it('should strip {.unfurl} display mode in secure mode', () => {
      const markdown = 'Watch [Video](https://youtube.com/watch?v=abc){.unfurl} here.';
      const result = markdownToProsemirror(markdown, { secureMode: true });

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');

      // Should only have href, NO displayMode
      expect(linkMark!.attrs).toEqual({
        href: 'https://youtube.com/watch?v=abc',
      });

      // The {.unfurl} text should still be removed
      const allText = content.map((n) => n.text || '').join('');
      expect(allText).toBe('Watch Video here.');
    });

    it('should preserve {.link} display mode in secure mode', () => {
      const markdown = 'Visit [Example](https://example.com){.link} now.';
      const result = markdownToProsemirror(markdown, { secureMode: true });

      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');

      // {.link} is allowed in secure mode since it's already plain
      expect(linkMark!.attrs).toEqual({
        href: 'https://example.com',
        displayMode: 'link',
      });
    });

    it('should strip display modes for multiple links in secure mode', () => {
      const markdown =
        'See [Link A](https://a.com){.link} and [Link B](https://b.com){.chip} and [Link C](https://c.com){.unfurl}.';
      const result = markdownToProsemirror(markdown, { secureMode: true });

      const content = result.content![0].content!;
      const linkNodes = content.filter((n) => n.marks?.some((m) => m.type === 'link'));

      expect(linkNodes).toHaveLength(3);

      // Link A: {.link} is allowed
      const linkA = linkNodes[0].marks!.find((m) => m.type === 'link');
      expect(linkA!.attrs).toEqual({ href: 'https://a.com', displayMode: 'link' });

      // Link B: {.chip} stripped
      const linkB = linkNodes[1].marks!.find((m) => m.type === 'link');
      expect(linkB!.attrs).toEqual({ href: 'https://b.com' });

      // Link C: {.unfurl} stripped
      const linkC = linkNodes[2].marks!.find((m) => m.type === 'link');
      expect(linkC!.attrs).toEqual({ href: 'https://c.com' });
    });
  });

  describe('oEmbedUnfurl block prevention', () => {
    it('should NOT create oEmbedUnfurl block in secure mode', () => {
      const markdown = '[Video](https://youtube.com/watch?v=abc){.unfurl}';
      const result = markdownToProsemirror(markdown, { secureMode: true });

      // Should only have paragraph, NO oembedUnfurl block
      expect(result.content).toHaveLength(1);
      expect(result.content![0].type).toBe('paragraph');
    });

    it('should NOT create multiple oEmbedUnfurl blocks in secure mode', () => {
      const markdown =
        '[Video 1](https://youtube.com/1){.unfurl}\n\n[Video 2](https://youtube.com/2){.unfurl}';
      const result = markdownToProsemirror(markdown, { secureMode: true });

      // Should only have two paragraphs, NO oembedUnfurl blocks
      expect(result.content).toHaveLength(2);
      expect(result.content![0].type).toBe('paragraph');
      expect(result.content![1].type).toBe('paragraph');
    });
  });

  describe('normal mode comparison', () => {
    it('should create oEmbedUnfurl block in normal mode', () => {
      const markdown = '[Video](https://youtube.com/watch?v=abc){.unfurl}';

      // Normal mode (no options)
      const normalResult = markdownToProsemirror(markdown);
      expect(normalResult.content).toHaveLength(2);
      expect(normalResult.content![1].type).toBe('oembedUnfurl');

      // Explicit secureMode: false
      const explicitNormalResult = markdownToProsemirror(markdown, { secureMode: false });
      expect(explicitNormalResult.content).toHaveLength(2);
      expect(explicitNormalResult.content![1].type).toBe('oembedUnfurl');
    });

    it('should apply chip display mode in normal mode', () => {
      const markdown = 'Check out [GitHub](https://github.com){.chip}';

      const result = markdownToProsemirror(markdown);
      const content = result.content![0].content!;
      const linkNode = content.find((n) => n.marks?.some((m) => m.type === 'link'));
      const linkMark = linkNode!.marks!.find((m) => m.type === 'link');

      expect(linkMark!.attrs).toEqual({
        href: 'https://github.com',
        displayMode: 'chip',
      });
    });
  });
});
