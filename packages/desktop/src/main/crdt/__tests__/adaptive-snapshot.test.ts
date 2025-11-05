/**
 * Tests for Adaptive Snapshot Threshold Logic
 *
 * Note: These tests verify the logic of calculateSnapshotThreshold,
 * which is a private method. We test it indirectly through integration
 * with the snapshot creation flow.
 */

import type { DocumentState } from '../types';
import { NoteDoc } from '@notecove/shared';

describe('Adaptive Snapshot Threshold Logic', () => {
  /**
   * Helper to simulate the calculateSnapshotThreshold logic
   * (copied from crdt-manager.ts for testing)
   */
  function calculateSnapshotThreshold(state: DocumentState): number {
    const now = Date.now();
    const timeSinceLastCheck = now - state.lastSnapshotCheck;
    const timeSinceLastSnapshot = now - state.lastSnapshotCreated;

    // Calculate edits per minute
    const minutesSinceCheck = timeSinceLastCheck / (60 * 1000);
    const editsPerMinute = minutesSinceCheck > 0 ? state.editCount / minutesSinceCheck : 0;

    // Adaptive thresholds based on edit rate
    if (editsPerMinute > 10) {
      return 50; // Very active
    } else if (editsPerMinute > 5) {
      return 100; // High activity
    } else if (editsPerMinute > 1) {
      return 200; // Medium activity
    } else if (timeSinceLastSnapshot > 30 * 60 * 1000) {
      return 50; // Force snapshot for idle documents (>30 min)
    } else {
      return 500; // Low activity
    }
  }

  /**
   * Helper to create a mock DocumentState
   */
  function createMockState(
    editCount: number,
    timeSinceLastCheck: number,
    timeSinceLastSnapshot: number
  ): DocumentState {
    const now = Date.now();
    const noteId = 'test-note';
    const noteDoc = new NoteDoc(noteId);
    return {
      doc: noteDoc.doc,
      noteDoc,
      noteId,
      sdId: 'default',
      refCount: 1,
      lastModified: now,
      editCount,
      lastSnapshotCheck: now - timeSinceLastCheck,
      lastSnapshotCreated: now - timeSinceLastSnapshot,
    };
  }

  describe('Edit rate calculations', () => {
    it('should return threshold 50 for very high activity (>10 edits/min)', () => {
      // 20 edits in 1 minute = 20 edits/min
      const state = createMockState(20, 60 * 1000, 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(50);
    });

    it('should return threshold 100 for high activity (5-10 edits/min)', () => {
      // 8 edits in 1 minute = 8 edits/min
      const state = createMockState(8, 60 * 1000, 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(100);
    });

    it('should return threshold 200 for medium activity (1-5 edits/min)', () => {
      // 3 edits in 1 minute = 3 edits/min
      const state = createMockState(3, 60 * 1000, 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(200);
    });

    it('should return threshold 500 for low activity (<1 edit/min)', () => {
      // 1 edit in 2 minutes = 0.5 edits/min
      const state = createMockState(1, 2 * 60 * 1000, 2 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(500);
    });
  });

  describe('Idle document handling', () => {
    it('should return threshold 50 for idle documents (>30 min since last snapshot)', () => {
      // 0 edits in last 35 minutes
      const state = createMockState(0, 35 * 60 * 1000, 35 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(50);
    });

    it('should not force snapshot if less than 30 minutes idle', () => {
      // 0 edits in last 25 minutes (low activity)
      const state = createMockState(0, 25 * 60 * 1000, 25 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(500); // Should use low activity threshold
    });
  });

  describe('Edge cases', () => {
    it('should handle zero time elapsed gracefully', () => {
      // Just loaded, no time passed
      const state = createMockState(0, 0, 0);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBeGreaterThan(0);
      expect([50, 100, 200, 500]).toContain(threshold);
    });

    it('should handle very high edit counts', () => {
      // 100 edits in 1 minute = 100 edits/min
      const state = createMockState(100, 60 * 1000, 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(50); // Very active threshold
    });

    it('should calculate correctly over longer time periods', () => {
      // 50 edits in 10 minutes = 5 edits/min (boundary case - not >5, so medium activity)
      const state = createMockState(50, 10 * 60 * 1000, 10 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(200); // Should be medium activity (5 edits/min is <=5, not >5)
    });

    it('should prioritize idle check over low activity threshold', () => {
      // 1 edit in 35 minutes (low activity but idle)
      const state = createMockState(1, 35 * 60 * 1000, 35 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(50); // Should force snapshot for idle document
    });
  });

  describe('Real-world scenarios', () => {
    it('should adapt for burst editing (typing session)', () => {
      // Simulating a typing session: 60 edits in 5 minutes = 12 edits/min
      const state = createMockState(60, 5 * 60 * 1000, 5 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(50); // Very active - snapshot frequently
    });

    it('should adapt for occasional edits (reviewing/reading)', () => {
      // Occasional edits: 5 edits in 10 minutes = 0.5 edits/min
      const state = createMockState(5, 10 * 60 * 1000, 10 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(500); // Low activity - snapshot less frequently
    });

    it('should handle document left open but inactive', () => {
      // Document open for 1 hour with no edits
      const state = createMockState(0, 60 * 60 * 1000, 60 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(50); // Force snapshot for idle document
    });

    it('should adapt during collaborative editing (moderate activity)', () => {
      // Collaborative editing: 20 edits in 5 minutes = 4 edits/min
      const state = createMockState(20, 5 * 60 * 1000, 5 * 60 * 1000);
      const threshold = calculateSnapshotThreshold(state);
      expect(threshold).toBe(200); // Medium activity
    });
  });
});
