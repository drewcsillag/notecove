/**
 * Binary Parser Utilities Tests for Storage Inspector
 *
 * Tests for parsers that return byte offset information for hex viewer color coding.
 */

import {
  parseCrdtLogWithOffsets,
  parseSnapshotWithOffsets,
  type ParsedFieldWithOffsets,
} from '../binary-parser';
import {
  writeLogHeader,
  writeLogRecord,
  writeSnapshotHeader,
  writeVectorClock,
  LOG_HEADER_SIZE,
} from '@notecove/shared';

describe('parseCrdtLogWithOffsets', () => {
  /**
   * Create a test log file with given records
   */
  function createTestLogFile(
    records: { timestamp: number; sequence: number; data: Uint8Array }[]
  ): Uint8Array {
    const parts: Uint8Array[] = [];
    parts.push(writeLogHeader());
    for (const record of records) {
      parts.push(writeLogRecord(record.timestamp, record.sequence, record.data));
    }
    const totalSize = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  it('should parse header fields with correct offsets', () => {
    const logFile = createTestLogFile([
      { timestamp: 1699028345123, sequence: 1, data: new Uint8Array([0x01, 0x02, 0x03]) },
    ]);

    const result = parseCrdtLogWithOffsets(logFile);

    expect(result.error).toBeUndefined();
    expect(result.fields.length).toBeGreaterThan(0);

    // Check magic field
    const magicField = result.fields.find((f) => f.name === 'Magic');
    expect(magicField).toBeDefined();
    expect(magicField!.startOffset).toBe(0);
    expect(magicField!.endOffset).toBe(4);
    expect(magicField!.type).toBe('magic');
    expect(magicField!.value).toBe('NCLG');

    // Check version field
    const versionField = result.fields.find((f) => f.name === 'Version');
    expect(versionField).toBeDefined();
    expect(versionField!.startOffset).toBe(4);
    expect(versionField!.endOffset).toBe(5);
    expect(versionField!.type).toBe('version');
    expect(versionField!.value).toBe(1);
  });

  it('should parse record fields with correct offsets', () => {
    const data = new Uint8Array([0xab, 0xcd, 0xef]);
    const timestamp = 1699028345123;
    const sequence = 42;

    const logFile = createTestLogFile([{ timestamp, sequence, data }]);

    const result = parseCrdtLogWithOffsets(logFile);

    expect(result.error).toBeUndefined();
    expect(result.records.length).toBe(1);

    const record = result.records[0]!;
    expect(record.timestamp).toBe(timestamp);
    expect(record.sequence).toBe(sequence);
    expect(record.dataSize).toBe(data.length);
    expect(record.index).toBe(0);

    // Check record fields
    expect(record.fields.length).toBeGreaterThan(0);

    // Length field should start at LOG_HEADER_SIZE
    const lengthField = record.fields.find((f) => f.name === 'Length');
    expect(lengthField).toBeDefined();
    expect(lengthField!.startOffset).toBe(LOG_HEADER_SIZE);
    expect(lengthField!.type).toBe('length');

    // Timestamp field should follow length
    const timestampField = record.fields.find((f) => f.name === 'Timestamp');
    expect(timestampField).toBeDefined();
    expect(timestampField!.type).toBe('timestamp');
    expect(timestampField!.endOffset - timestampField!.startOffset).toBe(8);

    // Sequence field should follow timestamp
    const sequenceField = record.fields.find((f) => f.name === 'Sequence');
    expect(sequenceField).toBeDefined();
    expect(sequenceField!.type).toBe('sequence');

    // Data field should be last
    const dataField = record.fields.find((f) => f.name === 'Data');
    expect(dataField).toBeDefined();
    expect(dataField!.type).toBe('data');
    expect(dataField!.endOffset - dataField!.startOffset).toBe(3);
  });

  it('should parse multiple records', () => {
    const logFile = createTestLogFile([
      { timestamp: 1699028345123, sequence: 1, data: new Uint8Array([0x01]) },
      { timestamp: 1699028345200, sequence: 2, data: new Uint8Array([0x02, 0x03]) },
      { timestamp: 1699028345300, sequence: 3, data: new Uint8Array([0x04, 0x05, 0x06]) },
    ]);

    const result = parseCrdtLogWithOffsets(logFile);

    expect(result.error).toBeUndefined();
    expect(result.records.length).toBe(3);

    // Check record indices
    expect(result.records[0]!.index).toBe(0);
    expect(result.records[1]!.index).toBe(1);
    expect(result.records[2]!.index).toBe(2);

    // Check sequences
    expect(result.records[0]!.sequence).toBe(1);
    expect(result.records[1]!.sequence).toBe(2);
    expect(result.records[2]!.sequence).toBe(3);

    // Records should not overlap in offsets
    const record0EndOffset = Math.max(...result.records[0]!.fields.map((f) => f.endOffset));
    const record1StartOffset = Math.min(...result.records[1]!.fields.map((f) => f.startOffset));
    expect(record1StartOffset).toBeGreaterThanOrEqual(record0EndOffset);
  });

  it('should handle invalid magic number', () => {
    const invalidFile = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x01]);

    const result = parseCrdtLogWithOffsets(invalidFile);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid magic');
    // Should still provide error field for visualization
    const errorField = result.fields.find((f) => f.type === 'error');
    expect(errorField).toBeDefined();
  });

  it('should handle truncated file', () => {
    // File with only partial header
    const truncated = new Uint8Array([0x4e, 0x43, 0x4c]); // "NCL" - missing 'G' and version

    const result = parseCrdtLogWithOffsets(truncated);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Truncated');
  });

  it('should handle truncated record', () => {
    const header = writeLogHeader();
    // Add a length varint that claims more data than exists
    const truncatedRecord = new Uint8Array([...header, 0x10]); // Length=16 but no data

    const result = parseCrdtLogWithOffsets(truncatedRecord);

    // Should partially parse and flag error
    expect(result.fields.length).toBeGreaterThan(0); // Header should be parsed
    expect(result.error).toBeDefined();
  });

  it('should handle empty log file (header only)', () => {
    const headerOnly = writeLogHeader();

    const result = parseCrdtLogWithOffsets(headerOnly);

    expect(result.error).toBeUndefined();
    expect(result.records.length).toBe(0);
    expect(result.fields.length).toBe(2); // Magic + Version
  });
});

describe('parseSnapshotWithOffsets', () => {
  /**
   * Create a test snapshot file
   */
  function createTestSnapshotFile(
    vectorClock: { instanceId: string; sequence: number; offset: number; filename: string }[],
    documentState: Uint8Array,
    complete = true
  ): Uint8Array {
    const parts: Uint8Array[] = [];
    parts.push(writeSnapshotHeader(complete));
    parts.push(writeVectorClock(vectorClock));
    parts.push(documentState);

    const totalSize = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  it('should parse header fields with correct offsets', () => {
    const snapshot = createTestSnapshotFile([], new Uint8Array([0x01, 0x02]), true);

    const result = parseSnapshotWithOffsets(snapshot);

    expect(result.error).toBeUndefined();

    // Check magic field
    const magicField = result.fields.find((f) => f.name === 'Magic');
    expect(magicField).toBeDefined();
    expect(magicField!.startOffset).toBe(0);
    expect(magicField!.endOffset).toBe(4);
    expect(magicField!.type).toBe('magic');
    expect(magicField!.value).toBe('NCSS');

    // Check version field
    const versionField = result.fields.find((f) => f.name === 'Version');
    expect(versionField).toBeDefined();
    expect(versionField!.startOffset).toBe(4);
    expect(versionField!.endOffset).toBe(5);
    expect(versionField!.type).toBe('version');

    // Check status field
    const statusField = result.fields.find((f) => f.name === 'Status');
    expect(statusField).toBeDefined();
    expect(statusField!.startOffset).toBe(5);
    expect(statusField!.endOffset).toBe(6);
    expect(statusField!.type).toBe('status');
    expect(statusField!.value).toBe('Complete');
  });

  it('should parse vector clock entries with correct offsets', () => {
    const snapshot = createTestSnapshotFile(
      [
        { instanceId: 'inst-abc123', sequence: 42, offset: 1000, filename: 'test.crdtlog' },
        { instanceId: 'inst-def456', sequence: 10, offset: 500, filename: 'other.crdtlog' },
      ],
      new Uint8Array([0x01]),
      true
    );

    const result = parseSnapshotWithOffsets(snapshot);

    expect(result.error).toBeUndefined();
    expect(result.vectorClockEntries.length).toBe(2);

    // Check first entry
    const entry0 = result.vectorClockEntries[0]!;
    expect(entry0.instanceId).toBe('inst-abc123');
    expect(entry0.sequence).toBe(42);
    expect(entry0.offset).toBe(1000);
    expect(entry0.filename).toBe('test.crdtlog');
    expect(entry0.fields.length).toBeGreaterThan(0);

    // Check vector clock fields have correct types
    const instanceIdField = entry0.fields.find((f) => f.name === 'Instance ID');
    expect(instanceIdField).toBeDefined();
    expect(instanceIdField!.type).toBe('vectorClock');

    // Check second entry
    const entry1 = result.vectorClockEntries[1]!;
    expect(entry1.instanceId).toBe('inst-def456');
    expect(entry1.sequence).toBe(10);
  });

  it('should parse document state with correct offsets', () => {
    const docState = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]);
    const snapshot = createTestSnapshotFile([], docState, true);

    const result = parseSnapshotWithOffsets(snapshot);

    expect(result.error).toBeUndefined();

    // Document state field should be at the end
    const dataField = result.fields.find((f) => f.name === 'Document State');
    expect(dataField).toBeDefined();
    expect(dataField!.type).toBe('data');
    expect(dataField!.endOffset - dataField!.startOffset).toBe(docState.length);
  });

  it('should handle incomplete status', () => {
    const snapshot = createTestSnapshotFile([], new Uint8Array([0x01]), false);

    const result = parseSnapshotWithOffsets(snapshot);

    const statusField = result.fields.find((f) => f.name === 'Status');
    expect(statusField).toBeDefined();
    expect(statusField!.value).toBe('Incomplete');
  });

  it('should handle invalid magic number', () => {
    const invalidFile = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x01, 0x01]);

    const result = parseSnapshotWithOffsets(invalidFile);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid magic');
  });

  it('should handle truncated file', () => {
    const truncated = new Uint8Array([0x4e, 0x43, 0x53]); // "NCS" - missing 'S', version, status

    const result = parseSnapshotWithOffsets(truncated);

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Truncated');
  });

  it('should handle empty vector clock', () => {
    const snapshot = createTestSnapshotFile([], new Uint8Array([0x01, 0x02]), true);

    const result = parseSnapshotWithOffsets(snapshot);

    expect(result.error).toBeUndefined();
    expect(result.vectorClockEntries.length).toBe(0);

    // Should have vector clock count field
    const countField = result.fields.find((f) => f.name === 'Vector Clock Count');
    expect(countField).toBeDefined();
    expect(countField!.type).toBe('length');
    expect(countField!.value).toBe(0);
  });
});

describe('ParsedFieldWithOffsets interface', () => {
  it('should support all field types defined in PLAN.md', () => {
    // Verify the type system allows all expected field types
    const validTypes: ParsedFieldWithOffsets['type'][] = [
      'magic',
      'version',
      'timestamp',
      'sequence',
      'length',
      'data',
      'error',
      'vectorClock',
      'status',
    ];

    // This test is primarily a compile-time check
    expect(validTypes.length).toBe(9);
  });
});
