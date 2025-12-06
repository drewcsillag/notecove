/**
 * Tests for SyncMetrics
 */

import { metrics } from '@opentelemetry/api';
import { SyncMetrics, getSyncMetrics } from '../sync-metrics';

// Mock OpenTelemetry metrics
const mockRecord = jest.fn();
const mockAdd = jest.fn();

const mockHistogram = {
  record: mockRecord,
};

const mockCounter = {
  add: mockAdd,
};

const mockMeter = {
  createHistogram: jest.fn(() => mockHistogram),
  createCounter: jest.fn(() => mockCounter),
};

jest.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: jest.fn(() => mockMeter),
  },
}));

describe('SyncMetrics', () => {
  let syncMetrics: SyncMetrics;

  beforeEach(() => {
    jest.clearAllMocks();
    syncMetrics = new SyncMetrics();
  });

  describe('constructor', () => {
    it('should create histogram for sync latency', () => {
      expect(mockMeter.createHistogram).toHaveBeenCalledWith('sync.latency_ms', {
        description: 'Time from activity detection to successful note reload',
        unit: 'ms',
      });
    });

    it('should create histogram for sync attempts', () => {
      expect(mockMeter.createHistogram).toHaveBeenCalledWith('sync.attempts', {
        description: 'Number of retry attempts before sync succeeds',
        unit: 'attempts',
      });
    });

    it('should create counter for sync successes', () => {
      expect(mockMeter.createCounter).toHaveBeenCalledWith('sync.successes', {
        description: 'Number of successful sync operations',
        unit: 'syncs',
      });
    });

    it('should create counter for sync failures', () => {
      expect(mockMeter.createCounter).toHaveBeenCalledWith('sync.failures', {
        description: 'Number of failed sync operations (non-timeout errors)',
        unit: 'syncs',
      });
    });

    it('should create counter for sync timeouts', () => {
      expect(mockMeter.createCounter).toHaveBeenCalledWith('sync.timeouts', {
        description: 'Number of sync operations that timed out',
        unit: 'syncs',
      });
    });

    it('should create counter for full scans', () => {
      expect(mockMeter.createCounter).toHaveBeenCalledWith('sync.full_scans', {
        description: 'Number of full scan fallbacks triggered',
        unit: 'scans',
      });
    });

    it('should create counter for activity logs processed', () => {
      expect(mockMeter.createCounter).toHaveBeenCalledWith('sync.activity_logs_processed', {
        description: 'Number of activity log files processed',
        unit: 'files',
      });
    });

    it('should create counter for notes reloaded', () => {
      expect(mockMeter.createCounter).toHaveBeenCalledWith('sync.notes_reloaded', {
        description: 'Number of notes reloaded from disk',
        unit: 'notes',
      });
    });
  });

  describe('recordSyncSuccess', () => {
    it('should record latency and attempts on success', () => {
      syncMetrics.recordSyncSuccess(150, 2);

      expect(mockRecord).toHaveBeenCalledWith(150, undefined);
      expect(mockRecord).toHaveBeenCalledWith(2, undefined);
      expect(mockAdd).toHaveBeenCalledWith(1, undefined);
    });

    it('should pass attributes when provided', () => {
      const attrs = { sdId: 1, noteId: 'note-1' };
      syncMetrics.recordSyncSuccess(100, 1, attrs);

      expect(mockRecord).toHaveBeenCalledWith(100, attrs);
      expect(mockAdd).toHaveBeenCalledWith(1, attrs);
    });
  });

  describe('recordSyncFailure', () => {
    it('should increment failure counter', () => {
      syncMetrics.recordSyncFailure();

      expect(mockAdd).toHaveBeenCalledWith(1, undefined);
    });

    it('should pass attributes when provided', () => {
      const attrs = { error: 'Network error' };
      syncMetrics.recordSyncFailure(attrs);

      expect(mockAdd).toHaveBeenCalledWith(1, attrs);
    });
  });

  describe('recordSyncTimeout', () => {
    it('should record attempts and increment timeout counter', () => {
      syncMetrics.recordSyncTimeout(5);

      expect(mockRecord).toHaveBeenCalledWith(5, undefined);
      expect(mockAdd).toHaveBeenCalledWith(1, undefined);
    });

    it('should pass attributes when provided', () => {
      const attrs = { noteId: 'note-1' };
      syncMetrics.recordSyncTimeout(3, attrs);

      expect(mockRecord).toHaveBeenCalledWith(3, attrs);
      expect(mockAdd).toHaveBeenCalledWith(1, attrs);
    });
  });

  describe('recordFullScan', () => {
    it('should record full scan and notes reloaded', () => {
      syncMetrics.recordFullScan(10);

      expect(mockAdd).toHaveBeenCalledWith(1, undefined);
      expect(mockAdd).toHaveBeenCalledWith(10, undefined);
    });

    it('should pass attributes when provided', () => {
      const attrs = { sdId: 1 };
      syncMetrics.recordFullScan(5, attrs);

      expect(mockAdd).toHaveBeenCalledWith(1, attrs);
      expect(mockAdd).toHaveBeenCalledWith(5, attrs);
    });
  });

  describe('recordActivityLogProcessed', () => {
    it('should increment activity logs counter', () => {
      syncMetrics.recordActivityLogProcessed();

      expect(mockAdd).toHaveBeenCalledWith(1, undefined);
    });

    it('should pass attributes when provided', () => {
      const attrs = { instanceId: 'inst-1' };
      syncMetrics.recordActivityLogProcessed(attrs);

      expect(mockAdd).toHaveBeenCalledWith(1, attrs);
    });
  });

  describe('recordNoteReloaded', () => {
    it('should increment notes reloaded counter', () => {
      syncMetrics.recordNoteReloaded();

      expect(mockAdd).toHaveBeenCalledWith(1, undefined);
    });

    it('should pass attributes when provided', () => {
      const attrs = { noteId: 'note-1' };
      syncMetrics.recordNoteReloaded(attrs);

      expect(mockAdd).toHaveBeenCalledWith(1, attrs);
    });
  });
});

describe('getSyncMetrics', () => {
  it('should return a SyncMetrics instance', () => {
    const metrics = getSyncMetrics();
    expect(metrics).toBeInstanceOf(SyncMetrics);
  });

  it('should return the same instance on subsequent calls', () => {
    const metrics1 = getSyncMetrics();
    const metrics2 = getSyncMetrics();
    expect(metrics1).toBe(metrics2);
  });
});
