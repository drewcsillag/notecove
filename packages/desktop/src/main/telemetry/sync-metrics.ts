/**
 * Sync Metrics Collection
 *
 * Provides OpenTelemetry metrics for cross-machine sync operations:
 * - Sync latency (time from activity detection to note reload)
 * - Sync attempts (retry count before success)
 * - Sync success/failure counts
 * - Full scan fallback counts
 */

import { metrics } from '@opentelemetry/api';
import type { Histogram, Counter } from '@opentelemetry/api';

/**
 * Sync Metrics Collector
 * Uses OpenTelemetry API to record sync operation metrics
 */
export class SyncMetrics {
  private meter = metrics.getMeter('notecove-sync');

  // Histograms for latency metrics
  private syncLatencyMs: Histogram;
  private syncAttempts: Histogram;

  // Counters for sync operations
  private syncSuccesses: Counter;
  private syncFailures: Counter;
  private syncTimeouts: Counter;
  private fullScans: Counter;

  // Counters for activity detection
  private activityLogsProcessed: Counter;
  private notesReloaded: Counter;

  constructor() {
    // Latency histograms
    this.syncLatencyMs = this.meter.createHistogram('sync.latency_ms', {
      description: 'Time from activity detection to successful note reload',
      unit: 'ms',
    });

    this.syncAttempts = this.meter.createHistogram('sync.attempts', {
      description: 'Number of retry attempts before sync succeeds',
      unit: 'attempts',
    });

    // Success/failure counters
    this.syncSuccesses = this.meter.createCounter('sync.successes', {
      description: 'Number of successful sync operations',
      unit: 'syncs',
    });

    this.syncFailures = this.meter.createCounter('sync.failures', {
      description: 'Number of failed sync operations (non-timeout errors)',
      unit: 'syncs',
    });

    this.syncTimeouts = this.meter.createCounter('sync.timeouts', {
      description: 'Number of sync operations that timed out',
      unit: 'syncs',
    });

    this.fullScans = this.meter.createCounter('sync.full_scans', {
      description: 'Number of full scan fallbacks triggered',
      unit: 'scans',
    });

    // Activity tracking
    this.activityLogsProcessed = this.meter.createCounter('sync.activity_logs_processed', {
      description: 'Number of activity log files processed',
      unit: 'files',
    });

    this.notesReloaded = this.meter.createCounter('sync.notes_reloaded', {
      description: 'Number of notes reloaded from disk',
      unit: 'notes',
    });
  }

  /**
   * Record a successful sync operation
   */
  recordSyncSuccess(
    latencyMs: number,
    attempts: number,
    attributes?: Record<string, string | number>
  ): void {
    this.syncLatencyMs.record(latencyMs, attributes);
    this.syncAttempts.record(attempts, attributes);
    this.syncSuccesses.add(1, attributes);
  }

  /**
   * Record a failed sync operation (non-timeout error)
   */
  recordSyncFailure(attributes?: Record<string, string | number>): void {
    this.syncFailures.add(1, attributes);
  }

  /**
   * Record a sync timeout
   */
  recordSyncTimeout(attempts: number, attributes?: Record<string, string | number>): void {
    this.syncAttempts.record(attempts, attributes);
    this.syncTimeouts.add(1, attributes);
  }

  /**
   * Record a full scan fallback
   */
  recordFullScan(notesReloaded: number, attributes?: Record<string, string | number>): void {
    this.fullScans.add(1, attributes);
    this.notesReloaded.add(notesReloaded, attributes);
  }

  /**
   * Record activity log processing
   */
  recordActivityLogProcessed(attributes?: Record<string, string | number>): void {
    this.activityLogsProcessed.add(1, attributes);
  }

  /**
   * Record a note reload
   */
  recordNoteReloaded(attributes?: Record<string, string | number>): void {
    this.notesReloaded.add(1, attributes);
  }
}

// Global instance
let globalSyncMetrics: SyncMetrics | null = null;

/**
 * Get global Sync metrics instance
 */
export function getSyncMetrics(): SyncMetrics {
  globalSyncMetrics ??= new SyncMetrics();
  return globalSyncMetrics;
}
