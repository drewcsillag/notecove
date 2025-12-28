/**
 * oEmbed module exports
 */

export { OEmbedService, type UnfurlOptions } from './oembed-service';
export { discoverOEmbedEndpoint, type DiscoveryResult } from './oembed-discovery';
export { FaviconService } from './favicon-service';
export { ThumbnailProxy } from './thumbnail-proxy';

// Re-export types from shared
export type { OEmbedResult, OEmbedErrorType, OEmbedResponse } from '@notecove/shared';
