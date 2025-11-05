/**
 * Garbage collection configuration for CRDT files
 * Phase 4.1bis Phase 3: Garbage Collection
 */

export interface GCConfig {
  /**
   * Number of snapshots to keep per note (newest ones)
   * Default: 3
   * Rationale: Keep 2-3 for safety (if newest corrupts, fallback exists)
   */
  snapshotRetentionCount: number;

  /**
   * Minimum history duration to retain (in milliseconds)
   * Default: 24 hours
   * Even if files are incorporated into snapshots, keep recent history for debugging
   */
  minimumHistoryDuration: number;

  /**
   * How often to run GC (in milliseconds)
   * Default: 30 minutes
   */
  gcInterval: number;
}

/**
 * Default GC configuration
 */
export const DEFAULT_GC_CONFIG: GCConfig = {
  snapshotRetentionCount: 3,
  minimumHistoryDuration: 24 * 60 * 60 * 1000, // 24 hours
  gcInterval: 30 * 60 * 1000, // 30 minutes
};

/**
 * Statistics from a GC run
 */
export interface GCStats {
  /** When GC started */
  startTime: number;

  /** How long GC took (ms) */
  duration: number;

  /** Number of snapshots deleted */
  snapshotsDeleted: number;

  /** Number of pack files deleted */
  packsDeleted: number;

  /** Number of update files deleted */
  updatesDeleted: number;

  /** Total files deleted */
  totalFilesDeleted: number;

  /** Estimated disk space freed (bytes) */
  diskSpaceFreed: number;

  /** Any errors encountered during GC */
  errors: string[];
}
