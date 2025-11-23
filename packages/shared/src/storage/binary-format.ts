/**
 * Binary Format Utilities
 *
 * LEB128 varint encoding and file format primitives for the CRDT log storage system.
 *
 * @see STORAGE-FORMAT-DESIGN.md for specification
 */

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
// Non-null assertions required for desktop's noUncheckedIndexedAccess but flagged as unnecessary by shared's looser settings

// Log file magic number: "NCLG" in ASCII (big-endian)
export const LOG_MAGIC = 0x4e434c47;

// Current log file format version
export const LOG_VERSION = 1;

// Log header size in bytes (4 magic + 1 version)
export const LOG_HEADER_SIZE = 5;

// Snapshot file magic number: "NCSS" in ASCII (big-endian)
export const SNAPSHOT_MAGIC = 0x4e435353;

// Current snapshot file format version
export const SNAPSHOT_VERSION = 1;

// Snapshot header size in bytes (4 magic + 1 version + 1 status)
export const SNAPSHOT_HEADER_SIZE = 6;

// Snapshot status bytes
export const SNAPSHOT_STATUS_INCOMPLETE = 0x00;
export const SNAPSHOT_STATUS_COMPLETE = 0x01;

/**
 * Encode a non-negative integer as an unsigned LEB128 varint.
 *
 * LEB128 (Little Endian Base 128) encodes integers in 7-bit groups,
 * with the high bit indicating continuation (1 = more bytes follow).
 *
 * @param value - Non-negative integer to encode (0 to Number.MAX_SAFE_INTEGER)
 * @returns Uint8Array containing the encoded varint
 * @throws Error if value is negative
 */
export function encodeVarint(value: number): Uint8Array {
  if (value < 0) {
    throw new Error('Cannot encode negative numbers as unsigned varint');
  }

  // Fast path for small values (most common case)
  if (value < 128) {
    return new Uint8Array([value]);
  }

  // Calculate how many bytes we need
  const bytes: number[] = [];
  let remaining = value;

  while (remaining >= 0x80) {
    // Take low 7 bits, set continuation bit
    bytes.push((remaining & 0x7f) | 0x80);
    // Shift right by 7 bits
    remaining = Math.floor(remaining / 128);
  }
  // Last byte has no continuation bit
  bytes.push(remaining);

  return new Uint8Array(bytes);
}

/**
 * Decode an unsigned LEB128 varint from a buffer.
 *
 * @param buffer - Buffer containing the varint
 * @param offset - Starting position in the buffer
 * @returns Object with decoded value and number of bytes read
 * @throws Error if the varint is incomplete (buffer ends mid-encoding)
 */
export function decodeVarint(
  buffer: Uint8Array,
  offset: number
): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  for (;;) {
    if (offset + bytesRead >= buffer.length) {
      throw new Error('Incomplete varint: buffer ends mid-encoding');
    }

    // Safe after length check above
    const byte = buffer[offset + bytesRead]!;
    bytesRead++;

    // Add the low 7 bits to our value
    value += (byte & 0x7f) * Math.pow(2, shift);
    shift += 7;

    // If high bit is not set, this is the last byte
    if ((byte & 0x80) === 0) {
      break;
    }

    // Safety check for overflow (JavaScript safe integer limit)
    if (shift > 56) {
      throw new Error('Varint too large for safe JavaScript integer');
    }
  }

  return { value, bytesRead };
}

/**
 * Write a log file header.
 *
 * Format (5 bytes):
 * - Bytes 0-3: Magic number "NCLG" (0x4E 0x43 0x4C 0x47, big-endian)
 * - Byte 4: Version (0x01)
 *
 * @returns Uint8Array containing the header
 */
export function writeLogHeader(): Uint8Array {
  const header = new Uint8Array(LOG_HEADER_SIZE);
  // Magic number in big-endian
  header[0] = 0x4e; // 'N'
  header[1] = 0x43; // 'C'
  header[2] = 0x4c; // 'L'
  header[3] = 0x47; // 'G'
  // Version
  header[4] = LOG_VERSION;
  return header;
}

/**
 * Read and validate a log file header.
 *
 * @param buffer - Buffer containing at least 5 bytes
 * @returns Object with validation result, version, and optional error message
 */
export function readLogHeader(buffer: Uint8Array): {
  valid: boolean;
  version: number;
  error?: string;
} {
  if (buffer.length < LOG_HEADER_SIZE) {
    return {
      valid: false,
      version: 0,
      error: 'Truncated header: expected at least 5 bytes',
    };
  }

  // Check magic number (safe after length check above)
  const magic = (buffer[0]! << 24) | (buffer[1]! << 16) | (buffer[2]! << 8) | buffer[3]!;
  if (magic !== LOG_MAGIC) {
    return {
      valid: false,
      version: 0,
      error: `Invalid magic number: expected 0x${LOG_MAGIC.toString(16)}, got 0x${magic.toString(16)}`,
    };
  }

  // Check version (safe after length check above)
  const version = buffer[4]!;
  if (version !== LOG_VERSION) {
    return {
      valid: false,
      version,
      error: `Unsupported version: expected ${LOG_VERSION}, got ${version}`,
    };
  }

  return { valid: true, version };
}

/**
 * Write a snapshot file header.
 *
 * Format (6 bytes):
 * - Bytes 0-3: Magic number "NCSS" (0x4E 0x43 0x53 0x53, big-endian)
 * - Byte 4: Version (0x01)
 * - Byte 5: Status (0x00 = incomplete, 0x01 = complete)
 *
 * @param complete - Whether the snapshot is complete
 * @returns Uint8Array containing the header
 */
export function writeSnapshotHeader(complete: boolean = false): Uint8Array {
  const header = new Uint8Array(SNAPSHOT_HEADER_SIZE);
  // Magic number in big-endian
  header[0] = 0x4e; // 'N'
  header[1] = 0x43; // 'C'
  header[2] = 0x53; // 'S'
  header[3] = 0x53; // 'S'
  // Version
  header[4] = SNAPSHOT_VERSION;
  // Status
  header[5] = complete ? SNAPSHOT_STATUS_COMPLETE : SNAPSHOT_STATUS_INCOMPLETE;
  return header;
}

/**
 * Read and validate a snapshot file header.
 *
 * @param buffer - Buffer containing at least 6 bytes
 * @returns Object with validation result, version, completion status, and optional error
 */
export function readSnapshotHeader(buffer: Uint8Array): {
  valid: boolean;
  version: number;
  complete: boolean;
  error?: string;
} {
  if (buffer.length < SNAPSHOT_HEADER_SIZE) {
    return {
      valid: false,
      version: 0,
      complete: false,
      error: 'Truncated header: expected at least 6 bytes',
    };
  }

  // Check magic number (safe after length check above)
  const magic = (buffer[0]! << 24) | (buffer[1]! << 16) | (buffer[2]! << 8) | buffer[3]!;
  if (magic !== SNAPSHOT_MAGIC) {
    return {
      valid: false,
      version: 0,
      complete: false,
      error: `Invalid magic number: expected 0x${SNAPSHOT_MAGIC.toString(16)}, got 0x${magic.toString(16)}`,
    };
  }

  // Check version (safe after length check above)
  const version = buffer[4]!;
  if (version !== SNAPSHOT_VERSION) {
    return {
      valid: false,
      version,
      complete: false,
      error: `Unsupported version: expected ${SNAPSHOT_VERSION}, got ${version}`,
    };
  }

  // Check status (safe after length check above)
  const status = buffer[5]!;
  if (status !== SNAPSHOT_STATUS_INCOMPLETE && status !== SNAPSHOT_STATUS_COMPLETE) {
    return {
      valid: false,
      version,
      complete: false,
      error: `Invalid status byte: expected 0x00 or 0x01, got 0x${status.toString(16)}`,
    };
  }

  return {
    valid: true,
    version,
    complete: status === SNAPSHOT_STATUS_COMPLETE,
  };
}

/**
 * Encode a 64-bit timestamp as big-endian bytes.
 *
 * @param timestamp - Milliseconds since Unix epoch
 * @returns 8-byte Uint8Array
 */
export function encodeTimestamp(timestamp: number): Uint8Array {
  const buffer = new Uint8Array(8);
  // JavaScript numbers can safely represent integers up to 2^53-1
  // We split into high and low 32-bit parts
  const high = Math.floor(timestamp / 0x100000000);
  const low = timestamp >>> 0;

  buffer[0] = (high >>> 24) & 0xff;
  buffer[1] = (high >>> 16) & 0xff;
  buffer[2] = (high >>> 8) & 0xff;
  buffer[3] = high & 0xff;
  buffer[4] = (low >>> 24) & 0xff;
  buffer[5] = (low >>> 16) & 0xff;
  buffer[6] = (low >>> 8) & 0xff;
  buffer[7] = low & 0xff;

  return buffer;
}

/**
 * Decode a 64-bit big-endian timestamp.
 *
 * @param buffer - Buffer containing at least 8 bytes from offset
 * @param offset - Starting position in the buffer
 * @returns Decoded timestamp in milliseconds
 */
export function decodeTimestamp(buffer: Uint8Array, offset: number): number {
  if (buffer.length < offset + 8) {
    throw new Error('Buffer too short to read timestamp');
  }

  // Safe after length check above
  const high =
    (buffer[offset]! << 24) |
    (buffer[offset + 1]! << 16) |
    (buffer[offset + 2]! << 8) |
    buffer[offset + 3]!;
  const low =
    (buffer[offset + 4]! << 24) |
    (buffer[offset + 5]! << 16) |
    (buffer[offset + 6]! << 8) |
    buffer[offset + 7]!;

  // Reconstruct the full value
  // Note: high needs to be treated as unsigned
  return (high >>> 0) * 0x100000000 + (low >>> 0);
}

/**
 * Vector clock entry for tracking sync state across instances.
 */
export interface VectorClockEntry {
  /** Instance UUID */
  instanceId: string;
  /** Highest sequence number seen from this instance */
  sequence: number;
  /** Byte offset in that instance's log file */
  offset: number;
  /** Log filename (e.g., "inst-abc_1699028345123.crdtlog") */
  filename: string;
}

/**
 * Log record structure returned by readLogRecord
 */
export interface LogRecord {
  /** Unix milliseconds when change was made */
  timestamp: number;
  /** Per-instance sequence number */
  sequence: number;
  /** Raw Yjs update data */
  data: Uint8Array;
  /** Total bytes consumed from buffer */
  bytesRead: number;
  /** True if this is the termination sentinel (length=0) */
  terminated: boolean;
}

/**
 * Write a log record.
 *
 * Format:
 * - varint: length of (timestamp + sequence + data)
 * - 8 bytes: timestamp (big-endian)
 * - varint: sequence number
 * - bytes: data
 *
 * @param timestamp - Unix milliseconds when change was made
 * @param sequence - Per-instance sequence number
 * @param data - Raw Yjs update data
 * @returns Uint8Array containing the complete record
 */
export function writeLogRecord(timestamp: number, sequence: number, data: Uint8Array): Uint8Array {
  // Encode components
  const timestampBytes = encodeTimestamp(timestamp);
  const sequenceBytes = encodeVarint(sequence);

  // Calculate total payload length (timestamp + sequence + data)
  const payloadLength = timestampBytes.length + sequenceBytes.length + data.length;
  const lengthBytes = encodeVarint(payloadLength);

  // Assemble the record
  const record = new Uint8Array(lengthBytes.length + payloadLength);
  let offset = 0;

  record.set(lengthBytes, offset);
  offset += lengthBytes.length;

  record.set(timestampBytes, offset);
  offset += timestampBytes.length;

  record.set(sequenceBytes, offset);
  offset += sequenceBytes.length;

  record.set(data, offset);

  return record;
}

/**
 * Write the termination sentinel (length=0).
 *
 * @returns Uint8Array containing the sentinel byte
 */
export function writeTerminationSentinel(): Uint8Array {
  return new Uint8Array([0x00]);
}

/**
 * Read a log record from a buffer.
 *
 * @param buffer - Buffer containing record data
 * @param offset - Starting position in the buffer
 * @returns Parsed log record with timestamp, sequence, data, and bytesRead
 * @throws Error if the record is truncated
 */
export function readLogRecord(buffer: Uint8Array, offset: number): LogRecord {
  // Read length prefix
  const lengthResult = decodeVarint(buffer, offset);
  const payloadLength = lengthResult.value;
  let pos = offset + lengthResult.bytesRead;

  // Check for termination sentinel
  if (payloadLength === 0) {
    return {
      timestamp: 0,
      sequence: 0,
      data: new Uint8Array(0),
      bytesRead: lengthResult.bytesRead,
      terminated: true,
    };
  }

  // Verify we have enough bytes
  if (buffer.length < pos + payloadLength) {
    throw new Error(
      `Truncated record: expected ${payloadLength} bytes, have ${buffer.length - pos}`
    );
  }

  // Read timestamp (8 bytes)
  const timestamp = decodeTimestamp(buffer, pos);
  pos += 8;

  // Read sequence
  const sequenceResult = decodeVarint(buffer, pos);
  const sequence = sequenceResult.value;
  pos += sequenceResult.bytesRead;

  // Read data (remaining bytes in payload)
  const dataLength = payloadLength - 8 - sequenceResult.bytesRead;
  const data = buffer.slice(pos, pos + dataLength);

  return {
    timestamp,
    sequence,
    data,
    bytesRead: lengthResult.bytesRead + payloadLength,
    terminated: false,
  };
}

// Text encoder/decoder for UTF-8 string handling
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

/**
 * Write a vector clock to binary format.
 *
 * Format:
 * - varint: entry_count
 * For each entry:
 * - varint: instance_id_len
 * - bytes: instance_id (UTF-8)
 * - varint: sequence
 * - varint: offset
 * - varint: filename_len
 * - bytes: filename (UTF-8)
 *
 * @param entries - Array of vector clock entries
 * @returns Uint8Array containing the serialized vector clock
 */
export function writeVectorClock(entries: VectorClockEntry[]): Uint8Array {
  // Encode all parts first to calculate total size
  const parts: Uint8Array[] = [];

  // Entry count
  parts.push(encodeVarint(entries.length));

  for (const entry of entries) {
    // Instance ID
    const instanceIdBytes = textEncoder.encode(entry.instanceId);
    parts.push(encodeVarint(instanceIdBytes.length));
    parts.push(instanceIdBytes);

    // Sequence
    parts.push(encodeVarint(entry.sequence));

    // Offset
    parts.push(encodeVarint(entry.offset));

    // Filename
    const filenameBytes = textEncoder.encode(entry.filename);
    parts.push(encodeVarint(filenameBytes.length));
    parts.push(filenameBytes);
  }

  // Calculate total size
  const totalSize = parts.reduce((sum, part) => sum + part.length, 0);

  // Assemble result
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

/**
 * Read a vector clock from binary format.
 *
 * @param buffer - Buffer containing vector clock data
 * @param offset - Starting position in the buffer
 * @returns Parsed entries and bytes consumed
 */
export function readVectorClock(
  buffer: Uint8Array,
  offset: number
): { entries: VectorClockEntry[]; bytesRead: number } {
  let pos = offset;

  // Read entry count
  const countResult = decodeVarint(buffer, pos);
  const entryCount = countResult.value;
  pos += countResult.bytesRead;

  const entries: VectorClockEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    // Read instance ID
    const idLenResult = decodeVarint(buffer, pos);
    pos += idLenResult.bytesRead;
    const instanceId = textDecoder.decode(buffer.slice(pos, pos + idLenResult.value));
    pos += idLenResult.value;

    // Read sequence
    const seqResult = decodeVarint(buffer, pos);
    pos += seqResult.bytesRead;

    // Read offset
    const offsetResult = decodeVarint(buffer, pos);
    pos += offsetResult.bytesRead;

    // Read filename
    const filenameLenResult = decodeVarint(buffer, pos);
    pos += filenameLenResult.bytesRead;
    const filename = textDecoder.decode(buffer.slice(pos, pos + filenameLenResult.value));
    pos += filenameLenResult.value;

    entries.push({
      instanceId,
      sequence: seqResult.value,
      offset: offsetResult.value,
      filename,
    });
  }

  return {
    entries,
    bytesRead: pos - offset,
  };
}

/**
 * Create a complete log file buffer with header and records.
 *
 * @param records - Array of records to include (timestamp, sequence, data)
 * @param terminated - Whether to include termination sentinel
 * @returns Complete log file as Uint8Array
 */
export function createLogFile(
  records: Array<{ timestamp: number; sequence: number; data: Uint8Array }>,
  terminated = false
): Uint8Array {
  const parts: Uint8Array[] = [];

  // Header
  parts.push(writeLogHeader());

  // Records
  for (const record of records) {
    parts.push(writeLogRecord(record.timestamp, record.sequence, record.data));
  }

  // Optional termination sentinel
  if (terminated) {
    parts.push(writeTerminationSentinel());
  }

  // Assemble
  const totalSize = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

/**
 * Parse all records from a log file buffer.
 *
 * @param buffer - Complete log file buffer (including header)
 * @returns Array of parsed records
 * @throws Error if header is invalid or records are corrupted
 */
export function parseLogFile(buffer: Uint8Array): {
  version: number;
  records: Array<{
    timestamp: number;
    sequence: number;
    data: Uint8Array;
  }>;
  terminated: boolean;
} {
  // Validate header
  const header = readLogHeader(buffer);
  if (!header.valid) {
    throw new Error(`Invalid log file header: ${header.error}`);
  }

  const records: Array<{
    timestamp: number;
    sequence: number;
    data: Uint8Array;
  }> = [];
  let offset = LOG_HEADER_SIZE;
  let terminated = false;

  while (offset < buffer.length) {
    const record = readLogRecord(buffer, offset);

    if (record.terminated) {
      terminated = true;
      break;
    }

    records.push({
      timestamp: record.timestamp,
      sequence: record.sequence,
      data: record.data,
    });

    offset += record.bytesRead;
  }

  return {
    version: header.version,
    records,
    terminated,
  };
}

/**
 * Create a complete snapshot file buffer.
 *
 * Format:
 * - 6 bytes: header (magic + version + status)
 * - variable: vector clock
 * - remaining: document state (Yjs encoded state)
 *
 * @param vectorClock - Vector clock entries
 * @param documentState - Yjs document state
 * @param complete - Whether snapshot is complete (status byte)
 * @returns Complete snapshot file as Uint8Array
 */
export function createSnapshotFile(
  vectorClock: VectorClockEntry[],
  documentState: Uint8Array,
  complete: boolean
): Uint8Array {
  const parts: Uint8Array[] = [];

  // Header
  parts.push(writeSnapshotHeader(complete));

  // Vector clock
  parts.push(writeVectorClock(vectorClock));

  // Document state
  parts.push(documentState);

  // Assemble
  const totalSize = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

/**
 * Parse a snapshot file buffer.
 *
 * @param buffer - Complete snapshot file buffer
 * @returns Parsed snapshot with header info, vector clock, and document state
 * @throws Error if header is invalid
 */
export function parseSnapshotFile(buffer: Uint8Array): {
  version: number;
  complete: boolean;
  vectorClock: VectorClockEntry[];
  documentState: Uint8Array;
} {
  // Validate header
  const header = readSnapshotHeader(buffer);
  if (!header.valid) {
    throw new Error(`Invalid snapshot header: ${header.error}`);
  }

  // Read vector clock
  const vectorClockResult = readVectorClock(buffer, SNAPSHOT_HEADER_SIZE);

  // Document state is everything after vector clock
  const documentStateOffset = SNAPSHOT_HEADER_SIZE + vectorClockResult.bytesRead;
  const documentState = buffer.slice(documentStateOffset);

  return {
    version: header.version,
    complete: header.complete,
    vectorClock: vectorClockResult.entries,
    documentState,
  };
}
