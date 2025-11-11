/**
 * Tests for TimelineBuilder
 */

// Mock uuid before importing anything else
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

import { TimelineBuilder } from '../timeline-builder';
import type { UpdateManager } from '../../storage/update-manager';

describe('TimelineBuilder', () => {
  let mockUpdateManager: jest.Mocked<UpdateManager>;
  let timelineBuilder: TimelineBuilder;

  beforeEach(() => {
    // Create mock UpdateManager
    mockUpdateManager = {
      listPackFiles: jest.fn(),
      readPackFile: jest.fn(),
      listNoteUpdateFiles: jest.fn(),
      readUpdateFile: jest.fn(),
    } as unknown as jest.Mocked<UpdateManager>;

    timelineBuilder = new TimelineBuilder(mockUpdateManager);
  });

  describe('buildTimeline', () => {
    it('should build empty timeline when no updates exist', async () => {
      mockUpdateManager.listPackFiles.mockResolvedValue([]);
      mockUpdateManager.listNoteUpdateFiles.mockResolvedValue([]);

      const timeline = await timelineBuilder.buildTimeline('sd1', 'note1');

      expect(timeline).toEqual([]);
    });

    it('should group updates into sessions by time gaps', async () => {
      mockUpdateManager.listPackFiles.mockResolvedValue([]);
      mockUpdateManager.listNoteUpdateFiles.mockResolvedValue([
        {
          filename: 'inst1_1000-1.yjson',
          path: '/path/inst1_1000-1.yjson',
          instanceId: 'inst1',
          documentId: 'note1',
          timestamp: 1000
        },
        {
          filename: 'inst1_2000-2.yjson',
          path: '/path/inst1_2000-2.yjson',
          instanceId: 'inst1',
          documentId: 'note1',
          timestamp: 2000
        },
        // Gap > 5 minutes
        {
          filename: 'inst1_400000-3.yjson',
          path: '/path/inst1_400000-3.yjson',
          instanceId: 'inst1',
          documentId: 'note1',
          timestamp: 400000
        },
      ]);

      mockUpdateManager.readUpdateFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const timeline = await timelineBuilder.buildTimeline('sd1', 'note1');

      expect(timeline).toHaveLength(2);
      expect(timeline[0].updateCount).toBe(2);
      expect(timeline[1].updateCount).toBe(1);
    });

    it('should group updates into sessions by update count', async () => {
      mockUpdateManager.listPackFiles.mockResolvedValue([]);

      // Create 101 updates within 1 second of each other
      const updates = Array.from({ length: 101 }, (_, i) => ({
        instanceId: 'inst1',
        sequence: i,
        timestamp: 1000 + i * 10, // 10ms apart
        filename: `f${i}`,
      }));

      mockUpdateManager.listNoteUpdateFiles.mockResolvedValue(
        updates.map((u, i) => ({
          filename: `inst1_${u.timestamp}-${i}.yjson`,
          path: `/path/inst1_${u.timestamp}-${i}.yjson`,
          instanceId: u.instanceId,
          documentId: 'note1',
          timestamp: u.timestamp,
        }))
      );
      mockUpdateManager.readUpdateFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const timeline = await timelineBuilder.buildTimeline('sd1', 'note1');

      // Should create 2 sessions (100 + 1)
      expect(timeline).toHaveLength(2);
      expect(timeline[0].updateCount).toBe(100);
      expect(timeline[1].updateCount).toBe(1);
    });

    it('should track multiple instance IDs in a session', async () => {
      mockUpdateManager.listPackFiles.mockResolvedValue([]);
      mockUpdateManager.listNoteUpdateFiles.mockResolvedValue([
        {
          filename: 'inst1_1000-1.yjson',
          path: '/path/inst1_1000-1.yjson',
          instanceId: 'inst1',
          documentId: 'note1',
          timestamp: 1000
        },
        {
          filename: 'inst2_2000-1.yjson',
          path: '/path/inst2_2000-1.yjson',
          instanceId: 'inst2',
          documentId: 'note1',
          timestamp: 2000
        },
        {
          filename: 'inst1_3000-2.yjson',
          path: '/path/inst1_3000-2.yjson',
          instanceId: 'inst1',
          documentId: 'note1',
          timestamp: 3000
        },
      ]);

      mockUpdateManager.readUpdateFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const timeline = await timelineBuilder.buildTimeline('sd1', 'note1');

      expect(timeline).toHaveLength(1);
      expect(timeline[0].instanceIds).toHaveLength(2);
      expect(timeline[0].instanceIds).toContain('inst1');
      expect(timeline[0].instanceIds).toContain('inst2');
    });

    it('should read updates from pack files', async () => {
      mockUpdateManager.listPackFiles.mockResolvedValue([
        { instanceId: 'inst1', startSeq: 1, endSeq: 3, filename: 'pack1.yjson' },
      ]);
      mockUpdateManager.listNoteUpdateFiles.mockResolvedValue([]);

      mockUpdateManager.readPackFile.mockResolvedValue({
        version: 1,
        instanceId: 'inst1',
        noteId: 'note1',
        sequenceRange: [1, 3],
        updates: [
          { seq: 1, timestamp: 1000, data: new Uint8Array([1]) },
          { seq: 2, timestamp: 2000, data: new Uint8Array([2]) },
          { seq: 3, timestamp: 3000, data: new Uint8Array([3]) },
        ],
      });

      const timeline = await timelineBuilder.buildTimeline('sd1', 'note1');

      expect(timeline).toHaveLength(1);
      expect(timeline[0].updateCount).toBe(3);
    });

    it('should handle errors gracefully when reading pack files', async () => {
      mockUpdateManager.listPackFiles.mockResolvedValue([
        { instanceId: 'inst1', startSeq: 1, endSeq: 3, filename: 'bad-pack.yjson' },
      ]);
      mockUpdateManager.listNoteUpdateFiles.mockResolvedValue([
        {
          filename: 'inst1_1000-1.yjson',
          path: '/path/inst1_1000-1.yjson',
          instanceId: 'inst1',
          documentId: 'note1',
          timestamp: 1000
        },
      ]);

      mockUpdateManager.readPackFile.mockRejectedValue(new Error('Corrupt pack file'));
      mockUpdateManager.readUpdateFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const timeline = await timelineBuilder.buildTimeline('sd1', 'note1');

      // Should still build timeline from individual update files
      expect(timeline).toHaveLength(1);
      expect(timeline[0].updateCount).toBe(1);
    });
  });

  describe('getHistoryStats', () => {
    it('should return stats for empty history', async () => {
      mockUpdateManager.listPackFiles.mockResolvedValue([]);
      mockUpdateManager.listNoteUpdateFiles.mockResolvedValue([]);

      const stats = await timelineBuilder.getHistoryStats('sd1', 'note1');

      expect(stats).toEqual({
        totalUpdates: 0,
        totalSessions: 0,
        firstEdit: null,
        lastEdit: null,
        instanceCount: 0,
        instances: [],
      });
    });

    it('should calculate stats correctly', async () => {
      mockUpdateManager.listPackFiles.mockResolvedValue([]);
      mockUpdateManager.listNoteUpdateFiles.mockResolvedValue([
        {
          filename: 'inst1_1000-1.yjson',
          path: '/path/inst1_1000-1.yjson',
          instanceId: 'inst1',
          documentId: 'note1',
          timestamp: 1000
        },
        {
          filename: 'inst2_2000-1.yjson',
          path: '/path/inst2_2000-1.yjson',
          instanceId: 'inst2',
          documentId: 'note1',
          timestamp: 2000
        },
        {
          filename: 'inst1_400000-2.yjson',
          path: '/path/inst1_400000-2.yjson',
          instanceId: 'inst1',
          documentId: 'note1',
          timestamp: 400000
        },
      ]);

      mockUpdateManager.readUpdateFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

      const stats = await timelineBuilder.getHistoryStats('sd1', 'note1');

      expect(stats.totalUpdates).toBe(3);
      expect(stats.totalSessions).toBe(2);
      expect(stats.firstEdit).toBe(1000);
      expect(stats.lastEdit).toBe(400000);
      expect(stats.instanceCount).toBe(2);
      expect(stats.instances).toEqual(['inst1', 'inst2']);
    });
  });
});
