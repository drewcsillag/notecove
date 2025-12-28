import { OEmbedRegistry, createRegistry, schemeToRegex, matchesScheme } from '../registry';
import type { OEmbedProvider } from '../types';
import providersJson from '../providers.json';

describe('oEmbed Registry', () => {
  describe('schemeToRegex', () => {
    it('should convert simple wildcard pattern', () => {
      const regex = schemeToRegex('https://example.com/*');
      expect(regex.test('https://example.com/')).toBe(true);
      expect(regex.test('https://example.com/foo')).toBe(true);
      expect(regex.test('https://example.com/foo/bar')).toBe(true);
      expect(regex.test('http://example.com/foo')).toBe(false);
    });

    it('should convert subdomain wildcard pattern', () => {
      const regex = schemeToRegex('https://*.youtube.com/watch*');
      expect(regex.test('https://www.youtube.com/watch?v=abc123')).toBe(true);
      expect(regex.test('https://m.youtube.com/watch?v=abc123')).toBe(true);
      // Note: *.youtube.com requires a dot, so bare domain doesn't match
      // (the real registry has separate patterns for both cases)
      expect(regex.test('https://youtube.com/watch?v=abc123')).toBe(false);
      expect(regex.test('https://www.youtube.com/playlist')).toBe(false);
    });

    it('should convert pattern with multiple wildcards', () => {
      const regex = schemeToRegex('http://www.23hq.com/*/photo/*');
      expect(regex.test('http://www.23hq.com/user123/photo/456')).toBe(true);
      expect(regex.test('http://www.23hq.com/user/photo/')).toBe(true);
      expect(regex.test('http://www.23hq.com/photo/')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const regex = schemeToRegex('https://example.com/*');
      expect(regex.test('HTTPS://EXAMPLE.COM/foo')).toBe(true);
      expect(regex.test('Https://Example.Com/FOO')).toBe(true);
    });

    it('should escape regex special characters', () => {
      const regex = schemeToRegex('https://example.com/path?query=*');
      expect(regex.test('https://example.com/path?query=value')).toBe(true);
      expect(regex.test('https://example.com/pathXquery=value')).toBe(false);
    });
  });

  describe('matchesScheme', () => {
    it('should return true for matching URLs', () => {
      expect(matchesScheme('https://youtu.be/abc123', 'https://youtu.be/*')).toBe(true);
    });

    it('should return false for non-matching URLs', () => {
      expect(matchesScheme('https://vimeo.com/123', 'https://youtu.be/*')).toBe(false);
    });
  });

  describe('OEmbedRegistry', () => {
    const testProviders: OEmbedProvider[] = [
      {
        provider_name: 'YouTube',
        provider_url: 'https://www.youtube.com/',
        endpoints: [
          {
            schemes: [
              'https://*.youtube.com/watch*',
              'https://*.youtube.com/v/*',
              'https://youtu.be/*',
              'https://*.youtube.com/shorts/*',
            ],
            url: 'https://www.youtube.com/oembed',
            formats: ['json'],
          },
        ],
      },
      {
        provider_name: 'Vimeo',
        provider_url: 'https://vimeo.com/',
        endpoints: [
          {
            schemes: ['https://vimeo.com/*', 'https://player.vimeo.com/video/*'],
            url: 'https://vimeo.com/api/oembed.json',
          },
        ],
      },
      {
        provider_name: 'Twitter',
        provider_url: 'https://twitter.com/',
        endpoints: [
          {
            schemes: ['https://twitter.com/*/status/*', 'https://*.twitter.com/*/status/*'],
            url: 'https://publish.twitter.com/oembed',
          },
        ],
      },
    ];

    let registry: OEmbedRegistry;

    beforeEach(() => {
      registry = new OEmbedRegistry(testProviders);
    });

    describe('constructor and getters', () => {
      it('should create registry with providers', () => {
        expect(registry.providerCount).toBe(3);
      });

      it('should return providers as readonly', () => {
        const providers = registry.getProviders();
        expect(providers).toHaveLength(3);
        expect(providers[0].provider_name).toBe('YouTube');
      });
    });

    describe('findEndpoint', () => {
      it('should find YouTube endpoint for youtube.com URL', () => {
        const result = registry.findEndpoint('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(result).not.toBeNull();
        expect(result!.provider.provider_name).toBe('YouTube');
        expect(result!.endpoint.url).toBe('https://www.youtube.com/oembed');
      });

      it('should find YouTube endpoint for youtu.be URL', () => {
        const result = registry.findEndpoint('https://youtu.be/dQw4w9WgXcQ');
        expect(result).not.toBeNull();
        expect(result!.provider.provider_name).toBe('YouTube');
      });

      it('should find YouTube endpoint for shorts URL', () => {
        const result = registry.findEndpoint('https://www.youtube.com/shorts/abc123');
        expect(result).not.toBeNull();
        expect(result!.provider.provider_name).toBe('YouTube');
      });

      it('should find Vimeo endpoint', () => {
        const result = registry.findEndpoint('https://vimeo.com/123456789');
        expect(result).not.toBeNull();
        expect(result!.provider.provider_name).toBe('Vimeo');
      });

      it('should find Twitter endpoint', () => {
        const result = registry.findEndpoint('https://twitter.com/user/status/123456789');
        expect(result).not.toBeNull();
        expect(result!.provider.provider_name).toBe('Twitter');
      });

      it('should return null for unknown URL', () => {
        const result = registry.findEndpoint('https://example.com/some/path');
        expect(result).toBeNull();
      });

      it('should return null for non-matching URL from known domain', () => {
        const result = registry.findEndpoint('https://www.youtube.com/about');
        expect(result).toBeNull();
      });
    });

    describe('findProvider', () => {
      it('should find provider by exact name', () => {
        const provider = registry.findProvider('YouTube');
        expect(provider).not.toBeNull();
        expect(provider!.provider_name).toBe('YouTube');
      });

      it('should find provider case-insensitively', () => {
        const provider = registry.findProvider('youtube');
        expect(provider).not.toBeNull();
        expect(provider!.provider_name).toBe('YouTube');
      });

      it('should return null for unknown provider', () => {
        const provider = registry.findProvider('Unknown');
        expect(provider).toBeNull();
      });
    });

    describe('buildOEmbedUrl', () => {
      it('should build basic oEmbed URL', () => {
        const endpoint = testProviders[0].endpoints[0];
        const targetUrl = 'https://www.youtube.com/watch?v=abc123';

        const url = registry.buildOEmbedUrl(endpoint, targetUrl);

        expect(url).toContain('https://www.youtube.com/oembed?');
        expect(url).toContain('url=');
        expect(url).toContain(encodeURIComponent(targetUrl));
        expect(url).toContain('format=json');
      });

      it('should include maxwidth and maxheight when provided', () => {
        const endpoint = testProviders[0].endpoints[0];
        const targetUrl = 'https://www.youtube.com/watch?v=abc123';

        const url = registry.buildOEmbedUrl(endpoint, targetUrl, {
          maxWidth: 640,
          maxHeight: 360,
        });

        expect(url).toContain('maxwidth=640');
        expect(url).toContain('maxheight=360');
      });

      it('should replace {format} placeholder in URL', () => {
        const endpoint = {
          url: 'https://example.com/oembed.{format}',
          schemes: ['https://example.com/*'],
        };

        const url = registry.buildOEmbedUrl(endpoint, 'https://example.com/video/123');

        expect(url).toContain('https://example.com/oembed.json?');
      });

      it('should handle URL that already has query parameters', () => {
        const endpoint = {
          url: 'https://example.com/oembed?key=value',
          schemes: ['https://example.com/*'],
        };

        const url = registry.buildOEmbedUrl(endpoint, 'https://example.com/video/123');

        expect(url).toContain('https://example.com/oembed?key=value&');
      });
    });
  });

  describe('createRegistry', () => {
    it('should create registry from providers JSON', () => {
      const registry = createRegistry(testProviders);
      expect(registry).toBeInstanceOf(OEmbedRegistry);
      expect(registry.providerCount).toBe(3);
    });
  });

  describe('Real providers.json', () => {
    let registry: OEmbedRegistry;

    beforeAll(() => {
      registry = createRegistry(providersJson as OEmbedProvider[]);
    });

    it('should load all providers', () => {
      expect(registry.providerCount).toBeGreaterThan(300);
    });

    it('should find YouTube in real registry', () => {
      const result = registry.findEndpoint('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).not.toBeNull();
      expect(result!.provider.provider_name).toBe('YouTube');
    });

    it('should find Vimeo in real registry', () => {
      const result = registry.findEndpoint('https://vimeo.com/123456789');
      expect(result).not.toBeNull();
      expect(result!.provider.provider_name).toBe('Vimeo');
    });

    it('should find X (formerly Twitter) in real registry', () => {
      // Twitter/X URLs should match
      const result = registry.findEndpoint('https://twitter.com/username/status/123456789');
      // Could be Twitter or X depending on registry
      expect(result).not.toBeNull();
    });

    it('should find Spotify in real registry', () => {
      const result = registry.findEndpoint('https://open.spotify.com/track/abc123');
      expect(result).not.toBeNull();
      expect(result!.provider.provider_name).toBe('Spotify');
    });

    it('should find SoundCloud in real registry', () => {
      const result = registry.findEndpoint('https://soundcloud.com/artist/track');
      expect(result).not.toBeNull();
      expect(result!.provider.provider_name).toBe('SoundCloud');
    });

    it('should return null for unknown domain', () => {
      const result = registry.findEndpoint('https://unknowndomain123456.com/video/123');
      expect(result).toBeNull();
    });
  });
});

const testProviders: OEmbedProvider[] = [
  {
    provider_name: 'YouTube',
    provider_url: 'https://www.youtube.com/',
    endpoints: [
      {
        schemes: [
          'https://*.youtube.com/watch*',
          'https://*.youtube.com/v/*',
          'https://youtu.be/*',
          'https://*.youtube.com/shorts/*',
        ],
        url: 'https://www.youtube.com/oembed',
        formats: ['json'],
      },
    ],
  },
  {
    provider_name: 'Vimeo',
    provider_url: 'https://vimeo.com/',
    endpoints: [
      {
        schemes: ['https://vimeo.com/*', 'https://player.vimeo.com/video/*'],
        url: 'https://vimeo.com/api/oembed.json',
      },
    ],
  },
  {
    provider_name: 'Twitter',
    provider_url: 'https://twitter.com/',
    endpoints: [
      {
        schemes: ['https://twitter.com/*/status/*', 'https://*.twitter.com/*/status/*'],
        url: 'https://publish.twitter.com/oembed',
      },
    ],
  },
];
