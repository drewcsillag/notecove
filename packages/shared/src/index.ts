/**
 * @notecove/shared
 *
 * Shared TypeScript code for NoteCove.
 * This package must be environment-agnostic (no Node.js-specific APIs)
 * to run in both Node.js (Electron) and JavaScriptCore (iOS).
 */

export * from './types';
// Re-export crdt but rename VectorClock to avoid conflict with storage VectorClock
export {
  NoteDoc,
  FolderTreeDoc,
  UpdateType,
  UPDATE_FORMAT_VERSION,
  parseUpdateFilename,
  generateUpdateFilename,
  encodeUpdateFile,
  decodeUpdateFile,
  type UpdateFileMetadata,
  SNAPSHOT_FORMAT_VERSION,
  parseSnapshotFilename,
  generateSnapshotFilename,
  encodeSnapshotFile,
  decodeSnapshotFile,
  createEmptyVectorClock,
  updateVectorClock,
  shouldApplyUpdate,
  selectBestSnapshot,
  type SnapshotData,
  type SnapshotFileMetadata,
  type VectorClock as LegacyVectorClock,
  PACK_FORMAT_VERSION,
  parsePackFilename,
  generatePackFilename,
  encodePackFile,
  decodePackFile,
  validatePackData,
  type PackData,
  type PackUpdateEntry,
  type PackFileMetadata,
  DEFAULT_GC_CONFIG,
  type GCConfig,
  type GCStats,
  extractTitleFromFragment,
  extractTitleFromDoc,
  extractTextFromFragment,
  extractSnippet,
  extractTextAndSnippet,
} from './crdt';
export * from './storage';
export * from './database';
export * from './logging';
export * from './utils';
export * from './profiles';
export * from './markdown';
export * from './feature-flags';
