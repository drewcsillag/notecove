/**
 * Binary Format Tests
 *
 * Tests for LEB128 varint encoding, log file format, snapshot format,
 * and vector clock serialization.
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

import {
  encodeVarint,
  decodeVarint,
  writeLogHeader,
  readLogHeader,
  LOG_MAGIC,
  LOG_VERSION,
  LOG_HEADER_SIZE,
  encodeTimestamp,
  decodeTimestamp,
  writeLogRecord,
  readLogRecord,
  SNAPSHOT_MAGIC,
  SNAPSHOT_VERSION,
  SNAPSHOT_HEADER_SIZE,
  SNAPSHOT_STATUS_INCOMPLETE,
  SNAPSHOT_STATUS_COMPLETE,
  writeSnapshotHeader,
  readSnapshotHeader,
  writeVectorClock,
  readVectorClock,
  createLogFile,
  parseLogFile,
  createSnapshotFile,
  parseSnapshotFile,
  type VectorClockEntry,
} from '../binary-format';

describe('Varint (LEB128) Encoding', () => {
  describe('encodeVarint', () => {
    it('should encode 0', () => {
      const result = encodeVarint(0);
      expect(result).toEqual(new Uint8Array([0x00]));
    });

    it('should encode 1', () => {
      const result = encodeVarint(1);
      expect(result).toEqual(new Uint8Array([0x01]));
    });

    it('should encode 127 (max single byte)', () => {
      const result = encodeVarint(127);
      expect(result).toEqual(new Uint8Array([0x7f]));
    });

    it('should encode 128 (first two-byte value)', () => {
      const result = encodeVarint(128);
      expect(result).toEqual(new Uint8Array([0x80, 0x01]));
    });

    it('should encode 16383 (max two-byte value)', () => {
      const result = encodeVarint(16383);
      expect(result).toEqual(new Uint8Array([0xff, 0x7f]));
    });

    it('should encode 16384 (first three-byte value)', () => {
      const result = encodeVarint(16384);
      expect(result).toEqual(new Uint8Array([0x80, 0x80, 0x01]));
    });

    it('should encode max safe integer (2^53 - 1)', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER; // 9007199254740991
      const result = encodeVarint(maxSafe);
      // Should encode without error
      expect(result.length).toBeGreaterThan(0);
      // Verify roundtrip
      const decoded = decodeVarint(result, 0);
      expect(decoded.value).toBe(maxSafe);
    });

    it('should throw for negative numbers', () => {
      expect(() => encodeVarint(-1)).toThrow();
    });
  });

  describe('decodeVarint', () => {
    it('should decode 0', () => {
      const result = decodeVarint(new Uint8Array([0x00]), 0);
      expect(result.value).toBe(0);
      expect(result.bytesRead).toBe(1);
    });

    it('should decode 1', () => {
      const result = decodeVarint(new Uint8Array([0x01]), 0);
      expect(result.value).toBe(1);
      expect(result.bytesRead).toBe(1);
    });

    it('should decode 127', () => {
      const result = decodeVarint(new Uint8Array([0x7f]), 0);
      expect(result.value).toBe(127);
      expect(result.bytesRead).toBe(1);
    });

    it('should decode 128', () => {
      const result = decodeVarint(new Uint8Array([0x80, 0x01]), 0);
      expect(result.value).toBe(128);
      expect(result.bytesRead).toBe(2);
    });

    it('should decode 16383', () => {
      const result = decodeVarint(new Uint8Array([0xff, 0x7f]), 0);
      expect(result.value).toBe(16383);
      expect(result.bytesRead).toBe(2);
    });

    it('should decode 16384', () => {
      const result = decodeVarint(new Uint8Array([0x80, 0x80, 0x01]), 0);
      expect(result.value).toBe(16384);
      expect(result.bytesRead).toBe(3);
    });

    it('should decode from offset', () => {
      // Prefix bytes + varint for 128
      const buffer = new Uint8Array([0xaa, 0xbb, 0x80, 0x01, 0xcc]);
      const result = decodeVarint(buffer, 2);
      expect(result.value).toBe(128);
      expect(result.bytesRead).toBe(2);
    });

    it('should throw for incomplete varint (buffer ends mid-encoding)', () => {
      // 0x80 indicates continuation but there's no next byte
      const buffer = new Uint8Array([0x80]);
      expect(() => decodeVarint(buffer, 0)).toThrow(/incomplete/i);
    });

    it('should throw for empty buffer', () => {
      expect(() => decodeVarint(new Uint8Array([]), 0)).toThrow(/incomplete/i);
    });

    it('should throw for offset beyond buffer', () => {
      const buffer = new Uint8Array([0x01, 0x02]);
      expect(() => decodeVarint(buffer, 5)).toThrow(/incomplete/i);
    });
  });

  describe('roundtrip encoding', () => {
    const testValues = [
      0,
      1,
      127,
      128,
      255,
      256,
      16383,
      16384,
      65535,
      65536,
      1000000,
      10000000,
      100000000,
      1000000000,
      Number.MAX_SAFE_INTEGER,
    ];

    testValues.forEach((value) => {
      it(`should roundtrip ${value}`, () => {
        const encoded = encodeVarint(value);
        const decoded = decodeVarint(encoded, 0);
        expect(decoded.value).toBe(value);
        expect(decoded.bytesRead).toBe(encoded.length);
      });
    });
  });
});

describe('Log File Header', () => {
  describe('constants', () => {
    it('should define LOG_MAGIC as NCLG', () => {
      // "NCLG" = 0x4E 0x43 0x4C 0x47
      expect(LOG_MAGIC).toBe(0x4e434c47);
    });

    it('should define LOG_VERSION as 1', () => {
      expect(LOG_VERSION).toBe(1);
    });

    it('should define LOG_HEADER_SIZE as 5', () => {
      expect(LOG_HEADER_SIZE).toBe(5);
    });
  });

  describe('writeLogHeader', () => {
    it('should write 5-byte header with magic and version', () => {
      const header = writeLogHeader();
      expect(header.length).toBe(5);
      // Magic: "NCLG" in big-endian
      expect(header[0]).toBe(0x4e); // 'N'
      expect(header[1]).toBe(0x43); // 'C'
      expect(header[2]).toBe(0x4c); // 'L'
      expect(header[3]).toBe(0x47); // 'G'
      // Version
      expect(header[4]).toBe(0x01);
    });
  });

  describe('readLogHeader', () => {
    it('should read valid header', () => {
      const header = new Uint8Array([0x4e, 0x43, 0x4c, 0x47, 0x01]);
      const result = readLogHeader(header);
      expect(result.valid).toBe(true);
      expect(result.version).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid magic number', () => {
      const header = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01]);
      const result = readLogHeader(header);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/magic/i);
    });

    it('should reject unsupported version', () => {
      const header = new Uint8Array([0x4e, 0x43, 0x4c, 0x47, 0x99]);
      const result = readLogHeader(header);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/version/i);
    });

    it('should reject truncated header (< 5 bytes)', () => {
      const header = new Uint8Array([0x4e, 0x43, 0x4c]);
      const result = readLogHeader(header);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/truncated/i);
    });

    it('should handle empty buffer', () => {
      const result = readLogHeader(new Uint8Array([]));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/truncated/i);
    });

    it('should roundtrip write/read', () => {
      const written = writeLogHeader();
      const read = readLogHeader(written);
      expect(read.valid).toBe(true);
      expect(read.version).toBe(LOG_VERSION);
    });
  });
});

describe('Timestamp Encoding', () => {
  describe('encodeTimestamp', () => {
    it('should encode 0', () => {
      const result = encodeTimestamp(0);
      expect(result.length).toBe(8);
      expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it('should encode small timestamp', () => {
      // 1000 milliseconds = 0x3E8
      const result = encodeTimestamp(1000);
      expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0x03, 0xe8]));
    });

    it('should encode a realistic timestamp', () => {
      // 2024-01-01T00:00:00.000Z = 1704067200000
      const timestamp = 1704067200000;
      const result = encodeTimestamp(timestamp);
      expect(result.length).toBe(8);
      // Verify roundtrip
      const decoded = decodeTimestamp(result, 0);
      expect(decoded).toBe(timestamp);
    });

    it('should encode max safe integer', () => {
      const result = encodeTimestamp(Number.MAX_SAFE_INTEGER);
      expect(result.length).toBe(8);
      const decoded = decodeTimestamp(result, 0);
      expect(decoded).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('decodeTimestamp', () => {
    it('should decode 0', () => {
      const buffer = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(decodeTimestamp(buffer, 0)).toBe(0);
    });

    it('should decode from offset', () => {
      const buffer = new Uint8Array([0xff, 0xff, 0, 0, 0, 0, 0, 0, 0x03, 0xe8]);
      expect(decodeTimestamp(buffer, 2)).toBe(1000);
    });

    it('should throw for buffer too short', () => {
      const buffer = new Uint8Array([0, 0, 0, 0]);
      expect(() => decodeTimestamp(buffer, 0)).toThrow();
    });

    it('should throw for offset beyond buffer', () => {
      const buffer = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(() => decodeTimestamp(buffer, 5)).toThrow();
    });
  });

  describe('roundtrip', () => {
    const testTimestamps = [
      0,
      1,
      1000,
      1704067200000, // 2024-01-01
      Date.now(),
      Number.MAX_SAFE_INTEGER,
    ];

    testTimestamps.forEach((timestamp) => {
      it(`should roundtrip ${timestamp}`, () => {
        const encoded = encodeTimestamp(timestamp);
        const decoded = decodeTimestamp(encoded, 0);
        expect(decoded).toBe(timestamp);
      });
    });
  });
});

describe('Log Record Format', () => {
  describe('writeLogRecord', () => {
    it('should write a minimal record', () => {
      const timestamp = 1704067200000;
      const sequence = 1;
      const data = new Uint8Array([0x01, 0x02, 0x03]);

      const record = writeLogRecord(timestamp, sequence, data);

      // Verify structure:
      // - varint length prefix
      // - 8-byte timestamp
      // - varint sequence
      // - data bytes
      expect(record.length).toBeGreaterThan(0);

      // Verify roundtrip
      const parsed = readLogRecord(record, 0);
      expect(parsed.timestamp).toBe(timestamp);
      expect(parsed.sequence).toBe(sequence);
      expect(parsed.data).toEqual(data);
    });

    it('should write record with large sequence number', () => {
      const timestamp = Date.now();
      const sequence = 100000;
      const data = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);

      const record = writeLogRecord(timestamp, sequence, data);
      const parsed = readLogRecord(record, 0);

      expect(parsed.timestamp).toBe(timestamp);
      expect(parsed.sequence).toBe(sequence);
      expect(parsed.data).toEqual(data);
    });

    it('should write record with larger data payload', () => {
      const timestamp = Date.now();
      const sequence = 42;
      const data = new Uint8Array(1000).fill(0x55);

      const record = writeLogRecord(timestamp, sequence, data);
      const parsed = readLogRecord(record, 0);

      expect(parsed.timestamp).toBe(timestamp);
      expect(parsed.sequence).toBe(sequence);
      expect(parsed.data).toEqual(data);
    });
  });

  describe('readLogRecord', () => {
    it('should read record from offset', () => {
      const timestamp = 1704067200000;
      const sequence = 5;
      const data = new Uint8Array([0x01, 0x02]);

      const record = writeLogRecord(timestamp, sequence, data);
      // Prepend some bytes
      const buffer = new Uint8Array(10 + record.length);
      buffer.set([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], 0);
      buffer.set(record, 10);

      const parsed = readLogRecord(buffer, 10);
      expect(parsed.timestamp).toBe(timestamp);
      expect(parsed.sequence).toBe(sequence);
      expect(parsed.data).toEqual(data);
    });

    it('should return bytesRead for consecutive records', () => {
      const record1 = writeLogRecord(1000, 1, new Uint8Array([0x01]));
      const record2 = writeLogRecord(2000, 2, new Uint8Array([0x02]));

      const buffer = new Uint8Array(record1.length + record2.length);
      buffer.set(record1, 0);
      buffer.set(record2, record1.length);

      const parsed1 = readLogRecord(buffer, 0);
      expect(parsed1.bytesRead).toBe(record1.length);

      const parsed2 = readLogRecord(buffer, parsed1.bytesRead);
      expect(parsed2.timestamp).toBe(2000);
      expect(parsed2.sequence).toBe(2);
    });

    it('should detect termination sentinel (length=0)', () => {
      const sentinel = new Uint8Array([0x00]); // varint 0
      const parsed = readLogRecord(sentinel, 0);

      expect(parsed.terminated).toBe(true);
      expect(parsed.bytesRead).toBe(1);
    });

    it('should throw for truncated record', () => {
      // Write a record, then truncate it
      const record = writeLogRecord(1000, 1, new Uint8Array([0x01, 0x02, 0x03]));
      const truncated = record.slice(0, record.length - 2);

      expect(() => readLogRecord(truncated, 0)).toThrow(/truncated/i);
    });
  });
});

describe('Snapshot File Header', () => {
  describe('constants', () => {
    it('should define SNAPSHOT_MAGIC as NCSS', () => {
      // "NCSS" = 0x4E 0x43 0x53 0x53
      expect(SNAPSHOT_MAGIC).toBe(0x4e435353);
    });

    it('should define SNAPSHOT_VERSION as 1', () => {
      expect(SNAPSHOT_VERSION).toBe(1);
    });

    it('should define SNAPSHOT_HEADER_SIZE as 6', () => {
      expect(SNAPSHOT_HEADER_SIZE).toBe(6);
    });

    it('should define status bytes', () => {
      expect(SNAPSHOT_STATUS_INCOMPLETE).toBe(0x00);
      expect(SNAPSHOT_STATUS_COMPLETE).toBe(0x01);
    });
  });

  describe('writeSnapshotHeader', () => {
    it('should write 6-byte header with incomplete status', () => {
      const header = writeSnapshotHeader(false);
      expect(header.length).toBe(6);
      // Magic: "NCSS" in big-endian
      expect(header[0]).toBe(0x4e); // 'N'
      expect(header[1]).toBe(0x43); // 'C'
      expect(header[2]).toBe(0x53); // 'S'
      expect(header[3]).toBe(0x53); // 'S'
      // Version
      expect(header[4]).toBe(0x01);
      // Status (incomplete)
      expect(header[5]).toBe(0x00);
    });

    it('should write 6-byte header with complete status', () => {
      const header = writeSnapshotHeader(true);
      expect(header[5]).toBe(0x01);
    });
  });

  describe('readSnapshotHeader', () => {
    it('should read valid incomplete header', () => {
      const header = new Uint8Array([0x4e, 0x43, 0x53, 0x53, 0x01, 0x00]);
      const result = readSnapshotHeader(header);
      expect(result.valid).toBe(true);
      expect(result.version).toBe(1);
      expect(result.complete).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should read valid complete header', () => {
      const header = new Uint8Array([0x4e, 0x43, 0x53, 0x53, 0x01, 0x01]);
      const result = readSnapshotHeader(header);
      expect(result.valid).toBe(true);
      expect(result.version).toBe(1);
      expect(result.complete).toBe(true);
    });

    it('should reject invalid magic number', () => {
      const header = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x01]);
      const result = readSnapshotHeader(header);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/magic/i);
    });

    it('should reject unsupported version', () => {
      const header = new Uint8Array([0x4e, 0x43, 0x53, 0x53, 0x99, 0x01]);
      const result = readSnapshotHeader(header);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/version/i);
    });

    it('should reject invalid status byte', () => {
      const header = new Uint8Array([0x4e, 0x43, 0x53, 0x53, 0x01, 0x99]);
      const result = readSnapshotHeader(header);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/status/i);
    });

    it('should reject truncated header (< 6 bytes)', () => {
      const header = new Uint8Array([0x4e, 0x43, 0x53, 0x53]);
      const result = readSnapshotHeader(header);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/truncated/i);
    });

    it('should roundtrip write/read incomplete', () => {
      const written = writeSnapshotHeader(false);
      const read = readSnapshotHeader(written);
      expect(read.valid).toBe(true);
      expect(read.complete).toBe(false);
    });

    it('should roundtrip write/read complete', () => {
      const written = writeSnapshotHeader(true);
      const read = readSnapshotHeader(written);
      expect(read.valid).toBe(true);
      expect(read.complete).toBe(true);
    });
  });
});

describe('Vector Clock Serialization', () => {
  describe('writeVectorClock', () => {
    it('should write empty vector clock', () => {
      const clock: VectorClockEntry[] = [];
      const result = writeVectorClock(clock);

      // Should just have entry_count = 0
      expect(result).toEqual(new Uint8Array([0x00]));
    });

    it('should write single entry', () => {
      const clock: VectorClockEntry[] = [
        {
          instanceId: 'inst-abc',
          sequence: 42,
          offset: 1000,
          filename: 'inst-abc_1699028345123.crdtlog',
        },
      ];

      const result = writeVectorClock(clock);
      expect(result.length).toBeGreaterThan(1);

      // Verify roundtrip
      const parsed = readVectorClock(result, 0);
      expect(parsed.entries.length).toBe(1);
      expect(parsed.entries[0].instanceId).toBe('inst-abc');
      expect(parsed.entries[0].sequence).toBe(42);
      expect(parsed.entries[0].offset).toBe(1000);
      expect(parsed.entries[0].filename).toBe('inst-abc_1699028345123.crdtlog');
    });

    it('should write multiple entries', () => {
      const clock: VectorClockEntry[] = [
        {
          instanceId: 'inst-aaa',
          sequence: 100,
          offset: 5000,
          filename: 'inst-aaa_1699028345000.crdtlog',
        },
        {
          instanceId: 'inst-bbb',
          sequence: 50,
          offset: 2500,
          filename: 'inst-bbb_1699028346000.crdtlog',
        },
        {
          instanceId: 'inst-ccc',
          sequence: 1,
          offset: 100,
          filename: 'inst-ccc_1699028347000.crdtlog',
        },
      ];

      const result = writeVectorClock(clock);
      const parsed = readVectorClock(result, 0);

      expect(parsed.entries.length).toBe(3);
      expect(parsed.entries[0].instanceId).toBe('inst-aaa');
      expect(parsed.entries[0].sequence).toBe(100);
      expect(parsed.entries[1].instanceId).toBe('inst-bbb');
      expect(parsed.entries[1].sequence).toBe(50);
      expect(parsed.entries[2].instanceId).toBe('inst-ccc');
      expect(parsed.entries[2].sequence).toBe(1);
    });
  });

  describe('readVectorClock', () => {
    it('should read empty vector clock', () => {
      const buffer = new Uint8Array([0x00]); // entry_count = 0
      const result = readVectorClock(buffer, 0);

      expect(result.entries.length).toBe(0);
      expect(result.bytesRead).toBe(1);
    });

    it('should read from offset', () => {
      const clock: VectorClockEntry[] = [
        {
          instanceId: 'test-id',
          sequence: 10,
          offset: 500,
          filename: 'test.crdtlog',
        },
      ];

      const encoded = writeVectorClock(clock);
      // Prepend some bytes
      const buffer = new Uint8Array(5 + encoded.length);
      buffer.set([0xff, 0xff, 0xff, 0xff, 0xff], 0);
      buffer.set(encoded, 5);

      const result = readVectorClock(buffer, 5);
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].instanceId).toBe('test-id');
    });

    it('should return bytesRead for subsequent parsing', () => {
      const clock: VectorClockEntry[] = [
        {
          instanceId: 'abc',
          sequence: 1,
          offset: 10,
          filename: 'f.log',
        },
      ];

      const encoded = writeVectorClock(clock);
      // Add trailing data
      const buffer = new Uint8Array(encoded.length + 10);
      buffer.set(encoded, 0);
      buffer.fill(0xaa, encoded.length);

      const result = readVectorClock(buffer, 0);
      expect(result.bytesRead).toBe(encoded.length);
    });

    it('should handle large sequence numbers', () => {
      const clock: VectorClockEntry[] = [
        {
          instanceId: 'inst',
          sequence: 1000000000,
          offset: 500000000,
          filename: 'large.crdtlog',
        },
      ];

      const encoded = writeVectorClock(clock);
      const parsed = readVectorClock(encoded, 0);

      expect(parsed.entries[0].sequence).toBe(1000000000);
      expect(parsed.entries[0].offset).toBe(500000000);
    });

    it('should handle UUID-style instance IDs', () => {
      const clock: VectorClockEntry[] = [
        {
          instanceId: '550e8400-e29b-41d4-a716-446655440000',
          sequence: 42,
          offset: 1024,
          filename: '550e8400-e29b-41d4-a716-446655440000_1699028345123.crdtlog',
        },
      ];

      const encoded = writeVectorClock(clock);
      const parsed = readVectorClock(encoded, 0);

      expect(parsed.entries[0].instanceId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(parsed.entries[0].filename).toBe(
        '550e8400-e29b-41d4-a716-446655440000_1699028345123.crdtlog'
      );
    });

    it('should throw for truncated entry count', () => {
      // Incomplete varint for entry count
      const buffer = new Uint8Array([0x80]); // continuation bit set but no next byte
      expect(() => readVectorClock(buffer, 0)).toThrow();
    });
  });
});

describe('Log File Helpers', () => {
  describe('createLogFile', () => {
    it('should create empty log file with just header', () => {
      const buffer = createLogFile([]);
      expect(buffer.length).toBe(LOG_HEADER_SIZE);

      const header = readLogHeader(buffer);
      expect(header.valid).toBe(true);
    });

    it('should create log file with single record', () => {
      const records = [
        { timestamp: 1704067200000, sequence: 1, data: new Uint8Array([0x01, 0x02]) },
      ];
      const buffer = createLogFile(records);

      const parsed = parseLogFile(buffer);
      expect(parsed.records.length).toBe(1);
      expect(parsed.records[0].timestamp).toBe(1704067200000);
      expect(parsed.records[0].sequence).toBe(1);
      expect(parsed.records[0].data).toEqual(new Uint8Array([0x01, 0x02]));
      expect(parsed.terminated).toBe(false);
    });

    it('should create log file with multiple records', () => {
      const records = [
        { timestamp: 1000, sequence: 1, data: new Uint8Array([0xaa]) },
        { timestamp: 2000, sequence: 2, data: new Uint8Array([0xbb]) },
        { timestamp: 3000, sequence: 3, data: new Uint8Array([0xcc]) },
      ];
      const buffer = createLogFile(records);

      const parsed = parseLogFile(buffer);
      expect(parsed.records.length).toBe(3);
      expect(parsed.records[0].sequence).toBe(1);
      expect(parsed.records[1].sequence).toBe(2);
      expect(parsed.records[2].sequence).toBe(3);
    });

    it('should create terminated log file', () => {
      const records = [{ timestamp: 1000, sequence: 1, data: new Uint8Array([0x01]) }];
      const buffer = createLogFile(records, true);

      const parsed = parseLogFile(buffer);
      expect(parsed.records.length).toBe(1);
      expect(parsed.terminated).toBe(true);
    });
  });

  describe('parseLogFile', () => {
    it('should throw for invalid header', () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01]);
      expect(() => parseLogFile(buffer)).toThrow(/invalid.*header/i);
    });

    it('should handle empty log (header only)', () => {
      const buffer = createLogFile([]);
      const parsed = parseLogFile(buffer);

      expect(parsed.version).toBe(LOG_VERSION);
      expect(parsed.records.length).toBe(0);
      expect(parsed.terminated).toBe(false);
    });

    it('should preserve data integrity through roundtrip', () => {
      const originalData = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        originalData[i] = i;
      }

      const records = [{ timestamp: Date.now(), sequence: 42, data: originalData }];
      const buffer = createLogFile(records);
      const parsed = parseLogFile(buffer);

      expect(parsed.records[0].data).toEqual(originalData);
    });
  });
});

describe('Snapshot File Helpers', () => {
  describe('createSnapshotFile', () => {
    it('should create snapshot with empty vector clock', () => {
      const vectorClock: VectorClockEntry[] = [];
      const documentState = new Uint8Array([0x01, 0x02, 0x03]);

      const buffer = createSnapshotFile(vectorClock, documentState, true);

      // Should have header (6) + vector clock (1 for count=0) + document state (3)
      expect(buffer.length).toBe(6 + 1 + 3);

      const parsed = parseSnapshotFile(buffer);
      expect(parsed.complete).toBe(true);
      expect(parsed.vectorClock.length).toBe(0);
      expect(parsed.documentState).toEqual(documentState);
    });

    it('should create snapshot with vector clock entries', () => {
      const vectorClock: VectorClockEntry[] = [
        {
          instanceId: 'inst-abc',
          sequence: 100,
          offset: 5000,
          filename: 'inst-abc_1699028345123.crdtlog',
        },
        {
          instanceId: 'inst-xyz',
          sequence: 50,
          offset: 2500,
          filename: 'inst-xyz_1699028346000.crdtlog',
        },
      ];
      const documentState = new Uint8Array(50).fill(0xaa);

      const buffer = createSnapshotFile(vectorClock, documentState, true);
      const parsed = parseSnapshotFile(buffer);

      expect(parsed.complete).toBe(true);
      expect(parsed.vectorClock.length).toBe(2);
      expect(parsed.vectorClock[0].instanceId).toBe('inst-abc');
      expect(parsed.vectorClock[0].sequence).toBe(100);
      expect(parsed.vectorClock[1].instanceId).toBe('inst-xyz');
      expect(parsed.vectorClock[1].sequence).toBe(50);
      expect(parsed.documentState).toEqual(documentState);
    });

    it('should create incomplete snapshot', () => {
      const vectorClock: VectorClockEntry[] = [];
      const documentState = new Uint8Array([0x01]);

      const buffer = createSnapshotFile(vectorClock, documentState, false);
      const parsed = parseSnapshotFile(buffer);

      expect(parsed.complete).toBe(false);
    });
  });

  describe('parseSnapshotFile', () => {
    it('should throw for invalid header', () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x01]);
      expect(() => parseSnapshotFile(buffer)).toThrow(/invalid.*header/i);
    });

    it('should handle empty document state', () => {
      const vectorClock: VectorClockEntry[] = [];
      const documentState = new Uint8Array(0);

      const buffer = createSnapshotFile(vectorClock, documentState, true);
      const parsed = parseSnapshotFile(buffer);

      expect(parsed.documentState.length).toBe(0);
    });

    it('should preserve large document state', () => {
      const vectorClock: VectorClockEntry[] = [];
      const documentState = new Uint8Array(10000);
      for (let i = 0; i < 10000; i++) {
        documentState[i] = i % 256;
      }

      const buffer = createSnapshotFile(vectorClock, documentState, true);
      const parsed = parseSnapshotFile(buffer);

      expect(parsed.documentState).toEqual(documentState);
    });

    it('should handle complex vector clocks with UUIDs', () => {
      const vectorClock: VectorClockEntry[] = [
        {
          instanceId: '550e8400-e29b-41d4-a716-446655440000',
          sequence: 1000000,
          offset: 500000,
          filename: '550e8400-e29b-41d4-a716-446655440000_1699028345123.crdtlog',
        },
        {
          instanceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          sequence: 500000,
          offset: 250000,
          filename: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890_1699028346000.crdtlog',
        },
        {
          instanceId: 'deadbeef-cafe-babe-1234-567890abcdef',
          sequence: 250000,
          offset: 125000,
          filename: 'deadbeef-cafe-babe-1234-567890abcdef_1699028347000.crdtlog',
        },
      ];
      const documentState = new Uint8Array([0xff, 0xfe, 0xfd]);

      const buffer = createSnapshotFile(vectorClock, documentState, true);
      const parsed = parseSnapshotFile(buffer);

      expect(parsed.vectorClock.length).toBe(3);
      expect(parsed.vectorClock[0].instanceId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(parsed.vectorClock[0].sequence).toBe(1000000);
      expect(parsed.vectorClock[2].filename).toBe(
        'deadbeef-cafe-babe-1234-567890abcdef_1699028347000.crdtlog'
      );
    });
  });
});
