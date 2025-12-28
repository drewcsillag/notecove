/**
 * Provider Embed Utilities
 *
 * Extracts embed URLs and determines embed types for various video/rich providers.
 */

import type { OEmbedResponse } from '@notecove/shared';

/**
 * Embed information for a provider
 */
export interface ProviderEmbed {
  /** Type of embed */
  type: 'video' | 'rich';
  /** Embed URL for iframe src (for video type) */
  embedUrl?: string | undefined;
  /** HTML content for embedding (for rich type) */
  embedHtml?: string | undefined;
  /** Aspect ratio (width / height) */
  aspectRatio?: number | undefined;
  /** Provider name */
  provider?: string | undefined;
}

/**
 * Extract YouTube video ID and create embed URL
 */
export function getYouTubeEmbed(url: string): ProviderEmbed | null {
  // Match various YouTube URL formats:
  // - youtube.com/watch?v=VIDEO_ID
  // - youtube.com/watch?v=VIDEO_ID&t=123
  // - youtu.be/VIDEO_ID
  // - youtube.com/embed/VIDEO_ID
  // - youtube.com/v/VIDEO_ID
  // - youtube.com/shorts/VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return {
        type: 'video',
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        aspectRatio: 16 / 9,
        provider: 'YouTube',
      };
    }
  }
  return null;
}

/**
 * Extract Vimeo video ID and create embed URL
 */
export function getVimeoEmbed(url: string): ProviderEmbed | null {
  // Match: vimeo.com/VIDEO_ID or player.vimeo.com/video/VIDEO_ID
  const match = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (match) {
    const videoId = match[1];
    return {
      type: 'video',
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
      aspectRatio: 16 / 9,
      provider: 'Vimeo',
    };
  }
  return null;
}

/**
 * Extract Dailymotion video ID and create embed URL
 */
export function getDailymotionEmbed(url: string): ProviderEmbed | null {
  // Match: dailymotion.com/video/VIDEO_ID
  const match = /dailymotion\.com\/video\/([a-zA-Z0-9]+)/.exec(url);
  if (match) {
    const videoId = match[1];
    return {
      type: 'video',
      embedUrl: `https://www.dailymotion.com/embed/video/${videoId}`,
      aspectRatio: 16 / 9,
      provider: 'Dailymotion',
    };
  }
  return null;
}

/**
 * Extract Twitch embed URL
 */
export function getTwitchEmbed(url: string): ProviderEmbed | null {
  // Match: twitch.tv/CHANNEL or twitch.tv/videos/VIDEO_ID
  const channelMatch = /twitch\.tv\/([a-zA-Z0-9_]+)(?:\/|$)/.exec(url);
  const videoMatch = /twitch\.tv\/videos\/(\d+)/.exec(url);

  if (videoMatch) {
    const videoId = videoMatch[1];
    return {
      type: 'video',
      embedUrl: `https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}`,
      aspectRatio: 16 / 9,
      provider: 'Twitch',
    };
  }

  if (channelMatch && channelMatch[1] !== 'videos') {
    const channel = channelMatch[1];
    return {
      type: 'video',
      embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`,
      aspectRatio: 16 / 9,
      provider: 'Twitch',
    };
  }

  return null;
}

/**
 * Extract Loom embed URL
 */
export function getLoomEmbed(url: string): ProviderEmbed | null {
  // Match: loom.com/share/VIDEO_ID
  const match = /loom\.com\/share\/([a-zA-Z0-9]+)/.exec(url);
  if (match) {
    const videoId = match[1];
    return {
      type: 'video',
      embedUrl: `https://www.loom.com/embed/${videoId}`,
      aspectRatio: 16 / 9,
      provider: 'Loom',
    };
  }
  return null;
}

/**
 * Allowed providers for rich HTML embeds
 * Only these providers are allowed to render arbitrary HTML
 */
const ALLOWED_RICH_PROVIDERS = [
  'youtube.com',
  'vimeo.com',
  'twitter.com',
  'x.com',
  'spotify.com',
  'soundcloud.com',
  'codepen.io',
  'codesandbox.io',
  'figma.com',
  'gist.github.com',
  'github.com',
  'loom.com',
  'miro.com',
  'twitch.tv',
];

/**
 * Check if a provider URL is allowed for rich HTML embedding
 */
export function isAllowedRichProvider(providerUrl: string | undefined): boolean {
  if (!providerUrl) return false;
  return ALLOWED_RICH_PROVIDERS.some((p) => providerUrl.includes(p));
}

/**
 * Partial oEmbed data for provider detection
 */
interface PartialOEmbedData {
  type: 'video' | 'rich' | 'link' | 'photo';
  version: '1.0';
  html?: string;
  width?: number;
  height?: number;
  provider_name?: string;
  provider_url?: string;
  thumbnail_url?: string;
  title?: string;
}

/**
 * Get provider embed information from URL and oEmbed data
 *
 * @param url The original URL
 * @param oembedData The oEmbed response (optional)
 * @returns Embed information or null
 */
export function getProviderEmbed(
  url: string,
  oembedData?: PartialOEmbedData | OEmbedResponse | null
): ProviderEmbed | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // Try provider-specific extractors first (more reliable)
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) {
      return getYouTubeEmbed(url);
    }
    if (hostname.includes('vimeo')) {
      return getVimeoEmbed(url);
    }
    if (hostname.includes('dailymotion')) {
      return getDailymotionEmbed(url);
    }
    if (hostname.includes('twitch')) {
      return getTwitchEmbed(url);
    }
    if (hostname.includes('loom')) {
      return getLoomEmbed(url);
    }

    // Fall back to oEmbed data if available
    if (oembedData) {
      // Video type with HTML (from oEmbed response)
      if (oembedData.type === 'video' && 'html' in oembedData && oembedData.html) {
        return {
          type: 'video',
          embedHtml: oembedData.html,
          aspectRatio:
            'width' in oembedData && 'height' in oembedData && oembedData.width && oembedData.height
              ? oembedData.width / oembedData.height
              : 16 / 9,
          provider: oembedData.provider_name,
        };
      }

      // Rich type (from oEmbed response) - only if from allowed provider
      if (oembedData.type === 'rich' && 'html' in oembedData && oembedData.html) {
        if (isAllowedRichProvider(oembedData.provider_url)) {
          return {
            type: 'rich',
            embedHtml: oembedData.html,
            aspectRatio:
              'width' in oembedData &&
              'height' in oembedData &&
              oembedData.width &&
              oembedData.height
                ? oembedData.width / oembedData.height
                : undefined,
            provider: oembedData.provider_name,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a video URL that we can embed
 */
export function isVideoUrl(url: string): boolean {
  return getProviderEmbed(url) !== null;
}

/**
 * Get thumbnail URL for a video
 * Some providers have predictable thumbnail URLs
 */
export function getVideoThumbnailUrl(url: string): string | null {
  const embed = getProviderEmbed(url);
  if (!embed) return null;

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // YouTube thumbnails are predictable
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) {
      const match =
        /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/.exec(
          url
        );
      if (match) {
        return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
      }
    }

    // Vimeo thumbnails require API call, skip for now
    // Other providers vary

    return null;
  } catch {
    return null;
  }
}
