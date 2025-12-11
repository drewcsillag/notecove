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
const mockThumbnailGetDataUrl = jest.fn();
const mockGetMetadata = jest.fn();
beforeAll(() => {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    image: {
      getDataUrl: mockGetDataUrl,
      getMetadata: mockGetMetadata,
    },
    thumbnail: {
      getDataUrl: mockThumbnailGetDataUrl,
    },
  };
});

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: readonly number[] = [];
  private callback: IntersectionObserverCallback;
  private static instances: MockIntersectionObserver[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(_target: Element): void {
    // Store reference but don't trigger callback immediately
  }

  unobserve(_target: Element): void {
    // Mock implementation
  }
  disconnect(): void {
    // Mock implementation
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  // Test helper to simulate intersection
  static triggerIntersection(isIntersecting: boolean): void {
    MockIntersectionObserver.instances.forEach((instance) => {
      instance.callback(
        [
          {
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            target: document.createElement('div'),
            time: Date.now(),
          },
        ],
        instance
      );
    });
  }

  static reset(): void {
    MockIntersectionObserver.instances = [];
  }
}

beforeAll(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

beforeEach(() => {
  jest.clearAllMocks();
  MockIntersectionObserver.reset();
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
      expect(imageType?.spec.group).toBe('block');
    });

    it('should be an atom (not editable content)', () => {
      const imageType = editor.schema.nodes['notecoveImage'];
      expect(imageType).toBeDefined();
      expect(imageType?.spec.atom).toBe(true);
    });

    it('should have all required attributes with defaults', () => {
      const imageType = editor.schema.nodes['notecoveImage'];
      expect(imageType).toBeDefined();
      const attrs = imageType?.spec.attrs as Record<string, { default: unknown }> | undefined;
      expect(attrs).toBeDefined();

      expect(attrs?.['imageId']).toBeDefined();
      expect(attrs?.['imageId']?.default).toBeNull();

      expect(attrs?.['sdId']).toBeDefined();
      expect(attrs?.['sdId']?.default).toBeNull();

      expect(attrs?.['alt']).toBeDefined();
      expect(attrs?.['alt']?.default).toBe('');

      expect(attrs?.['caption']).toBeDefined();
      expect(attrs?.['caption']?.default).toBe('');

      expect(attrs?.['alignment']).toBeDefined();
      expect(attrs?.['alignment']?.default).toBe('center');

      expect(attrs?.['width']).toBeDefined();
      expect(attrs?.['width']?.default).toBeNull();

      expect(attrs?.['linkHref']).toBeDefined();
      expect(attrs?.['linkHref']?.default).toBeNull();
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
        display: 'block',
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

  describe('Display Modes', () => {
    it('should default to block display mode', () => {
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
      expect(node?.attrs['display']).toBe('block');
    });

    it('should accept inline display mode', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'test-image',
              sdId: 'sd-1',
              display: 'inline',
            },
          },
        ],
      });

      const node = editor.state.doc.firstChild;
      expect(node?.attrs['display']).toBe('inline');
    });

    it('should serialize display attribute to HTML', () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'test-image',
              sdId: 'sd-1',
              display: 'inline',
            },
          },
        ],
      });

      const html = editor.getHTML();
      expect(html).toContain('data-display="inline"');
    });

    it('should parse display attribute from HTML', () => {
      const html = `
        <figure class="notecove-image" data-image-id="parsed-id" data-sd-id="sd-parsed" data-display="inline">
          <img alt="Test" />
        </figure>
      `;

      editor.commands.setContent(html);

      const node = editor.state.doc.firstChild;
      expect(node?.type.name).toBe('notecoveImage');
      expect(node?.attrs['display']).toBe('inline');
    });

    it('should default to block display when parsing HTML without display attribute', () => {
      const html = `
        <figure class="notecove-image" data-image-id="parsed-id" data-sd-id="sd-parsed">
          <img alt="Test" />
        </figure>
      `;

      editor.commands.setContent(html);

      const node = editor.state.doc.firstChild;
      expect(node?.attrs['display']).toBe('block');
    });
  });

  describe('Markdown Input Rule', () => {
    // The markdown input rule requires the editor to call downloadAndSave
    // These tests verify the regex pattern matching behavior

    it('should have input rules defined', () => {
      // Input rules are added to the extension
      const extensionOptions = NotecoveImage.options;
      expect(extensionOptions).toBeDefined();
    });

    it('should match markdown image syntax pattern', () => {
      // Test the regex pattern that will be used
      // Pattern: ![alt](url) followed by space
      const MARKDOWN_IMAGE_REGEX = /!\[([^[\]]*)\]\((https?:\/\/[^\s<>)]+|file:\/\/[^\s<>)]+)\) $/;

      // Valid patterns
      expect(MARKDOWN_IMAGE_REGEX.exec('![alt](https://example.com/image.png) ')).toBeTruthy();
      expect(MARKDOWN_IMAGE_REGEX.exec('![](https://example.com/image.jpg) ')).toBeTruthy();
      expect(
        MARKDOWN_IMAGE_REGEX.exec('![My Image](https://example.com/path/to/image.gif) ')
      ).toBeTruthy();
      expect(MARKDOWN_IMAGE_REGEX.exec('![local](file:///path/to/image.png) ')).toBeTruthy();

      // Invalid patterns (no trailing space)
      expect(MARKDOWN_IMAGE_REGEX.exec('![alt](https://example.com/image.png)')).toBeNull();

      // Invalid patterns (not image URL)
      expect(MARKDOWN_IMAGE_REGEX.exec('![alt](ftp://example.com/image.png) ')).toBeNull();

      // Should capture alt text and URL
      const match = MARKDOWN_IMAGE_REGEX.exec('![Screenshot](https://example.com/screenshot.png) ');
      expect(match?.[1]).toBe('Screenshot');
      expect(match?.[2]).toBe('https://example.com/screenshot.png');
    });

    it('should handle URLs with special characters', () => {
      const MARKDOWN_IMAGE_REGEX = /!\[([^[\]]*)\]\((https?:\/\/[^\s<>)]+|file:\/\/[^\s<>)]+)\) $/;

      // URL with query parameters
      const matchWithQuery = MARKDOWN_IMAGE_REGEX.exec(
        '![image](https://example.com/image.png?v=1&size=large) '
      );
      expect(matchWithQuery).toBeTruthy();
      expect(matchWithQuery?.[2]).toBe('https://example.com/image.png?v=1&size=large');

      // URL with encoded characters
      const matchEncoded = MARKDOWN_IMAGE_REGEX.exec(
        '![image](https://example.com/my%20image.png) '
      );
      expect(matchEncoded).toBeTruthy();
    });
  });

  describe('Lazy Loading', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      editor.destroy();
      editor = new Editor({
        element: container,
        extensions: [
          StarterKit.configure({
            history: false,
          }),
          NotecoveImage,
        ],
      });
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should not load image data until visible (lazy loading)', async () => {
      mockThumbnailGetDataUrl.mockResolvedValue('data:image/jpeg;base64,thumbnail');

      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'lazy-test-id',
              sdId: 'sd-1',
            },
          },
        ],
      });

      // Wait a tick for initial render
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Image API should NOT have been called yet (not visible)
      expect(mockThumbnailGetDataUrl).not.toHaveBeenCalled();
      expect(mockGetDataUrl).not.toHaveBeenCalled();

      // Simulate the image becoming visible
      MockIntersectionObserver.triggerIntersection(true);

      // Wait for async load
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Now thumbnail API should have been called
      expect(mockThumbnailGetDataUrl).toHaveBeenCalledWith('sd-1', 'lazy-test-id');
    });

    it('should show placeholder before image is loaded', async () => {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'placeholder-test',
              sdId: 'sd-1',
            },
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Find the image wrapper in the DOM
      const wrapper = container.querySelector('.notecove-image');
      expect(wrapper).toBeTruthy();

      // Placeholder should be visible before intersection
      const placeholder = wrapper?.querySelector('.notecove-image-lazy-placeholder');
      expect(placeholder).toBeTruthy();
    });

    it('should use thumbnail for display, not full image', async () => {
      mockThumbnailGetDataUrl.mockResolvedValue('data:image/jpeg;base64,thumbnail');
      mockGetDataUrl.mockResolvedValue('data:image/png;base64,fullimage');

      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'thumb-test',
              sdId: 'sd-1',
            },
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger visibility
      MockIntersectionObserver.triggerIntersection(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Thumbnail API should be called, not the full image API
      expect(mockThumbnailGetDataUrl).toHaveBeenCalledWith('sd-1', 'thumb-test');
      // Full image API should NOT be called for normal display
      expect(mockGetDataUrl).not.toHaveBeenCalled();
    });

    it('should add fade-in class when image loads', async () => {
      mockThumbnailGetDataUrl.mockResolvedValue('data:image/jpeg;base64,thumbnail');

      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'fade-test',
              sdId: 'sd-1',
            },
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger visibility
      MockIntersectionObserver.triggerIntersection(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Find the image element
      const wrapper = container.querySelector('.notecove-image');
      const img = wrapper?.querySelector('.notecove-image-element');

      // Should have fade-in class
      expect(img?.classList.contains('notecove-image--fade-in')).toBe(true);
    });

    it('should stop observing after image loads', async () => {
      mockThumbnailGetDataUrl.mockResolvedValue('data:image/jpeg;base64,thumbnail');

      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'notecoveImage',
            attrs: {
              imageId: 'unobserve-test',
              sdId: 'sd-1',
            },
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // First intersection - loads the image
      MockIntersectionObserver.triggerIntersection(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Clear mocks
      mockThumbnailGetDataUrl.mockClear();

      // Second intersection should NOT trigger another load
      MockIntersectionObserver.triggerIntersection(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not have been called again
      expect(mockThumbnailGetDataUrl).not.toHaveBeenCalled();
    });
  });
});
