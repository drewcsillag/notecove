/**
 * Timeline Builder - Groups CRDT updates into user-meaningful activity sessions
 *
 * Analyzes note history and creates timeline of editing sessions based on:
 * - Time gaps (5+ minutes of inactivity = new session)
 * - Edit count (100+ updates in single session = split)
 */

import type { UUID } from '../types';
import type { UpdateManager } from '../storage/update-manager';

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
    private readonly updateManager: UpdateManager,
    private readonly config: SessionConfig = DEFAULT_SESSION_CONFIG
  ) {}

  /**
   * Build timeline for a note
   * Returns sessions in chronological order (oldest first)
   */
  async buildTimeline(sdId: UUID, noteId: UUID): Promise<ActivitySession[]> {
    // 1. Collect all updates from packs and individual files
    const updates = await this.collectAllUpdates(sdId, noteId);

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
   * Collect all updates from packs and individual update files
   */
  private async collectAllUpdates(sdId: UUID, noteId: UUID): Promise<HistoryUpdate[]> {
    const allUpdates: HistoryUpdate[] = [];

    // Read from pack files first (historical updates)
    const packs = await this.updateManager.listPackFiles(sdId, noteId);

    for (const pack of packs) {
      try {
        const packData = await this.updateManager.readPackFile(sdId, noteId, pack.filename);

        // Add all updates from pack
        for (const entry of packData.updates) {
          allUpdates.push({
            instanceId: packData.instanceId,
            timestamp: entry.timestamp,
            sequence: entry.seq,
            data: entry.data,
          });
        }
      } catch (error) {
        console.error(`Failed to read pack file ${pack.filename}:`, error);
        // Continue with other packs
      }
    }

    // Read from individual update files (recent updates)
    const updateFiles = await this.updateManager.listNoteUpdateFiles(sdId, noteId);

    for (const file of updateFiles) {
      try {
        const data = await this.updateManager.readUpdateFile(file.path);

        // Parse sequence number from filename
        // Format: <instance-id>_<timestamp>-<sequence>.yjson
        const seqMatch = file.filename.match(/-(\d+)\.yjson/);
        const sequence = seqMatch ? parseInt(seqMatch[1], 10) : 0;

        allUpdates.push({
          instanceId: file.instanceId,
          timestamp: file.timestamp,
          sequence,
          data,
        });
      } catch (error) {
        console.error(`Failed to read update file ${file.filename}:`, error);
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
   */
  async getHistoryStats(
    sdId: UUID,
    noteId: UUID
  ): Promise<{
    totalUpdates: number;
    totalSessions: number;
    firstEdit: number | null;
    lastEdit: number | null;
    instanceCount: number;
    instances: string[];
  }> {
    const sessions = await this.buildTimeline(sdId, noteId);

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

    return {
      totalUpdates,
      totalSessions: sessions.length,
      firstEdit: sessions[0].startTime,
      lastEdit: sessions[sessions.length - 1].endTime,
      instanceCount: allInstanceIds.size,
      instances: Array.from(allInstanceIds),
    };
  }
}
