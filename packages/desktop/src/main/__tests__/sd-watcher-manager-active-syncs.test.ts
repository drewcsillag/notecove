/**
 * Tests for SDWatcherManager active sync tracking
 */

import { SDWatcherManager } from '../sd-watcher-manager';

describe('SDWatcherManager Active Sync Tracking', () => {
  let manager: SDWatcherManager;

  beforeEach(() => {
    manager = new SDWatcherManager();
  });

  describe('addActiveSyncs', () => {
    it('should add notes to active syncs', () => {
      const noteIds = new Set(['note1', 'note2']);
      manager.addActiveSyncs('sd1', noteIds);

      const activeSyncs = manager.getActiveSyncs();
      expect(activeSyncs).toHaveLength(2);
      expect(activeSyncs).toContainEqual({ sdId: 'sd1', noteId: 'note1' });
      expect(activeSyncs).toContainEqual({ sdId: 'sd1', noteId: 'note2' });
    });

    it('should handle multiple SDs', () => {
      manager.addActiveSyncs('sd1', new Set(['note1']));
      manager.addActiveSyncs('sd2', new Set(['note2']));

      const activeSyncs = manager.getActiveSyncs();
      expect(activeSyncs).toHaveLength(2);
      expect(activeSyncs).toContainEqual({ sdId: 'sd1', noteId: 'note1' });
      expect(activeSyncs).toContainEqual({ sdId: 'sd2', noteId: 'note2' });
    });

    it('should not duplicate notes when added twice', () => {
      manager.addActiveSyncs('sd1', new Set(['note1']));
      manager.addActiveSyncs('sd1', new Set(['note1']));

      const activeSyncs = manager.getActiveSyncs();
      expect(activeSyncs).toHaveLength(1);
    });

    it('should do nothing for empty set', () => {
      const callback = jest.fn();
      manager.setOnActiveSyncsChanged(callback);

      manager.addActiveSyncs('sd1', new Set());

      expect(manager.getActiveSyncs()).toHaveLength(0);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call onActiveSyncsChanged callback', () => {
      const callback = jest.fn();
      manager.setOnActiveSyncsChanged(callback);

      manager.addActiveSyncs('sd1', new Set(['note1']));

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeActiveSyncs', () => {
    it('should remove notes from active syncs', () => {
      manager.addActiveSyncs('sd1', new Set(['note1', 'note2']));
      manager.removeActiveSyncs('sd1', new Set(['note1']));

      const activeSyncs = manager.getActiveSyncs();
      expect(activeSyncs).toHaveLength(1);
      expect(activeSyncs).toContainEqual({ sdId: 'sd1', noteId: 'note2' });
    });

    it('should clean up empty SD entries', () => {
      manager.addActiveSyncs('sd1', new Set(['note1']));
      manager.removeActiveSyncs('sd1', new Set(['note1']));

      expect(manager.getActiveSyncs()).toHaveLength(0);
      expect(manager.getActiveSyncCount()).toBe(0);
    });

    it('should do nothing for non-existent SD', () => {
      const callback = jest.fn();
      manager.setOnActiveSyncsChanged(callback);

      manager.removeActiveSyncs('nonexistent', new Set(['note1']));

      expect(callback).not.toHaveBeenCalled();
    });

    it('should do nothing for empty set', () => {
      manager.addActiveSyncs('sd1', new Set(['note1']));
      const callback = jest.fn();
      manager.setOnActiveSyncsChanged(callback);

      manager.removeActiveSyncs('sd1', new Set());

      expect(manager.getActiveSyncs()).toHaveLength(1);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call onActiveSyncsChanged callback', () => {
      manager.addActiveSyncs('sd1', new Set(['note1']));
      const callback = jest.fn();
      manager.setOnActiveSyncsChanged(callback);

      manager.removeActiveSyncs('sd1', new Set(['note1']));

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getActiveSyncs', () => {
    it('should return empty array when no active syncs', () => {
      expect(manager.getActiveSyncs()).toEqual([]);
    });

    it('should return flat array of all syncs across SDs', () => {
      manager.addActiveSyncs('sd1', new Set(['note1', 'note2']));
      manager.addActiveSyncs('sd2', new Set(['note3']));

      const activeSyncs = manager.getActiveSyncs();
      expect(activeSyncs).toHaveLength(3);
    });
  });

  describe('getActiveSyncCount', () => {
    it('should return 0 when no active syncs', () => {
      expect(manager.getActiveSyncCount()).toBe(0);
    });

    it('should return total count across all SDs', () => {
      manager.addActiveSyncs('sd1', new Set(['note1', 'note2']));
      manager.addActiveSyncs('sd2', new Set(['note3']));

      expect(manager.getActiveSyncCount()).toBe(3);
    });
  });

  describe('callback management', () => {
    it('should allow setting callback', () => {
      const callback = jest.fn();
      manager.setOnActiveSyncsChanged(callback);

      manager.addActiveSyncs('sd1', new Set(['note1']));
      manager.removeActiveSyncs('sd1', new Set(['note1']));

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should handle no callback set', () => {
      // Should not throw
      expect(() => {
        manager.addActiveSyncs('sd1', new Set(['note1']));
        manager.removeActiveSyncs('sd1', new Set(['note1']));
      }).not.toThrow();
    });
  });
});
