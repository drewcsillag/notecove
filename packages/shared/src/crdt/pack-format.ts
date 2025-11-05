/**
 * Pack file format for CRDT updates
 * Phase 4.1bis Phase 2: Packing
 *
 * Packs reduce file count by batching 50-100 updates into a single file.
 * Each pack is per-instance and contains contiguous sequence numbers.
 */

import type { UUID } from '../types';

/**
 * Format version for pack files
 */
export const PACK_FORMAT_VERSION = 1;

/**
 * Single update entry within a pack
 */
export interface PackUpdateEntry {
  seq: number; // Sequence number
  timestamp: number; // When this update was created
  data: Uint8Array; // Yjs update data
}

/**
 * Pack file data structure
 */
export interface PackData {
  version: number;
  instanceId: string;
  noteId: UUID;
  sequenceRange: [number, number]; // [startSeq, endSeq] inclusive
  updates: PackUpdateEntry[];
}

/**
 * Pack file metadata extracted from filename
 */
export interface PackFileMetadata {
  instanceId: string;
  startSeq: number;
  endSeq: number;
  filename: string;
}

/**
 * Parse pack filename to extract metadata
 * Format: <instance-id>_pack_<start-seq>-<end-seq>.yjson
 *
 * @param filename - Pack filename to parse
 * @returns Metadata or null if invalid format
 */
export function parsePackFilename(filename: string): PackFileMetadata | null {
  // Check extension
  if (!filename.endsWith('.yjson')) {
    return null;
  }

  // Remove extension
  const base = filename.slice(0, -6);

  // Split into parts
  const parts = base.split('_pack_');
  if (parts.length !== 2) {
    return null;
  }

  const instanceId = parts[0];
  const range = parts[1];

  if (!instanceId || !range) {
    return null;
  }

  // Parse sequence range
  const rangeParts = range.split('-');
  if (rangeParts.length !== 2) {
    return null;
  }

  const startSeq = parseInt(rangeParts[0] ?? '', 10);
  const endSeq = parseInt(rangeParts[1] ?? '', 10);

  if (isNaN(startSeq) || isNaN(endSeq)) {
    return null;
  }

  if (startSeq < 0 || endSeq < 0 || startSeq > endSeq) {
    return null;
  }

  return {
    instanceId,
    startSeq,
    endSeq,
    filename,
  };
}

/**
 * Generate pack filename from metadata
 * Format: <instance-id>_pack_<start-seq>-<end-seq>.yjson
 *
 * @param instanceId - Instance that created these updates
 * @param startSeq - First sequence number in pack
 * @param endSeq - Last sequence number in pack
 * @returns Pack filename
 */
export function generatePackFilename(instanceId: string, startSeq: number, endSeq: number): string {
  return `${instanceId}_pack_${startSeq}-${endSeq}.yjson`;
}

/**
 * Encode pack data for storage
 *
 * @param pack - Pack data to encode
 * @returns Encoded data as Uint8Array
 */
export function encodePackFile(pack: PackData): Uint8Array {
  // Convert to JSON-serializable object
  const serializable = {
    version: pack.version,
    instanceId: pack.instanceId,
    noteId: pack.noteId,
    sequenceRange: pack.sequenceRange,
    updates: pack.updates.map((entry) => ({
      seq: entry.seq,
      timestamp: entry.timestamp,
      data: Array.from(entry.data), // Convert Uint8Array to regular array for JSON
    })),
  };

  const json = JSON.stringify(serializable);
  return new TextEncoder().encode(json);
}

/**
 * Decode pack file from storage
 *
 * @param data - Encoded pack data
 * @returns Decoded pack data
 */
export function decodePackFile(data: Uint8Array): PackData {
  const json = new TextDecoder().decode(data);
  const parsed = JSON.parse(json) as {
    version: number;
    instanceId: string;
    noteId: UUID;
    sequenceRange: [number, number];
    updates: Array<{
      seq: number;
      timestamp: number;
      data: number[];
    }>;
  };

  // Validate version
  if (parsed.version !== PACK_FORMAT_VERSION) {
    throw new Error(
      `Unsupported pack format version: ${parsed.version} (expected ${PACK_FORMAT_VERSION})`
    );
  }

  // Convert arrays back to Uint8Array
  const updates: PackUpdateEntry[] = parsed.updates.map((entry) => ({
    seq: entry.seq,
    timestamp: entry.timestamp,
    data: new Uint8Array(entry.data),
  }));

  return {
    version: parsed.version,
    instanceId: parsed.instanceId,
    noteId: parsed.noteId,
    sequenceRange: parsed.sequenceRange,
    updates,
  };
}

/**
 * Validate pack data integrity
 *
 * @param pack - Pack data to validate
 * @throws Error if pack is invalid
 */
export function validatePackData(pack: PackData): void {
  const [startSeq, endSeq] = pack.sequenceRange;

  // Check sequence range
  if (startSeq < 0 || endSeq < 0 || startSeq > endSeq) {
    throw new Error(`Invalid sequence range: [${startSeq}, ${endSeq}]`);
  }

  // Check update count matches range
  const expectedCount = endSeq - startSeq + 1;
  if (pack.updates.length !== expectedCount) {
    throw new Error(
      `Pack update count (${pack.updates.length}) doesn't match range (${expectedCount})`
    );
  }

  // Check sequence numbers are contiguous
  for (let i = 0; i < pack.updates.length; i++) {
    const update = pack.updates[i];
    if (!update) continue;

    const expectedSeq = startSeq + i;
    if (update.seq !== expectedSeq) {
      throw new Error(`Pack update at index ${i} has seq ${update.seq}, expected ${expectedSeq}`);
    }
  }
}
