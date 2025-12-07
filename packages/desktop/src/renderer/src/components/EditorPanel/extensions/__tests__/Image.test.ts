/**
 * Image Extension Tests
 *
 * Tests for the TipTap Image node extension.
 * @see plans/add-images/PLAN-PHASE-1.md
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { NotecoveImage, type ImageNodeAttrs } from '../Image';

// Mock window.electronAPI
const mockGetDataUrl = jest.fn();
beforeAll(() => {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    image: {
      getDataUrl: mockGetDataUrl,
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NotecoveImage Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        NotecoveImage,
      ],
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Node Schema', () => {
    it('should define image as a block node', () => {
      const imageType = editor.schema.nodes['notecoveImage'];
      expect(imageType).toBeDefined();
      expect(imageType.spec.group).toBe('block');
    });

    it('should be an atom (not editable content)', () => {
      const imageType = editor.schema.nodes['notecoveImage'];
      expect(imageType.spec.atom).toBe(true);
    });

    it('should have all required attributes with defaults', () => {
      const imageType = editor.schema.nodes['notecoveImage'];
      const attrs = imageType.spec.attrs as Record<string, { default: unknown }>;

      expect(attrs['imageId']).toBeDefined();
      expect(attrs['imageId'].default).toBeNull();

      expect(attrs['sdId']).toBeDefined();
      expect(attrs['sdId'].default).toBeNull();

      expect(attrs['alt']).toBeDefined();
      expect(attrs['alt'].default).toBe('');

      expect(attrs['caption']).toBeDefined();
      expect(attrs['caption'].default).toBe('');

      expect(attrs['alignment']).toBeDefined();
      expect(attrs['alignment'].default).toBe('center');

      expect(attrs['width']).toBeDefined();
      expect(attrs['width'].default).toBeNull();

      expect(attrs['linkHref']).toBeDefined();
      expect(attrs['linkHref'].default).toBeNull();
    });
  });

  describe('Node Creation', () => {
    it('should insert an image node with attributes', () => {
      const attrs: ImageNodeAttrs = {
        imageId: 'test-image-id',
        sdId: 'sd-1',
        alt: 'Test image',
        caption: 'A test caption',
        alignment: 'center',
        width: '50%',
        linkHref: null,
      };

      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs,
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node).not.toBeNull();
      expect(node?.type.name).toBe('notecoveImage');
      expect(node?.attrs['imageId']).toBe('test-image-id');
      expect(node?.attrs['sdId']).toBe('sd-1');
      expect(node?.attrs['alt']).toBe('Test image');
      expect(node?.attrs['caption']).toBe('A test caption');
      expect(node?.attrs['alignment']).toBe('center');
      expect(node?.attrs['width']).toBe('50%');
    });

    it('should use default values for optional attributes', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'test-image',
              sdId: 'sd-1',
            },
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.attrs['alt']).toBe('');
      expect(node?.attrs['caption']).toBe('');
      expect(node?.attrs['alignment']).toBe('center');
      expect(node?.attrs['width']).toBeNull();
      expect(node?.attrs['linkHref']).toBeNull();
    });
  });

  describe('Commands', () => {
    it('should provide insertImage command', () => {
      expect(editor.commands.insertImage).toBeDefined();
    });

    it('should insert image at current position', () => {
      editor.commands.setContent('<p>Hello</p>');
      editor.commands.focus('end');

      editor.commands.insertImage({
        imageId: 'new-image',
        sdId: 'sd-1',
      });

      // Should have paragraph + image
      expect(editor.state.doc.childCount).toBe(2);
      expect(editor.state.doc.child(1).type.name).toBe('notecoveImage');
      expect(editor.state.doc.child(1).attrs['imageId']).toBe('new-image');
    });
  });

  describe('HTML Serialization', () => {
    it('should serialize to HTML with data attributes', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'test-id',
              sdId: 'sd-1',
              alt: 'Alt text',
              caption: 'Caption text',
              alignment: 'left',
              width: '300px',
            },
          },
        ],
      });

      const html = editor.getHTML();
      expect(html).toContain('data-image-id="test-id"');
      expect(html).toContain('data-sd-id="sd-1"');
      expect(html).toContain('alt="Alt text"');
      expect(html).toContain('data-caption="Caption text"');
      expect(html).toContain('data-alignment="left"');
      expect(html).toContain('data-width="300px"');
    });

    it('should parse HTML back to node', () => {
      const html = `
        <figure class="notecove-image" data-image-id="parsed-id" data-sd-id="sd-parsed" data-alignment="right">
          <img alt="Parsed alt" />
          <figcaption>Parsed caption</figcaption>
        </figure>
      `;

      editor.commands.setContent(html);

      const node = editor.state.doc.firstChild;
      expect(node?.type.name).toBe('notecoveImage');
      expect(node?.attrs['imageId']).toBe('parsed-id');
      expect(node?.attrs['sdId']).toBe('sd-parsed');
      expect(node?.attrs['alignment']).toBe('right');
      expect(node?.attrs['alt']).toBe('Parsed alt');
    });
  });
});
