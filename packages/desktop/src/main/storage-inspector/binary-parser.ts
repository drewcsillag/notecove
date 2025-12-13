/**
 * Binary Parser Utilities for Storage Inspector
 *
 * Extends the standard binary format parsers with byte offset tracking
 * for color coding in the hex viewer.
 */

import {
  readLogHeader,
  readSnapshotHeader,
  decodeVarint,
  decodeTimestamp,
  LOG_HEADER_SIZE,
  SNAPSHOT_HEADER_SIZE,
} from '@notecove/shared';

/**
 * Field types for color coding in hex viewer
 * Matches FIELD_COLORS in HexViewer.tsx
 */
export type FieldType =
  | 'magic'
  | 'version'
  | 'timestamp'
  | 'sequence'
  | 'length'
  | 'data'
  | 'error'
  | 'vectorClock'
  | 'status';

/**
 * Parsed field with byte offset information for hex viewer highlighting
 */
export interface ParsedFieldWithOffsets {
  name: string;
  value: string | number;
  startOffset: number;
  endOffset: number;
  type: FieldType;
  /** Error message if parsing failed for this field. Explicit undefined allowed. */
  error?: string | undefined;
}

/**
 * Parsed log record with byte offsets
 */
export interface ParsedLogRecord {
  index: number;
  timestamp: number;
  sequence: number;
  dataSize: number;
  startOffset: number;
  endOffset: number;
  /** Start offset of the Yjs update data (after length, timestamp, sequence) */
  dataStartOffset: number;
  fields: ParsedFieldWithOffsets[];
}

/**
 * Result of parsing a CRDT log file
 */
export interface ParsedCrdtLogResult {
  fields: ParsedFieldWithOffsets[];
  records: ParsedLogRecord[];
  error?: string;
}

/**
 * Vector clock entry with byte offsets
 */
export interface ParsedVectorClockEntry {
  instanceId: string;
  sequence: number;
  offset: number;
  filename: string;
  startOffset: number;
  endOffset: number;
  fields: ParsedFieldWithOffsets[];
}

/**
 * Result of parsing a snapshot file
 */
export interface ParsedSnapshotResult {
  fields: ParsedFieldWithOffsets[];
  vectorClockEntries: ParsedVectorClockEntry[];
  documentStateOffset: number;
  documentStateSize: number;
  complete: boolean;
  error?: string;
}

/**
 * Parse a CRDT log file with byte offset information for hex viewer
 *
 * @param buffer - Raw file data
 * @returns Parsed fields with byte offsets
 */
export function parseCrdtLogWithOffsets(buffer: Uint8Array): ParsedCrdtLogResult {
  const fields: ParsedFieldWithOffsets[] = [];
  const records: ParsedLogRecord[] = [];

  // Check minimum size for header
  if (buffer.length < LOG_HEADER_SIZE) {
    return {
      fields: [
        {
          name: 'Error',
          value: 'Truncated header',
          startOffset: 0,
          endOffset: buffer.length,
          type: 'error',
          error: 'Truncated header: expected at least 5 bytes',
        },
      ],
      records: [],
      error: 'Truncated header: expected at least 5 bytes',
    };
  }

  // Parse header
  const header = readLogHeader(buffer);

  // Magic field
  const magicBytes = buffer.slice(0, 4);
  const magicString = String.fromCharCode(...magicBytes);
  fields.push({
    name: 'Magic',
    value: magicString,
    startOffset: 0,
    endOffset: 4,
    type: header.valid ? 'magic' : 'error',
    error: header.valid ? undefined : header.error,
  });

  // Version field
  fields.push({
    name: 'Version',
    value: buffer[4] ?? 0,
    startOffset: 4,
    endOffset: 5,
    type: header.valid ? 'version' : 'error',
  });

  if (!header.valid) {
    return {
      fields,
      records: [],
      error: `Invalid magic: ${header.error}`,
    };
  }

  // Parse records
  let offset = LOG_HEADER_SIZE;
  let recordIndex = 0;

  while (offset < buffer.length) {
    try {
      const recordStartOffset = offset;
      const recordFields: ParsedFieldWithOffsets[] = [];

      // Read length varint
      const lengthResult = decodeVarint(buffer, offset);
      const payloadLength = lengthResult.value;

      recordFields.push({
        name: 'Length',
        value: payloadLength,
        startOffset: offset,
        endOffset: offset + lengthResult.bytesRead,
        type: 'length',
      });

      offset += lengthResult.bytesRead;

      // Check for termination sentinel
      if (payloadLength === 0) {
        // Termination sentinel - add to main fields list
        fields.push({
          name: 'Termination',
          value: 0,
          startOffset: recordStartOffset,
          endOffset: offset,
          type: 'length',
        });
        break;
      }

      // Verify we have enough bytes
      if (buffer.length < offset + payloadLength) {
        return {
          fields,
          records,
          error: `Truncated record at offset ${recordStartOffset}: expected ${payloadLength} bytes, have ${buffer.length - offset}`,
        };
      }

      // Read timestamp (8 bytes)
      const timestampStartOffset = offset;
      const timestamp = decodeTimestamp(buffer, offset);
      offset += 8;

      recordFields.push({
        name: 'Timestamp',
        value: timestamp,
        startOffset: timestampStartOffset,
        endOffset: offset,
        type: 'timestamp',
      });

      // Read sequence varint
      const sequenceStartOffset = offset;
      const sequenceResult = decodeVarint(buffer, offset);
      const sequence = sequenceResult.value;
      offset += sequenceResult.bytesRead;

      recordFields.push({
        name: 'Sequence',
        value: sequence,
        startOffset: sequenceStartOffset,
        endOffset: offset,
        type: 'sequence',
      });

      // Calculate data length (remaining bytes in payload)
      const dataLength = payloadLength - 8 - sequenceResult.bytesRead;
      const dataStartOffset = offset;

      recordFields.push({
        name: 'Data',
        value: `${dataLength} bytes`,
        startOffset: dataStartOffset,
        endOffset: offset + dataLength,
        type: 'data',
      });

      offset += dataLength;

      // Add record
      records.push({
        index: recordIndex,
        timestamp,
        sequence,
        dataSize: dataLength,
        startOffset: recordStartOffset,
        endOffset: offset,
        dataStartOffset: dataStartOffset,
        fields: recordFields,
      });

      recordIndex++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        fields,
        records,
        error: `Error parsing record at offset ${offset}: ${errorMessage}`,
      };
    }
  }

  return { fields, records };
}

/**
 * Parse a snapshot file with byte offset information for hex viewer
 *
 * @param buffer - Raw file data
 * @returns Parsed fields with byte offsets
 */
export function parseSnapshotWithOffsets(buffer: Uint8Array): ParsedSnapshotResult {
  const fields: ParsedFieldWithOffsets[] = [];
  const vectorClockEntries: ParsedVectorClockEntry[] = [];

  // Check minimum size for header
  if (buffer.length < SNAPSHOT_HEADER_SIZE) {
    return {
      fields: [
        {
          name: 'Error',
          value: 'Truncated header',
          startOffset: 0,
          endOffset: buffer.length,
          type: 'error',
          error: 'Truncated header: expected at least 6 bytes',
        },
      ],
      vectorClockEntries: [],
      documentStateOffset: 0,
      documentStateSize: 0,
      complete: false,
      error: 'Truncated header: expected at least 6 bytes',
    };
  }

  // Parse header
  const header = readSnapshotHeader(buffer);

  // Magic field
  const magicBytes = buffer.slice(0, 4);
  const magicString = String.fromCharCode(...magicBytes);
  fields.push({
    name: 'Magic',
    value: magicString,
    startOffset: 0,
    endOffset: 4,
    type: header.valid ? 'magic' : 'error',
    error: header.valid ? undefined : header.error,
  });

  // Version field
  fields.push({
    name: 'Version',
    value: buffer[4] ?? 0,
    startOffset: 4,
    endOffset: 5,
    type: header.valid ? 'version' : 'error',
  });

  // Status field
  const statusByte = buffer[5] ?? 0;
  fields.push({
    name: 'Status',
    value: statusByte === 0x01 ? 'Complete' : 'Incomplete',
    startOffset: 5,
    endOffset: 6,
    type: 'status',
  });

  if (!header.valid) {
    return {
      fields,
      vectorClockEntries: [],
      documentStateOffset: 0,
      documentStateSize: 0,
      complete: false,
      error: `Invalid magic: ${header.error}`,
    };
  }

  // Parse vector clock
  let offset = SNAPSHOT_HEADER_SIZE;

  try {
    // Read entry count
    const countResult = decodeVarint(buffer, offset);
    const entryCount = countResult.value;

    fields.push({
      name: 'Vector Clock Count',
      value: entryCount,
      startOffset: offset,
      endOffset: offset + countResult.bytesRead,
      type: 'length',
    });

    offset += countResult.bytesRead;

    // Parse each entry
    for (let i = 0; i < entryCount; i++) {
      const entryStartOffset = offset;
      const entryFields: ParsedFieldWithOffsets[] = [];

      // Instance ID length
      const idLenResult = decodeVarint(buffer, offset);
      offset += idLenResult.bytesRead;

      // Instance ID string
      const instanceId = new TextDecoder('utf-8').decode(
        buffer.slice(offset, offset + idLenResult.value)
      );
      entryFields.push({
        name: 'Instance ID',
        value: instanceId,
        startOffset: entryStartOffset,
        endOffset: offset + idLenResult.value,
        type: 'vectorClock',
      });
      offset += idLenResult.value;

      // Sequence
      const seqStartOffset = offset;
      const seqResult = decodeVarint(buffer, offset);
      entryFields.push({
        name: 'Sequence',
        value: seqResult.value,
        startOffset: seqStartOffset,
        endOffset: offset + seqResult.bytesRead,
        type: 'sequence',
      });
      offset += seqResult.bytesRead;

      // Offset
      const offsetStartOffset = offset;
      const offsetResult = decodeVarint(buffer, offset);
      entryFields.push({
        name: 'Offset',
        value: offsetResult.value,
        startOffset: offsetStartOffset,
        endOffset: offset + offsetResult.bytesRead,
        type: 'length',
      });
      offset += offsetResult.bytesRead;

      // Filename length
      const filenameLenResult = decodeVarint(buffer, offset);
      offset += filenameLenResult.bytesRead;

      // Filename string
      const filenameStartOffset = offset - filenameLenResult.bytesRead;
      const filename = new TextDecoder('utf-8').decode(
        buffer.slice(offset, offset + filenameLenResult.value)
      );
      entryFields.push({
        name: 'Filename',
        value: filename,
        startOffset: filenameStartOffset,
        endOffset: offset + filenameLenResult.value,
        type: 'vectorClock',
      });
      offset += filenameLenResult.value;

      vectorClockEntries.push({
        instanceId,
        sequence: seqResult.value,
        offset: offsetResult.value,
        filename,
        startOffset: entryStartOffset,
        endOffset: offset,
        fields: entryFields,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      fields,
      vectorClockEntries,
      documentStateOffset: offset,
      documentStateSize: Math.max(0, buffer.length - offset),
      complete: header.complete,
      error: `Error parsing vector clock: ${errorMessage}`,
    };
  }

  // Document state is everything after vector clock
  const documentStateOffset = offset;
  const documentStateSize = buffer.length - offset;

  if (documentStateSize > 0) {
    fields.push({
      name: 'Document State',
      value: `${documentStateSize} bytes`,
      startOffset: documentStateOffset,
      endOffset: buffer.length,
      type: 'data',
    });
  }

  return {
    fields,
    vectorClockEntries,
    documentStateOffset,
    documentStateSize,
    complete: header.complete,
  };
}
