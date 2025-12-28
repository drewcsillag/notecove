/**
 * Provider Embed Utilities Tests
 */

import {
  getYouTubeEmbed,
  getVimeoEmbed,
  getDailymotionEmbed,
  getLoomEmbed,
  getProviderEmbed,
  isAllowedRichProvider,
  isVideoUrl,
  getVideoThumbnailUrl,
} from '../providerEmbed';

describe('providerEmbed utilities', () => {
  describe('getYouTubeEmbed', () => {
    it('extracts video ID from youtube.com/watch URL', () => {
      const result = getYouTubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(result).toEqual({
        type: 'video',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        aspectRatio: 16 / 9,
        provider: 'YouTube',
      });
    });

    it('extracts video ID from youtu.be URL', () => {
      const result = getYouTubeEmbed('https://youtu.be/dQw4w9WgXcQ');

      expect(result).toEqual({
        type: 'video',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        aspectRatio: 16 / 9,
        provider: 'YouTube',
      });
    });

    it('extracts video ID from youtube.com/embed URL', () => {
      const result = getYouTubeEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ');

      expect(result).toEqual({
        type: 'video',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        aspectRatio: 16 / 9,
        provider: 'YouTube',
      });
    });

    it('extracts video ID from youtube.com/shorts URL', () => {
      const result = getYouTubeEmbed('https://www.youtube.com/shorts/abc123xyz12');

      expect(result).toEqual({
        type: 'video',
        embedUrl: 'https://www.youtube.com/embed/abc123xyz12',
        aspectRatio: 16 / 9,
        provider: 'YouTube',
      });
    });

    it('handles URL with additional parameters', () => {
      const result = getYouTubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120');

      expect(result?.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('returns null for non-YouTube URL', () => {
      const result = getYouTubeEmbed('https://vimeo.com/123456');

      expect(result).toBeNull();
    });
  });

  describe('getVimeoEmbed', () => {
    it('extracts video ID from vimeo.com URL', () => {
      const result = getVimeoEmbed('https://vimeo.com/123456789');

      expect(result).toEqual({
        type: 'video',
        embedUrl: 'https://player.vimeo.com/video/123456789',
        aspectRatio: 16 / 9,
        provider: 'Vimeo',
      });
    });

    it('extracts video ID from player.vimeo.com URL', () => {
      const result = getVimeoEmbed('https://player.vimeo.com/video/123456789');

      expect(result).toEqual({
        type: 'video',
        embedUrl: 'https://player.vimeo.com/video/123456789',
        aspectRatio: 16 / 9,
        provider: 'Vimeo',
      });
    });

    it('returns null for non-Vimeo URL', () => {
      const result = getVimeoEmbed('https://youtube.com/watch?v=abc');

      expect(result).toBeNull();
    });
  });

  describe('getDailymotionEmbed', () => {
    it('extracts video ID from dailymotion.com URL', () => {
      const result = getDailymotionEmbed('https://www.dailymotion.com/video/x7abcde');

      expect(result).toEqual({
        type: 'video',
        embedUrl: 'https://www.dailymotion.com/embed/video/x7abcde',
        aspectRatio: 16 / 9,
        provider: 'Dailymotion',
      });
    });

    it('returns null for non-Dailymotion URL', () => {
      const result = getDailymotionEmbed('https://youtube.com/watch?v=abc');

      expect(result).toBeNull();
    });
  });

  describe('getLoomEmbed', () => {
    it('extracts video ID from loom.com/share URL', () => {
      const result = getLoomEmbed('https://www.loom.com/share/abc123def456');

      expect(result).toEqual({
        type: 'video',
        embedUrl: 'https://www.loom.com/embed/abc123def456',
        aspectRatio: 16 / 9,
        provider: 'Loom',
      });
    });

    it('returns null for non-Loom URL', () => {
      const result = getLoomEmbed('https://youtube.com/watch?v=abc');

      expect(result).toBeNull();
    });
  });

  describe('isAllowedRichProvider', () => {
    it('returns true for allowed providers', () => {
      expect(isAllowedRichProvider('https://youtube.com')).toBe(true);
      expect(isAllowedRichProvider('https://twitter.com')).toBe(true);
      expect(isAllowedRichProvider('https://x.com')).toBe(true);
      expect(isAllowedRichProvider('https://spotify.com')).toBe(true);
      expect(isAllowedRichProvider('https://gist.github.com')).toBe(true);
    });

    it('returns false for disallowed providers', () => {
      expect(isAllowedRichProvider('https://malicious-site.com')).toBe(false);
      expect(isAllowedRichProvider('https://example.com')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isAllowedRichProvider(undefined)).toBe(false);
    });
  });

  describe('getProviderEmbed', () => {
    it('returns YouTube embed for YouTube URL', () => {
      const result = getProviderEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(result?.type).toBe('video');
      expect(result?.embedUrl).toContain('youtube.com/embed');
    });

    it('returns Vimeo embed for Vimeo URL', () => {
      const result = getProviderEmbed('https://vimeo.com/123456789');

      expect(result?.type).toBe('video');
      expect(result?.embedUrl).toContain('player.vimeo.com');
    });

    it('returns embed from oEmbed data for video type', () => {
      const result = getProviderEmbed('https://example.com/video', {
        type: 'video',
        version: '1.0',
        html: '<iframe src="..."></iframe>',
        width: 640,
        height: 360,
        provider_name: 'Example',
      });

      expect(result?.type).toBe('video');
      expect(result?.embedHtml).toBe('<iframe src="..."></iframe>');
      expect(result?.aspectRatio).toBeCloseTo(640 / 360);
    });

    it('returns embed from oEmbed data for rich type from allowed provider', () => {
      const result = getProviderEmbed('https://twitter.com/status/123', {
        type: 'rich',
        version: '1.0',
        html: '<blockquote>Tweet</blockquote>',
        provider_url: 'https://twitter.com',
      });

      expect(result?.type).toBe('rich');
      expect(result?.embedHtml).toBe('<blockquote>Tweet</blockquote>');
    });

    it('returns null for rich type from disallowed provider', () => {
      const result = getProviderEmbed('https://example.com/page', {
        type: 'rich',
        version: '1.0',
        html: '<script>evil()</script>',
        provider_url: 'https://malicious.com',
      });

      expect(result).toBeNull();
    });

    it('returns null for link type', () => {
      const result = getProviderEmbed('https://example.com/article', {
        type: 'link',
        version: '1.0',
      });

      expect(result).toBeNull();
    });

    it('returns null for invalid URL', () => {
      const result = getProviderEmbed('not-a-valid-url');

      expect(result).toBeNull();
    });
  });

  describe('isVideoUrl', () => {
    it('returns true for YouTube URLs', () => {
      expect(isVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('returns true for Vimeo URLs', () => {
      expect(isVideoUrl('https://vimeo.com/123456789')).toBe(true);
    });

    it('returns false for non-video URLs', () => {
      expect(isVideoUrl('https://example.com/article')).toBe(false);
      expect(isVideoUrl('https://github.com/user/repo')).toBe(false);
    });
  });

  describe('getVideoThumbnailUrl', () => {
    it('returns YouTube thumbnail URL', () => {
      const result = getVideoThumbnailUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(result).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    });

    it('returns null for non-YouTube videos', () => {
      const result = getVideoThumbnailUrl('https://vimeo.com/123456789');

      expect(result).toBeNull();
    });

    it('returns null for non-video URLs', () => {
      const result = getVideoThumbnailUrl('https://example.com/article');

      expect(result).toBeNull();
    });
  });
});
