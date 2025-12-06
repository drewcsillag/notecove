/**
 * App State Storage Tests
 */

import { AppStateStorage, appStateStorage } from '../app-state';

describe('AppStateStorage', () => {
  let storage: AppStateStorage;

  beforeEach(() => {
    storage = new AppStateStorage();
  });

  describe('get/set', () => {
    it('should set and get a value', async () => {
      await storage.set('key1', 'value1');
      const result = await storage.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const result = await storage.get('non-existent');
      expect(result).toBeNull();
    });

    it('should overwrite existing value', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key1', 'value2');
      const result = await storage.get('key1');
      expect(result).toBe('value2');
    });
  });

  describe('delete', () => {
    it('should delete a value', async () => {
      await storage.set('key1', 'value1');
      await storage.delete('key1');
      const result = await storage.get('key1');
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(storage.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all values', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.clear();
      expect(await storage.get('key1')).toBeNull();
      expect(await storage.get('key2')).toBeNull();
    });
  });
});

describe('appStateStorage (global instance)', () => {
  afterEach(async () => {
    await appStateStorage.clear();
  });

  it('should be a singleton instance', () => {
    expect(appStateStorage).toBeInstanceOf(AppStateStorage);
  });

  it('should persist state between operations', async () => {
    await appStateStorage.set('test', 'value');
    expect(await appStateStorage.get('test')).toBe('value');
  });
});
