/**
 * Polling Group Tests
 *
 * Tests for the two-tier sync polling system (Tier 2: persistent polling group).
 */

import {
  PollingGroup,
  PollingGroupEntry,
  PollingGroupSettings,
  PollingGroupReason,
  DEFAULT_POLLING_GROUP_SETTINGS,
  storedToRuntimeSettings,
  mergePollingSettings,
  PollingGroupStoredSettings,
} from '../polling-group';

describe('PollingGroup', () => {
  let pollingGroup: PollingGroup;
  const defaultSettings: PollingGroupSettings = {
    pollRatePerMinute: 120,
    hitRateMultiplier: 0.25,
    maxBurstPerSecond: 10,
    normalPriorityReserve: 0.2,
    recentEditWindowMs: 5 * 60 * 1000,
    fullRepollIntervalMs: 30 * 60 * 1000,
    fastPathMaxDelayMs: 60 * 1000,
  };

  beforeEach(() => {
    pollingGroup = new PollingGroup(defaultSettings);
  });

  describe('add/remove entries', () => {
    it('should add an entry to the polling group', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 100]]),
        reason: 'fast-path-handoff',
      });

      const status = pollingGroup.getStatus();
      expect(status.totalEntries).toBe(1);
      expect(status.entries).toHaveLength(1);
      expect(status.entries[0].noteId).toBe('note-1');
    });

    it('should not add duplicate entries for same note/sd', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 100]]),
        reason: 'fast-path-handoff',
      });

      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 150]]),
        reason: 'fast-path-handoff',
      });

      const status = pollingGroup.getStatus();
      expect(status.totalEntries).toBe(1);
      // Should have merged/updated the expected sequences
      expect(status.entries[0].expectedSequences.get('instance-a')).toBe(150);
    });

    it('should allow same note in different SDs', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'open-note',
      });

      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-2',
        expectedSequences: new Map(),
        reason: 'open-note',
      });

      const status = pollingGroup.getStatus();
      expect(status.totalEntries).toBe(2);
    });

    it('should remove an entry from the polling group', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'open-note',
      });

      pollingGroup.remove('note-1', 'sd-1');

      const status = pollingGroup.getStatus();
      expect(status.totalEntries).toBe(0);
    });

    it('should handle removing non-existent entry gracefully', () => {
      expect(() => {
        pollingGroup.remove('non-existent', 'sd-1');
      }).not.toThrow();
    });
  });

  describe('priority ordering', () => {
    it('should return high-priority entries before normal-priority', () => {
      // Add normal priority first
      pollingGroup.add({
        noteId: 'note-normal',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff', // normal priority
      });

      // Add high priority second
      pollingGroup.add({
        noteId: 'note-high',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'open-note', // high priority
      });

      const batch = pollingGroup.getNextBatch(1);
      expect(batch).toHaveLength(1);
      expect(batch[0].noteId).toBe('note-high');
    });

    it('should use FIFO within same priority level', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      pollingGroup.add({
        noteId: 'note-2',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      pollingGroup.add({
        noteId: 'note-3',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      const batch = pollingGroup.getNextBatch(2);
      expect(batch).toHaveLength(2);
      expect(batch[0].noteId).toBe('note-1');
      expect(batch[1].noteId).toBe('note-2');
    });

    it('should reserve capacity for normal priority (20% default)', () => {
      // Add 10 high-priority notes
      for (let i = 0; i < 10; i++) {
        pollingGroup.add({
          noteId: `note-high-${i}`,
          sdId: 'sd-1',
          expectedSequences: new Map(),
          reason: 'open-note',
        });
      }

      // Add 5 normal-priority notes
      for (let i = 0; i < 5; i++) {
        pollingGroup.add({
          noteId: `note-normal-${i}`,
          sdId: 'sd-1',
          expectedSequences: new Map(),
          reason: 'fast-path-handoff',
        });
      }

      // Request batch of 10 - should include at least 2 normal (20% reserve)
      const batch = pollingGroup.getNextBatch(10);
      const normalCount = batch.filter((e) => e.reason === 'fast-path-handoff').length;
      expect(normalCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('setOpenNotes / setNotesInLists', () => {
    it('should upgrade priority when note becomes open', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      // Initially normal priority
      let status = pollingGroup.getStatus();
      expect(status.entries[0].priority).toBe('normal');

      // Mark as open
      pollingGroup.setOpenNotes('sd-1', new Set(['note-1']));

      // Should now be high priority
      status = pollingGroup.getStatus();
      expect(status.entries[0].priority).toBe('high');
    });

    it('should downgrade priority when note closes', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      // Mark as open
      pollingGroup.setOpenNotes('sd-1', new Set(['note-1']));
      expect(pollingGroup.getStatus().entries[0].priority).toBe('high');

      // Close the note
      pollingGroup.setOpenNotes('sd-1', new Set());
      expect(pollingGroup.getStatus().entries[0].priority).toBe('normal');
    });

    it('should handle notes in lists similarly to open notes', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      pollingGroup.setNotesInLists('sd-1', new Set(['note-1']));

      const status = pollingGroup.getStatus();
      expect(status.entries[0].priority).toBe('high');
    });
  });

  describe('exit criteria by reason', () => {
    it('fast-path-handoff: should exit when all sequences caught up', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([
          ['instance-a', 100],
          ['instance-b', 50],
        ]),
        reason: 'fast-path-handoff',
      });

      // Update one sequence - not caught up yet
      pollingGroup.updateSequence('note-1', 'sd-1', 'instance-a', 100);
      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(false);

      // Update second sequence - now caught up
      pollingGroup.updateSequence('note-1', 'sd-1', 'instance-b', 50);
      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(true);
    });

    it('full-repoll: should exit after one poll', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'full-repoll',
      });

      // Before polling - should not exit
      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(false);

      // After polling - should exit
      pollingGroup.markPolled('note-1', 'sd-1', false);
      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(true);
    });

    it('open-note: should not exit while note is open', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'open-note',
      });

      pollingGroup.setOpenNotes('sd-1', new Set(['note-1']));
      pollingGroup.markPolled('note-1', 'sd-1', false);

      // Should not exit while open
      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(false);

      // Close the note
      pollingGroup.setOpenNotes('sd-1', new Set());

      // Now should exit
      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(true);
    });

    it('notes-list: should not exit while note is in list', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'notes-list',
      });

      pollingGroup.setNotesInLists('sd-1', new Set(['note-1']));
      pollingGroup.markPolled('note-1', 'sd-1', false);

      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(false);

      pollingGroup.setNotesInLists('sd-1', new Set());
      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(true);
    });

    it('recent-edit: should exit after window expires', () => {
      // Use shorter window for testing
      const shortWindowSettings = { ...defaultSettings, recentEditWindowMs: 100 };
      pollingGroup = new PollingGroup(shortWindowSettings);

      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'recent-edit',
      });

      // Should not exit immediately
      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(false);

      // Wait for window to expire - use fake timer approach
      const entry = pollingGroup.getEntry('note-1', 'sd-1');
      if (entry) {
        // Manually backdate addedAt for testing
        (entry as { addedAt: number }).addedAt = Date.now() - 200;
      }

      expect(pollingGroup.checkExitCriteria('note-1', 'sd-1')).toBe(true);
    });
  });

  describe('rate limiting with hit acceleration', () => {
    it('should respect base rate for misses', () => {
      // Add entries
      for (let i = 0; i < 10; i++) {
        pollingGroup.add({
          noteId: `note-${i}`,
          sdId: 'sd-1',
          expectedSequences: new Map(),
          reason: 'fast-path-handoff',
        });
      }

      // Get batch - should be limited by rate
      const batch = pollingGroup.getNextBatch(100); // Request more than available
      expect(batch.length).toBeLessThanOrEqual(10);
    });

    it('should track hits and apply multiplier', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      // Mark as hit
      pollingGroup.markPolled('note-1', 'sd-1', true);

      const status = pollingGroup.getStatus();
      expect(status.recentHits).toBeGreaterThan(0);
    });

    it('should not exceed burst cap even with many hits', () => {
      // Add many entries
      for (let i = 0; i < 50; i++) {
        pollingGroup.add({
          noteId: `note-${i}`,
          sdId: 'sd-1',
          expectedSequences: new Map(),
          reason: 'fast-path-handoff',
        });
        // Mark them all as hits to trigger acceleration
        pollingGroup.markPolled(`note-${i}`, 'sd-1', true);
      }

      // Request a large batch
      const batch = pollingGroup.getNextBatch(100);
      // Should be capped by maxBurstPerSecond
      expect(batch.length).toBeLessThanOrEqual(defaultSettings.maxBurstPerSecond);
    });
  });

  describe('updateSequence / addExpectedSequence', () => {
    it('should mark sequence as caught up when actual >= expected', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 100]]),
        reason: 'fast-path-handoff',
      });

      // Update with actual sequence that matches expected
      pollingGroup.updateSequence('note-1', 'sd-1', 'instance-a', 100);

      const entry = pollingGroup.getEntry('note-1', 'sd-1');
      expect(entry?.caughtUpSequences?.has('instance-a')).toBe(true);
    });

    it('should mark sequence as caught up when actual > expected', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 100]]),
        reason: 'fast-path-handoff',
      });

      // Update with actual sequence higher than expected
      pollingGroup.updateSequence('note-1', 'sd-1', 'instance-a', 150);

      const entry = pollingGroup.getEntry('note-1', 'sd-1');
      expect(entry?.caughtUpSequences?.has('instance-a')).toBe(true);
    });

    it('should not mark sequence as caught up when actual < expected', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 100]]),
        reason: 'fast-path-handoff',
      });

      // Update with actual sequence lower than expected
      pollingGroup.updateSequence('note-1', 'sd-1', 'instance-a', 50);

      const entry = pollingGroup.getEntry('note-1', 'sd-1');
      expect(entry?.caughtUpSequences?.has('instance-a')).toBe(false);
    });

    it('should add expected sequence for new instance', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 100]]),
        reason: 'fast-path-handoff',
      });

      pollingGroup.addExpectedSequence('note-1', 'sd-1', 'instance-b', 200);

      const entry = pollingGroup.getEntry('note-1', 'sd-1');
      expect(entry?.expectedSequences.get('instance-b')).toBe(200);
      expect(entry?.expectedSequences.size).toBe(2);
    });

    it('should update expected sequence to higher value', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 100]]),
        reason: 'fast-path-handoff',
      });

      pollingGroup.addExpectedSequence('note-1', 'sd-1', 'instance-a', 150);

      const entry = pollingGroup.getEntry('note-1', 'sd-1');
      expect(entry?.expectedSequences.get('instance-a')).toBe(150);
    });

    it('should mark sequence as caught up via markSequenceCaughtUp', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map([['instance-a', 100]]),
        reason: 'fast-path-handoff',
      });

      pollingGroup.markSequenceCaughtUp('note-1', 'sd-1', 'instance-a');

      const entry = pollingGroup.getEntry('note-1', 'sd-1');
      expect(entry?.caughtUpSequences?.has('instance-a')).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'open-note',
      });

      pollingGroup.add({
        noteId: 'note-2',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      const status = pollingGroup.getStatus();

      expect(status.totalEntries).toBe(2);
      expect(status.highPriorityCount).toBe(1);
      expect(status.normalPriorityCount).toBe(1);
      expect(status.entries).toHaveLength(2);
      expect(typeof status.currentRatePerMinute).toBe('number');
      expect(typeof status.recentHits).toBe('number');
    });
  });

  describe('multi-window support', () => {
    it('should track open notes per window', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      // Window 1 opens note-1
      pollingGroup.setOpenNotesForWindow('window-1', 'sd-1', new Set(['note-1']));
      expect(pollingGroup.getStatus().entries[0].priority).toBe('high');

      // Window 2 also opens note-1
      pollingGroup.setOpenNotesForWindow('window-2', 'sd-1', new Set(['note-1']));

      // Window 1 closes note-1
      pollingGroup.setOpenNotesForWindow('window-1', 'sd-1', new Set());

      // Should still be high priority (window-2 has it open)
      expect(pollingGroup.getStatus().entries[0].priority).toBe('high');

      // Window 2 closes note-1
      pollingGroup.setOpenNotesForWindow('window-2', 'sd-1', new Set());

      // Now should be normal priority
      expect(pollingGroup.getStatus().entries[0].priority).toBe('normal');
    });

    it('should handle window close', () => {
      pollingGroup.add({
        noteId: 'note-1',
        sdId: 'sd-1',
        expectedSequences: new Map(),
        reason: 'fast-path-handoff',
      });

      pollingGroup.setOpenNotesForWindow('window-1', 'sd-1', new Set(['note-1']));
      expect(pollingGroup.getStatus().entries[0].priority).toBe('high');

      // Window closes entirely
      pollingGroup.removeWindow('window-1');

      expect(pollingGroup.getStatus().entries[0].priority).toBe('normal');
    });
  });
});

describe('Polling Group Settings Helpers', () => {
  describe('DEFAULT_POLLING_GROUP_SETTINGS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_POLLING_GROUP_SETTINGS.pollRatePerMinute).toBe(120);
      expect(DEFAULT_POLLING_GROUP_SETTINGS.hitRateMultiplier).toBe(0.25);
      expect(DEFAULT_POLLING_GROUP_SETTINGS.maxBurstPerSecond).toBe(10);
      expect(DEFAULT_POLLING_GROUP_SETTINGS.normalPriorityReserve).toBe(0.2);
      expect(DEFAULT_POLLING_GROUP_SETTINGS.recentEditWindowMs).toBe(5 * 60 * 1000);
      expect(DEFAULT_POLLING_GROUP_SETTINGS.fullRepollIntervalMs).toBe(30 * 60 * 1000);
      expect(DEFAULT_POLLING_GROUP_SETTINGS.fastPathMaxDelayMs).toBe(60 * 1000);
    });
  });

  describe('storedToRuntimeSettings', () => {
    it('should convert empty stored settings to empty partial', () => {
      const stored: PollingGroupStoredSettings = {};
      const result = storedToRuntimeSettings(stored);
      expect(result).toEqual({});
    });

    it('should pass through rate-based settings directly', () => {
      const stored: PollingGroupStoredSettings = {
        pollRatePerMinute: 60,
        hitRateMultiplier: 0.5,
        maxBurstPerSecond: 5,
        normalPriorityReserve: 0.3,
      };
      const result = storedToRuntimeSettings(stored);
      expect(result.pollRatePerMinute).toBe(60);
      expect(result.hitRateMultiplier).toBe(0.5);
      expect(result.maxBurstPerSecond).toBe(5);
      expect(result.normalPriorityReserve).toBe(0.3);
    });

    it('should convert minutes to milliseconds', () => {
      const stored: PollingGroupStoredSettings = {
        recentEditWindowMinutes: 10,
        fullRepollIntervalMinutes: 60,
      };
      const result = storedToRuntimeSettings(stored);
      expect(result.recentEditWindowMs).toBe(10 * 60 * 1000);
      expect(result.fullRepollIntervalMs).toBe(60 * 60 * 1000);
    });

    it('should convert seconds to milliseconds', () => {
      const stored: PollingGroupStoredSettings = {
        fastPathMaxDelaySeconds: 30,
      };
      const result = storedToRuntimeSettings(stored);
      expect(result.fastPathMaxDelayMs).toBe(30 * 1000);
    });

    it('should handle all settings together', () => {
      const stored: PollingGroupStoredSettings = {
        pollRatePerMinute: 200,
        hitRateMultiplier: 0.1,
        maxBurstPerSecond: 15,
        normalPriorityReserve: 0.15,
        recentEditWindowMinutes: 3,
        fullRepollIntervalMinutes: 45,
        fastPathMaxDelaySeconds: 90,
      };
      const result = storedToRuntimeSettings(stored);
      expect(result).toEqual({
        pollRatePerMinute: 200,
        hitRateMultiplier: 0.1,
        maxBurstPerSecond: 15,
        normalPriorityReserve: 0.15,
        recentEditWindowMs: 3 * 60 * 1000,
        fullRepollIntervalMs: 45 * 60 * 1000,
        fastPathMaxDelayMs: 90 * 1000,
      });
    });
  });

  describe('mergePollingSettings', () => {
    it('should return defaults when no overrides provided', () => {
      const result = mergePollingSettings({});
      expect(result).toEqual(DEFAULT_POLLING_GROUP_SETTINGS);
    });

    it('should apply base settings over defaults', () => {
      const base = { pollRatePerMinute: 60 };
      const result = mergePollingSettings(base);
      expect(result.pollRatePerMinute).toBe(60);
      expect(result.hitRateMultiplier).toBe(DEFAULT_POLLING_GROUP_SETTINGS.hitRateMultiplier);
    });

    it('should apply override over base', () => {
      const base = { pollRatePerMinute: 60 };
      const override = { pollRatePerMinute: 30 };
      const result = mergePollingSettings(base, override);
      expect(result.pollRatePerMinute).toBe(30);
    });

    it('should merge base and override independently', () => {
      const base = { pollRatePerMinute: 60, hitRateMultiplier: 0.5 };
      const override = { maxBurstPerSecond: 20 };
      const result = mergePollingSettings(base, override);
      expect(result.pollRatePerMinute).toBe(60);
      expect(result.hitRateMultiplier).toBe(0.5);
      expect(result.maxBurstPerSecond).toBe(20);
      expect(result.normalPriorityReserve).toBe(DEFAULT_POLLING_GROUP_SETTINGS.normalPriorityReserve);
    });

    it('should work with undefined override', () => {
      const base = { pollRatePerMinute: 60 };
      const result = mergePollingSettings(base, undefined);
      expect(result.pollRatePerMinute).toBe(60);
    });
  });
});
