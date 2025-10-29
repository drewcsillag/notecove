import { StorageDirectoryRegistry } from '../sd-registry';

describe('StorageDirectoryRegistry', () => {
  let registry: StorageDirectoryRegistry;

  beforeEach(() => {
    registry = new StorageDirectoryRegistry();
  });

  describe('register', () => {
    it('should register a Storage Directory', () => {
      registry.register('sd-1', '/path/to/sd1');

      expect(registry.has('sd-1')).toBe(true);
      expect(registry.get('sd-1')).toBe('/path/to/sd1');
    });

    it('should allow registering multiple Storage Directories', () => {
      registry.register('sd-1', '/path/to/sd1');
      registry.register('sd-2', '/path/to/sd2');

      expect(registry.size).toBe(2);
      expect(registry.get('sd-1')).toBe('/path/to/sd1');
      expect(registry.get('sd-2')).toBe('/path/to/sd2');
    });

    it('should overwrite existing registration', () => {
      registry.register('sd-1', '/old/path');
      registry.register('sd-1', '/new/path');

      expect(registry.size).toBe(1);
      expect(registry.get('sd-1')).toBe('/new/path');
    });
  });

  describe('unregister', () => {
    it('should unregister a Storage Directory', () => {
      registry.register('sd-1', '/path/to/sd1');
      registry.unregister('sd-1');

      expect(registry.has('sd-1')).toBe(false);
      expect(registry.get('sd-1')).toBeUndefined();
    });

    it('should handle unregistering non-existent SD', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
      expect(registry.size).toBe(0);
    });
  });

  describe('get', () => {
    it('should return path for registered SD', () => {
      registry.register('sd-1', '/path/to/sd1');

      expect(registry.get('sd-1')).toBe('/path/to/sd1');
    });

    it('should return undefined for unregistered SD', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered SD', () => {
      registry.register('sd-1', '/path/to/sd1');

      expect(registry.has('sd-1')).toBe(true);
    });

    it('should return false for unregistered SD', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getAllIds', () => {
    it('should return empty array when no SDs registered', () => {
      expect(registry.getAllIds()).toEqual([]);
    });

    it('should return all registered SD IDs', () => {
      registry.register('sd-1', '/path/to/sd1');
      registry.register('sd-2', '/path/to/sd2');
      registry.register('sd-3', '/path/to/sd3');

      const ids = registry.getAllIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('sd-1');
      expect(ids).toContain('sd-2');
      expect(ids).toContain('sd-3');
    });
  });

  describe('getAll', () => {
    it('should return empty map when no SDs registered', () => {
      const all = registry.getAll();
      expect(all.size).toBe(0);
    });

    it('should return all registered SDs as Map', () => {
      registry.register('sd-1', '/path/to/sd1');
      registry.register('sd-2', '/path/to/sd2');

      const all = registry.getAll();
      expect(all.size).toBe(2);
      expect(all.get('sd-1')).toBe('/path/to/sd1');
      expect(all.get('sd-2')).toBe('/path/to/sd2');
    });

    it('should return a copy of the internal map', () => {
      registry.register('sd-1', '/path/to/sd1');

      const all = registry.getAll();
      all.set('sd-2', '/path/to/sd2'); // Modify the returned map

      // Original registry should not be affected
      expect(registry.has('sd-2')).toBe(false);
      expect(registry.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      registry.register('sd-1', '/path/to/sd1');
      registry.register('sd-2', '/path/to/sd2');

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.has('sd-1')).toBe(false);
      expect(registry.has('sd-2')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size).toBe(0);
    });

    it('should return correct count of registered SDs', () => {
      registry.register('sd-1', '/path/to/sd1');
      expect(registry.size).toBe(1);

      registry.register('sd-2', '/path/to/sd2');
      expect(registry.size).toBe(2);

      registry.unregister('sd-1');
      expect(registry.size).toBe(1);
    });
  });
});
