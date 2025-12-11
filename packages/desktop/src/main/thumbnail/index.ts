/**
 * Thumbnail module
 * Provides thumbnail generation and caching for images
 *
 * @see plans/add-images/PLAN-PHASE-5.md
 */

export { ThumbnailGenerator, ThumbnailSpec, type ThumbnailResult } from './thumbnail-generator';
export {
  ThumbnailCacheManager,
  type ThumbnailCacheConfig,
  type CleanupResult,
  type CacheStats,
  type SdCacheStats,
  type FullCleanupResult,
  type ImageExistsCheck,
} from './thumbnail-cache-manager';
