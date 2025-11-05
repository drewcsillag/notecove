import {
  parsePackFilename,
  generatePackFilename,
  encodePackFile,
  decodePackFile,
  validatePackData,
  PACK_FORMAT_VERSION,
  type PackData,
  type PackUpdateEntry,
} from '../pack-format';

describe('pack-format', () => {
  describe('parsePackFilename', () => {
    it('should parse valid pack filename', () => {
      const filename = 'instance-abc_pack_0-99.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.instanceId).toBe('instance-abc');
      expect(metadata?.startSeq).toBe(0);
      expect(metadata?.endSeq).toBe(99);
      expect(metadata?.filename).toBe(filename);
    });

    it('should parse filename with instance ID containing underscores', () => {
      const filename = 'instance_with_underscores_pack_100-199.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.instanceId).toBe('instance_with_underscores');
      expect(metadata?.startSeq).toBe(100);
      expect(metadata?.endSeq).toBe(199);
    });

    it('should parse large sequence numbers', () => {
      const filename = 'inst-123_pack_1000000-1000099.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.startSeq).toBe(1000000);
      expect(metadata?.endSeq).toBe(1000099);
    });

    it('should parse single update pack', () => {
      const filename = 'inst-123_pack_50-50.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.startSeq).toBe(50);
      expect(metadata?.endSeq).toBe(50);
    });

    it('should return null for invalid extension', () => {
      const filename = 'instance-abc_pack_0-99.txt';
      const metadata = parsePackFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for missing pack marker', () => {
      const filename = 'instance-abc_0-99.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for invalid range format', () => {
      const filename = 'instance-abc_pack_0_99.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for invalid sequence numbers', () => {
      const filename = 'instance-abc_pack_notanumber-99.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for negative sequence numbers', () => {
      const filename = 'instance-abc_pack_-1-99.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for inverted range (end < start)', () => {
      const filename = 'instance-abc_pack_99-0.yjson';
      const metadata = parsePackFilename(filename);

      expect(metadata).toBeNull();
    });
  });

  describe('generatePackFilename', () => {
    it('should generate valid pack filename', () => {
      const filename = generatePackFilename('instance-abc', 0, 99);

      expect(filename).toBe('instance-abc_pack_0-99.yjson');
    });

    it('should handle instance IDs with underscores', () => {
      const filename = generatePackFilename('instance_with_underscores', 100, 199);

      expect(filename).toBe('instance_with_underscores_pack_100-199.yjson');
    });

    it('should handle sequence 0', () => {
      const filename = generatePackFilename('inst-123', 0, 0);

      expect(filename).toBe('inst-123_pack_0-0.yjson');
    });

    it('should handle large sequence numbers', () => {
      const filename = generatePackFilename('inst-123', 1000000, 1000099);

      expect(filename).toBe('inst-123_pack_1000000-1000099.yjson');
    });

    it('should handle single update pack', () => {
      const filename = generatePackFilename('inst-123', 50, 50);

      expect(filename).toBe('inst-123_pack_50-50.yjson');
    });
  });

  describe('encodePackFile / decodePackFile', () => {
    it('should encode and decode pack data', () => {
      const updates: PackUpdateEntry[] = [
        { seq: 0, timestamp: 1000, data: new Uint8Array([1, 2, 3]) },
        { seq: 1, timestamp: 2000, data: new Uint8Array([4, 5, 6]) },
        { seq: 2, timestamp: 3000, data: new Uint8Array([7, 8, 9]) },
      ];

      const original: PackData = {
        version: PACK_FORMAT_VERSION,
        instanceId: 'instance-A',
        noteId: 'note-123',
        sequenceRange: [0, 2],
        updates,
      };

      const encoded = encodePackFile(original);
      const decoded = decodePackFile(encoded);

      expect(decoded.version).toBe(original.version);
      expect(decoded.instanceId).toBe(original.instanceId);
      expect(decoded.noteId).toBe(original.noteId);
      expect(decoded.sequenceRange).toEqual(original.sequenceRange);
      expect(decoded.updates).toHaveLength(3);
      expect(decoded.updates[0]?.data).toEqual(new Uint8Array([1, 2, 3]));
      expect(decoded.updates[1]?.data).toEqual(new Uint8Array([4, 5, 6]));
      expect(decoded.updates[2]?.data).toEqual(new Uint8Array([7, 8, 9]));
    });

    it('should handle empty update data', () => {
      const updates: PackUpdateEntry[] = [{ seq: 0, timestamp: 1000, data: new Uint8Array([]) }];

      const original: PackData = {
        version: 1,
        instanceId: 'instance-B',
        noteId: 'note-456',
        sequenceRange: [0, 0],
        updates,
      };

      const encoded = encodePackFile(original);
      const decoded = decodePackFile(encoded);

      expect(decoded.updates[0]?.data).toEqual(new Uint8Array([]));
    });

    it('should handle large update data', () => {
      const largeData = new Uint8Array(10000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const updates: PackUpdateEntry[] = [{ seq: 100, timestamp: 5000, data: largeData }];

      const original: PackData = {
        version: 1,
        instanceId: 'instance-C',
        noteId: 'note-789',
        sequenceRange: [100, 100],
        updates,
      };

      const encoded = encodePackFile(original);
      const decoded = decodePackFile(encoded);

      expect(decoded.updates[0]?.data).toEqual(largeData);
    });

    it('should handle many updates', () => {
      const updates: PackUpdateEntry[] = [];
      for (let i = 0; i < 100; i++) {
        updates.push({
          seq: i,
          timestamp: 1000 + i * 100,
          data: new Uint8Array([i % 256]),
        });
      }

      const original: PackData = {
        version: 1,
        instanceId: 'instance-D',
        noteId: 'note-999',
        sequenceRange: [0, 99],
        updates,
      };

      const encoded = encodePackFile(original);
      const decoded = decodePackFile(encoded);

      expect(decoded.updates).toHaveLength(100);
      for (let i = 0; i < 100; i++) {
        expect(decoded.updates[i]?.seq).toBe(i);
        expect(decoded.updates[i]?.timestamp).toBe(1000 + i * 100);
        expect(decoded.updates[i]?.data).toEqual(new Uint8Array([i % 256]));
      }
    });

    it('should throw error for unsupported version', () => {
      const updates: PackUpdateEntry[] = [
        { seq: 0, timestamp: 1000, data: new Uint8Array([1, 2, 3]) },
      ];

      const original: PackData = {
        version: 999, // Unsupported version
        instanceId: 'instance-E',
        noteId: 'note-888',
        sequenceRange: [0, 0],
        updates,
      };

      const encoded = encodePackFile(original);

      expect(() => decodePackFile(encoded)).toThrow(/Unsupported pack format version/);
    });
  });

  describe('validatePackData', () => {
    it('should validate valid pack data', () => {
      const updates: PackUpdateEntry[] = [
        { seq: 10, timestamp: 1000, data: new Uint8Array([1]) },
        { seq: 11, timestamp: 2000, data: new Uint8Array([2]) },
        { seq: 12, timestamp: 3000, data: new Uint8Array([3]) },
      ];

      const pack: PackData = {
        version: 1,
        instanceId: 'instance-A',
        noteId: 'note-123',
        sequenceRange: [10, 12],
        updates,
      };

      expect(() => validatePackData(pack)).not.toThrow();
    });

    it('should validate single update pack', () => {
      const updates: PackUpdateEntry[] = [{ seq: 50, timestamp: 1000, data: new Uint8Array([1]) }];

      const pack: PackData = {
        version: 1,
        instanceId: 'instance-B',
        noteId: 'note-456',
        sequenceRange: [50, 50],
        updates,
      };

      expect(() => validatePackData(pack)).not.toThrow();
    });

    it('should throw for negative start sequence', () => {
      const updates: PackUpdateEntry[] = [{ seq: -1, timestamp: 1000, data: new Uint8Array([1]) }];

      const pack: PackData = {
        version: 1,
        instanceId: 'instance-C',
        noteId: 'note-789',
        sequenceRange: [-1, 0],
        updates,
      };

      expect(() => validatePackData(pack)).toThrow(/Invalid sequence range/);
    });

    it('should throw for inverted range', () => {
      const updates: PackUpdateEntry[] = [{ seq: 10, timestamp: 1000, data: new Uint8Array([1]) }];

      const pack: PackData = {
        version: 1,
        instanceId: 'instance-D',
        noteId: 'note-999',
        sequenceRange: [10, 5],
        updates,
      };

      expect(() => validatePackData(pack)).toThrow(/Invalid sequence range/);
    });

    it('should throw for update count mismatch', () => {
      const updates: PackUpdateEntry[] = [
        { seq: 10, timestamp: 1000, data: new Uint8Array([1]) },
        { seq: 11, timestamp: 2000, data: new Uint8Array([2]) },
      ];

      const pack: PackData = {
        version: 1,
        instanceId: 'instance-E',
        noteId: 'note-888',
        sequenceRange: [10, 12], // Says 3 updates, but only has 2
        updates,
      };

      expect(() => validatePackData(pack)).toThrow(/doesn't match range/);
    });

    it('should throw for non-contiguous sequences', () => {
      const updates: PackUpdateEntry[] = [
        { seq: 10, timestamp: 1000, data: new Uint8Array([1]) },
        { seq: 11, timestamp: 2000, data: new Uint8Array([2]) },
        { seq: 13, timestamp: 3000, data: new Uint8Array([3]) }, // Gap! Should be 12
      ];

      const pack: PackData = {
        version: 1,
        instanceId: 'instance-F',
        noteId: 'note-777',
        sequenceRange: [10, 12],
        updates,
      };

      expect(() => validatePackData(pack)).toThrow(/has seq 13, expected 12/);
    });

    it('should throw for wrong starting sequence', () => {
      const updates: PackUpdateEntry[] = [
        { seq: 11, timestamp: 1000, data: new Uint8Array([1]) }, // Should start at 10
        { seq: 12, timestamp: 2000, data: new Uint8Array([2]) },
        { seq: 13, timestamp: 3000, data: new Uint8Array([3]) },
      ];

      const pack: PackData = {
        version: 1,
        instanceId: 'instance-G',
        noteId: 'note-666',
        sequenceRange: [10, 12],
        updates,
      };

      expect(() => validatePackData(pack)).toThrow(/has seq 11, expected 10/);
    });
  });

  describe('round-trip integration', () => {
    it('should correctly round-trip filename generation and parsing', () => {
      const instanceId = 'instance-abc-123';
      const startSeq = 1000;
      const endSeq = 1099;

      const filename = generatePackFilename(instanceId, startSeq, endSeq);
      const metadata = parsePackFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.instanceId).toBe(instanceId);
      expect(metadata?.startSeq).toBe(startSeq);
      expect(metadata?.endSeq).toBe(endSeq);
    });

    it('should correctly round-trip pack encoding and decoding', () => {
      const updates: PackUpdateEntry[] = [];
      for (let i = 0; i < 50; i++) {
        updates.push({
          seq: 100 + i,
          timestamp: 1699028345123 + i * 1000,
          data: new Uint8Array([i % 256, (i * 2) % 256, (i * 3) % 256]),
        });
      }

      const original: PackData = {
        version: PACK_FORMAT_VERSION,
        instanceId: 'instance-test-123',
        noteId: 'note-test-456',
        sequenceRange: [100, 149],
        updates,
      };

      const encoded = encodePackFile(original);
      const decoded = decodePackFile(encoded);

      // Deep equality check
      expect(decoded).toEqual(original);

      // Validate pack integrity
      expect(() => validatePackData(decoded)).not.toThrow();
    });

    it('should handle complete workflow', () => {
      // Create pack data
      const updates: PackUpdateEntry[] = [
        { seq: 0, timestamp: 1000, data: new Uint8Array([1, 2, 3]) },
        { seq: 1, timestamp: 2000, data: new Uint8Array([4, 5, 6]) },
        { seq: 2, timestamp: 3000, data: new Uint8Array([7, 8, 9]) },
      ];

      const pack: PackData = {
        version: PACK_FORMAT_VERSION,
        instanceId: 'inst-workflow',
        noteId: 'note-workflow',
        sequenceRange: [0, 2],
        updates,
      };

      // Validate before encoding
      expect(() => validatePackData(pack)).not.toThrow();

      // Generate filename
      const filename = generatePackFilename(pack.instanceId, 0, 2);
      expect(filename).toBe('inst-workflow_pack_0-2.yjson');

      // Parse filename
      const metadata = parsePackFilename(filename);
      expect(metadata?.instanceId).toBe('inst-workflow');
      expect(metadata?.startSeq).toBe(0);
      expect(metadata?.endSeq).toBe(2);

      // Encode
      const encoded = encodePackFile(pack);

      // Decode
      const decoded = decodePackFile(encoded);

      // Validate after decoding
      expect(() => validatePackData(decoded)).not.toThrow();

      // Verify data integrity
      expect(decoded).toEqual(pack);
    });
  });
});
