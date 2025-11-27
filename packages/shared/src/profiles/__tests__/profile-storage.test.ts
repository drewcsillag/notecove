/**
 * Profile Storage Tests
 *
 * Tests for loading/saving profile configuration from profiles.json.
 * Uses a mock filesystem adapter to test in isolation.
 */

import { ProfileStorage } from '../profile-storage';
import type { ProfilesConfig } from '../types';
import type { FileSystemAdapter } from '../../storage/types';

/**
 * Create a mock filesystem adapter for testing
 */
function createMockFs(files: Map<string, Uint8Array> = new Map()): FileSystemAdapter {
  return {
    exists: jest.fn(async (path: string) => files.has(path)),
    mkdir: jest.fn(async () => {}),
    readFile: jest.fn(async (path: string) => {
      const data = files.get(path);
      if (!data) throw new Error(`ENOENT: ${path}`);
      return data;
    }),
    writeFile: jest.fn(async (path: string, data: Uint8Array) => {
      files.set(path, data);
    }),
    appendFile: jest.fn(async () => {}),
    deleteFile: jest.fn(async (path: string) => {
      files.delete(path);
    }),
    listFiles: jest.fn(async () => []),
    joinPath: jest.fn((...segments: string[]) => segments.join('/')),
    basename: jest.fn((path: string) => path.split('/').pop() || ''),
    stat: jest.fn(async () => ({ size: 0, mtimeMs: 0, ctimeMs: 0 })),
  };
}

describe('ProfileStorage', () => {
  const APP_DATA_DIR = '/Users/test/Library/Application Support/NoteCove';
  const PROFILES_JSON = `${APP_DATA_DIR}/profiles.json`;

  describe('loadProfiles', () => {
    it('should return empty config when profiles.json does not exist', async () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const config = await storage.loadProfiles();

      expect(config.profiles).toEqual([]);
      expect(config.defaultProfileId).toBeNull();
      expect(config.skipPicker).toBe(false);
    });

    it('should load and parse existing profiles.json', async () => {
      const existingConfig: ProfilesConfig = {
        profiles: [
          {
            id: 'p1',
            name: 'Development',
            isDev: true,
            created: 1000,
            lastUsed: 2000,
          },
        ],
        defaultProfileId: 'p1',
        skipPicker: false,
      };
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode(JSON.stringify(existingConfig)));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const config = await storage.loadProfiles();

      expect(config.profiles).toHaveLength(1);
      expect(config.profiles[0].name).toBe('Development');
      expect(config.defaultProfileId).toBe('p1');
    });

    it('should return empty config when profiles.json is corrupted', async () => {
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode('{ invalid json'));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const config = await storage.loadProfiles();

      expect(config.profiles).toEqual([]);
    });
  });

  describe('saveProfiles', () => {
    it('should save config to profiles.json', async () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);
      const config: ProfilesConfig = {
        profiles: [
          {
            id: 'p2',
            name: 'Production',
            isDev: false,
            created: 3000,
            lastUsed: 4000,
          },
        ],
        defaultProfileId: 'p2',
        skipPicker: true,
      };

      await storage.saveProfiles(config);

      expect(mockFs.mkdir).toHaveBeenCalledWith(APP_DATA_DIR);
      expect(mockFs.writeFile).toHaveBeenCalled();

      // Verify the written data
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      const writtenPath = writeCall[0];
      const writtenData = writeCall[1];
      expect(writtenPath).toBe(PROFILES_JSON);

      const parsed = JSON.parse(new TextDecoder().decode(writtenData)) as ProfilesConfig;
      expect(parsed.profiles[0]?.name).toBe('Production');
      expect(parsed.skipPicker).toBe(true);
    });
  });

  describe('getProfileDatabasePath', () => {
    it('should return correct path for a profile', () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const dbPath = storage.getProfileDatabasePath('my-profile-id');

      expect(dbPath).toBe(`${APP_DATA_DIR}/profiles/my-profile-id/notecove.db`);
    });
  });

  describe('getProfileDataDir', () => {
    it('should return correct directory for a profile', () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const dataDir = storage.getProfileDataDir('my-profile-id');

      expect(dataDir).toBe(`${APP_DATA_DIR}/profiles/my-profile-id`);
    });
  });

  describe('ensureProfileDataDir', () => {
    it('should create profile data directory', async () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      await storage.ensureProfileDataDir('p1');

      expect(mockFs.mkdir).toHaveBeenCalledWith(`${APP_DATA_DIR}/profiles/p1`);
    });
  });

  describe('createProfile', () => {
    it('should create a new profile and save it', async () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const profile = await storage.createProfile('My Profile', false);

      expect(profile.name).toBe('My Profile');
      expect(profile.isDev).toBe(false);
      expect(profile.id).toBeDefined();
      expect(profile.created).toBeGreaterThan(0);
      expect(profile.lastUsed).toBeGreaterThan(0);

      // Verify it was saved
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.mkdir).toHaveBeenCalledWith(`${APP_DATA_DIR}/profiles/${profile.id}`);
    });

    it('should create a dev profile when isDev is true', async () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const profile = await storage.createProfile('Dev Profile', true);

      expect(profile.name).toBe('Dev Profile');
      expect(profile.isDev).toBe(true);
    });

    it('should add profile to existing profiles', async () => {
      const existingConfig: ProfilesConfig = {
        profiles: [
          {
            id: 'existing-1',
            name: 'Existing',
            isDev: false,
            created: 1000,
            lastUsed: 2000,
          },
        ],
        defaultProfileId: 'existing-1',
        skipPicker: false,
      };
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode(JSON.stringify(existingConfig)));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const profile = await storage.createProfile('New Profile', false);

      // Verify the saved data contains both profiles
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      const writtenData = writeCall[1];
      const parsed = JSON.parse(new TextDecoder().decode(writtenData)) as ProfilesConfig;
      expect(parsed.profiles).toHaveLength(2);
      expect(parsed.profiles.find((p) => p.id === 'existing-1')).toBeDefined();
      expect(parsed.profiles.find((p) => p.id === profile.id)).toBeDefined();
    });
  });

  describe('deleteProfile', () => {
    it('should remove profile from config', async () => {
      const existingConfig: ProfilesConfig = {
        profiles: [
          {
            id: 'p1',
            name: 'Profile 1',
            isDev: false,
            created: 1000,
            lastUsed: 2000,
          },
          {
            id: 'p2',
            name: 'Profile 2',
            isDev: false,
            created: 1000,
            lastUsed: 2000,
          },
        ],
        defaultProfileId: 'p1',
        skipPicker: false,
      };
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode(JSON.stringify(existingConfig)));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      await storage.deleteProfile('p1');

      // Verify the saved data only contains p2
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      const writtenData = writeCall[1];
      const parsed = JSON.parse(new TextDecoder().decode(writtenData)) as ProfilesConfig;
      expect(parsed.profiles).toHaveLength(1);
      expect(parsed.profiles[0]?.id).toBe('p2');
    });

    it('should clear defaultProfileId if deleting the default profile', async () => {
      const existingConfig: ProfilesConfig = {
        profiles: [
          {
            id: 'p1',
            name: 'Profile 1',
            isDev: false,
            created: 1000,
            lastUsed: 2000,
          },
        ],
        defaultProfileId: 'p1',
        skipPicker: true,
      };
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode(JSON.stringify(existingConfig)));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      await storage.deleteProfile('p1');

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      const writtenData = writeCall[1];
      const parsed = JSON.parse(new TextDecoder().decode(writtenData)) as ProfilesConfig;
      expect(parsed.defaultProfileId).toBeNull();
      expect(parsed.skipPicker).toBe(false); // Reset skipPicker when default is deleted
    });

    it('should throw if profile does not exist', async () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      await expect(storage.deleteProfile('nonexistent')).rejects.toThrow('Profile not found');
    });

    it('should NOT delete profile data directory (only config entry)', async () => {
      const existingConfig: ProfilesConfig = {
        profiles: [
          {
            id: 'p1',
            name: 'Profile 1',
            isDev: false,
            created: 1000,
            lastUsed: 2000,
          },
        ],
        defaultProfileId: null,
        skipPicker: false,
      };
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode(JSON.stringify(existingConfig)));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      await storage.deleteProfile('p1');

      // deleteFile should NOT be called for the profile directory
      expect(mockFs.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('renameProfile', () => {
    it('should update profile name', async () => {
      const existingConfig: ProfilesConfig = {
        profiles: [
          {
            id: 'p1',
            name: 'Old Name',
            isDev: false,
            created: 1000,
            lastUsed: 2000,
          },
        ],
        defaultProfileId: null,
        skipPicker: false,
      };
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode(JSON.stringify(existingConfig)));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      await storage.renameProfile('p1', 'New Name');

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      const writtenData = writeCall[1];
      const parsed = JSON.parse(new TextDecoder().decode(writtenData)) as ProfilesConfig;
      expect(parsed.profiles[0]?.name).toBe('New Name');
    });

    it('should throw if profile does not exist', async () => {
      const mockFs = createMockFs();
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      await expect(storage.renameProfile('nonexistent', 'New Name')).rejects.toThrow(
        'Profile not found'
      );
    });

    it('should throw if new name is empty', async () => {
      const existingConfig: ProfilesConfig = {
        profiles: [
          {
            id: 'p1',
            name: 'Old Name',
            isDev: false,
            created: 1000,
            lastUsed: 2000,
          },
        ],
        defaultProfileId: null,
        skipPicker: false,
      };
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode(JSON.stringify(existingConfig)));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      await expect(storage.renameProfile('p1', '')).rejects.toThrow('Profile name cannot be empty');
      await expect(storage.renameProfile('p1', '   ')).rejects.toThrow(
        'Profile name cannot be empty'
      );
    });
  });

  describe('updateLastUsed', () => {
    it('should update the lastUsed timestamp', async () => {
      const existingConfig: ProfilesConfig = {
        profiles: [
          {
            id: 'p1',
            name: 'Profile 1',
            isDev: false,
            created: 1000,
            lastUsed: 2000,
          },
        ],
        defaultProfileId: null,
        skipPicker: false,
      };
      const files = new Map<string, Uint8Array>();
      files.set(PROFILES_JSON, new TextEncoder().encode(JSON.stringify(existingConfig)));
      const mockFs = createMockFs(files);
      const storage = new ProfileStorage(mockFs, APP_DATA_DIR);

      const beforeUpdate = Date.now();
      await storage.updateLastUsed('p1');

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0] as [string, Uint8Array];
      const writtenData = writeCall[1];
      const parsed = JSON.parse(new TextDecoder().decode(writtenData)) as ProfilesConfig;
      expect(parsed.profiles[0]?.lastUsed).toBeGreaterThanOrEqual(beforeUpdate);
    });
  });
});
