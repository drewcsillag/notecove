import {
  parseSnapshotFilename,
  generateSnapshotFilename,
  encodeSnapshotFile,
  decodeSnapshotFile,
  createEmptyVectorClock,
  updateVectorClock,
  shouldApplyUpdate,
  selectBestSnapshot,
  SNAPSHOT_FORMAT_VERSION,
  type SnapshotData,
  type VectorClock,
} from '../snapshot-format';

describe('snapshot-format', () => {
  describe('parseSnapshotFilename', () => {
    it('should parse valid snapshot filename', () => {
      const filename = 'snapshot_4800_instance-abc.yjson';
      const metadata = parseSnapshotFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.totalChanges).toBe(4800);
      expect(metadata?.instanceId).toBe('instance-abc');
      expect(metadata?.filename).toBe(filename);
    });

    it('should parse filename with instance ID containing underscores', () => {
      const filename = 'snapshot_1000_instance_with_underscores.yjson';
      const metadata = parseSnapshotFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.instanceId).toBe('instance_with_underscores');
    });

    it('should parse large totalChanges values', () => {
      const filename = 'snapshot_999999_inst-123.yjson';
      const metadata = parseSnapshotFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.totalChanges).toBe(999999);
    });

    it('should return null for invalid extension', () => {
      const filename = 'snapshot_4800_instance-abc.txt';
      const metadata = parseSnapshotFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for missing parts', () => {
      const filename = 'snapshot_4800.yjson';
      const metadata = parseSnapshotFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for wrong prefix', () => {
      const filename = 'notasnapshot_4800_instance-abc.yjson';
      const metadata = parseSnapshotFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for invalid totalChanges', () => {
      const filename = 'snapshot_notanumber_instance-abc.yjson';
      const metadata = parseSnapshotFilename(filename);

      expect(metadata).toBeNull();
    });
  });

  describe('generateSnapshotFilename', () => {
    it('should generate valid snapshot filename', () => {
      const filename = generateSnapshotFilename(4800, 'instance-abc');

      expect(filename).toBe('snapshot_4800_instance-abc.yjson');
    });

    it('should handle instance IDs with underscores', () => {
      const filename = generateSnapshotFilename(1000, 'instance_with_underscores');

      expect(filename).toBe('snapshot_1000_instance_with_underscores.yjson');
    });

    it('should handle totalChanges of 0', () => {
      const filename = generateSnapshotFilename(0, 'inst-123');

      expect(filename).toBe('snapshot_0_inst-123.yjson');
    });

    it('should handle large totalChanges', () => {
      const filename = generateSnapshotFilename(999999, 'inst-123');

      expect(filename).toBe('snapshot_999999_inst-123.yjson');
    });
  });

  describe('encodeSnapshotFile / decodeSnapshotFile', () => {
    it('should encode and decode snapshot data', () => {
      const original: SnapshotData = {
        version: SNAPSHOT_FORMAT_VERSION,
        noteId: 'note-123',
        timestamp: Date.now(),
        totalChanges: 100,
        documentState: new Uint8Array([1, 2, 3, 4, 5]),
        maxSequences: {
          'instance-A': 50,
          'instance-B': 30,
          'instance-C': 20,
        },
      };

      const encoded = encodeSnapshotFile(original);
      const decoded = decodeSnapshotFile(encoded);

      expect(decoded.version).toBe(original.version);
      expect(decoded.noteId).toBe(original.noteId);
      expect(decoded.timestamp).toBe(original.timestamp);
      expect(decoded.totalChanges).toBe(original.totalChanges);
      expect(decoded.documentState).toEqual(original.documentState);
      expect(decoded.maxSequences).toEqual(original.maxSequences);
    });

    it('should handle empty document state', () => {
      const original: SnapshotData = {
        version: 1,
        noteId: 'note-456',
        timestamp: 1234567890,
        totalChanges: 0,
        documentState: new Uint8Array([]),
        maxSequences: {},
      };

      const encoded = encodeSnapshotFile(original);
      const decoded = decodeSnapshotFile(encoded);

      expect(decoded.documentState).toEqual(new Uint8Array([]));
      expect(decoded.maxSequences).toEqual({});
    });

    it('should handle large document state', () => {
      const largeState = new Uint8Array(10000);
      for (let i = 0; i < largeState.length; i++) {
        largeState[i] = i % 256;
      }

      const original: SnapshotData = {
        version: 1,
        noteId: 'note-789',
        timestamp: 1234567890,
        totalChanges: 500,
        documentState: largeState,
        maxSequences: { 'inst-1': 100, 'inst-2': 200, 'inst-3': 200 },
      };

      const encoded = encodeSnapshotFile(original);
      const decoded = decodeSnapshotFile(encoded);

      expect(decoded.documentState).toEqual(largeState);
    });
  });

  describe('VectorClock operations', () => {
    describe('createEmptyVectorClock', () => {
      it('should create empty vector clock', () => {
        const clock = createEmptyVectorClock();

        expect(clock).toEqual({});
      });
    });

    describe('updateVectorClock', () => {
      it('should update vector clock with new instance', () => {
        const clock: VectorClock = {};

        updateVectorClock(clock, 'instance-A', 10);

        expect(clock['instance-A']).toBe(10);
      });

      it('should update existing instance with higher sequence', () => {
        const clock: VectorClock = { 'instance-A': 10 };

        updateVectorClock(clock, 'instance-A', 20);

        expect(clock['instance-A']).toBe(20);
      });

      it('should not update with lower sequence', () => {
        const clock: VectorClock = { 'instance-A': 20 };

        updateVectorClock(clock, 'instance-A', 10);

        expect(clock['instance-A']).toBe(20);
      });

      it('should not update with equal sequence', () => {
        const clock: VectorClock = { 'instance-A': 20 };

        updateVectorClock(clock, 'instance-A', 20);

        expect(clock['instance-A']).toBe(20);
      });

      it('should handle sequence 0', () => {
        const clock: VectorClock = {};

        updateVectorClock(clock, 'instance-A', 0);

        expect(clock['instance-A']).toBe(0);
      });

      it('should handle multiple instances', () => {
        const clock: VectorClock = {};

        updateVectorClock(clock, 'instance-A', 10);
        updateVectorClock(clock, 'instance-B', 20);
        updateVectorClock(clock, 'instance-C', 15);

        expect(clock).toEqual({
          'instance-A': 10,
          'instance-B': 20,
          'instance-C': 15,
        });
      });
    });

    describe('shouldApplyUpdate', () => {
      it('should return true for new instance', () => {
        const clock: VectorClock = { 'instance-A': 10 };

        expect(shouldApplyUpdate(clock, 'instance-B', 5)).toBe(true);
      });

      it('should return true for sequence higher than clock', () => {
        const clock: VectorClock = { 'instance-A': 10 };

        expect(shouldApplyUpdate(clock, 'instance-A', 11)).toBe(true);
      });

      it('should return false for sequence equal to clock', () => {
        const clock: VectorClock = { 'instance-A': 10 };

        expect(shouldApplyUpdate(clock, 'instance-A', 10)).toBe(false);
      });

      it('should return false for sequence lower than clock', () => {
        const clock: VectorClock = { 'instance-A': 10 };

        expect(shouldApplyUpdate(clock, 'instance-A', 5)).toBe(false);
      });

      it('should handle empty clock', () => {
        const clock: VectorClock = {};

        expect(shouldApplyUpdate(clock, 'instance-A', 0)).toBe(true);
        expect(shouldApplyUpdate(clock, 'instance-A', 10)).toBe(true);
      });

      it('should handle sequence 0', () => {
        const clock: VectorClock = { 'instance-A': -1 };

        expect(shouldApplyUpdate(clock, 'instance-A', 0)).toBe(true);
      });
    });
  });

  describe('selectBestSnapshot', () => {
    it('should select snapshot with highest totalChanges', () => {
      const snapshots = [
        { totalChanges: 100, instanceId: 'inst-A', filename: 'snapshot_100_inst-A.yjson' },
        { totalChanges: 200, instanceId: 'inst-B', filename: 'snapshot_200_inst-B.yjson' },
        { totalChanges: 150, instanceId: 'inst-C', filename: 'snapshot_150_inst-C.yjson' },
      ];

      const best = selectBestSnapshot(snapshots);

      expect(best?.totalChanges).toBe(200);
      expect(best?.instanceId).toBe('inst-B');
    });

    it('should use instance ID as tie-breaker', () => {
      const snapshots = [
        { totalChanges: 100, instanceId: 'inst-C', filename: 'snapshot_100_inst-C.yjson' },
        { totalChanges: 100, instanceId: 'inst-A', filename: 'snapshot_100_inst-A.yjson' },
        { totalChanges: 100, instanceId: 'inst-B', filename: 'snapshot_100_inst-B.yjson' },
      ];

      const best = selectBestSnapshot(snapshots);

      // Should pick lexicographically first
      expect(best?.instanceId).toBe('inst-A');
    });

    it('should return null for empty array', () => {
      const best = selectBestSnapshot([]);

      expect(best).toBeNull();
    });

    it('should handle single snapshot', () => {
      const snapshots = [
        { totalChanges: 100, instanceId: 'inst-A', filename: 'snapshot_100_inst-A.yjson' },
      ];

      const best = selectBestSnapshot(snapshots);

      expect(best?.totalChanges).toBe(100);
    });
  });

  describe('round-trip integration', () => {
    it('should correctly round-trip filename generation and parsing', () => {
      const totalChanges = 4800;
      const instanceId = 'instance-abc-123';

      const filename = generateSnapshotFilename(totalChanges, instanceId);
      const metadata = parseSnapshotFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.totalChanges).toBe(totalChanges);
      expect(metadata?.instanceId).toBe(instanceId);
    });

    it('should correctly round-trip snapshot encoding and decoding', () => {
      const original: SnapshotData = {
        version: SNAPSHOT_FORMAT_VERSION,
        noteId: 'note-test-123',
        timestamp: 1699028345123,
        totalChanges: 4800,
        documentState: new Uint8Array([10, 20, 30, 40, 50]),
        maxSequences: {
          'instance-A': 1250,
          'instance-B': 3042,
          'instance-C': 897,
        },
      };

      const encoded = encodeSnapshotFile(original);
      const decoded = decodeSnapshotFile(encoded);

      // Deep equality check
      expect(decoded).toEqual(original);
    });
  });
});
