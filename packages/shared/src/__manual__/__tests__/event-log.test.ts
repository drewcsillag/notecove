/**
 * Tests for EventLog
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventLog } from '../event-log.js';

const TEST_DIR = '/tmp/fuzz-test-tests';

describe('EventLog', () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should record events with timestamps', async () => {
    const logPath = path.join(TEST_DIR, 'test.jsonl');
    const log = new EventLog(logPath);
    await log.initialize();

    const before = Date.now();
    await log.record({
      instanceId: 'instance-1',
      type: 'create',
      noteId: 'note-123',
    });
    const after = Date.now();

    const events = log.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(events[0].timestamp).toBeLessThanOrEqual(after);
    expect(events[0].instanceId).toBe('instance-1');
    expect(events[0].type).toBe('create');
    expect(events[0].noteId).toBe('note-123');

    await log.close();
  });

  it('should persist events to file', async () => {
    const logPath = path.join(TEST_DIR, 'test.jsonl');
    const log = new EventLog(logPath);
    await log.initialize();

    await log.record({ instanceId: 'instance-1', type: 'create', noteId: 'note-1' });
    await log.record({ instanceId: 'instance-2', type: 'edit', noteId: 'note-1' });

    await log.close();

    // Load from file
    const loaded = await EventLog.load(logPath);
    expect(loaded.getEvents()).toHaveLength(2);
    expect(loaded.getEvents()[0].noteId).toBe('note-1');
    expect(loaded.getEvents()[1].type).toBe('edit');
  });

  it('should filter events by note ID', async () => {
    const logPath = path.join(TEST_DIR, 'test.jsonl');
    const log = new EventLog(logPath);
    await log.initialize();

    await log.record({ instanceId: 'instance-1', type: 'create', noteId: 'note-1' });
    await log.record({ instanceId: 'instance-1', type: 'create', noteId: 'note-2' });
    await log.record({ instanceId: 'instance-1', type: 'edit', noteId: 'note-1' });

    const note1Events = log.getEventsForNote('note-1');
    expect(note1Events).toHaveLength(2);
    expect(note1Events.every((e) => e.noteId === 'note-1')).toBe(true);

    await log.close();
  });

  it('should compute statistics', async () => {
    const logPath = path.join(TEST_DIR, 'test.jsonl');
    const log = new EventLog(logPath);
    await log.initialize();

    await log.record({ instanceId: 'instance-1', type: 'create', noteId: 'note-1' });
    await log.record({ instanceId: 'instance-1', type: 'create', noteId: 'note-2' });
    await log.record({ instanceId: 'instance-2', type: 'edit', noteId: 'note-1' });
    await log.record({ instanceId: 'sync-daemon', type: 'sync-completed' });

    const stats = log.getStats();

    expect(stats.totalEvents).toBe(4);
    expect(stats.eventsByType.create).toBe(2);
    expect(stats.eventsByType.edit).toBe(1);
    expect(stats.eventsByInstance['instance-1']).toBe(2);
    expect(stats.eventsByInstance['instance-2']).toBe(1);
    expect(stats.uniqueNotes).toBe(2);

    await log.close();
  });
});
