/**
 * oEmbed Repository
 * Handles caching operations for oEmbed data, favicons, and thumbnails.
 *
 * Note: The actual oEmbed response data is stored in document CRDT, not here.
 * This repository is only for:
 * 1. Session-level fetch cache (to deduplicate fetches)
 * 2. Favicon cache (shared across all documents)
 * 3. Thumbnail cache (shared across all documents)
 */

import type {
  DatabaseAdapter,
  FaviconCache,
  ThumbnailCache,
  OEmbedFetchCache,
  OEmbedResponse,
} from '@notecove/shared';

export class OEmbedRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  // ============================================
  // Fetch Cache (Session-level deduplication)
  // ============================================

  /**
   * Get a recent oEmbed fetch if it exists and isn't too old
   */
  async getRecentFetch(url: string, maxAgeMs: number): Promise<OEmbedResponse | null> {
    const minFetchedAt = Date.now() - maxAgeMs;

    const row = await this.adapter.get<{
      url: string;
      raw_json: string;
      fetched_at: number;
    }>('SELECT * FROM oembed_fetch_cache WHERE url = ? AND fetched_at >= ?', [url, minFetchedAt]);

    if (!row) return null;

    try {
      return JSON.parse(row.raw_json) as OEmbedResponse;
    } catch {
      return null;
    }
  }

  /**
   * Cache an oEmbed response
   */
  async cacheFetch(url: string, data: OEmbedResponse): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO oembed_fetch_cache (url, raw_json, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         raw_json = excluded.raw_json,
         fetched_at = excluded.fetched_at`,
      [url, JSON.stringify(data), Date.now()]
    );
  }

  /**
   * Clear the fetch cache (e.g., on session end)
   */
  async clearFetchCache(): Promise<void> {
    await this.adapter.exec('DELETE FROM oembed_fetch_cache');
  }

  /**
   * Get all fetch cache entries (for debugging)
   */
  async getAllFetchCacheEntries(): Promise<OEmbedFetchCache[]> {
    const rows = await this.adapter.all<{
      url: string;
      raw_json: string;
      fetched_at: number;
    }>('SELECT * FROM oembed_fetch_cache ORDER BY fetched_at DESC');

    return rows.map((row) => ({
      url: row.url,
      rawJson: row.raw_json,
      fetchedAt: row.fetched_at,
    }));
  }

  // ============================================
  // Favicon Cache
  // ============================================

  /**
   * Get cached favicon for a domain
   */
  async getFavicon(domain: string): Promise<string | null> {
    const row = await this.adapter.get<{
      domain: string;
      data_url: string;
      fetched_at: number;
    }>('SELECT * FROM favicon_cache WHERE domain = ?', [domain]);

    return row?.data_url ?? null;
  }

  /**
   * Upsert a favicon
   */
  async upsertFavicon(domain: string, dataUrl: string): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO favicon_cache (domain, data_url, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(domain) DO UPDATE SET
         data_url = excluded.data_url,
         fetched_at = excluded.fetched_at`,
      [domain, dataUrl, Date.now()]
    );
  }

  /**
   * Delete cached favicon for a domain
   */
  async deleteFavicon(domain: string): Promise<void> {
    await this.adapter.exec('DELETE FROM favicon_cache WHERE domain = ?', [domain]);
  }

  /**
   * Get all cached favicons (for debugging)
   */
  async getAllFavicons(): Promise<FaviconCache[]> {
    const rows = await this.adapter.all<{
      domain: string;
      data_url: string;
      fetched_at: number;
    }>('SELECT * FROM favicon_cache ORDER BY fetched_at DESC');

    return rows.map((row) => ({
      domain: row.domain,
      dataUrl: row.data_url,
      fetchedAt: row.fetched_at,
    }));
  }

  /**
   * Get favicon cache stats
   */
  async getFaviconStats(): Promise<{ count: number }> {
    const row = await this.adapter.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM favicon_cache'
    );
    return { count: row?.count ?? 0 };
  }

  // ============================================
  // Thumbnail Cache
  // ============================================

  /**
   * Get cached thumbnail for a URL
   */
  async getThumbnail(url: string): Promise<string | null> {
    const row = await this.adapter.get<{
      url: string;
      data_url: string;
      size_bytes: number;
      fetched_at: number;
    }>('SELECT * FROM thumbnail_cache WHERE url = ?', [url]);

    return row?.data_url ?? null;
  }

  /**
   * Upsert a thumbnail
   */
  async upsertThumbnail(url: string, dataUrl: string, sizeBytes: number): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO thumbnail_cache (url, data_url, size_bytes, fetched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         data_url = excluded.data_url,
         size_bytes = excluded.size_bytes,
         fetched_at = excluded.fetched_at`,
      [url, dataUrl, sizeBytes, Date.now()]
    );
  }

  /**
   * Delete cached thumbnail for a URL
   */
  async deleteThumbnail(url: string): Promise<void> {
    await this.adapter.exec('DELETE FROM thumbnail_cache WHERE url = ?', [url]);
  }

  /**
   * Get all cached thumbnails (for debugging)
   */
  async getAllThumbnails(): Promise<ThumbnailCache[]> {
    const rows = await this.adapter.all<{
      url: string;
      data_url: string;
      size_bytes: number;
      fetched_at: number;
    }>('SELECT * FROM thumbnail_cache ORDER BY fetched_at DESC');

    return rows.map((row) => ({
      url: row.url,
      dataUrl: row.data_url,
      sizeBytes: row.size_bytes,
      fetchedAt: row.fetched_at,
    }));
  }

  /**
   * Get thumbnail cache stats
   */
  async getThumbnailStats(): Promise<{ count: number; totalSizeBytes: number }> {
    const row = await this.adapter.get<{ count: number; total: number | null }>(
      'SELECT COUNT(*) as count, SUM(size_bytes) as total FROM thumbnail_cache'
    );
    return {
      count: row?.count ?? 0,
      totalSizeBytes: row?.total ?? 0,
    };
  }

  /**
   * Clear all thumbnails (for cache management)
   */
  async clearThumbnails(): Promise<void> {
    await this.adapter.exec('DELETE FROM thumbnail_cache');
  }

  // ============================================
  // Combined Stats
  // ============================================

  /**
   * Get combined cache statistics
   */
  async getCacheStats(): Promise<{
    fetchCacheCount: number;
    faviconCount: number;
    thumbnailCount: number;
    thumbnailTotalSizeBytes: number;
  }> {
    const [fetchCache, favicons, thumbnails] = await Promise.all([
      this.adapter.get<{ count: number }>('SELECT COUNT(*) as count FROM oembed_fetch_cache'),
      this.getFaviconStats(),
      this.getThumbnailStats(),
    ]);

    return {
      fetchCacheCount: fetchCache?.count ?? 0,
      faviconCount: favicons.count,
      thumbnailCount: thumbnails.count,
      thumbnailTotalSizeBytes: thumbnails.totalSizeBytes,
    };
  }
}
