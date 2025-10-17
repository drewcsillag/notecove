/**
 * Update Store - Manages packed CRDT update files
 * Each instance writes its own update files and reads others'
 * No write conflicts - completely robust multi-instance sync
 *
 * Updates are batched into files based on configurable flush strategy
 */

export type UpdateType = 'content' | 'metadata';

interface FileStorage {
  isElectron: boolean;
  notesPath: string;
}

interface PendingUpdate {
  data: Uint8Array;
  type: UpdateType;
}

interface NoteState {
  seen: Map<string, number>;
  seenRanges: Map<string, Array<[number, number]>>;
  writeCounter: number;
  pendingUpdates: PendingUpdate[];
  pendingStartSeq: number | null;
}

interface MetaFile {
  instanceId: string;
  lastWrite: number;
  seen: Record<string, number>;
  lastUpdated: string;
}

interface PackedFile {
  instance: string;
  sequence: [number, number];
  timestamp: string;
  updates: Array<string | {  // Support both old (string) and new (object) formats
    data: string;
    type: UpdateType;
  }>;
}

interface FlushOptions {
  updateCount: number;
  totalBytes: number;
  firstUpdateTime: number | null;
}

interface FlushStrategyOptions {
  idleMs?: number;
  maxUpdates?: number;
  maxBytes?: number;
  flushStrategy?: FlushStrategy;
}

export interface UpdateWithMetadata {
  instanceId: string;
  sequence: number;
  update: Uint8Array;
  type: UpdateType;
}

interface GapSummary {
  totalMissing: number;
  instanceCount: number;
  instances: Array<{
    instanceId: string;
    ranges: Array<[number, number]>;
    missing: number;
  }>;
  lastChecked: number;
}

export class UpdateStore {
  fileStorage: FileStorage;
  instanceId: string;
  isElectron: boolean;
  noteState: Map<string, NoteState>;
  seen: Map<string, number>;
  writeCounter: number;
  pendingUpdates: Uint8Array[];
  pendingStartSeq: number | null;
  flushStrategy: FlushStrategy;
  flushTimer: NodeJS.Timeout | null;

  constructor(fileStorage: FileStorage, instanceId: string, options: FlushStrategyOptions = {}) {
    this.fileStorage = fileStorage;
    this.instanceId = instanceId;
    this.isElectron = fileStorage.isElectron;

    // Per-note tracking: Map<noteId, { seen, writeCounter, pendingUpdates, pendingStartSeq }>
    this.noteState = new Map();

    // DEPRECATED - keeping for backwards compatibility but not using
    this.seen = new Map();
    this.writeCounter = 0;
    this.pendingUpdates = [];
    this.pendingStartSeq = null;

    // Flush strategy (easy to swap out)
    this.flushStrategy = options.flushStrategy || new IdleFlushStrategy({
      idleMs: options.idleMs || 3000,  // 3 seconds of inactivity
      maxUpdates: options.maxUpdates || 100,  // Safety: flush after 100 updates
      maxBytes: options.maxBytes || 1024 * 1024  // Safety: flush after 1MB
    });

    this.flushTimer = null;
  }

  /**
   * Add a range to an instance's seen ranges, merging adjacent/overlapping ranges
   * @param ranges - Sorted array of [start, end] ranges
   * @param start - Start sequence
   * @param end - End sequence
   * @returns Updated ranges
   */
  addToRanges(ranges: Array<[number, number]>, start: number, end: number): Array<[number, number]> {
    if (ranges.length === 0) {
      return [[start, end]];
    }

    const newRanges: Array<[number, number]> = [];
    let merged = false;
    let newStart = start;
    let newEnd = end;

    for (const [rangeStart, rangeEnd] of ranges) {
      if (merged) {
        // Already merged, just copy remaining ranges
        newRanges.push([rangeStart, rangeEnd]);
      } else if (newEnd < rangeStart - 1) {
        // New range comes before this range, no overlap
        newRanges.push([newStart, newEnd]);
        newRanges.push([rangeStart, rangeEnd]);
        merged = true;
      } else if (newStart > rangeEnd + 1) {
        // New range comes after this range, no overlap
        newRanges.push([rangeStart, rangeEnd]);
      } else {
        // Ranges overlap or are adjacent, merge them
        newStart = Math.min(newStart, rangeStart);
        newEnd = Math.max(newEnd, rangeEnd);
      }
    }

    if (!merged) {
      // New range extends or comes after all existing ranges
      newRanges.push([newStart, newEnd]);
    }

    return newRanges;
  }

  /**
   * Find gaps in a set of ranges
   * @param ranges - Sorted array of [start, end] ranges
   * @returns Array of gap ranges
   */
  findGaps(ranges: Array<[number, number]>): Array<[number, number]> {
    if (ranges.length === 0) return [];

    const gaps: Array<[number, number]> = [];
    for (let i = 0; i < ranges.length - 1; i++) {
      const [, currentEnd] = ranges[i];
      const [nextStart] = ranges[i + 1];
      if (nextStart > currentEnd + 1) {
        gaps.push([currentEnd + 1, nextStart - 1]);
      }
    }
    return gaps;
  }

  /**
   * Check if a sequence is in any of the ranges
   * @param ranges - Sorted array of [start, end] ranges
   * @param seq - Sequence number to check
   * @returns True if sequence is in ranges
   */
  isInRanges(ranges: Array<[number, number]>, seq: number): boolean {
    for (const [start, end] of ranges) {
      if (seq >= start && seq <= end) return true;
      if (seq < start) return false; // Ranges are sorted
    }
    return false;
  }

  /**
   * Get or create state for a note
   * @param noteId - Note ID
   * @returns Note state
   */
  getNoteState(noteId: string): NoteState {
    if (!this.noteState.has(noteId)) {
      this.noteState.set(noteId, {
        seen: new Map(),              // DEPRECATED: for backwards compatibility
        seenRanges: new Map(),        // NEW: instanceId -> [[start, end], ...]
        writeCounter: 0,
        pendingUpdates: [],
        pendingStartSeq: null
      });
    }
    return this.noteState.get(noteId)!;
  }

  /**
   * Initialize the update store for a note
   * Loads our meta file and sets up tracking
   * @param noteId - Note ID
   */
  async initialize(noteId: string): Promise<void> {
    if (!this.isElectron) return;

    const state = this.getNoteState(noteId);

    try {
      const metaPath = this.getMetaPath(noteId);
      const result = await window.electronAPI?.fileSystem.readFile(metaPath);

      if (result?.success && result.content) {
        // Decode Uint8Array to string for JSON parsing
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(result.content);
        const meta: MetaFile = JSON.parse(jsonString);
        state.writeCounter = meta.lastWrite || 0;
        state.seen = new Map(Object.entries(meta.seen || {}));
        console.log(`UpdateStore initialized for ${noteId}:`, {
          instanceId: this.instanceId,
          writeCounter: state.writeCounter,
          seen: Object.fromEntries(state.seen)
        });
      } else {
        // First time - initialize empty
        state.writeCounter = 0;
        state.seen = new Map();
        console.log(`UpdateStore: New note ${noteId}, starting fresh`);
      }
    } catch (error) {
      console.error('Error initializing UpdateStore:', error);
      state.writeCounter = 0;
      state.seen = new Map();
    }
  }

  /**
   * Add a CRDT update to the buffer
   * Will be flushed according to flush strategy
   * @param noteId - Note ID
   * @param update - CRDT update data
   * @param type - Update type ('content' or 'metadata')
   */
  async addUpdate(noteId: string, update: Uint8Array, type: UpdateType): Promise<void> {
    if (!this.isElectron) return;

    const state = this.getNoteState(noteId);

    // Track the sequence number for this update
    if (state.pendingStartSeq === null) {
      state.pendingStartSeq = state.writeCounter + 1;
    }

    state.pendingUpdates.push({ data: update, type });

    // Check if we should flush based on strategy
    const shouldFlush = this.flushStrategy.shouldFlush({
      updateCount: state.pendingUpdates.length,
      totalBytes: this.getTotalBytes(noteId),
      firstUpdateTime: this.flushStrategy.firstUpdateTime
    });

    if (shouldFlush) {
      await this.flush(noteId);
    } else {
      // Reset idle timer
      this.resetFlushTimer(noteId);
    }
  }

  /**
   * Reset the idle flush timer
   * @param noteId - Note ID
   */
  resetFlushTimer(noteId: string): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    // Only set timer if strategy has idle timeout
    const idleMs = (this.flushStrategy as IdleFlushStrategy).options?.idleMs;
    if (idleMs) {
      this.flushTimer = setTimeout(() => {
        this.flush(noteId);
      }, idleMs);
    }
  }

  /**
   * Get total bytes of pending updates
   * @param noteId - Note ID
   * @returns Total bytes
   */
  getTotalBytes(noteId: string): number {
    const state = this.getNoteState(noteId);
    return state.pendingUpdates.reduce((sum, update) => sum + update.data.length, 0);
  }

  /**
   * Flush pending updates to a packed file
   * @param noteId - Note ID
   * @returns Success
   */
  async flush(noteId: string): Promise<boolean> {
    const state = this.getNoteState(noteId);

    console.log(`[UpdateStore] flush() called for ${noteId}, buffer has ${state.pendingUpdates.length} updates`);

    if (!this.isElectron) {
      console.log('[UpdateStore] Not in Electron mode, skipping flush');
      return false;
    }

    if (state.pendingUpdates.length === 0) {
      console.log('[UpdateStore] No pending updates to flush');
      return false;
    }

    try {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }

      const startSeq = state.pendingStartSeq!;
      const endSeq = startSeq + state.pendingUpdates.length - 1;

      console.log(`[UpdateStore] Flushing ${state.pendingUpdates.length} updates (seq ${startSeq}-${endSeq})`);

      // Update our write counter
      state.writeCounter = endSeq;

      // Create packed file
      const packedFile: PackedFile = {
        instance: this.instanceId,
        sequence: [startSeq, endSeq],  // Range [start, end] inclusive
        timestamp: new Date().toISOString(),
        updates: state.pendingUpdates.map(u => ({
          data: this.encodeUpdate(u.data),
          type: u.type
        }))
      };

      // Write packed file
      const updatePath = this.getUpdatePath(noteId, this.instanceId, startSeq, endSeq);
      await this.ensureDirectories(noteId);

      const writeResult = await window.electronAPI?.fileSystem.writeFile(
        updatePath,
        JSON.stringify(packedFile)
      );

      if (!writeResult?.success) {
        console.error('Failed to write packed update file:', writeResult?.error || 'Unknown error');
        return false;
      }

      // Update our seen map
      state.seen.set(this.instanceId, state.writeCounter);

      // Write our meta file
      await this.writeMeta(noteId);

      console.log(`UpdateStore: Flushed ${state.pendingUpdates.length} updates as ${this.instanceId}.${startSeq}-${endSeq} for note ${noteId}`);

      // Clear buffer
      state.pendingUpdates = [];
      state.pendingStartSeq = null;
      this.flushStrategy.reset();

      return true;
    } catch (error) {
      console.error('Error flushing updates:', error);
      return false;
    }
  }

  /**
   * Read ALL updates from all instances (ignoring seen state)
   * Used when loading a note from scratch
   * @param noteId - Note ID
   * @returns Array of {instanceId, sequence, update} objects
   */
  async readAllUpdates(noteId: string): Promise<UpdateWithMetadata[]> {
    if (!this.isElectron) return [];

    try {
      const updatesDir = this.getUpdatesDir(noteId);

      // List all update files
      const listResult = await window.electronAPI?.fileSystem.readDir(updatesDir);
      if (!listResult || !listResult.success) {
        // Directory doesn't exist yet
        return [];
      }

      const allUpdates: UpdateWithMetadata[] = [];

      if (!listResult) return [];
      for (const filename of listResult.files || []) {
        if (!filename.endsWith('.yjson')) continue;

        // Parse filename: instance-A.000001-000050.yjson or instance-A.000001.yjson
        const match = filename.match(/^(.+)\.(\d+)(?:-(\d+))?\.yjson$/);
        if (!match) continue;

        const [, instanceId] = match;

        // Read the packed file
        const updatePath = `${updatesDir}/${filename}`;
        const readResult = await window.electronAPI?.fileSystem.readFile(updatePath);
        if (!readResult?.success || !readResult.content) {
          console.error('Failed to read packed update file:', updatePath);
          continue;
        }

        // Decode Uint8Array to string for JSON parsing
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(readResult.content);
        const packedFile: PackedFile = JSON.parse(jsonString);
        const [fileStartSeq] = packedFile.sequence;

        // Read ALL updates from this file
        for (let i = 0; i < packedFile.updates.length; i++) {
          const seq = fileStartSeq + i;
          const updateEntry = packedFile.updates[i];

          // Backward compatibility: handle old format (string) and new format (object)
          let update: Uint8Array;
          let type: UpdateType;

          if (typeof updateEntry === 'string') {
            // Old format: just the base64 string
            update = this.decodeUpdate(updateEntry);
            type = 'content'; // Default to content for backward compat
          } else {
            // New format: object with data and type
            update = this.decodeUpdate(updateEntry.data);
            type = updateEntry.type;
          }

          allUpdates.push({ instanceId, sequence: seq, update, type });
        }
      }

      // Sort by sequence to apply in order
      allUpdates.sort((a, b) => a.sequence - b.sequence);

      console.log(`UpdateStore: Read ${allUpdates.length} total updates for note ${noteId}`);
      return allUpdates;
    } catch (error) {
      console.error('Error reading all updates:', error);
      return [];
    }
  }

  /**
   * Read all updates we haven't seen yet from all instances
   * Used for incremental sync
   * @param noteId - Note ID
   * @returns Array of {instanceId, sequence, update} objects
   */
  async readNewUpdates(noteId: string): Promise<UpdateWithMetadata[]> {
    if (!this.isElectron) return [];

    const state = this.getNoteState(noteId);

    try {
      const updatesDir = this.getUpdatesDir(noteId);

      // List all update files
      const listResult = await window.electronAPI?.fileSystem.readDir(updatesDir);
      if (!listResult || !listResult.success) {
        // Directory doesn't exist yet
        return [];
      }

      const newUpdates: UpdateWithMetadata[] = [];

      if (!listResult) return [];
      for (const filename of listResult.files || []) {
        if (!filename.endsWith('.yjson')) continue;

        // Parse filename: instance-A.000001-000050.yjson or instance-A.000001.yjson
        const match = filename.match(/^(.+)\.(\d+)(?:-(\d+))?\.yjson$/);
        if (!match) continue;

        const [, instanceId, startStr, endStr] = match;
        const startSeq = parseInt(startStr, 10);
        const endSeq = endStr ? parseInt(endStr, 10) : startSeq;

        // Get the ranges we've seen from this instance
        const ranges = state.seenRanges.get(instanceId) || [];

        // Check if we need to read this file at all
        // We need it if ANY sequence in the file is not in our ranges
        let needFile = false;
        for (let seq = startSeq; seq <= endSeq; seq++) {
          if (!this.isInRanges(ranges, seq)) {
            needFile = true;
            break;
          }
        }

        if (!needFile) {
          console.log(`[readNewUpdates] ${noteId}: Skipping ${filename} - all sequences in ranges`);
          continue;
        }

        console.log(`[readNewUpdates] ${noteId}: Reading ${filename} (may have new sequences)`);

        // Read the packed file
        const updatePath = `${updatesDir}/${filename}`;
        const readResult = await window.electronAPI?.fileSystem.readFile(updatePath);
        if (!readResult?.success || !readResult.content) {
          console.error('Failed to read packed update file:', updatePath);
          continue;
        }

        // Decode Uint8Array to string for JSON parsing
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(readResult.content);
        const packedFile: PackedFile = JSON.parse(jsonString);

        // Extract updates we haven't seen
        const [fileStartSeq] = packedFile.sequence;
        let hasNewUpdates = false;

        for (let i = 0; i < packedFile.updates.length; i++) {
          const seq = fileStartSeq + i;

          // Skip if we already have this sequence
          if (this.isInRanges(ranges, seq)) {
            continue;
          }

          const updateEntry = packedFile.updates[i];

          // Backward compatibility: handle old format (string) and new format (object)
          let update: Uint8Array;
          let type: UpdateType;

          if (typeof updateEntry === 'string') {
            // Old format: just the base64 string
            update = this.decodeUpdate(updateEntry);
            type = 'content'; // Default to content for backward compat
          } else {
            // New format: object with data and type
            update = this.decodeUpdate(updateEntry.data);
            type = updateEntry.type;
          }

          newUpdates.push({ instanceId, sequence: seq, update, type });
          hasNewUpdates = true;
        }

        // Update ranges for this instance with the entire file range
        // (even if we skipped some sequences, they're now "available")
        if (hasNewUpdates) {
          const updatedRanges = this.addToRanges(ranges, startSeq, endSeq);
          state.seenRanges.set(instanceId, updatedRanges);
        }
      }

      // Sort by sequence to apply in order
      newUpdates.sort((a, b) => a.sequence - b.sequence);

      if (newUpdates.length > 0) {
        console.log(`UpdateStore: Read ${newUpdates.length} new updates for note ${noteId}`);
        // Update our meta file with what we've seen
        await this.writeMeta(noteId);
      }

      return newUpdates;
    } catch (error) {
      console.error('Error reading new updates:', error);
      return [];
    }
  }

  /**
   * Write our meta file tracking what we've seen
   * @param noteId - Note ID
   */
  async writeMeta(noteId: string): Promise<void> {
    if (!this.isElectron) return;

    const state = this.getNoteState(noteId);

    try {
      const metaPath = this.getMetaPath(noteId);

      const meta: MetaFile = {
        instanceId: this.instanceId,
        lastWrite: state.writeCounter,
        seen: Object.fromEntries(state.seen),
        lastUpdated: new Date().toISOString()
      };

      await this.ensureDirectories(noteId);

      const result = await window.electronAPI?.fileSystem.writeFile(
        metaPath,
        JSON.stringify(meta, null, 2)
      );

      if (!result?.success) {
        console.error('Failed to write meta file:', result?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error writing meta file:', error);
    }
  }

  /**
   * Ensure directories exist for a note
   * @param noteId - Note ID
   */
  async ensureDirectories(noteId: string): Promise<void> {
    if (!this.isElectron) return;

    const notesPath = this.fileStorage.notesPath;
    const noteDir = `${notesPath}/${noteId}`;
    const updatesDir = `${noteDir}/updates`;
    const metaDir = `${noteDir}/meta`;

    for (const dir of [noteDir, updatesDir, metaDir]) {
      const exists = await window.electronAPI?.fileSystem.exists(dir);
      if (!exists) {
        await window.electronAPI?.fileSystem.mkdir(dir);
      }
    }
  }

  /**
   * Get path to our meta file
   * @param noteId - Note ID
   * @returns Path
   */
  getMetaPath(noteId: string): string {
    const notesPath = this.fileStorage.notesPath;
    return `${notesPath}/${noteId}/meta/${this.instanceId}.json`;
  }

  /**
   * Get path to updates directory
   * @param noteId - Note ID
   * @returns Path
   */
  getUpdatesDir(noteId: string): string {
    const notesPath = this.fileStorage.notesPath;
    return `${notesPath}/${noteId}/updates`;
  }

  /**
   * Get path to a packed update file
   * @param noteId - Note ID
   * @param instanceId - Instance ID
   * @param startSeq - Start sequence number
   * @param endSeq - End sequence number (optional, same as start for single update)
   * @returns Path
   */
  getUpdatePath(noteId: string, instanceId: string, startSeq: number, endSeq: number | null = null): string {
    const updatesDir = this.getUpdatesDir(noteId);
    const paddedStart = startSeq.toString().padStart(6, '0');

    if (endSeq && endSeq !== startSeq) {
      const paddedEnd = endSeq.toString().padStart(6, '0');
      return `${updatesDir}/${instanceId}.${paddedStart}-${paddedEnd}.yjson`;
    } else {
      return `${updatesDir}/${instanceId}.${paddedStart}.yjson`;
    }
  }

  /**
   * Encode update as base64 for storage
   * @param update - Update data
   * @returns Base64 string
   */
  encodeUpdate(update: Uint8Array): string {
    // For large updates (images), we can't use spread operator as it causes stack overflow
    // Process in chunks instead
    const chunkSize = 8192; // 8KB chunks
    let binaryString = '';

    for (let i = 0; i < update.length; i += chunkSize) {
      const chunk = update.subarray(i, Math.min(i + chunkSize, update.length));
      binaryString += String.fromCharCode(...chunk);
    }

    return btoa(binaryString);
  }

  /**
   * Decode update from base64
   * @param base64 - Base64 string
   * @returns Update data
   */
  decodeUpdate(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Get all instance IDs that have written updates for a note
   * @param noteId - Note ID
   * @returns Instance IDs
   */
  async getInstances(noteId: string): Promise<string[]> {
    if (!this.isElectron) return [];

    try {
      const metaDir = `${this.fileStorage.notesPath}/${noteId}/meta`;
      const result = await window.electronAPI?.fileSystem.readDir(metaDir);

      if (!result?.success) {
        return [];
      }

      return (result.files || [])
        .filter((f: string) => f.endsWith('.json'))
        .map((f: string) => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  /**
   * Cleanup - flush any pending updates
   * @param noteId - Note ID
   */
  async cleanup(noteId: string): Promise<void> {
    const state = this.getNoteState(noteId);

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (state.pendingUpdates.length > 0) {
      await this.flush(noteId);
    }
  }

  /**
   * Get gaps for a specific note from a specific instance
   * @param noteId - Note ID
   * @param instanceId - Instance ID
   * @returns Array of gap ranges
   */
  getGapsForInstance(noteId: string, instanceId: string): Array<[number, number]> {
    const state = this.getNoteState(noteId);
    const ranges = state.seenRanges.get(instanceId) || [];
    return this.findGaps(ranges);
  }

  /**
   * Get all gaps for a note from all instances
   * @param noteId - Note ID
   * @returns instanceId -> gap ranges
   */
  getGaps(noteId: string): Map<string, Array<[number, number]>> {
    const state = this.getNoteState(noteId);
    const gaps = new Map<string, Array<[number, number]>>();

    state.seenRanges.forEach((ranges, instanceId) => {
      const gapRanges = this.findGaps(ranges);
      if (gapRanges.length > 0) {
        gaps.set(instanceId, gapRanges);
      }
    });

    return gaps;
  }

  /**
   * Check if a note has any gaps
   * @param noteId - Note ID
   * @returns True if note has gaps
   */
  hasGaps(noteId: string): boolean {
    const gaps = this.getGaps(noteId);
    return gaps.size > 0;
  }

  /**
   * Check if any tracked notes have gaps
   * @returns True if any note has gaps
   */
  hasAnyGaps(): boolean {
    for (const [noteId] of this.noteState) {
      if (this.hasGaps(noteId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get a summary of gap state for UI display
   * @param noteId - Note ID
   * @returns Gap summary or null if no gaps
   */
  getGapSummary(noteId: string): GapSummary | null {
    const gaps = this.getGaps(noteId);
    if (gaps.size === 0) return null;

    let totalMissing = 0;
    const instances: Array<{
      instanceId: string;
      ranges: Array<[number, number]>;
      missing: number;
    }> = [];

    gaps.forEach((ranges, instanceId) => {
      const missing = ranges.reduce((sum, [start, end]) =>
        sum + (end - start + 1), 0);
      totalMissing += missing;
      instances.push({
        instanceId,
        ranges,
        missing
      });
    });

    return {
      totalMissing,
      instanceCount: instances.length,
      instances,
      lastChecked: Date.now()
    };
  }

  /**
   * Get all notes that currently have gaps
   * @returns Array of note IDs with gaps
   */
  getNotesWithGaps(): string[] {
    const notesWithGaps: string[] = [];
    for (const [noteId] of this.noteState) {
      if (this.hasGaps(noteId)) {
        notesWithGaps.push(noteId);
      }
    }
    return notesWithGaps;
  }
}

/**
 * Base flush strategy interface
 */
interface FlushStrategy {
  firstUpdateTime: number | null;
  shouldFlush(options: FlushOptions): boolean;
  reset(): void;
}

/**
 * Idle-based flush strategy
 * Flushes after period of inactivity, with safety limits
 */
class IdleFlushStrategy implements FlushStrategy {
  options: FlushStrategyOptions;
  firstUpdateTime: number | null;

  constructor(options: FlushStrategyOptions = {}) {
    this.options = {
      idleMs: options.idleMs || 3000,
      maxUpdates: options.maxUpdates || 100,
      maxBytes: options.maxBytes || 1024 * 1024
    };
    this.firstUpdateTime = null;
  }

  shouldFlush({ updateCount, totalBytes }: FlushOptions): boolean {
    // Track when first update arrived
    if (this.firstUpdateTime === null) {
      this.firstUpdateTime = Date.now();
    }

    // Safety limits - flush if exceeded
    if (updateCount >= this.options.maxUpdates!) {
      console.log('UpdateStore: Flushing due to max updates');
      return true;
    }

    if (totalBytes >= this.options.maxBytes!) {
      console.log('UpdateStore: Flushing due to max bytes');
      return true;
    }

    // Otherwise wait for idle timer
    return false;
  }

  reset(): void {
    this.firstUpdateTime = null;
  }
}

/**
 * Immediate flush strategy (for server-based sync)
 * Flushes every update immediately
 */
export class ImmediateFlushStrategy implements FlushStrategy {
  firstUpdateTime: number | null = null;

  shouldFlush(): boolean {
    return true;
  }

  reset(): void {}
}

/**
 * Count-based flush strategy
 * Flushes after N updates
 */
export class CountFlushStrategy implements FlushStrategy {
  maxCount: number;
  firstUpdateTime: number | null = null;

  constructor(count = 50) {
    this.maxCount = count;
  }

  shouldFlush({ updateCount }: FlushOptions): boolean {
    return updateCount >= this.maxCount;
  }

  reset(): void {}
}
