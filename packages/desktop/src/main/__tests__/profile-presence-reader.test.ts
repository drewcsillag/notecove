/**
 * ProfilePresenceReader Tests
 *
 * Tests for reading and caching profile presence files from SDs,
 * enabling the Stale Sync UI to show meaningful device/user names.
 *
 * @see plans/stale-sync-ux/PROFILE-PRESENCE.md
 */

import { ProfilePresenceReader } from '../profile-presence-reader';
import type { ProfilePresence, FileSystemAdapter, CachedProfilePresence } from '@notecove/shared';

// Mock database that implements the necessary cache operations
interface MockDatabase {
  cache: Map<string, CachedProfilePresence>;
  getProfilePresenceCache: jest.Mock;
  upsertProfilePresenceCache: jest.Mock;
  getProfilePresenceCacheBySd: jest.Mock;
}

const createMockDb = (): MockDatabase => {
  const cache = new Map<string, CachedProfilePresence>();
  return {
    cache,
    getProfilePresenceCache: jest.fn(async (profileId: string, sdId: string) => {
      return cache.get(`${profileId}:${sdId}`) ?? null;
    }),
    upsertProfilePresenceCache: jest.fn(async (presence: CachedProfilePresence) => {
      cache.set(`${presence.profileId}:${presence.sdId}`, presence);
    }),
    getProfilePresenceCacheBySd: jest.fn(async (sdId: string) => {
      return Array.from(cache.values()).filter((p) => p.sdId === sdId);
    }),
  };
};

// Mock file system for presence file reading
type MockFileSystem = Pick<FileSystemAdapter, 'readFile' | 'exists' | 'joinPath' | 'listFiles'>;

interface MockFileSystemState {
  files: Map<string, string>;
  existingPaths: Set<string>;
}

const createMockFs = (): MockFileSystem & MockFileSystemState & { reset: () => void } => {
  const state: MockFileSystemState = {
    files: new Map(),
    existingPaths: new Set(),
  };

  return {
    files: state.files,
    existingPaths: state.existingPaths,
    reset() {
      state.files.clear();
      state.existingPaths.clear();
    },
    readFile: jest.fn(async (path: string): Promise<Uint8Array> => {
      const content = state.files.get(path);
      if (!content) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return new TextEncoder().encode(content);
    }),
    exists: jest.fn(async (path: string): Promise<boolean> => {
      return state.existingPaths.has(path);
    }),
    joinPath: jest.fn((...segments: string[]): string => segments.join('/')),
    listFiles: jest.fn(async (path: string): Promise<string[]> => {
      // Return files in the given directory
      const prefix = path + '/';
      const entries: string[] = [];
      for (const filePath of state.files.keys()) {
        if (filePath.startsWith(prefix)) {
          const relativePath = filePath.substring(prefix.length);
          // Only include direct children (no subdirectories)
          if (!relativePath.includes('/')) {
            entries.push(relativePath);
          }
        }
      }
      return entries;
    }),
  };
};

describe('ProfilePresenceReader', () => {
  let reader: ProfilePresenceReader;
  let mockDb: MockDatabase;
  let mockFs: ReturnType<typeof createMockFs>;

  const testSdId = 'test-sd-id';
  const testSdPath = '/test/sd';

  const validPresence: ProfilePresence = {
    profileId: 'profile-123',
    instanceId: 'instance-123',
    profileName: 'Test Profile',
    user: '@testuser',
    username: 'Test User',
    hostname: 'test-host.local',
    platform: 'darwin',
    appVersion: '0.1.2',
    lastUpdated: Date.now(),
  };

  beforeEach(() => {
    mockDb = createMockDb();
    mockFs = createMockFs();
    reader = new ProfilePresenceReader(mockFs, mockDb);
  });

  describe('Step 5.1: presence info cached in local DB', () => {
    it('should read presence file and cache it in the database', async () => {
      // Set up a valid presence file
      const presenceFilePath = '/test/sd/profiles/profile-123.json';
      mockFs.files.set(presenceFilePath, JSON.stringify(validPresence));
      mockFs.existingPaths.add('/test/sd/profiles');

      // Read and cache
      const result = await reader.readAndCachePresence(testSdPath, testSdId, 'profile-123');

      // Should return the presence
      expect(result).toBeDefined();
      expect(result?.profileId).toBe('profile-123');
      expect(result?.profileName).toBe('Test Profile');
      expect(result?.user).toBe('@testuser');

      // Should have cached to database
      expect(mockDb.upsertProfilePresenceCache).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-123',
          sdId: testSdId,
          profileName: 'Test Profile',
          user: '@testuser',
          username: 'Test User',
          hostname: 'test-host.local',
          platform: 'darwin',
          appVersion: '0.1.2',
        })
      );
    });

    it('should read all presence files from an SD and cache them', async () => {
      // Set up multiple presence files
      mockFs.existingPaths.add('/test/sd/profiles');
      mockFs.files.set(
        '/test/sd/profiles/profile-1.json',
        JSON.stringify({ ...validPresence, profileId: 'profile-1', profileName: 'Profile 1' })
      );
      mockFs.files.set(
        '/test/sd/profiles/profile-2.json',
        JSON.stringify({ ...validPresence, profileId: 'profile-2', profileName: 'Profile 2' })
      );

      // Read all presence files
      const results = await reader.readAllPresenceFiles(testSdPath, testSdId);

      // Should return both presences
      expect(results).toHaveLength(2);
      expect(results.map((p) => p.profileId)).toContain('profile-1');
      expect(results.map((p) => p.profileId)).toContain('profile-2');

      // Should have cached both to database
      expect(mockDb.upsertProfilePresenceCache).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when profiles directory does not exist', async () => {
      // No profiles directory
      const results = await reader.readAllPresenceFiles(testSdPath, testSdId);

      expect(results).toHaveLength(0);
      expect(mockDb.upsertProfilePresenceCache).not.toHaveBeenCalled();
    });
  });

  describe('Step 5.2: partial/corrupt JSON uses cached value', () => {
    it('should fall back to cached value when JSON is corrupt', async () => {
      // Set up corrupt presence file
      const presenceFilePath = '/test/sd/profiles/profile-123.json';
      mockFs.files.set(presenceFilePath, '{ invalid json that is not parseable');
      mockFs.existingPaths.add('/test/sd/profiles');

      // Set up cached value in database
      const cachedPresence: CachedProfilePresence = {
        profileId: 'profile-123',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Cached Profile',
        user: '@cacheduser',
        username: 'Cached User',
        hostname: 'cached-host.local',
        platform: 'darwin',
        appVersion: '0.1.0',
        lastUpdated: Date.now() - 86400000, // 1 day ago
        cachedAt: Date.now() - 3600000,
      };
      mockDb.cache.set('profile-123:test-sd-id', cachedPresence);

      // Read should fall back to cache
      const result = await reader.readAndCachePresence(testSdPath, testSdId, 'profile-123');

      expect(result).toBeDefined();
      expect(result?.profileName).toBe('Cached Profile');
      expect(result?.user).toBe('@cacheduser');
    });

    it('should fall back to cached value when file is truncated', async () => {
      // Set up truncated presence file (partial JSON)
      const presenceFilePath = '/test/sd/profiles/profile-123.json';
      mockFs.files.set(presenceFilePath, '{"profileId":"profile-123","profileName":"Trunc');
      mockFs.existingPaths.add('/test/sd/profiles');

      // Set up cached value
      const cachedPresence: CachedProfilePresence = {
        profileId: 'profile-123',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Cached Profile',
        user: '@cacheduser',
        username: 'Cached User',
        hostname: 'cached-host.local',
        platform: 'darwin',
        appVersion: '0.1.0',
        lastUpdated: Date.now() - 86400000,
        cachedAt: Date.now() - 3600000,
      };
      mockDb.cache.set('profile-123:test-sd-id', cachedPresence);

      // Read should fall back to cache
      const result = await reader.readAndCachePresence(testSdPath, testSdId, 'profile-123');

      expect(result).toBeDefined();
      expect(result?.profileName).toBe('Cached Profile');
    });

    it('should fall back to cached value when file does not exist', async () => {
      mockFs.existingPaths.add('/test/sd/profiles');
      // No file exists

      // Set up cached value
      const cachedPresence: CachedProfilePresence = {
        profileId: 'profile-123',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Cached Profile',
        user: '@cacheduser',
        username: 'Cached User',
        hostname: 'cached-host.local',
        platform: 'darwin',
        appVersion: '0.1.0',
        lastUpdated: Date.now() - 86400000,
        cachedAt: Date.now() - 3600000,
      };
      mockDb.cache.set('profile-123:test-sd-id', cachedPresence);

      // Read should fall back to cache
      const result = await reader.readAndCachePresence(testSdPath, testSdId, 'profile-123');

      expect(result).toBeDefined();
      expect(result?.profileName).toBe('Cached Profile');
    });

    it('should return null when file is corrupt and no cache exists', async () => {
      // Set up corrupt presence file
      const presenceFilePath = '/test/sd/profiles/profile-123.json';
      mockFs.files.set(presenceFilePath, '{ corrupt json }');
      mockFs.existingPaths.add('/test/sd/profiles');
      // No cached value

      const result = await reader.readAndCachePresence(testSdPath, testSdId, 'profile-123');

      expect(result).toBeNull();
    });

    it('should return null when file does not exist and no cache exists', async () => {
      mockFs.existingPaths.add('/test/sd/profiles');
      // No file, no cache

      const result = await reader.readAndCachePresence(testSdPath, testSdId, 'profile-123');

      expect(result).toBeNull();
    });

    it('should skip corrupt files when reading all presence files', async () => {
      mockFs.existingPaths.add('/test/sd/profiles');

      // One valid, one corrupt
      mockFs.files.set(
        '/test/sd/profiles/profile-1.json',
        JSON.stringify({ ...validPresence, profileId: 'profile-1' })
      );
      mockFs.files.set('/test/sd/profiles/profile-2.json', '{ corrupt }');

      // Set up cached value for corrupt file
      const cachedPresence: CachedProfilePresence = {
        profileId: 'profile-2',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Cached Profile 2',
        user: '@cached2',
        username: 'Cached 2',
        hostname: 'host2.local',
        platform: 'darwin',
        appVersion: '0.1.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };
      mockDb.cache.set('profile-2:test-sd-id', cachedPresence);

      const results = await reader.readAllPresenceFiles(testSdPath, testSdId);

      // Should have 2 results: one from file, one from cache
      expect(results).toHaveLength(2);
      expect(results.find((p) => p.profileId === 'profile-1')?.profileName).toBe('Test Profile');
      expect(results.find((p) => p.profileId === 'profile-2')?.profileName).toBe(
        'Cached Profile 2'
      );
    });
  });

  describe('getPresence (with cache fallback)', () => {
    it('should prefer fresh file data over cached data', async () => {
      // Set up presence file
      const presenceFilePath = '/test/sd/profiles/profile-123.json';
      mockFs.files.set(presenceFilePath, JSON.stringify(validPresence));
      mockFs.existingPaths.add('/test/sd/profiles');

      // Set up older cached value
      const cachedPresence: CachedProfilePresence = {
        profileId: 'profile-123',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Old Cached Name',
        user: '@olduser',
        username: 'Old User',
        hostname: 'old-host.local',
        platform: 'darwin',
        appVersion: '0.0.1',
        lastUpdated: Date.now() - 86400000,
        cachedAt: Date.now() - 3600000,
      };
      mockDb.cache.set('profile-123:test-sd-id', cachedPresence);

      const result = await reader.readAndCachePresence(testSdPath, testSdId, 'profile-123');

      // Should return fresh file data, not cached
      expect(result?.profileName).toBe('Test Profile');
      expect(result?.user).toBe('@testuser');
    });

    it('should update cache when reading fresh file data', async () => {
      // Set up presence file
      const presenceFilePath = '/test/sd/profiles/profile-123.json';
      mockFs.files.set(presenceFilePath, JSON.stringify(validPresence));
      mockFs.existingPaths.add('/test/sd/profiles');

      await reader.readAndCachePresence(testSdPath, testSdId, 'profile-123');

      // Cache should have been updated
      expect(mockDb.upsertProfilePresenceCache).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-123',
          profileName: 'Test Profile',
        })
      );
    });
  });

  describe('getCachedPresenceForSd', () => {
    it('should return all cached presences for an SD', async () => {
      // Set up cached values
      const cached1: CachedProfilePresence = {
        profileId: 'profile-1',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Profile 1',
        user: '@user1',
        username: 'User 1',
        hostname: 'host1.local',
        platform: 'darwin',
        appVersion: '0.1.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };
      const cached2: CachedProfilePresence = {
        profileId: 'profile-2',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Profile 2',
        user: '@user2',
        username: 'User 2',
        hostname: 'host2.local',
        platform: 'win32',
        appVersion: '0.1.1',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };
      mockDb.cache.set('profile-1:test-sd-id', cached1);
      mockDb.cache.set('profile-2:test-sd-id', cached2);

      const results = await reader.getCachedPresenceForSd(testSdId);

      expect(results).toHaveLength(2);
      expect(mockDb.getProfilePresenceCacheBySd).toHaveBeenCalledWith(testSdId);
    });
  });

  describe('getCachedPresence', () => {
    it('should return cached presence for specific profile', async () => {
      const cachedPresence: CachedProfilePresence = {
        profileId: 'profile-123',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Test Profile',
        user: '@testuser',
        username: 'Test User',
        hostname: 'test-host.local',
        platform: 'darwin',
        appVersion: '0.1.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };
      mockDb.cache.set('profile-123:test-sd-id', cachedPresence);

      const result = await reader.getCachedPresence('profile-123', testSdId);

      expect(result).toBeDefined();
      expect(result?.profileName).toBe('Test Profile');
      expect(mockDb.getProfilePresenceCache).toHaveBeenCalledWith('profile-123', testSdId);
    });

    it('should return null when no cached presence exists', async () => {
      const result = await reader.getCachedPresence('non-existent', testSdId);

      expect(result).toBeNull();
    });
  });

  describe('readAllPresenceFiles error handling', () => {
    it('should fall back to cached presences when listFiles throws', async () => {
      // Set up profiles directory to exist
      mockFs.existingPaths.add('/test/sd/profiles');

      // Make listFiles throw an error
      (mockFs.listFiles as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      // Set up cached values
      const cachedPresence: CachedProfilePresence = {
        profileId: 'profile-1',
        instanceId: null,
        sdId: testSdId,
        profileName: 'Cached Profile',
        user: '@cached',
        username: 'Cached User',
        hostname: 'cached.local',
        platform: 'darwin',
        appVersion: '0.1.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };
      mockDb.cache.set('profile-1:test-sd-id', cachedPresence);

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const results = await reader.readAllPresenceFiles(testSdPath, testSdId);

      // Should fall back to cached presences
      expect(results).toHaveLength(1);
      expect(results[0].profileName).toBe('Cached Profile');
      expect(mockDb.getProfilePresenceCacheBySd).toHaveBeenCalledWith(testSdId);

      consoleSpy.mockRestore();
    });
  });
});
