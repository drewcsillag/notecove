/**
 * ProfilePresenceManager Tests
 *
 * Tests for writing profile presence files to SDs, which allows devices
 * to identify each other in the Stale Sync UI.
 */

import { ProfilePresenceManager } from '../profile-presence-manager';
import type { ProfilePresence, Database, FileSystemAdapter } from '@notecove/shared';

// Required subset of FileSystemAdapter for ProfilePresenceManager
type MockFileSystem = Pick<FileSystemAdapter, 'writeFile' | 'mkdir' | 'exists' | 'joinPath'> & {
  writtenFiles: Map<string, string>;
  existingDirs: Set<string>;
  mkdirCalls: string[];
  reset: () => void;
};

// Mock file system
const mockFs: MockFileSystem = {
  writtenFiles: new Map(),
  existingDirs: new Set(),
  mkdirCalls: [],
  reset() {
    this.writtenFiles.clear();
    this.existingDirs.clear();
    this.mkdirCalls = [];
  },
  writeFile: jest.fn(async (path: string, data: Uint8Array) => {
    mockFs.writtenFiles.set(path, new TextDecoder().decode(data));
  }),
  mkdir: jest.fn(async (path: string) => {
    mockFs.mkdirCalls.push(path);
    mockFs.existingDirs.add(path);
  }),
  exists: jest.fn(async (path: string) => mockFs.existingDirs.has(path)),
  joinPath: jest.fn((...segments: string[]) => segments.join('/')),
};

// Mock database
const mockDb = {
  getState: jest.fn(),
} as unknown as Database;

describe('ProfilePresenceManager', () => {
  let manager: ProfilePresenceManager;

  const testConfig = {
    profileId: 'test-profile-123',
    instanceId: 'test-instance-456',
    profileName: 'Test Profile',
    hostname: 'test-host.local',
    platform: 'darwin' as const,
    appVersion: '0.1.2',
  };

  beforeEach(() => {
    mockFs.reset();
    jest.clearAllMocks();
    (mockDb.getState as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'userHandle') return '@testuser';
      if (key === 'username') return 'Test User';
      return null;
    });

    manager = new ProfilePresenceManager(mockFs, mockDb, testConfig);
  });

  describe('writePresence', () => {
    it('should write presence file to SD profiles directory', async () => {
      const sdPath = '/test/sd';

      await manager.writePresence(sdPath);

      // Should have written to the correct path
      expect(mockFs.writtenFiles.has('/test/sd/profiles/test-profile-123.json')).toBe(true);
    });

    it('should create profiles directory if it does not exist', async () => {
      const sdPath = '/test/sd';

      await manager.writePresence(sdPath);

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/sd/profiles');
    });

    it('should include all profile presence fields', async () => {
      const sdPath = '/test/sd';

      await manager.writePresence(sdPath);

      const writtenContent = mockFs.writtenFiles.get('/test/sd/profiles/test-profile-123.json');
      expect(writtenContent).toBeDefined();

      const presence: ProfilePresence = JSON.parse(writtenContent!);
      expect(presence.profileId).toBe('test-profile-123');
      expect(presence.instanceId).toBe('test-instance-456');
      // CRITICAL: instanceId must be different from profileId
      // This ensures each app installation has a unique identity, separate from the profile
      expect(presence.instanceId).not.toBe(presence.profileId);
      expect(presence.profileName).toBe('Test Profile');
      expect(presence.user).toBe('@testuser');
      expect(presence.username).toBe('Test User');
      expect(presence.hostname).toBe('test-host.local');
      expect(presence.platform).toBe('darwin');
      expect(presence.appVersion).toBe('0.1.2');
      expect(typeof presence.lastUpdated).toBe('number');
    });

    it('should use default values when user settings are not configured', async () => {
      (mockDb.getState as jest.Mock).mockResolvedValue(null);
      const sdPath = '/test/sd';

      await manager.writePresence(sdPath);

      const writtenContent = mockFs.writtenFiles.get('/test/sd/profiles/test-profile-123.json');
      const presence: ProfilePresence = JSON.parse(writtenContent!);

      expect(presence.user).toBe(''); // Empty string when not configured
      expect(presence.username).toBe(''); // Empty string when not configured
    });

    it('should write to multiple SDs', async () => {
      const sd1Path = '/sd1';
      const sd2Path = '/sd2';

      await manager.writePresence(sd1Path);
      await manager.writePresence(sd2Path);

      expect(mockFs.writtenFiles.has('/sd1/profiles/test-profile-123.json')).toBe(true);
      expect(mockFs.writtenFiles.has('/sd2/profiles/test-profile-123.json')).toBe(true);
    });
  });

  describe('writePresenceToAllSDs', () => {
    it('should write presence to all connected SDs', async () => {
      const sdPaths = ['/sd1', '/sd2', '/sd3'];

      await manager.writePresenceToAllSDs(sdPaths);

      expect(mockFs.writtenFiles.size).toBe(3);
      expect(mockFs.writtenFiles.has('/sd1/profiles/test-profile-123.json')).toBe(true);
      expect(mockFs.writtenFiles.has('/sd2/profiles/test-profile-123.json')).toBe(true);
      expect(mockFs.writtenFiles.has('/sd3/profiles/test-profile-123.json')).toBe(true);
    });

    it('should handle empty SD list', async () => {
      await manager.writePresenceToAllSDs([]);

      expect(mockFs.writtenFiles.size).toBe(0);
    });
  });

  describe('shouldUpdatePresence', () => {
    it('should return true when user settings change', () => {
      expect(manager.shouldUpdatePresence({ userHandle: '@newhandle' })).toBe(true);
      expect(manager.shouldUpdatePresence({ username: 'New Name' })).toBe(true);
    });

    it('should return true when profile name changes', () => {
      expect(manager.shouldUpdatePresence({ profileName: 'New Profile Name' })).toBe(true);
    });

    it('should return true when hostname changes', () => {
      expect(manager.shouldUpdatePresence({ hostname: 'new-host.local' })).toBe(true);
    });

    it('should return true when app version changes', () => {
      expect(manager.shouldUpdatePresence({ appVersion: '0.2.0' })).toBe(true);
    });

    it('should return false when nothing relevant changes', () => {
      expect(manager.shouldUpdatePresence({})).toBe(false);
      expect(manager.shouldUpdatePresence({ unrelatedKey: 'value' })).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update internal config values', () => {
      manager.updateConfig({ profileName: 'Updated Profile' });

      expect(manager.getConfig().profileName).toBe('Updated Profile');
    });

    it('should update hostname', () => {
      manager.updateConfig({ hostname: 'new-hostname.local' });

      expect(manager.getConfig().hostname).toBe('new-hostname.local');
    });

    it('should update app version', () => {
      manager.updateConfig({ appVersion: '1.0.0' });

      expect(manager.getConfig().appVersion).toBe('1.0.0');
    });
  });
});
