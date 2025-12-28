/**
 * oEmbed types based on the oEmbed specification (https://oembed.com/)
 *
 * oEmbed is a format for allowing an embedded representation of a URL on third party sites.
 */

// ============================================================================
// oEmbed Response Types
// ============================================================================

/** The type of oEmbed response */
export type OEmbedType = 'photo' | 'video' | 'link' | 'rich';

/** Base fields common to all oEmbed response types */
export interface OEmbedResponseBase {
  /** The oEmbed version number. Must be 1.0. */
  version: '1.0';
  /** The resource type */
  type: OEmbedType;
  /** A text title describing the resource */
  title?: string;
  /** The name of the author/owner of the resource */
  author_name?: string;
  /** A URL for the author/owner of the resource */
  author_url?: string;
  /** The name of the resource provider */
  provider_name?: string;
  /** The URL of the resource provider */
  provider_url?: string;
  /** The suggested cache lifetime for this resource, in seconds */
  cache_age?: number;
  /** A URL to a thumbnail image representing the resource */
  thumbnail_url?: string;
  /** The width of the thumbnail */
  thumbnail_width?: number;
  /** The height of the thumbnail */
  thumbnail_height?: number;
}

/** Photo response - represents a static photo */
export interface OEmbedPhotoResponse extends OEmbedResponseBase {
  type: 'photo';
  /** The source URL of the image (required) */
  url: string;
  /** The width in pixels of the image (required) */
  width: number;
  /** The height in pixels of the image (required) */
  height: number;
}

/** Video response - represents playable video */
export interface OEmbedVideoResponse extends OEmbedResponseBase {
  type: 'video';
  /** The HTML required to embed a video player (required) */
  html: string;
  /** The width in pixels required to display the HTML (required) */
  width: number;
  /** The height in pixels required to display the HTML (required) */
  height: number;
}

/** Link response - generic embed type for links */
export interface OEmbedLinkResponse extends OEmbedResponseBase {
  type: 'link';
}

/** Rich response - generic embed type with HTML */
export interface OEmbedRichResponse extends OEmbedResponseBase {
  type: 'rich';
  /** The HTML required to display the resource (required) */
  html: string;
  /** The width in pixels required to display the HTML (required) */
  width: number;
  /** The height in pixels required to display the HTML (required) */
  height: number;
}

/** Union of all oEmbed response types */
export type OEmbedResponse =
  | OEmbedPhotoResponse
  | OEmbedVideoResponse
  | OEmbedLinkResponse
  | OEmbedRichResponse;

// ============================================================================
// Provider Registry Types
// ============================================================================

/** An endpoint configuration for an oEmbed provider */
export interface OEmbedProviderEndpoint {
  /** URL schemes that this endpoint handles (glob patterns like "https://*.youtube.com/*") */
  schemes?: string[];
  /** The oEmbed endpoint URL */
  url: string;
  /** Whether this endpoint supports oEmbed discovery */
  discovery?: boolean;
  /** Supported response formats */
  formats?: ('json' | 'xml')[];
}

/** A provider in the oEmbed registry */
export interface OEmbedProvider {
  /** The name of the provider */
  provider_name: string;
  /** The provider's website URL */
  provider_url: string;
  /** The provider's oEmbed endpoints */
  endpoints: OEmbedProviderEndpoint[];
}

// ============================================================================
// API Result Types
// ============================================================================

/** Result of an unfurl operation */
export interface OEmbedResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** The oEmbed data if successful */
  data?: OEmbedResponse;
  /** Error message if unsuccessful */
  error?: string;
  /** Error type for programmatic handling */
  errorType?: OEmbedErrorType;
  /** Whether this result came from cache */
  fromCache?: boolean;
}

/** Types of errors that can occur during oEmbed operations */
export type OEmbedErrorType =
  | 'NETWORK_ERROR' // Failed to connect
  | 'TIMEOUT' // Request timed out
  | 'PROVIDER_ERROR' // Provider returned an error
  | 'INVALID_RESPONSE' // Response wasn't valid oEmbed
  | 'NOT_FOUND' // No provider and discovery failed
  | 'RATE_LIMITED' // Too many requests
  | 'OFFLINE'; // Device is offline

/** Options for unfurl operations */
export interface UnfurlOptions {
  /** Maximum width hint for the provider */
  maxWidth?: number;
  /** Maximum height hint for the provider */
  maxHeight?: number;
  /** Skip the local cache and force a fresh fetch */
  skipCache?: boolean;
  /** Skip oEmbed discovery for providers not in registry */
  skipDiscovery?: boolean;
}

// ============================================================================
// Node Attribute Types (for document storage)
// ============================================================================

/** oEmbed data stored as node attributes in the document CRDT */
export interface OEmbedNodeAttrs {
  /** The URL being unfurled */
  url: string;
  /** Display mode preference */
  displayMode: 'unfurl' | 'chip' | 'link';
  /** The oEmbed response type */
  oembedType: OEmbedType | null;
  /** Title from oEmbed response */
  title: string | null;
  /** Description (may come from provider or page) */
  description: string | null;
  /** Original thumbnail URL */
  thumbnailUrl: string | null;
  /** Cached thumbnail as base64 data URL (for offline) */
  thumbnailDataUrl: string | null;
  /** Provider name */
  providerName: string | null;
  /** Provider URL */
  providerUrl: string | null;
  /** Author name */
  authorName: string | null;
  /** HTML content for video/rich embeds */
  html: string | null;
  /** Width of embedded content */
  width: number | null;
  /** Height of embedded content */
  height: number | null;
  /** Timestamp when this data was fetched */
  fetchedAt: number | null;
}

/** Default values for OEmbedNodeAttrs */
export const DEFAULT_OEMBED_NODE_ATTRS: OEmbedNodeAttrs = {
  url: '',
  displayMode: 'unfurl',
  oembedType: null,
  title: null,
  description: null,
  thumbnailUrl: null,
  thumbnailDataUrl: null,
  providerName: null,
  providerUrl: null,
  authorName: null,
  html: null,
  width: null,
  height: null,
  fetchedAt: null,
};

// ============================================================================
// Cache Types (for database)
// ============================================================================

/** Favicon cache entry */
export interface FaviconCacheEntry {
  domain: string;
  dataUrl: string;
  fetchedAt: number;
}

/** Thumbnail cache entry */
export interface ThumbnailCacheEntry {
  url: string;
  dataUrl: string;
  sizeBytes: number;
  fetchedAt: number;
}

/** Cache statistics */
export interface OEmbedCacheStats {
  thumbnails: {
    count: number;
    totalSizeBytes: number;
  };
  favicons: {
    count: number;
  };
}
