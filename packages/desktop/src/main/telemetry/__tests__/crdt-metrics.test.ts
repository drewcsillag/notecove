/**
 * Tests for CRDT Metrics Collection
 */

import { CRDTMetrics, getCRDTMetrics } from '../crdt-metrics';
import { metrics } from '@opentelemetry/api';

// Mock the OpenTelemetry metrics API
jest.mock('@opentelemetry/api', () => {
  const mockHistogram = {
    record: jest.fn(),
  };

  const mockCounter = {
    add: jest.fn(),
  };

  const mockMeter = {
    createHistogram: jest.fn(() => mockHistogram),
    createCounter: jest.fn(() => mockCounter),
  };

  return {
    metrics: {
      getMeter: jest.fn(() => mockMeter),
    },
  };
});

describe('CRDTMetrics', () => {
  let crdtMetrics: CRDTMetrics;
  let mockMeter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    crdtMetrics = new CRDTMetrics();
    mockMeter = metrics.getMeter('notecove-crdt');
  });

  describe('Construction', () => {
    it('should create all required metrics instruments', () => {
      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        'crdt.cold_load.duration_ms',
        expect.objectContaining({
          description: 'Time to load note from disk on cold start',
          unit: 'ms',
        })
      );

      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        'crdt.snapshot.creation_duration_ms',
        expect.any(Object)
      );

      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        'crdt.pack.creation_duration_ms',
        expect.any(Object)
      );

      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        'crdt.gc.duration_ms',
        expect.any(Object)
      );

      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        'crdt.gc.files_deleted',
        expect.any(Object)
      );

      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        'crdt.snapshot.created',
        expect.any(Object)
      );
    });
  });

  describe('recordColdLoad', () => {
    it('should record cold load duration', () => {
      const mockHistogram = mockMeter.createHistogram();

      crdtMetrics.recordColdLoad(150);

      expect(mockHistogram.record).toHaveBeenCalledWith(150, undefined);
    });

    it('should record cold load duration with attributes', () => {
      const mockHistogram = mockMeter.createHistogram();

      crdtMetrics.recordColdLoad(150, {
        note_id: 'abc-123',
        sd_id: 'default',
      });

      expect(mockHistogram.record).toHaveBeenCalledWith(150, {
        note_id: 'abc-123',
        sd_id: 'default',
      });
    });
  });

  describe('recordSnapshotCreation', () => {
    it('should record snapshot creation duration and increment counter', () => {
      const mockHistogram = mockMeter.createHistogram();
      const mockCounter = mockMeter.createCounter();

      crdtMetrics.recordSnapshotCreation(200);

      expect(mockHistogram.record).toHaveBeenCalledWith(200, undefined);
      expect(mockCounter.add).toHaveBeenCalledWith(1, undefined);
    });

    it('should record snapshot creation with attributes', () => {
      const mockHistogram = mockMeter.createHistogram();
      const mockCounter = mockMeter.createCounter();

      const attributes = {
        note_id: 'abc-123',
        file_count: 42,
      };

      crdtMetrics.recordSnapshotCreation(200, attributes);

      expect(mockHistogram.record).toHaveBeenCalledWith(200, attributes);
      expect(mockCounter.add).toHaveBeenCalledWith(1, attributes);
    });
  });

  describe('recordPackCreation', () => {
    it('should record pack creation duration with update count', () => {
      const mockHistogram = mockMeter.createHistogram();
      const mockCounter = mockMeter.createCounter();

      crdtMetrics.recordPackCreation(300, 10);

      expect(mockHistogram.record).toHaveBeenCalledWith(300, {
        update_count: 10,
      });
      expect(mockCounter.add).toHaveBeenCalledWith(1, undefined);
    });

    it('should record pack creation with additional attributes', () => {
      const mockHistogram = mockMeter.createHistogram();

      const attributes = {
        note_id: 'abc-123',
        sd_id: 'default',
      };

      crdtMetrics.recordPackCreation(300, 10, attributes);

      expect(mockHistogram.record).toHaveBeenCalledWith(300, {
        ...attributes,
        update_count: 10,
      });
    });
  });

  describe('recordGC', () => {
    it('should record all GC statistics', () => {
      const mockHistogram = mockMeter.createHistogram();
      const mockCounter = mockMeter.createCounter();

      const stats = {
        durationMs: 500,
        filesDeleted: 15,
        bytesFreed: 1024 * 1024,
        errorCount: 0,
      };

      crdtMetrics.recordGC(stats);

      // Check histogram was called with duration
      expect(mockHistogram.record).toHaveBeenCalledWith(500, undefined);

      // Check counters were called
      expect(mockCounter.add).toHaveBeenCalledWith(15, undefined);
      expect(mockCounter.add).toHaveBeenCalledWith(1024 * 1024, undefined);
    });

    it('should record GC errors when error count > 0', () => {
      const mockCounter = mockMeter.createCounter();

      const stats = {
        durationMs: 500,
        filesDeleted: 10,
        bytesFreed: 1024,
        errorCount: 3,
      };

      crdtMetrics.recordGC(stats);

      // Verify error counter was incremented
      expect(mockCounter.add).toHaveBeenCalledWith(3, undefined);
    });

    it('should not record GC errors when error count is 0', () => {
      const mockCounter = mockMeter.createCounter();
      jest.clearAllMocks();

      const stats = {
        durationMs: 500,
        filesDeleted: 10,
        bytesFreed: 1024,
        errorCount: 0,
      };

      crdtMetrics.recordGC(stats);

      // Count the number of add() calls
      const addCalls = mockCounter.add.mock.calls;
      // Should be called twice: once for filesDeleted, once for bytesFreed
      // NOT called for errors (errorCount is 0)
      expect(addCalls.filter((call: any) => call[0] === 0).length).toBe(0);
    });

    it('should record GC with attributes', () => {
      const mockHistogram = mockMeter.createHistogram();

      const stats = {
        durationMs: 500,
        filesDeleted: 10,
        bytesFreed: 1024,
        errorCount: 0,
      };

      const attributes = {
        sd_id: 'default',
      };

      crdtMetrics.recordGC(stats, attributes);

      expect(mockHistogram.record).toHaveBeenCalledWith(500, attributes);
    });
  });

  describe('recordFileCounts', () => {
    it('should record all file count metrics', () => {
      const mockHistogram = mockMeter.createHistogram();

      const counts = {
        total: 100,
        snapshots: 5,
        packs: 10,
        updates: 85,
      };

      crdtMetrics.recordFileCounts(counts);

      // Check all histograms were called with correct values
      expect(mockHistogram.record).toHaveBeenCalledWith(100, undefined);
      expect(mockHistogram.record).toHaveBeenCalledWith(5, undefined);
      expect(mockHistogram.record).toHaveBeenCalledWith(10, undefined);
      expect(mockHistogram.record).toHaveBeenCalledWith(85, undefined);
    });

    it('should record file counts with attributes', () => {
      const mockHistogram = mockMeter.createHistogram();

      const counts = {
        total: 50,
        snapshots: 2,
        packs: 5,
        updates: 43,
      };

      const attributes = {
        note_id: 'abc-123',
        sd_id: 'default',
      };

      crdtMetrics.recordFileCounts(counts, attributes);

      expect(mockHistogram.record).toHaveBeenCalledWith(50, attributes);
      expect(mockHistogram.record).toHaveBeenCalledWith(2, attributes);
      expect(mockHistogram.record).toHaveBeenCalledWith(5, attributes);
      expect(mockHistogram.record).toHaveBeenCalledWith(43, attributes);
    });
  });

  describe('Global instance', () => {
    it('should return singleton instance', () => {
      const instance1 = getCRDTMetrics();
      const instance2 = getCRDTMetrics();

      expect(instance1).toBe(instance2);
    });
  });
});
