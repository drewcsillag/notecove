/**
 * Profile Types Tests
 *
 * Tests for the profile type definitions and helper functions.
 */

import {
  Profile,
  ProfileMode,
  ProfilesConfig,
  SDType,
  createEmptyProfilesConfig,
  createProfile,
  getProfileMode,
  modeAllowsCloudQuickAdd,
  modeAllowsLinkPreviewChanges,
  modeAsksForUserInfo,
} from '../types';

describe('Profile Types', () => {
  describe('Profile interface', () => {
    it('should accept valid profile data', () => {
      const profile: Profile = {
        id: 'profile-123',
        name: 'Development',
        isDev: true,
        created: Date.now(),
        lastUsed: Date.now(),
      };

      expect(profile.id).toBe('profile-123');
      expect(profile.name).toBe('Development');
      expect(profile.isDev).toBe(true);
    });

    it('should accept production profile', () => {
      const profile: Profile = {
        id: 'profile-456',
        name: 'Production',
        isDev: false,
        created: Date.now(),
        lastUsed: Date.now(),
      };

      expect(profile.isDev).toBe(false);
    });
  });

  describe('ProfilesConfig interface', () => {
    it('should accept valid config with profiles', () => {
      const config: ProfilesConfig = {
        profiles: [
          {
            id: 'p1',
            name: 'Dev',
            isDev: true,
            created: Date.now(),
            lastUsed: Date.now(),
          },
          {
            id: 'p2',
            name: 'Prod',
            isDev: false,
            created: Date.now(),
            lastUsed: Date.now(),
          },
        ],
        defaultProfileId: 'p2',
        skipPicker: true,
      };

      expect(config.profiles).toHaveLength(2);
      expect(config.defaultProfileId).toBe('p2');
      expect(config.skipPicker).toBe(true);
    });

    it('should accept config with null defaultProfileId', () => {
      const config: ProfilesConfig = {
        profiles: [],
        defaultProfileId: null,
        skipPicker: false,
      };

      expect(config.defaultProfileId).toBeNull();
    });
  });

  describe('SDType', () => {
    it('should accept dev type', () => {
      const sdType: SDType = 'dev';
      expect(sdType).toBe('dev');
    });

    it('should accept prod type', () => {
      const sdType: SDType = 'prod';
      expect(sdType).toBe('prod');
    });
  });

  describe('createEmptyProfilesConfig', () => {
    it('should return config with empty profiles array', () => {
      const config = createEmptyProfilesConfig();

      expect(config.profiles).toEqual([]);
      expect(config.defaultProfileId).toBeNull();
      expect(config.skipPicker).toBe(false);
    });
  });

  describe('createProfile', () => {
    it('should create dev profile with correct properties', () => {
      const before = Date.now();
      const profile = createProfile('Development', true);
      const after = Date.now();

      expect(profile.name).toBe('Development');
      expect(profile.isDev).toBe(true);
      expect(profile.id).toMatch(/^[A-Za-z0-9_-]{22}$/); // Compact UUID format (base64url)
      expect(profile.created).toBeGreaterThanOrEqual(before);
      expect(profile.created).toBeLessThanOrEqual(after);
      expect(profile.lastUsed).toBe(profile.created);
    });

    it('should create prod profile with correct properties', () => {
      const profile = createProfile('Production', false);

      expect(profile.name).toBe('Production');
      expect(profile.isDev).toBe(false);
    });

    it('should generate unique IDs for each profile', () => {
      const profile1 = createProfile('Profile 1', false);
      const profile2 = createProfile('Profile 2', false);

      expect(profile1.id).not.toBe(profile2.id);
    });

    it('should default mode to local when not specified', () => {
      const profile = createProfile('Test', false);

      expect(profile.mode).toBe('local');
    });

    it('should accept explicit mode parameter', () => {
      const paranoidProfile = createProfile('Paranoid', false, 'paranoid');
      const cloudProfile = createProfile('Cloud', false, 'cloud');
      const customProfile = createProfile('Custom', false, 'custom');
      const localProfile = createProfile('Local', false, 'local');

      expect(paranoidProfile.mode).toBe('paranoid');
      expect(cloudProfile.mode).toBe('cloud');
      expect(customProfile.mode).toBe('custom');
      expect(localProfile.mode).toBe('local');
    });
  });

  describe('ProfileMode type', () => {
    it('should accept all valid mode values', () => {
      const modes: ProfileMode[] = ['local', 'cloud', 'paranoid', 'custom'];

      expect(modes).toHaveLength(4);
      expect(modes).toContain('local');
      expect(modes).toContain('cloud');
      expect(modes).toContain('paranoid');
      expect(modes).toContain('custom');
    });
  });

  describe('Profile interface with mode', () => {
    it('should accept profile with mode field', () => {
      const profile: Profile = {
        id: 'profile-123',
        name: 'Paranoid Profile',
        isDev: false,
        mode: 'paranoid',
        created: Date.now(),
        lastUsed: Date.now(),
      };

      expect(profile.mode).toBe('paranoid');
    });

    it('should accept profile without mode field (backwards compatibility)', () => {
      const profile: Profile = {
        id: 'profile-legacy',
        name: 'Legacy Profile',
        isDev: false,
        created: Date.now(),
        lastUsed: Date.now(),
      };

      expect(profile.mode).toBeUndefined();
    });
  });

  describe('getProfileMode', () => {
    it('should return profile mode when set', () => {
      const profile: Profile = {
        id: 'p1',
        name: 'Test',
        isDev: false,
        mode: 'paranoid',
        created: Date.now(),
        lastUsed: Date.now(),
      };

      expect(getProfileMode(profile)).toBe('paranoid');
    });

    it('should return local for profiles without mode (backwards compatibility)', () => {
      const profile: Profile = {
        id: 'p1',
        name: 'Legacy',
        isDev: false,
        created: Date.now(),
        lastUsed: Date.now(),
      };

      expect(getProfileMode(profile)).toBe('local');
    });
  });

  describe('modeAllowsCloudQuickAdd', () => {
    it('should return true for local, cloud, and custom modes', () => {
      expect(modeAllowsCloudQuickAdd('local')).toBe(true);
      expect(modeAllowsCloudQuickAdd('cloud')).toBe(true);
      expect(modeAllowsCloudQuickAdd('custom')).toBe(true);
    });

    it('should return false for paranoid mode', () => {
      expect(modeAllowsCloudQuickAdd('paranoid')).toBe(false);
    });
  });

  describe('modeAllowsLinkPreviewChanges', () => {
    it('should return true for local, cloud, and custom modes', () => {
      expect(modeAllowsLinkPreviewChanges('local')).toBe(true);
      expect(modeAllowsLinkPreviewChanges('cloud')).toBe(true);
      expect(modeAllowsLinkPreviewChanges('custom')).toBe(true);
    });

    it('should return false for paranoid mode', () => {
      expect(modeAllowsLinkPreviewChanges('paranoid')).toBe(false);
    });
  });

  describe('modeAsksForUserInfo', () => {
    it('should return true for local, cloud, and custom modes', () => {
      expect(modeAsksForUserInfo('local')).toBe(true);
      expect(modeAsksForUserInfo('cloud')).toBe(true);
      expect(modeAsksForUserInfo('custom')).toBe(true);
    });

    it('should return false for paranoid mode', () => {
      expect(modeAsksForUserInfo('paranoid')).toBe(false);
    });
  });
});
