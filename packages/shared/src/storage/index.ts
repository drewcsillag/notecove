/**
 * Storage layer - File system abstraction and SD management
 */

export * from './types';
export { SyncDirectoryStructure } from './sd-structure';
// UpdateManager removed - replaced by AppendLogManager
export { ActivityLogger } from './activity-logger';
export {
  ActivitySync,
  type ActivitySyncCallbacks,
  type SyncMetricsCallbacks,
  type StaleEntry,
} from './activity-sync';
export { DeletionLogger } from './deletion-logger';
export { DeletionSync, type DeletionSyncCallbacks } from './deletion-sync';
export { SdUuidManager, type SdIdFile, type SdUuidInitResult } from './sd-uuid';

// New append-only log format (Phase 1-5)
export * from './binary-format';
export { LogWriter, type LogWriterOptions, type AppendResult } from './log-writer';
export { LogReader, type LogFileInfo, type LogRecordWithOffset } from './log-reader';
export { SnapshotWriter } from './snapshot-writer';
export { SnapshotReader, type SnapshotFileInfo, type SnapshotContent } from './snapshot-reader';
export {
  NoteStorageManager,
  type VectorClock,
  type NoteLogPaths,
  type LoadNoteResult,
  type SaveUpdateResult,
  type NoteSyncStateDb,
} from './note-storage-manager';
export {
  FolderStorageManager,
  type FolderPaths,
  type LoadFolderTreeResult,
  type FolderSyncStateDb,
} from './folder-storage-manager';
export {
  CrashRecovery,
  type RecoverDocumentResult,
  type LogValidationResult,
} from './crash-recovery';
export { LogSync, type LogSyncCallbacks, type SyncResult } from './log-sync';
export { AppendLogManager, type LoadResult, type AppendLogManagerDb } from './append-log-manager';
export { StorageMigration, type StorageMigrationResult } from './migration';
export { DocumentSnapshot } from './document-snapshot';
