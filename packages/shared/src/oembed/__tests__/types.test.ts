// Jest is the test framework used in this package
import {
  type OEmbedResponse,
  type OEmbedPhotoResponse,
  type OEmbedVideoResponse,
  type OEmbedLinkResponse,
  type OEmbedRichResponse,
  type OEmbedProvider,
  type OEmbedResult,
  type OEmbedNodeAttrs,
  DEFAULT_OEMBED_NODE_ATTRS,
} from '../types';

describe('oEmbed types', () => {
  describe('OEmbedResponse types', () => {
    it('should accept valid photo response', () => {
      const photo: OEmbedPhotoResponse = {
        type: 'photo',
        version: '1.0',
        url: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
        title: 'Test Image',
      };
      expect(photo.type).toBe('photo');
      expect(photo.url).toBeDefined();
    });

    it('should accept valid video response', () => {
      const video: OEmbedVideoResponse = {
        type: 'video',
        version: '1.0',
        html: '<iframe src="..."></iframe>',
        width: 640,
        height: 360,
        title: 'Test Video',
        provider_name: 'YouTube',
      };
      expect(video.type).toBe('video');
      expect(video.html).toBeDefined();
    });

    it('should accept valid link response', () => {
      const link: OEmbedLinkResponse = {
        type: 'link',
        version: '1.0',
        title: 'Example Page',
        thumbnail_url: 'https://example.com/thumb.jpg',
      };
      expect(link.type).toBe('link');
    });

    it('should accept valid rich response', () => {
      const rich: OEmbedRichResponse = {
        type: 'rich',
        version: '1.0',
        html: '<div>Rich content</div>',
        width: 500,
        height: 300,
      };
      expect(rich.type).toBe('rich');
      expect(rich.html).toBeDefined();
    });

    it('should narrow type based on type field', () => {
      const response: OEmbedResponse = {
        type: 'video',
        version: '1.0',
        html: '<iframe></iframe>',
        width: 640,
        height: 360,
      };

      if (response.type === 'video') {
        // TypeScript should narrow this to OEmbedVideoResponse
        expect(response.html).toBeDefined();
      }
    });
  });

  describe('OEmbedProvider type', () => {
    it('should accept valid provider definition', () => {
      const provider: OEmbedProvider = {
        provider_name: 'YouTube',
        provider_url: 'https://www.youtube.com/',
        endpoints: [
          {
            schemes: ['https://*.youtube.com/watch*', 'https://youtu.be/*'],
            url: 'https://www.youtube.com/oembed',
            discovery: true,
            formats: ['json'],
          },
        ],
      };
      expect(provider.provider_name).toBe('YouTube');
      expect(provider.endpoints).toHaveLength(1);
      expect(provider.endpoints[0].schemes).toHaveLength(2);
    });

    it('should accept provider without optional fields', () => {
      const provider: OEmbedProvider = {
        provider_name: 'Simple Provider',
        provider_url: 'https://example.com',
        endpoints: [
          {
            url: 'https://example.com/oembed',
          },
        ],
      };
      expect(provider.endpoints[0].schemes).toBeUndefined();
      expect(provider.endpoints[0].discovery).toBeUndefined();
    });
  });

  describe('OEmbedResult type', () => {
    it('should accept successful result', () => {
      const result: OEmbedResult = {
        success: true,
        data: {
          type: 'link',
          version: '1.0',
          title: 'Test',
        },
        fromCache: true,
      };
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should accept error result', () => {
      const result: OEmbedResult = {
        success: false,
        error: 'Network error',
        errorType: 'NETWORK_ERROR',
      };
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('NETWORK_ERROR');
    });
  });

  describe('OEmbedNodeAttrs', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_OEMBED_NODE_ATTRS.displayMode).toBe('unfurl');
      expect(DEFAULT_OEMBED_NODE_ATTRS.title).toBeNull();
      expect(DEFAULT_OEMBED_NODE_ATTRS.fetchedAt).toBeNull();
    });

    it('should accept full node attributes', () => {
      const attrs: OEmbedNodeAttrs = {
        url: 'https://youtube.com/watch?v=abc',
        displayMode: 'unfurl',
        oembedType: 'video',
        title: 'Test Video',
        description: 'A test video',
        thumbnailUrl: 'https://img.youtube.com/vi/abc/0.jpg',
        thumbnailDataUrl: 'data:image/jpeg;base64,/9j/4AAQ...',
        providerName: 'YouTube',
        providerUrl: 'https://www.youtube.com/',
        authorName: 'Test Author',
        html: '<iframe></iframe>',
        width: 640,
        height: 360,
        fetchedAt: Date.now(),
      };
      expect(attrs.oembedType).toBe('video');
      expect(attrs.displayMode).toBe('unfurl');
    });
  });
});
