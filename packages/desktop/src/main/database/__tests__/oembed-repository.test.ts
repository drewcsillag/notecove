import { OEmbedRepository } from '../oembed-repository';
import type { DatabaseAdapter, OEmbedResponse } from '@notecove/shared';

// Mock DatabaseAdapter
function createMockAdapter(): jest.Mocked<DatabaseAdapter> {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    all: jest.fn(),
    exec: jest.fn(),
    run: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  };
}

describe('OEmbedRepository', () => {
  let adapter: jest.Mocked<DatabaseAdapter>;
  let repository: OEmbedRepository;

  beforeEach(() => {
    adapter = createMockAdapter();
    repository = new OEmbedRepository(adapter);
  });

  describe('Fetch Cache', () => {
    const testUrl = 'https://www.youtube.com/watch?v=abc123';
    const testResponse: OEmbedResponse = {
      type: 'video',
      version: '1.0',
      title: 'Test Video',
      html: '<iframe></iframe>',
      width: 640,
      height: 360,
    };

    describe('getRecentFetch', () => {
      it('should return cached response if within TTL', async () => {
        const now = Date.now();
        adapter.get.mockResolvedValue({
          url: testUrl,
          raw_json: JSON.stringify(testResponse),
          fetched_at: now,
        });

        const result = await repository.getRecentFetch(testUrl, 60000);

        expect(result).toEqual(testResponse);
        expect(adapter.get).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
          testUrl,
          expect.any(Number),
        ]);
      });

      it('should return null if no cache entry exists', async () => {
        adapter.get.mockResolvedValue(null);

        const result = await repository.getRecentFetch(testUrl, 60000);

        expect(result).toBeNull();
      });

      it('should return null for invalid JSON', async () => {
        adapter.get.mockResolvedValue({
          url: testUrl,
          raw_json: 'invalid json',
          fetched_at: Date.now(),
        });

        const result = await repository.getRecentFetch(testUrl, 60000);

        expect(result).toBeNull();
      });
    });

    describe('cacheFetch', () => {
      it('should store response in cache', async () => {
        adapter.exec.mockResolvedValue(undefined);

        await repository.cacheFetch(testUrl, testResponse);

        expect(adapter.exec).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO oembed_fetch_cache'),
          [testUrl, JSON.stringify(testResponse), expect.any(Number)]
        );
      });
    });

    describe('clearFetchCache', () => {
      it('should clear all fetch cache entries', async () => {
        adapter.exec.mockResolvedValue(undefined);

        await repository.clearFetchCache();

        expect(adapter.exec).toHaveBeenCalledWith('DELETE FROM oembed_fetch_cache');
      });
    });

    describe('getAllFetchCacheEntries', () => {
      it('should return all cache entries', async () => {
        const entries = [
          { url: 'url1', raw_json: '{}', fetched_at: 1000 },
          { url: 'url2', raw_json: '{}', fetched_at: 2000 },
        ];
        adapter.all.mockResolvedValue(entries);

        const result = await repository.getAllFetchCacheEntries();

        expect(result).toHaveLength(2);
        expect(result[0]?.url).toBe('url1');
        expect(result[1]?.url).toBe('url2');
      });
    });
  });

  describe('Favicon Cache', () => {
    const testDomain = 'youtube.com';
    const testDataUrl = 'data:image/png;base64,abc123';

    describe('getFavicon', () => {
      it('should return cached favicon', async () => {
        adapter.get.mockResolvedValue({
          domain: testDomain,
          data_url: testDataUrl,
          fetched_at: Date.now(),
        });

        const result = await repository.getFavicon(testDomain);

        expect(result).toBe(testDataUrl);
      });

      it('should return null if not cached', async () => {
        adapter.get.mockResolvedValue(null);

        const result = await repository.getFavicon(testDomain);

        expect(result).toBeNull();
      });
    });

    describe('upsertFavicon', () => {
      it('should store favicon', async () => {
        adapter.exec.mockResolvedValue(undefined);

        await repository.upsertFavicon(testDomain, testDataUrl);

        expect(adapter.exec).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO favicon_cache'),
          [testDomain, testDataUrl, expect.any(Number)]
        );
      });
    });

    describe('deleteFavicon', () => {
      it('should delete favicon', async () => {
        adapter.exec.mockResolvedValue(undefined);

        await repository.deleteFavicon(testDomain);

        expect(adapter.exec).toHaveBeenCalledWith('DELETE FROM favicon_cache WHERE domain = ?', [
          testDomain,
        ]);
      });
    });

    describe('getAllFavicons', () => {
      it('should return all favicons', async () => {
        adapter.all.mockResolvedValue([
          { domain: 'youtube.com', data_url: 'data1', fetched_at: 1000 },
          { domain: 'vimeo.com', data_url: 'data2', fetched_at: 2000 },
        ]);

        const result = await repository.getAllFavicons();

        expect(result).toHaveLength(2);
        expect(result[0]?.domain).toBe('youtube.com');
      });
    });

    describe('getFaviconStats', () => {
      it('should return favicon count', async () => {
        adapter.get.mockResolvedValue({ count: 42 });

        const result = await repository.getFaviconStats();

        expect(result.count).toBe(42);
      });
    });
  });

  describe('Thumbnail Cache', () => {
    const testUrl = 'https://img.youtube.com/vi/abc/0.jpg';
    const testDataUrl = 'data:image/jpeg;base64,xyz789';
    const testSizeBytes = 15000;

    describe('getThumbnail', () => {
      it('should return cached thumbnail', async () => {
        adapter.get.mockResolvedValue({
          url: testUrl,
          data_url: testDataUrl,
          size_bytes: testSizeBytes,
          fetched_at: Date.now(),
        });

        const result = await repository.getThumbnail(testUrl);

        expect(result).toBe(testDataUrl);
      });

      it('should return null if not cached', async () => {
        adapter.get.mockResolvedValue(null);

        const result = await repository.getThumbnail(testUrl);

        expect(result).toBeNull();
      });
    });

    describe('upsertThumbnail', () => {
      it('should store thumbnail', async () => {
        adapter.exec.mockResolvedValue(undefined);

        await repository.upsertThumbnail(testUrl, testDataUrl, testSizeBytes);

        expect(adapter.exec).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO thumbnail_cache'),
          [testUrl, testDataUrl, testSizeBytes, expect.any(Number)]
        );
      });
    });

    describe('deleteThumbnail', () => {
      it('should delete thumbnail', async () => {
        adapter.exec.mockResolvedValue(undefined);

        await repository.deleteThumbnail(testUrl);

        expect(adapter.exec).toHaveBeenCalledWith('DELETE FROM thumbnail_cache WHERE url = ?', [
          testUrl,
        ]);
      });
    });

    describe('getThumbnailStats', () => {
      it('should return thumbnail stats', async () => {
        adapter.get.mockResolvedValue({ count: 10, total: 150000 });

        const result = await repository.getThumbnailStats();

        expect(result.count).toBe(10);
        expect(result.totalSizeBytes).toBe(150000);
      });

      it('should handle null total', async () => {
        adapter.get.mockResolvedValue({ count: 0, total: null });

        const result = await repository.getThumbnailStats();

        expect(result.count).toBe(0);
        expect(result.totalSizeBytes).toBe(0);
      });
    });

    describe('clearThumbnails', () => {
      it('should clear all thumbnails', async () => {
        adapter.exec.mockResolvedValue(undefined);

        await repository.clearThumbnails();

        expect(adapter.exec).toHaveBeenCalledWith('DELETE FROM thumbnail_cache');
      });
    });
  });

  describe('getCacheStats', () => {
    it('should return combined stats', async () => {
      adapter.get
        .mockResolvedValueOnce({ count: 5 }) // fetchCache
        .mockResolvedValueOnce({ count: 10 }) // favicons
        .mockResolvedValueOnce({ count: 20, total: 500000 }); // thumbnails

      const result = await repository.getCacheStats();

      expect(result).toEqual({
        fetchCacheCount: 5,
        faviconCount: 10,
        thumbnailCount: 20,
        thumbnailTotalSizeBytes: 500000,
      });
    });
  });

  describe('Registry Metadata', () => {
    const testHash = 'abc123def456';
    const testProviderCount = 350;
    const testLastCheck = 1700000000000;

    describe('getRegistryHash', () => {
      it('should return stored hash', async () => {
        adapter.get.mockResolvedValue({ value: testHash });

        const result = await repository.getRegistryHash();

        expect(result).toBe(testHash);
        expect(adapter.get).toHaveBeenCalledWith('SELECT value FROM app_state WHERE key = ?', [
          'oembed_registry_hash',
        ]);
      });

      it('should return null if no hash stored', async () => {
        adapter.get.mockResolvedValue(null);

        const result = await repository.getRegistryHash();

        expect(result).toBeNull();
      });
    });

    describe('getRegistryLastCheck', () => {
      it('should return stored timestamp', async () => {
        adapter.get.mockResolvedValue({ value: String(testLastCheck) });

        const result = await repository.getRegistryLastCheck();

        expect(result).toBe(testLastCheck);
        expect(adapter.get).toHaveBeenCalledWith('SELECT value FROM app_state WHERE key = ?', [
          'oembed_registry_last_check',
        ]);
      });

      it('should return null if no timestamp stored', async () => {
        adapter.get.mockResolvedValue(null);

        const result = await repository.getRegistryLastCheck();

        expect(result).toBeNull();
      });

      it('should return null for invalid timestamp', async () => {
        adapter.get.mockResolvedValue({ value: 'not-a-number' });

        const result = await repository.getRegistryLastCheck();

        expect(result).toBeNull();
      });
    });

    describe('getRegistryProviderCount', () => {
      it('should return stored count', async () => {
        adapter.get.mockResolvedValue({ value: String(testProviderCount) });

        const result = await repository.getRegistryProviderCount();

        expect(result).toBe(testProviderCount);
      });

      it('should return null if no count stored', async () => {
        adapter.get.mockResolvedValue(null);

        const result = await repository.getRegistryProviderCount();

        expect(result).toBeNull();
      });
    });

    describe('setRegistryMetadata', () => {
      it('should store hash, timestamp, and provider count', async () => {
        adapter.exec.mockResolvedValue(undefined);

        await repository.setRegistryMetadata(testHash, testProviderCount);

        expect(adapter.exec).toHaveBeenCalledTimes(3);
        expect(adapter.exec).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining('INSERT INTO app_state'),
          ['oembed_registry_hash', testHash]
        );
        expect(adapter.exec).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('INSERT INTO app_state'),
          ['oembed_registry_last_check', expect.any(String)]
        );
        expect(adapter.exec).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining('INSERT INTO app_state'),
          ['oembed_registry_provider_count', String(testProviderCount)]
        );
      });
    });

    describe('getRegistryMetadata', () => {
      it('should return all metadata', async () => {
        adapter.get
          .mockResolvedValueOnce({ value: testHash })
          .mockResolvedValueOnce({ value: String(testLastCheck) })
          .mockResolvedValueOnce({ value: String(testProviderCount) });

        const result = await repository.getRegistryMetadata();

        expect(result).toEqual({
          hash: testHash,
          lastCheck: testLastCheck,
          providerCount: testProviderCount,
        });
      });

      it('should handle missing metadata', async () => {
        adapter.get.mockResolvedValue(null);

        const result = await repository.getRegistryMetadata();

        expect(result).toEqual({
          hash: null,
          lastCheck: null,
          providerCount: null,
        });
      });
    });
  });
});
