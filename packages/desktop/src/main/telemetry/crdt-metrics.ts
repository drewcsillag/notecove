/**
 * CRDT Metrics Collection
 *
 * Provides OpenTelemetry metrics for CRDT operations:
 * - Cold load times (P50, P95, P99)
 * - File counts per note
 * - Snapshot creation times
 * - Pack creation times
 * - GC statistics
 */

import { metrics } from '@opentelemetry/api';
import type { Histogram, Counter } from '@opentelemetry/api';

/**
 * CRDT Metrics Collector
 * Uses OpenTelemetry API to record CRDT operation metrics
 */
export class CRDTMetrics {
  private meter = metrics.getMeter('notecove-crdt');

  // Histograms for latency metrics (automatically calculate P50, P95, P99)
  private coldLoadTimeMs: Histogram;
  private snapshotCreationTimeMs: Histogram;
  private packCreationTimeMs: Histogram;
  private gcDurationMs: Histogram;

  // Histograms for file counts
  private filesPerNote: Histogram;
  private snapshotsPerNote: Histogram;
  private packsPerNote: Histogram;
  private updatesPerNote: Histogram;

  // Counters for GC operations
  private gcFilesDeleted: Counter;
  private gcBytesFreed: Counter;
  private gcErrors: Counter;

  // Counters for snapshot/pack operations
  private snapshotsCreated: Counter;
  private packsCreated: Counter;

  constructor() {
    // Latency histograms
    this.coldLoadTimeMs = this.meter.createHistogram('crdt.cold_load.duration_ms', {
      description: 'Time to load note from disk on cold start',
      unit: 'ms',
    });

    this.snapshotCreationTimeMs = this.meter.createHistogram('crdt.snapshot.creation_duration_ms', {
      description: 'Time to create snapshot file',
      unit: 'ms',
    });

    this.packCreationTimeMs = this.meter.createHistogram('crdt.pack.creation_duration_ms', {
      description: 'Time to create pack file',
      unit: 'ms',
    });

    this.gcDurationMs = this.meter.createHistogram('crdt.gc.duration_ms', {
      description: 'Time to run garbage collection',
      unit: 'ms',
    });

    // File count histograms
    this.filesPerNote = this.meter.createHistogram('crdt.files.total_per_note', {
      description: 'Total number of CRDT files per note',
      unit: 'files',
    });

    this.snapshotsPerNote = this.meter.createHistogram('crdt.files.snapshots_per_note', {
      description: 'Number of snapshot files per note',
      unit: 'files',
    });

    this.packsPerNote = this.meter.createHistogram('crdt.files.packs_per_note', {
      description: 'Number of pack files per note',
      unit: 'files',
    });

    this.updatesPerNote = this.meter.createHistogram('crdt.files.updates_per_note', {
      description: 'Number of update files per note',
      unit: 'files',
    });

    // GC counters
    this.gcFilesDeleted = this.meter.createCounter('crdt.gc.files_deleted', {
      description: 'Number of files deleted by garbage collection',
      unit: 'files',
    });

    this.gcBytesFreed = this.meter.createCounter('crdt.gc.bytes_freed', {
      description: 'Bytes freed by garbage collection',
      unit: 'bytes',
    });

    this.gcErrors = this.meter.createCounter('crdt.gc.errors', {
      description: 'Number of errors during garbage collection',
      unit: 'errors',
    });

    // Operation counters
    this.snapshotsCreated = this.meter.createCounter('crdt.snapshot.created', {
      description: 'Number of snapshots created',
      unit: 'snapshots',
    });

    this.packsCreated = this.meter.createCounter('crdt.pack.created', {
      description: 'Number of pack files created',
      unit: 'packs',
    });
  }

  /**
   * Record cold load time for a note
   */
  recordColdLoad(durationMs: number, attributes?: Record<string, string | number>): void {
    this.coldLoadTimeMs.record(durationMs, attributes);
  }

  /**
   * Record snapshot creation time
   */
  recordSnapshotCreation(durationMs: number, attributes?: Record<string, string | number>): void {
    this.snapshotCreationTimeMs.record(durationMs, attributes);
    this.snapshotsCreated.add(1, attributes);
  }

  /**
   * Record pack creation time
   */
  recordPackCreation(
    durationMs: number,
    updateCount: number,
    attributes?: Record<string, string | number>
  ): void {
    this.packCreationTimeMs.record(durationMs, {
      ...attributes,
      update_count: updateCount,
    });
    this.packsCreated.add(1, attributes);
  }

  /**
   * Record garbage collection statistics
   */
  recordGC(
    stats: {
      durationMs: number;
      filesDeleted: number;
      bytesFreed: number;
      errorCount: number;
    },
    attributes?: Record<string, string | number>
  ): void {
    this.gcDurationMs.record(stats.durationMs, attributes);
    this.gcFilesDeleted.add(stats.filesDeleted, attributes);
    this.gcBytesFreed.add(stats.bytesFreed, attributes);

    if (stats.errorCount > 0) {
      this.gcErrors.add(stats.errorCount, attributes);
    }
  }

  /**
   * Record file counts for a note
   */
  recordFileCounts(
    counts: {
      total: number;
      snapshots: number;
      packs: number;
      updates: number;
    },
    attributes?: Record<string, string | number>
  ): void {
    this.filesPerNote.record(counts.total, attributes);
    this.snapshotsPerNote.record(counts.snapshots, attributes);
    this.packsPerNote.record(counts.packs, attributes);
    this.updatesPerNote.record(counts.updates, attributes);
  }
}

// Global instance
let globalCRDTMetrics: CRDTMetrics | null = null;

/**
 * Get global CRDT metrics instance
 */
export function getCRDTMetrics(): CRDTMetrics {
  if (!globalCRDTMetrics) {
    globalCRDTMetrics = new CRDTMetrics();
  }
  return globalCRDTMetrics;
}
