/**
 * Validation - Checks if instances have converged to the same state
 */

/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import * as crypto from 'crypto';
import type { TestInstance } from './test-instance.js';
import type { Event, EventLog } from './event-log.js';

export interface ValidationReport {
  success: boolean;
  reason?: string;
  timestamp: number;

  // Summary stats
  stats: {
    totalEvents: number;
    notesCreated: number;
    editsPerformed: number;
    syncOperations: number;
    partialWrites: number;
    gcTriggered: number;
    snapshotsCreated: number;
  };

  // State dumps
  instance1: InstanceState;
  instance2: InstanceState;

  // Divergence details (if any)
  divergences?: Divergence[];

  // File system state
  fileSystemSnapshot: {
    instance1Files: string[];
    instance2Files: string[];
  };
}

export interface InstanceState {
  noteCount: number;
  notes: NoteState[];
}

export interface NoteState {
  id: string;
  title: string;
  contentHash: string;
  contentLength: number;
  isDeleted: boolean;
  yjsStateVector: string; // Base64 encoded for comparison
}

export interface Divergence {
  noteId: string;
  issue: 'missing-in-instance-1' | 'missing-in-instance-2' | 'content-mismatch' | 'delete-mismatch';
  instance1State?: NoteState;
  instance2State?: NoteState;
  relatedEvents: Event[];
}

/**
 * Validate that two instances have converged to the same state
 */
export async function validateConvergence(
  instance1: TestInstance,
  instance2: TestInstance,
  eventLog: EventLog
): Promise<ValidationReport> {
  const timestamp = Date.now();

  // Gather stats from event log
  const stats = computeStats(eventLog);

  // Get all notes from both instances
  const notes1 = await instance1.getAllNotes();
  const notes2 = await instance2.getAllNotes();

  // Build state representations
  const state1 = await buildInstanceState(instance1, notes1);
  const state2 = await buildInstanceState(instance2, notes2);

  // Find divergences
  const divergences = findDivergences(state1, state2, eventLog);

  // Get file system snapshot
  const fileSystemSnapshot = {
    instance1Files: await listAllFiles(instance1.getSDPath()),
    instance2Files: await listAllFiles(instance2.getSDPath()),
  };

  // Determine success
  const success = divergences.length === 0 && state1.noteCount === state2.noteCount;

  const report: ValidationReport = {
    success,
    reason: success ? undefined : generateFailureReason(divergences, state1, state2),
    timestamp,
    stats,
    instance1: state1,
    instance2: state2,
    divergences: divergences.length > 0 ? divergences : undefined,
    fileSystemSnapshot,
  };

  return report;
}

/**
 * Build instance state representation
 */
async function buildInstanceState(
  _instance: TestInstance,
  notes: Array<{ id: string; doc: any }>
): Promise<InstanceState> {
  const noteStates: NoteState[] = [];

  for (const { id, doc } of notes) {
    const metadata = doc.getMetadata();

    // Extract title from content (simplified)
    let title = 'Untitled';
    try {
      const firstChild = doc.content.firstChild;
      if (firstChild?.firstChild) {
        title = firstChild.firstChild.toString().substring(0, 50);
      }
    } catch {
      // Ignore
    }

    // Get full content as string
    const content = doc.content.toString();

    // Compute content hash
    const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);

    // Get Yjs state vector (base64 encoded)
    const yjsState = doc.encodeStateAsUpdate();
    const yjsStateVector = Buffer.from(yjsState).toString('base64');

    noteStates.push({
      id,
      title,
      contentHash,
      contentLength: content.length,
      isDeleted: metadata.deleted,
      yjsStateVector,
    });
  }

  // Sort by ID for consistent ordering
  noteStates.sort((a, b) => a.id.localeCompare(b.id));

  return {
    noteCount: noteStates.length,
    notes: noteStates,
  };
}

/**
 * Find divergences between two states
 */
function findDivergences(
  state1: InstanceState,
  state2: InstanceState,
  eventLog: EventLog
): Divergence[] {
  const divergences: Divergence[] = [];

  // Build maps for easy lookup
  const notes1Map = new Map(state1.notes.map((n) => [n.id, n]));
  const notes2Map = new Map(state2.notes.map((n) => [n.id, n]));

  // Check all notes in instance 1
  for (const note1 of state1.notes) {
    const note2 = notes2Map.get(note1.id);

    if (!note2) {
      // Note exists in instance 1 but not instance 2
      divergences.push({
        noteId: note1.id,
        issue: 'missing-in-instance-2',
        instance1State: note1,
        relatedEvents: eventLog.getEventsForNote(note1.id),
      });
    } else {
      // Check for content mismatch
      if (note1.yjsStateVector !== note2.yjsStateVector) {
        divergences.push({
          noteId: note1.id,
          issue: 'content-mismatch',
          instance1State: note1,
          instance2State: note2,
          relatedEvents: eventLog.getEventsForNote(note1.id),
        });
      }

      // Check for delete mismatch
      if (note1.isDeleted !== note2.isDeleted) {
        divergences.push({
          noteId: note1.id,
          issue: 'delete-mismatch',
          instance1State: note1,
          instance2State: note2,
          relatedEvents: eventLog.getEventsForNote(note1.id),
        });
      }
    }
  }

  // Check for notes in instance 2 that are missing in instance 1
  for (const note2 of state2.notes) {
    if (!notes1Map.has(note2.id)) {
      divergences.push({
        noteId: note2.id,
        issue: 'missing-in-instance-1',
        instance2State: note2,
        relatedEvents: eventLog.getEventsForNote(note2.id),
      });
    }
  }

  return divergences;
}

/**
 * Compute statistics from event log
 */
function computeStats(eventLog: EventLog): ValidationReport['stats'] {
  const events = eventLog.getEvents();

  return {
    totalEvents: events.length,
    notesCreated: events.filter((e) => e.type === 'create').length,
    editsPerformed: events.filter((e) => e.type === 'edit').length,
    syncOperations: events.filter((e) => e.type === 'sync-completed').length,
    partialWrites: events.filter((e) => e.type === 'partial-write-started').length,
    gcTriggered: events.filter((e) => e.type === 'gc-triggered').length,
    snapshotsCreated: events.filter((e) => e.type === 'snapshot-created').length,
  };
}

/**
 * Generate failure reason summary
 */
function generateFailureReason(
  divergences: Divergence[],
  state1: InstanceState,
  state2: InstanceState
): string {
  if (state1.noteCount !== state2.noteCount) {
    return `Note count mismatch: instance-1 has ${state1.noteCount} notes, instance-2 has ${state2.noteCount} notes`;
  }

  if (divergences.length === 1) {
    const div = divergences[0];
    return `Note ${div.noteId}: ${div.issue.replace(/-/g, ' ')}`;
  }

  return `${divergences.length} notes diverged`;
}

/**
 * List all files in a directory recursively
 */
async function listAllFiles(dirPath: string): Promise<string[]> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(dirPath, fullPath);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          files.push(relativePath);
        }
      }
    } catch (error) {
      // Directory doesn't exist, skip
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  await walk(dirPath);

  return files.sort();
}

/**
 * Generate human-readable markdown report
 */
export function generateMarkdownReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push('# Fuzz Test Validation Report\n');
  lines.push(`**Timestamp:** ${new Date(report.timestamp).toISOString()}`);
  lines.push(`**Result:** ${report.success ? '✅ PASSED' : '❌ FAILED'}\n`);

  if (!report.success && report.reason) {
    lines.push(`**Failure Reason:** ${report.reason}\n`);
  }

  // Stats
  lines.push('## Statistics\n');
  lines.push(`- Total Events: ${report.stats.totalEvents}`);
  lines.push(`- Notes Created: ${report.stats.notesCreated}`);
  lines.push(`- Edits Performed: ${report.stats.editsPerformed}`);
  lines.push(`- Sync Operations: ${report.stats.syncOperations}`);
  lines.push(`- Partial Writes: ${report.stats.partialWrites}`);
  lines.push(`- GC Triggered: ${report.stats.gcTriggered}`);
  lines.push(`- Snapshots Created: ${report.stats.snapshotsCreated}\n`);

  // Instance states
  lines.push('## Instance States\n');
  lines.push(`**Instance 1:** ${report.instance1.noteCount} notes`);
  lines.push(`**Instance 2:** ${report.instance2.noteCount} notes\n`);

  // Divergences
  if (report.divergences && report.divergences.length > 0) {
    lines.push('## Divergences\n');

    for (const div of report.divergences) {
      lines.push(`### Note: ${div.noteId}\n`);
      lines.push(`**Issue:** ${div.issue.replace(/-/g, ' ')}\n`);

      if (div.instance1State) {
        lines.push('**Instance 1 State:**');
        lines.push(`- Title: ${div.instance1State.title}`);
        lines.push(`- Content Hash: ${div.instance1State.contentHash}`);
        lines.push(`- Content Length: ${div.instance1State.contentLength}`);
        lines.push(`- Is Deleted: ${div.instance1State.isDeleted}\n`);
      }

      if (div.instance2State) {
        lines.push('**Instance 2 State:**');
        lines.push(`- Title: ${div.instance2State.title}`);
        lines.push(`- Content Hash: ${div.instance2State.contentHash}`);
        lines.push(`- Content Length: ${div.instance2State.contentLength}`);
        lines.push(`- Is Deleted: ${div.instance2State.isDeleted}\n`);
      }

      lines.push(`**Related Events:** ${div.relatedEvents.length} events\n`);
    }
  }

  return lines.join('\n');
}
