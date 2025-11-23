/**
 * Timeline Builder - Groups CRDT updates into user-meaningful activity sessions
 *
 * Analyzes note history and creates timeline of editing sessions based on:
 * - Time gaps (5+ minutes of inactivity = new session)
 * - Edit count (100+ updates in single session = split)
 */

import type { FileSystemAdapter } from '../storage/types';
import { LogReader } from '../storage/log-reader';

/**
 * Single update in note history with metadata
 */
export interface HistoryUpdate {
  instanceId: string;
  timestamp: number;
  sequence: number;
  data: Uint8Array;
}

/**
 * Activity session - grouped set of updates
 */
export interface ActivitySession {
  id: string; // UUID for this session
  startTime: number;
  endTime: number;
  updateCount: number;
  instanceIds: string[]; // All instances that contributed to this session
  updates: HistoryUpdate[];
}

/**
 * Configuration for session detection
 */
export interface SessionConfig {
  // New session after this many milliseconds of inactivity
  idleThresholdMs: number;
  // Split session if it exceeds this many updates
  maxUpdatesPerSession: number;
}

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  idleThresholdMs: 5 * 60 * 1000, // 5 minutes
  maxUpdatesPerSession: 100,
};

/**
 * Timeline builder - analyzes note history and groups into sessions
 */
export class TimelineBuilder {
  constructor(
    private readonly fs: FileSystemAdapter,
    private readonly config: SessionConfig = DEFAULT_SESSION_CONFIG
  ) {}

  /**
   * Build timeline for a note
   * Returns sessions in chronological order (oldest first)
   *
   * @param logsDir - Path to the note's logs directory (e.g., {sdPath}/notes/{noteId}/logs)
   */
  async buildTimeline(logsDir: string): Promise<ActivitySession[]> {
    // 1. Collect all updates from log files
    const updates = await this.collectAllUpdates(logsDir);

    if (updates.length === 0) {
      return [];
    }

    // 2. Sort by timestamp (chronological order)
    updates.sort((a, b) => a.timestamp - b.timestamp);

    // 3. Group into sessions based on time gaps and update count
    const sessions = this.groupIntoSessions(updates);

    return sessions;
  }

  /**
   * Collect all updates from .crdtlog files in the logs directory
   */
  private async collectAllUpdates(logsDir: string): Promise<HistoryUpdate[]> {
    const allUpdates: HistoryUpdate[] = [];

    // List all log files in the directory
    const logFiles = await LogReader.listLogFiles(logsDir, this.fs);

    for (const logFile of logFiles) {
      try {
        // Read all records from this log file
        const records = await LogReader.readAllRecords(logFile.path, this.fs);

        // Add all records as updates
        for (const record of records) {
          allUpdates.push({
            instanceId: logFile.instanceId,
            timestamp: record.timestamp,
            sequence: record.sequence,
            data: record.data,
          });
        }
      } catch (error) {
        console.error(`Failed to read log file ${logFile.filename}:`, error);
        // Continue with other files
      }
    }

    return allUpdates;
  }

  /**
   * Group updates into sessions based on time gaps and update count
   * Implements hybrid approach: new session after idle threshold OR max updates
   */
  private groupIntoSessions(updates: HistoryUpdate[]): ActivitySession[] {
    if (updates.length === 0) {
      return [];
    }

    const sessions: ActivitySession[] = [];
    let currentSession: ActivitySession | null = null;

    for (const update of updates) {
      // Start new session if:
      // 1. No current session (first update)
      // 2. Time gap exceeds threshold
      // 3. Current session has too many updates
      const shouldStartNewSession =
        !currentSession ||
        update.timestamp - currentSession.endTime > this.config.idleThresholdMs ||
        currentSession.updates.length >= this.config.maxUpdatesPerSession;

      if (shouldStartNewSession) {
        // Save previous session
        if (currentSession) {
          sessions.push(currentSession);
        }

        // Start new session with deterministic ID
        // Session ID is based on first update's timestamp and instance ID
        // This ensures sessions have stable IDs across multiple timeline builds
        const sessionId = `${update.timestamp}-${update.instanceId}`;
        currentSession = {
          id: sessionId,
          startTime: update.timestamp,
          endTime: update.timestamp,
          updateCount: 1,
          instanceIds: [update.instanceId],
          updates: [update],
        };
      } else if (currentSession) {
        // Add to current session
        currentSession.endTime = update.timestamp;
        currentSession.updateCount++;
        currentSession.updates.push(update);

        // Track unique instance IDs
        if (!currentSession.instanceIds.includes(update.instanceId)) {
          currentSession.instanceIds.push(update.instanceId);
        }
      }
    }

    // Don't forget the last session
    if (currentSession) {
      sessions.push(currentSession);
    }

    return sessions;
  }

  /**
   * Get statistics about a note's history
   *
   * @param logsDir - Path to the note's logs directory
   */
  async getHistoryStats(logsDir: string): Promise<{
    totalUpdates: number;
    totalSessions: number;
    firstEdit: number | null;
    lastEdit: number | null;
    instanceCount: number;
    instances: string[];
  }> {
    const sessions = await this.buildTimeline(logsDir);

    if (sessions.length === 0) {
      return {
        totalUpdates: 0,
        totalSessions: 0,
        firstEdit: null,
        lastEdit: null,
        instanceCount: 0,
        instances: [],
      };
    }

    const allInstanceIds = new Set<string>();
    let totalUpdates = 0;

    for (const session of sessions) {
      totalUpdates += session.updateCount;
      session.instanceIds.forEach((id) => allInstanceIds.add(id));
    }

    const firstSession = sessions[0];
    const lastSession = sessions[sessions.length - 1];

    return {
      totalUpdates,
      totalSessions: sessions.length,
      firstEdit: firstSession ? firstSession.startTime : null,
      lastEdit: lastSession ? lastSession.endTime : null,
      instanceCount: allInstanceIds.size,
      instances: Array.from(allInstanceIds),
    };
  }
}
