/**
 * Event Log - Records all operations during fuzz test for replay and debugging
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type EventType =
  | 'create'
  | 'edit'
  | 'delete'
  | 'write'
  | 'sync-queued'
  | 'sync-started'
  | 'sync-completed'
  | 'partial-write-started'
  | 'partial-write-completed'
  | 'gc-triggered'
  | 'snapshot-created'
  | 'reload-triggered';

export interface Event {
  timestamp: number;
  instanceId: 'instance-1' | 'instance-2' | 'sync-daemon';
  type: EventType;
  noteId?: string;
  noteTitle?: string; // First 20 chars for readability
  sequenceNumber?: number;
  filePath?: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
}

export class EventLog {
  private events: Event[] = [];
  private logPath: string;
  private writeStream: fs.FileHandle | null = null;

  constructor(logPath: string) {
    this.logPath = logPath;
  }

  /**
   * Initialize the log file
   */
  async initialize(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.logPath), { recursive: true });

    // Open file for appending
    this.writeStream = await fs.open(this.logPath, 'a');
  }

  /**
   * Record an event
   */
  async record(event: Omit<Event, 'timestamp'>): Promise<void> {
    const fullEvent: Event = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);

    // Write to file immediately (JSONL format - one JSON object per line)
    if (this.writeStream) {
      await this.writeStream.write(JSON.stringify(fullEvent) + '\n');
    }
  }

  /**
   * Get all recorded events
   */
  getEvents(): Event[] {
    return [...this.events];
  }

  /**
   * Get events for a specific note
   */
  getEventsForNote(noteId: string): Event[] {
    return this.events.filter((e) => e.noteId === noteId);
  }

  /**
   * Get events for a specific instance
   */
  getEventsForInstance(instanceId: Event['instanceId']): Event[] {
    return this.events.filter((e) => e.instanceId === instanceId);
  }

  /**
   * Get events in a time range
   */
  getEventsInRange(startTime: number, endTime: number): Event[] {
    return this.events.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  /**
   * Flush and close the log
   */
  async close(): Promise<void> {
    if (this.writeStream) {
      await this.writeStream.sync();
      await this.writeStream.close();
      this.writeStream = null;
    }
  }

  /**
   * Load events from a log file
   */
  static async load(logPath: string): Promise<EventLog> {
    const log = new EventLog(logPath);

    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as Event;
          log.events.push(event);
        } catch (error) {
          console.warn(`Failed to parse event line: ${line}`, error);
        }
      }
    } catch (error) {
      // File doesn't exist yet, that's fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return log;
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByInstance: Record<string, number>;
    uniqueNotes: number;
    timespan: { start: number; end: number; durationMs: number };
  } {
    const eventsByType: Record<string, number> = {};
    const eventsByInstance: Record<string, number> = {};
    const uniqueNotes = new Set<string>();

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsByInstance[event.instanceId] = (eventsByInstance[event.instanceId] || 0) + 1;

      if (event.noteId) {
        uniqueNotes.add(event.noteId);
      }
    }

    const timestamps = this.events.map((e) => e.timestamp);
    const start = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const end = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsByInstance,
      uniqueNotes: uniqueNotes.size,
      timespan: {
        start,
        end,
        durationMs: end - start,
      },
    };
  }
}
