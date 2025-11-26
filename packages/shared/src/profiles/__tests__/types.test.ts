/**
 * Profile Types Tests
 *
 * Tests for the profile type definitions and helper functions.
 */

import {
  Profile,
  ProfilesConfig,
  SDType,
  createEmptyProfilesConfig,
  createProfile,
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
      expect(profile.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
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
  });
});
