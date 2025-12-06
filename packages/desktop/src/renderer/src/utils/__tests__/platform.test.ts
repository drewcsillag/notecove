/**
 * Tests for Platform Detection Utilities
 */

import {
  isElectron,
  isBrowser,
  isFeatureAvailable,
  ELECTRON_ONLY_FEATURES,
} from '../platform';

describe('Platform Detection Utilities', () => {
  // Store original window.electronAPI state
  const originalElectronAPI = (window as unknown as Record<string, unknown>).electronAPI;

  afterEach(() => {
    // Restore original state
    if (originalElectronAPI !== undefined) {
      (window as unknown as Record<string, unknown>).electronAPI = originalElectronAPI;
    } else {
      delete (window as unknown as Record<string, unknown>).electronAPI;
    }
  });

  describe('isElectron', () => {
    it('should return true when electronAPI is present', () => {
      (window as unknown as Record<string, unknown>).electronAPI = {};

      expect(isElectron()).toBe(true);
    });

    it('should return false when electronAPI is not present', () => {
      delete (window as unknown as Record<string, unknown>).electronAPI;

      expect(isElectron()).toBe(false);
    });
  });

  describe('isBrowser', () => {
    it('should return false when electronAPI is present', () => {
      (window as unknown as Record<string, unknown>).electronAPI = {};

      expect(isBrowser()).toBe(false);
    });

    it('should return true when electronAPI is not present', () => {
      delete (window as unknown as Record<string, unknown>).electronAPI;

      expect(isBrowser()).toBe(true);
    });
  });

  describe('ELECTRON_ONLY_FEATURES', () => {
    it('should include expected features', () => {
      expect(ELECTRON_ONLY_FEATURES.export).toBe(true);
      expect(ELECTRON_ONLY_FEATURES.storageDirectoryManagement).toBe(true);
      expect(ELECTRON_ONLY_FEATURES.databaseSettings).toBe(true);
      expect(ELECTRON_ONLY_FEATURES.recoverySettings).toBe(true);
      expect(ELECTRON_ONLY_FEATURES.webServerSettings).toBe(true);
      expect(ELECTRON_ONLY_FEATURES.telemetrySettings).toBe(true);
      expect(ELECTRON_ONLY_FEATURES.profileSwitching).toBe(true);
    });
  });

  describe('isFeatureAvailable', () => {
    describe('in Electron environment', () => {
      beforeEach(() => {
        (window as unknown as Record<string, unknown>).electronAPI = {};
      });

      it('should return true for all features', () => {
        expect(isFeatureAvailable('export')).toBe(true);
        expect(isFeatureAvailable('storageDirectoryManagement')).toBe(true);
        expect(isFeatureAvailable('databaseSettings')).toBe(true);
        expect(isFeatureAvailable('recoverySettings')).toBe(true);
        expect(isFeatureAvailable('webServerSettings')).toBe(true);
        expect(isFeatureAvailable('telemetrySettings')).toBe(true);
        expect(isFeatureAvailable('profileSwitching')).toBe(true);
      });
    });

    describe('in Browser environment', () => {
      beforeEach(() => {
        delete (window as unknown as Record<string, unknown>).electronAPI;
      });

      it('should return false for electron-only features', () => {
        expect(isFeatureAvailable('export')).toBe(false);
        expect(isFeatureAvailable('storageDirectoryManagement')).toBe(false);
        expect(isFeatureAvailable('databaseSettings')).toBe(false);
        expect(isFeatureAvailable('recoverySettings')).toBe(false);
        expect(isFeatureAvailable('webServerSettings')).toBe(false);
        expect(isFeatureAvailable('telemetrySettings')).toBe(false);
        expect(isFeatureAvailable('profileSwitching')).toBe(false);
      });
    });
  });
});
