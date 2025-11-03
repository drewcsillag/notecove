/**
 * Snapshot file format and utilities
 *
 * Snapshots store full document state with vector clock for efficient loading.
 * Filename format: snapshot_<total-changes>_<instance-id>.yjson
 */

import type { UUID } from '../types';

export const SNAPSHOT_FORMAT_VERSION = 1;

/**
 * Vector clock: maps instance-id to highest sequence number seen from that instance
 * Used to determine which update files to apply after loading snapshot
 */
export type VectorClock = Record<string, number>;

/**
 * Snapshot file contents
 */
export interface SnapshotData {
  version: number;
  noteId: UUID;
  timestamp: number;
  totalChanges: number; // Total updates incorporated from all instances
  documentState: Uint8Array; // Full Yjs document state (Y.encodeStateAsUpdate)
  maxSequences: VectorClock; // Highest sequence seen per instance
}

/**
 * Metadata extracted from snapshot filename
 */
export interface SnapshotFileMetadata {
  totalChanges: number;
  instanceId: string;
  filename: string;
}

/**
 * Parse snapshot filename to extract metadata
 * @param filename - e.g., "snapshot_4800_instance-abc.yjson"
 * @returns Metadata or null if invalid format
 */
export function parseSnapshotFilename(filename: string): SnapshotFileMetadata | null {
  // Check extension
  if (!filename.endsWith('.yjson')) {
    return null;
  }

  // Remove extension
  const baseName = filename.slice(0, -6);

  // Split by underscore: snapshot_<total-changes>_<instance-id>
  const parts = baseName.split('_');

  if (parts.length < 3 || parts[0] !== 'snapshot') {
    return null;
  }

  const totalChangesStr = parts[1];
  const instanceId = parts.slice(2).join('_'); // Handle instance IDs with underscores

  if (!totalChangesStr || !instanceId) {
    return null;
  }

  const totalChanges = parseInt(totalChangesStr, 10);
  if (isNaN(totalChanges)) {
    return null;
  }

  return {
    totalChanges,
    instanceId,
    filename,
  };
}

/**
 * Generate snapshot filename
 * @param totalChanges - Total number of updates incorporated
 * @param instanceId - ID of instance creating the snapshot
 * @returns Filename
 */
export function generateSnapshotFilename(totalChanges: number, instanceId: string): string {
  return `snapshot_${totalChanges}_${instanceId}.yjson`;
}

/**
 * Encode snapshot data for storage
 * Currently stores as-is, future versions could add compression
 */
export function encodeSnapshotFile(snapshot: SnapshotData): Uint8Array {
  // Convert to JSON-serializable object
  const serializable = {
    version: snapshot.version,
    noteId: snapshot.noteId,
    timestamp: snapshot.timestamp,
    totalChanges: snapshot.totalChanges,
    documentState: Array.from(snapshot.documentState), // Convert Uint8Array to array for JSON
    maxSequences: snapshot.maxSequences,
  };

  const json = JSON.stringify(serializable);
  return new TextEncoder().encode(json);
}

/**
 * Decode snapshot data from storage
 */
export function decodeSnapshotFile(data: Uint8Array): SnapshotData {
  const json = new TextDecoder().decode(data);
  const parsed = JSON.parse(json) as {
    version: number;
    noteId: UUID;
    timestamp: number;
    totalChanges: number;
    documentState: number[];
    maxSequences: VectorClock;
  };

  return {
    version: parsed.version,
    noteId: parsed.noteId,
    timestamp: parsed.timestamp,
    totalChanges: parsed.totalChanges,
    documentState: new Uint8Array(parsed.documentState), // Convert array back to Uint8Array
    maxSequences: parsed.maxSequences,
  };
}

/**
 * Create empty vector clock
 */
export function createEmptyVectorClock(): VectorClock {
  return {};
}

/**
 * Update vector clock with a sequence number
 */
export function updateVectorClock(
  clock: VectorClock,
  instanceId: string,
  sequence: number
): void {
  const current = clock[instanceId] ?? -1;
  if (sequence > current) {
    clock[instanceId] = sequence;
  }
}

/**
 * Check if an update should be applied based on vector clock
 * @param clock - Vector clock from snapshot
 * @param instanceId - Instance that wrote the update
 * @param sequence - Sequence number of the update
 * @returns true if update should be applied (sequence > clock), false if already incorporated
 */
export function shouldApplyUpdate(
  clock: VectorClock,
  instanceId: string,
  sequence: number
): boolean {
  const maxSeen = clock[instanceId] ?? -1;
  return sequence > maxSeen;
}

/**
 * Select best snapshot from a list
 * Picks snapshot with highest totalChanges (most comprehensive)
 * If tied, picks lexicographically first instance-id (deterministic)
 */
export function selectBestSnapshot(
  snapshots: SnapshotFileMetadata[]
): SnapshotFileMetadata | null {
  if (snapshots.length === 0) {
    return null;
  }

  return snapshots.reduce((best, current) => {
    if (current.totalChanges > best.totalChanges) {
      return current;
    }
    if (current.totalChanges === best.totalChanges) {
      // Tie-breaker: lexicographic order (deterministic)
      return current.instanceId < best.instanceId ? current : best;
    }
    return best;
  });
}
