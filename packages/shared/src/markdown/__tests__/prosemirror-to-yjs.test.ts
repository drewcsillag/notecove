/**
 * Tests for ProseMirror JSON to Y.XmlFragment conversion
 *
 * This conversion allows us to import markdown content into NoteCove's
 * Yjs-based CRDT storage without needing a DOM or full TipTap/ProseMirror runtime.
 */

import * as Y from 'yjs';
import { prosemirrorJsonToYXmlFragment, type ProseMirrorNode } from '../prosemirror-to-yjs';

describe('prosemirrorJsonToYXmlFragment', () => {
  describe('basic elements', () => {
    it('should convert an empty document', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      expect(fragment.length).toBe(0);
    });

    it('should convert a single paragraph with text', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello, World!' }],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      expect(fragment.length).toBe(1);
      const paragraph = fragment.get(0) as Y.XmlElement;
      expect(paragraph.nodeName).toBe('paragraph');
      expect(paragraph.length).toBe(1);

      const textNode = paragraph.get(0) as Y.XmlText;
      expect(textNode.toString()).toBe('Hello, World!');
    });

    it('should convert multiple paragraphs', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph' }] },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      expect(fragment.length).toBe(2);
      expect((fragment.get(0) as Y.XmlElement).nodeName).toBe('paragraph');
      expect((fragment.get(1) as Y.XmlElement).nodeName).toBe('paragraph');
    });

    it('should convert an empty paragraph', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      expect(fragment.length).toBe(1);
      const paragraph = fragment.get(0) as Y.XmlElement;
      expect(paragraph.nodeName).toBe('paragraph');
      expect(paragraph.length).toBe(0);
    });
  });

  describe('headings', () => {
    it('should convert headings with level attribute', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Subtitle' }],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      expect(fragment.length).toBe(2);

      const h1 = fragment.get(0) as Y.XmlElement;
      expect(h1.nodeName).toBe('heading');
      expect(h1.getAttribute('level')).toBe(1);

      const h2 = fragment.get(1) as Y.XmlElement;
      expect(h2.nodeName).toBe('heading');
      expect(h2.getAttribute('level')).toBe(2);
    });
  });

  describe('text marks (formatting)', () => {
    it('should convert bold text', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'bold text', marks: [{ type: 'bold' }] }],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const paragraph = fragment.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;

      // Check that the text has bold formatting
      const delta = textNode.toDelta();
      expect(delta).toHaveLength(1);
      expect(delta[0].insert).toBe('bold text');
      expect(delta[0].attributes).toEqual({ bold: {} });
    });

    it('should convert italic text', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'italic text', marks: [{ type: 'italic' }] }],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const paragraph = fragment.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      const delta = textNode.toDelta();

      expect(delta[0].attributes).toEqual({ italic: {} });
    });

    it('should convert text with multiple marks', () => {
      const json: ProseMirrorNode = {
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

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const paragraph = fragment.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      const delta = textNode.toDelta();

      expect(delta[0].attributes).toEqual({ bold: {}, italic: {} });
    });

    it('should convert mixed formatted and plain text', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'plain ' },
              { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' more plain' },
            ],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const paragraph = fragment.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      const delta = textNode.toDelta();

      expect(delta).toHaveLength(3);
      expect(delta[0]).toEqual({ insert: 'plain ' });
      expect(delta[1]).toEqual({ insert: 'bold', attributes: { bold: {} } });
      expect(delta[2]).toEqual({ insert: ' more plain' });
    });

    it('should convert links', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'click here',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              },
            ],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const paragraph = fragment.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      const delta = textNode.toDelta();

      expect(delta[0].attributes).toEqual({ link: { href: 'https://example.com' } });
    });

    it('should convert inline code', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'const x = 1', marks: [{ type: 'code' }] }],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const paragraph = fragment.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      const delta = textNode.toDelta();

      expect(delta[0].attributes).toEqual({ code: {} });
    });
  });

  describe('block elements', () => {
    it('should convert code blocks', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const codeBlock = fragment.get(0) as Y.XmlElement;
      expect(codeBlock.nodeName).toBe('codeBlock');
      expect(codeBlock.getAttribute('language')).toBe('javascript');
    });

    it('should convert blockquotes', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A quote' }],
              },
            ],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const blockquote = fragment.get(0) as Y.XmlElement;
      expect(blockquote.nodeName).toBe('blockquote');
      expect(blockquote.length).toBe(1);

      const paragraph = blockquote.get(0) as Y.XmlElement;
      expect(paragraph.nodeName).toBe('paragraph');
    });

    it('should convert horizontal rules', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [{ type: 'horizontalRule' }],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const hr = fragment.get(0) as Y.XmlElement;
      expect(hr.nodeName).toBe('horizontalRule');
    });
  });

  describe('lists', () => {
    it('should convert bullet lists', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }],
              },
            ],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const bulletList = fragment.get(0) as Y.XmlElement;
      expect(bulletList.nodeName).toBe('bulletList');
      expect(bulletList.length).toBe(2);

      const item1 = bulletList.get(0) as Y.XmlElement;
      expect(item1.nodeName).toBe('listItem');
    });

    it('should convert ordered lists', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }],
              },
            ],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const orderedList = fragment.get(0) as Y.XmlElement;
      expect(orderedList.nodeName).toBe('orderedList');
    });

    it('should convert task lists', () => {
      const json: ProseMirrorNode = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: 'unchecked' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Todo item' }] }],
              },
              {
                type: 'taskItem',
                attrs: { checked: 'checked' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done item' }] }],
              },
            ],
          },
        ],
      };

      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');
      prosemirrorJsonToYXmlFragment(json, fragment);

      const bulletList = fragment.get(0) as Y.XmlElement;
      const task1 = bulletList.get(0) as Y.XmlElement;
      const task2 = bulletList.get(1) as Y.XmlElement;

      expect(task1.nodeName).toBe('taskItem');
      expect(task1.getAttribute('checked')).toBe('unchecked');
      expect(task2.getAttribute('checked')).toBe('checked');
    });
  });
});
