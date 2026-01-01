/**
 * File Sync Simulator Utilities
 *
 * Provides debugging and inspection tools for the cross-machine sync simulator.
 * These utilities help diagnose sync issues by allowing inspection of:
 * - SD directory contents
 * - CRDT log sequence numbers
 * - Simulator activity and timing
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

/**
 * Logging configuration for the sync simulator
 */
export interface SimulatorLogConfig {
  enabled: boolean;
  verbose: boolean; // If true, logs every file operation
  prefix: string; // Prefix for log messages (e.g., "[Simulator]")
}

/**
 * Default logging configuration
 */
export const defaultLogConfig: SimulatorLogConfig = {
  enabled: true,
  verbose: false,
  prefix: '[Sync Simulator]',
};

/**
 * Logger for sync simulator operations
 */
export class SimulatorLogger {
  private config: SimulatorLogConfig;

  constructor(config: Partial<SimulatorLogConfig> = {}) {
    // Merge with defaults to ensure all fields are defined
    this.config = { ...defaultLogConfig, ...config };
  }

  log(message: string): void {
    if (this.config.enabled) {
      console.log(`${this.config.prefix} ${message}`);
    }
  }

  verbose(message: string): void {
    if (this.config.enabled && this.config.verbose) {
      console.log(`${this.config.prefix} [VERBOSE] ${message}`);
    }
  }

  error(message: string, error?: unknown): void {
    if (this.config.enabled) {
      console.error(`${this.config.prefix} [ERROR] ${message}`, error);
    }
  }
}

/**
 * SD content inspection result
 */
export interface SDContents {
  path: string;
  notes: Array<{
    id: string;
    logFiles: string[];
    snapshotFiles: string[];
    totalLogSize: number;
  }>;
  activityLogs: string[];
  folderLogs: string[];
  totalFiles: number;
}

/**
 * Inspect the contents of an SD directory
 *
 * @param sdPath - Path to the SD directory
 * @returns Summary of SD contents
 */
export async function inspectSDContents(sdPath: string): Promise<SDContents> {
  const contents: SDContents = {
    path: sdPath,
    notes: [],
    activityLogs: [],
    folderLogs: [],
    totalFiles: 0,
  };

  try {
    // Check notes directory
    const notesPath = join(sdPath, 'notes');
    try {
      const noteDirs = await readdir(notesPath);

      for (const noteId of noteDirs) {
        const notePath = join(notesPath, noteId);
        const noteStat = await stat(notePath);

        if (noteStat.isDirectory()) {
          const logsPath = join(notePath, 'logs');
          const snapshotsPath = join(notePath, 'snapshots');

          let logFiles: string[] = [];
          let snapshotFiles: string[] = [];
          let totalLogSize = 0;

          try {
            logFiles = await readdir(logsPath);
            contents.totalFiles += logFiles.length;

            // Calculate total log size
            for (const logFile of logFiles) {
              const logFilePath = join(logsPath, logFile);
              const logStat = await stat(logFilePath);
              totalLogSize += logStat.size;
            }
          } catch {
            // Logs directory doesn't exist yet
          }

          try {
            snapshotFiles = await readdir(snapshotsPath);
            contents.totalFiles += snapshotFiles.length;
          } catch {
            // Snapshots directory doesn't exist yet
          }

          contents.notes.push({
            id: noteId,
            logFiles,
            snapshotFiles,
            totalLogSize,
          });
        }
      }
    } catch {
      // Notes directory doesn't exist yet
    }

    // Check activity logs
    const activityPath = join(sdPath, 'activity');
    try {
      contents.activityLogs = await readdir(activityPath);
      contents.totalFiles += contents.activityLogs.length;
    } catch {
      // Activity directory doesn't exist yet
    }

    // Check folder logs
    const foldersLogsPath = join(sdPath, 'folders', 'logs');
    try {
      contents.folderLogs = await readdir(foldersLogsPath);
      contents.totalFiles += contents.folderLogs.length;
    } catch {
      // Folder logs directory doesn't exist yet
    }
  } catch (error) {
    console.error('[inspectSDContents] Error inspecting SD:', error);
  }

  return contents;
}

/**
 * Get folder log file sizes for an SD directory
 * @param sdPath - Path to the SD directory
 * @returns Map of filename to size in bytes
 */
export async function getFolderLogSizes(sdPath: string): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  const foldersLogsPath = join(sdPath, 'folders', 'logs');

  try {
    const files = await readdir(foldersLogsPath);
    for (const file of files) {
      const filePath = join(foldersLogsPath, file);
      const fileStat = await stat(filePath);
      sizes.set(file, fileStat.size);
    }
  } catch {
    // Directory doesn't exist
  }

  return sizes;
}

/**
 * Format SD contents for display
 */
export function formatSDContents(contents: SDContents): string {
  const lines: string[] = [];
  lines.push(`SD: ${contents.path}`);
  lines.push(`Total files: ${contents.totalFiles}`);
  lines.push('');

  if (contents.notes.length > 0) {
    lines.push('Notes:');
    for (const note of contents.notes) {
      lines.push(`  - ${note.id}`);
      lines.push(`    Log files: ${note.logFiles.length} (${note.totalLogSize} bytes)`);
      lines.push(`    Snapshots: ${note.snapshotFiles.length}`);
      if (note.logFiles.length > 0) {
        lines.push(`    Latest log: ${note.logFiles[note.logFiles.length - 1]}`);
      }
    }
    lines.push('');
  }

  if (contents.activityLogs.length > 0) {
    lines.push(`Activity logs: ${contents.activityLogs.join(', ')}`);
    lines.push('');
  }

  if (contents.folderLogs.length > 0) {
    lines.push(`Folder logs: ${contents.folderLogs.length}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Options for waitForSDSync
 */
export interface WaitForSDSyncOptions {
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Poll interval in milliseconds (default: 500) */
  pollInterval?: number;
  /** Whether to check folder log sizes (default: true) */
  checkFolderLogs?: boolean;
  /** Logger for progress messages (optional) */
  logger?: SimulatorLogger;
}

/**
 * Wait for SD directories to have matching CRDT log sizes and folder log sizes.
 *
 * This function polls both SD directories and waits until:
 * 1. Both have the same note IDs
 * 2. Each note has matching totalLogSize between SD1 and SD2
 * 3. (Optionally) Folder log sizes match
 *
 * Use this to wait for FileSyncSimulator to complete syncing before making assertions.
 *
 * @param sd1Path - Path to the first SD directory (source)
 * @param sd2Path - Path to the second SD directory (destination)
 * @param options - Configuration options
 * @returns Promise that resolves when sync is complete, or rejects on timeout
 */
export async function waitForSDSync(
  sd1Path: string,
  sd2Path: string,
  options: WaitForSDSyncOptions = {}
): Promise<void> {
  const { timeout = 60000, pollInterval = 500, checkFolderLogs = true, logger } = options;

  const startTime = Date.now();
  let lastLogTime = 0;
  const logInterval = 5000; // Log progress every 5 seconds

  const log = (message: string) => {
    if (logger) {
      logger.log(message);
    } else {
      console.log(`[waitForSDSync] ${message}`);
    }
  };

  log(`Waiting for SD sync (timeout: ${timeout}ms, checkFolderLogs: ${checkFolderLogs})`);

  while (Date.now() - startTime < timeout) {
    const sd1Contents = await inspectSDContents(sd1Path);
    const sd2Contents = await inspectSDContents(sd2Path);

    // Check if note IDs match
    const sd1NoteIds = sd1Contents.notes.map((n) => n.id).sort();
    const sd2NoteIds = sd2Contents.notes.map((n) => n.id).sort();

    const noteIdsMatch = JSON.stringify(sd1NoteIds) === JSON.stringify(sd2NoteIds);

    // Check if all note log sizes match
    let allLogSizesMatch = true;
    const logSizeMismatches: string[] = [];

    if (noteIdsMatch) {
      for (const sd1Note of sd1Contents.notes) {
        const sd2Note = sd2Contents.notes.find((n) => n.id === sd1Note.id);
        if (!sd2Note || sd2Note.totalLogSize !== sd1Note.totalLogSize) {
          allLogSizesMatch = false;
          const sd2Size = sd2Note?.totalLogSize ?? 0;
          logSizeMismatches.push(`${sd1Note.id}: ${sd2Size}/${sd1Note.totalLogSize}`);
        }
      }
    }

    // Check folder log sizes if enabled
    let folderLogsMatch = true;
    if (checkFolderLogs) {
      const sd1FolderSizes = await getFolderLogSizes(sd1Path);
      const sd2FolderSizes = await getFolderLogSizes(sd2Path);

      // Check all SD1 folder logs exist in SD2 with same size
      for (const [file, size] of sd1FolderSizes) {
        const sd2Size = sd2FolderSizes.get(file);
        if (sd2Size !== size) {
          folderLogsMatch = false;
          break;
        }
      }
    }

    // Log progress periodically
    const now = Date.now();
    if (now - lastLogTime >= logInterval) {
      const elapsed = Math.round((now - startTime) / 1000);
      log(
        `Progress after ${elapsed}s: noteIds=${noteIdsMatch}, logSizes=${allLogSizesMatch}, folderLogs=${folderLogsMatch}`
      );
      if (logSizeMismatches.length > 0) {
        log(`  Log size mismatches: ${logSizeMismatches.join(', ')}`);
      }
      lastLogTime = now;
    }

    // Check if sync is complete
    if (noteIdsMatch && allLogSizesMatch && folderLogsMatch) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      log(`Sync complete after ${elapsed}s`);
      return;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Timeout - get final state for error message
  const sd1Contents = await inspectSDContents(sd1Path);
  const sd2Contents = await inspectSDContents(sd2Path);

  const details = [
    `SD1 notes: ${sd1Contents.notes.map((n) => `${n.id}(${n.totalLogSize}b)`).join(', ')}`,
    `SD2 notes: ${sd2Contents.notes.map((n) => `${n.id}(${n.totalLogSize}b)`).join(', ')}`,
  ];

  throw new Error(`waitForSDSync timed out after ${timeout}ms. ${details.join('; ')}`);
}

/**
 * CRDT log record information
 */
export interface CRDTLogRecord {
  timestamp: number;
  sequence: number;
  dataSize: number;
}

/**
 * Parse a CRDT log file and extract sequence numbers
 *
 * This helps verify that sequence numbers are monotonically increasing.
 * Based on the storage format design: each record has a length, timestamp, sequence, and data.
 *
 * @param logPath - Path to the .crdtlog file
 * @returns Array of records with their sequence numbers
 */
export async function parseCRDTLogSequences(logPath: string): Promise<CRDTLogRecord[]> {
  const records: CRDTLogRecord[] = [];

  try {
    const buffer = await readFile(logPath);
    let offset = 0;

    // Check magic number (NCLG)
    if (buffer.length < 5) {
      console.warn(`[parseCRDTLogSequences] File truncated (only ${buffer.length} bytes, need at least 5 for header)`);
      return records;
    }

    const magic = buffer.toString('ascii', 0, 4);
    if (magic !== 'NCLG') {
      console.warn(`[parseCRDTLogSequences] Invalid magic number: ${magic} (file may be corrupted or truncated)`);
      return records;
    }

    const version = buffer[4];
    if (version !== 0x01) {
      console.warn(`[parseCRDTLogSequences] Unsupported version: ${version}`);
      return records;
    }

    offset = 5; // Skip header

    // Parse records
    while (offset < buffer.length) {
      const recordStartOffset = offset;

      // Read varint length - may throw on truncation
      let lengthResult;
      try {
        lengthResult = readVarint(buffer, offset);
      } catch {
        console.warn(`[parseCRDTLogSequences] File truncated at offset ${offset} while reading record length`);
        break;
      }
      const length = lengthResult.value;
      offset = lengthResult.offset;

      if (length === 0) {
        // Termination sentinel
        break;
      }

      // Check if we have enough bytes for the full record
      if (offset + length > buffer.length) {
        console.warn(`[parseCRDTLogSequences] File truncated: record at offset ${recordStartOffset} claims ${length} bytes but only ${buffer.length - offset} available`);
        break;
      }

      // Read timestamp (8 bytes, big-endian)
      if (offset + 8 > buffer.length) {
        console.warn(`[parseCRDTLogSequences] File truncated at offset ${offset} while reading timestamp`);
        break;
      }
      const timestamp = buffer.readBigUInt64BE(offset);
      offset += 8;

      // Save offset before reading sequence varint
      const offsetBeforeSequence = offset;

      // Read sequence (varint) - may throw on truncation
      let sequenceResult;
      try {
        sequenceResult = readVarint(buffer, offset);
      } catch {
        console.warn(`[parseCRDTLogSequences] File truncated at offset ${offset} while reading sequence`);
        break;
      }
      const sequence = sequenceResult.value;
      offset = sequenceResult.offset;

      // Calculate data size correctly: length minus timestamp (8 bytes) minus sequence varint size
      const sequenceVarintSize = sequenceResult.offset - offsetBeforeSequence;
      const dataSize = length - 8 - sequenceVarintSize;

      if (dataSize < 0) {
        console.warn(`[parseCRDTLogSequences] Invalid record at offset ${recordStartOffset}: computed negative data size ${dataSize}`);
        break;
      }

      // Skip past data to next record
      offset += dataSize;

      records.push({
        timestamp: Number(timestamp),
        sequence,
        dataSize,
      });
    }
  } catch (error) {
    console.error('[parseCRDTLogSequences] Error parsing log:', error);
  }

  return records;
}

/**
 * Read a varint (LEB128) from a buffer
 */
function readVarint(buffer: Buffer, offset: number): { value: number; offset: number } {
  let result = 0;
  let shift = 0;
  let byte: number;

  do {
    if (offset >= buffer.length) {
      throw new Error('Unexpected end of buffer while reading varint');
    }

    byte = buffer[offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);

  return { value: result, offset };
}

/**
 * Validate that sequence numbers in a CRDT log are in order
 *
 * @param logPath - Path to the .crdtlog file
 * @returns True if sequences are valid, false otherwise
 */
export async function validateSequenceOrder(logPath: string): Promise<{
  valid: boolean;
  records: CRDTLogRecord[];
  errors: string[];
}> {
  const records = await parseCRDTLogSequences(logPath);
  const errors: string[] = [];

  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];

    if (curr!.sequence !== prev!.sequence + 1) {
      errors.push(
        `Sequence gap at index ${i}: expected ${prev!.sequence + 1}, got ${curr!.sequence}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    records,
    errors,
  };
}

/**
 * Validate sequence order for all notes in an SD
 *
 * @param sdPath - Path to the SD directory
 * @returns Validation results for all notes
 */
export async function validateAllSequences(sdPath: string): Promise<{
  valid: boolean;
  noteResults: Map<string, { valid: boolean; errors: string[] }>;
}> {
  const results = new Map<string, { valid: boolean; errors: string[] }>();
  let allValid = true;

  const notesPath = join(sdPath, 'notes');
  try {
    const noteDirs = await readdir(notesPath);

    for (const noteId of noteDirs) {
      const logsPath = join(notesPath, noteId, 'logs');
      try {
        const logFiles = await readdir(logsPath);

        for (const logFile of logFiles) {
          if (logFile.endsWith('.crdtlog')) {
            const logPath = join(logsPath, logFile);
            const validation = await validateSequenceOrder(logPath);

            if (!validation.valid) {
              allValid = false;
              results.set(`${noteId}/${logFile}`, {
                valid: false,
                errors: validation.errors,
              });
            } else {
              results.set(`${noteId}/${logFile}`, {
                valid: true,
                errors: [],
              });
            }
          }
        }
      } catch {
        // Logs directory doesn't exist
      }
    }
  } catch {
    // Notes directory doesn't exist
  }

  return {
    valid: allValid,
    noteResults: results,
  };
}

/**
 * File sync simulator configuration
 */
export interface FileSyncSimulatorConfig {
  /** Delay range for file sync in milliseconds [min, max] */
  syncDelayRange: [number, number];
  /** Delay range for completing partial syncs in milliseconds [min, max] (defaults to syncDelayRange) */
  partialCompletionDelayRange?: [number, number];
  /** Probability of partial file sync (0.0 - 1.0) */
  partialSyncProbability: number;
  /** Ratio of file to show during partial sync [min, max] (0.0 - 1.0) */
  partialSyncRatio: [number, number];
  /** Random seed for reproducibility (optional) */
  randomSeed?: number;
  /** Logger for simulator events */
  logger: SimulatorLogger;
}

/**
 * Default file sync simulator configuration
 */
export const defaultFileSyncConfig: FileSyncSimulatorConfig = {
  syncDelayRange: [3000, 6000], // 3-6 seconds
  partialCompletionDelayRange: [1000, 2000], // 1-2 seconds for completion
  partialSyncProbability: 0.0, // No partial sync by default
  partialSyncRatio: [0.3, 0.9], // Show 30-90% of file
  logger: new SimulatorLogger(),
};

/**
 * File sync simulator that copies files between two SD directories
 * with configurable delays and partial file syncing.
 *
 * This simulates cloud sync services like iCloud or Dropbox.
 */
export class FileSyncSimulator {
  private watchers: FSWatcher[] = [];
  private stopped = false;
  private pendingSyncs: Map<string, NodeJS.Timeout> = new Map();
  private fileSizes: Map<string, number> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  // Track pending partial sync completions so we can complete them on stop()
  private pendingPartialCompletions: Map<
    string,
    { sourceFilePath: string; destFilePath: string; direction: string }
  > = new Map();

  constructor(
    private sd1Path: string,
    private sd2Path: string,
    private config: FileSyncSimulatorConfig = defaultFileSyncConfig
  ) {}

  /**
   * Start the file sync simulator
   * Watches both SD directories and syncs files bidirectionally
   */
  async start(): Promise<void> {
    const chokidar = await import('chokidar');

    // Reset stopped flag to allow syncing (important when restarting after stop())
    this.stopped = false;

    this.config.logger.log(`Starting file sync simulator`);
    this.config.logger.log(`  SD1: ${this.sd1Path}`);
    this.config.logger.log(`  SD2: ${this.sd2Path}`);
    this.config.logger.log(
      `  Sync delay: ${this.config.syncDelayRange[0]}-${this.config.syncDelayRange[1]}ms`
    );

    // Watch SD1 and sync to SD2
    // Use polling mode for reliable detection of file changes, especially appends
    // FSEvents on macOS is unreliable for detecting appends to existing files
    const watcher1 = chokidar.watch(this.sd1Path, {
      persistent: true,
      ignoreInitial: false,
      usePolling: true,
      interval: 100,
      binaryInterval: 100,
      awaitWriteFinish: false,
    });

    watcher1.on('add', (filePath: string) => {
      if (!this.stopped) {
        this.scheduleSync(filePath, this.sd1Path, this.sd2Path, 'SD1→SD2');
      }
    });

    watcher1.on('change', (filePath: string) => {
      if (!this.stopped) {
        this.scheduleSync(filePath, this.sd1Path, this.sd2Path, 'SD1→SD2');
      }
    });

    // Watch SD2 and sync to SD1
    // Use polling mode for reliable detection of file changes, especially appends
    // FSEvents on macOS is unreliable for detecting appends to existing files
    const watcher2 = chokidar.watch(this.sd2Path, {
      persistent: true,
      ignoreInitial: false,
      usePolling: true,
      interval: 100,
      binaryInterval: 100,
      awaitWriteFinish: false,
    });

    watcher2.on('add', (filePath: string) => {
      if (!this.stopped) {
        this.scheduleSync(filePath, this.sd2Path, this.sd1Path, 'SD2→SD1');
      }
    });

    watcher2.on('change', (filePath: string) => {
      if (!this.stopped) {
        this.scheduleSync(filePath, this.sd2Path, this.sd1Path, 'SD2→SD1');
      }
    });

    this.watchers = [watcher1, watcher2];

    // Also poll for file size changes every 200ms as backup
    // This catches changes that FSEvents misses (common on macOS for appended files)
    // More frequent polling needed for small file appends like activity log entries
    this.pollInterval = setInterval(() => {
      if (!this.stopped) {
        this.pollForChanges().catch((err) => {
          this.config.logger.error('Error polling for changes:', err);
        });
      }
    }, 200);

    this.config.logger.log('File sync simulator started');
  }

  /**
   * Poll all files in both SDs and sync any that have changed size
   */
  private async pollForChanges(): Promise<void> {
    const { readdir, stat: fsStat } = await import('fs/promises');
    const { join } = await import('path');

    const scanDir = async (
      basePath: string,
      sourceSD: string,
      destSD: string,
      direction: string
    ) => {
      const scanRecursive = async (dir: string) => {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              await scanRecursive(fullPath);
            } else if (entry.isFile()) {
              try {
                const stats = await fsStat(fullPath);
                const prevSize = this.fileSizes.get(fullPath);
                // Log all .crdtlog and .log files for debugging
                if (fullPath.endsWith('.crdtlog') || fullPath.endsWith('.log')) {
                  this.config.logger.verbose(
                    `Poll check: ${fullPath} size=${stats.size}, prev=${prevSize ?? 'none'}`
                  );
                }
                if (prevSize === undefined) {
                  // New file - record size AND trigger sync (in case chokidar missed the add event)
                  this.fileSizes.set(fullPath, stats.size);
                  this.config.logger.log(
                    `Poll detected new file: ${fullPath} (${stats.size} bytes)`
                  );
                  this.scheduleSync(fullPath, sourceSD, destSD, direction);
                } else if (stats.size !== prevSize) {
                  // Size changed, trigger sync
                  this.config.logger.log(
                    `Poll detected size change: ${fullPath} (${prevSize} -> ${stats.size})`
                  );
                  this.fileSizes.set(fullPath, stats.size);
                  this.scheduleSync(fullPath, sourceSD, destSD, direction);
                }
              } catch {
                // File may have been deleted
              }
            }
          }
        } catch {
          // Directory may not exist yet
        }
      };
      await scanRecursive(basePath);
    };

    await Promise.all([
      scanDir(this.sd1Path, this.sd1Path, this.sd2Path, 'SD1→SD2'),
      scanDir(this.sd2Path, this.sd2Path, this.sd1Path, 'SD2→SD1'),
    ]);
  }

  /**
   * Schedule a file sync with delay
   */
  private scheduleSync(
    filePath: string,
    sourceSD: string,
    destSD: string,
    direction: string
  ): void {
    // Cancel any pending sync for this file
    const existingTimeout = this.pendingSyncs.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Calculate delay - use shorter delays for coordination files
    const [minDelay, maxDelay] = this.config.syncDelayRange;
    const isActivityLog = filePath.includes('/activity/') && filePath.endsWith('.log');
    const isCrdtLog = filePath.endsWith('.crdtlog');

    // Activity logs sync fastest (200-500ms) since they're small coordination files
    // CRDT logs sync quickly (500-1500ms) since they need to arrive before ActivitySync polls
    // Other files use the configured delay range
    let effectiveMinDelay: number;
    let effectiveMaxDelay: number;
    if (isActivityLog) {
      effectiveMinDelay = Math.min(200, minDelay);
      effectiveMaxDelay = Math.min(500, maxDelay);
    } else if (isCrdtLog) {
      effectiveMinDelay = Math.min(500, minDelay);
      effectiveMaxDelay = Math.min(1500, maxDelay);
    } else {
      effectiveMinDelay = minDelay;
      effectiveMaxDelay = maxDelay;
    }
    const delay = effectiveMinDelay + Math.random() * (effectiveMaxDelay - effectiveMinDelay);

    // Calculate relative path within SD
    const relativePath = filePath.startsWith(sourceSD)
      ? filePath.substring(sourceSD.length)
      : filePath;

    this.config.logger.verbose(
      `Scheduled sync: ${relativePath} (${direction}) in ${Math.round(delay)}ms`
    );

    // Schedule the sync
    const timeout = setTimeout(() => {
      this.performSync(filePath, sourceSD, destSD, direction).catch((error) => {
        this.config.logger.error(`Sync failed for ${relativePath}`, error);
      });
      this.pendingSyncs.delete(filePath);
    }, delay);

    this.pendingSyncs.set(filePath, timeout);
  }

  /**
   * Perform the actual file sync
   */
  private async performSync(
    sourceFilePath: string,
    sourceSD: string,
    destSD: string,
    direction: string
  ): Promise<void> {
    if (this.stopped) {
      return;
    }

    try {
      // Read source file
      const content = await readFile(sourceFilePath);

      // Calculate relative path within SD
      const relativePath = sourceFilePath.startsWith(sourceSD)
        ? sourceFilePath.substring(sourceSD.length)
        : sourceFilePath;

      const destFilePath = join(destSD, relativePath);

      // For append-only log files (.crdtlog, .log), only sync if source is larger than dest
      // This prevents race conditions where an old version overwrites a newer appended version
      const isAppendOnlyLog =
        sourceFilePath.endsWith('.crdtlog') || sourceFilePath.endsWith('.log');
      if (isAppendOnlyLog) {
        try {
          const { stat: fsStat } = await import('fs/promises');
          const destStats = await fsStat(destFilePath);
          if (destStats.size >= content.length) {
            this.config.logger.verbose(
              `Skipping sync: ${relativePath} (${direction}) - dest ${destStats.size} >= source ${content.length} bytes`
            );
            return;
          }
        } catch {
          // Dest file doesn't exist, proceed with sync
        }
      }

      // Determine if we should do partial sync
      const shouldPartialSync = Math.random() < this.config.partialSyncProbability;

      if (shouldPartialSync) {
        // Partial sync: write part of the file
        const [minRatio, maxRatio] = this.config.partialSyncRatio;
        const ratio = minRatio + Math.random() * (maxRatio - minRatio);
        const bytesToWrite = Math.floor(content.length * ratio);
        const partialContent = content.slice(0, bytesToWrite);

        this.config.logger.log(
          `Partial sync: ${relativePath} (${direction}) - ${bytesToWrite}/${content.length} bytes`
        );

        // Ensure destination directory exists
        const { mkdir } = await import('fs/promises');
        const { dirname } = await import('path');
        await mkdir(dirname(destFilePath), { recursive: true });

        // Write partial file
        const { writeFile: writeFilePromise } = await import('fs/promises');
        await writeFilePromise(destFilePath, partialContent);

        // Schedule completion of the file (use partialCompletionDelayRange if set, otherwise syncDelayRange)
        const completionRange =
          this.config.partialCompletionDelayRange ?? this.config.syncDelayRange;
        const completionDelay =
          completionRange[0] + Math.random() * (completionRange[1] - completionRange[0]);

        // Track completion timeout so it can be cleared on stop()
        const completionKey = `${destFilePath}:completion`;

        // Store info needed to complete this partial sync (for completing on stop)
        this.pendingPartialCompletions.set(completionKey, {
          sourceFilePath,
          destFilePath,
          direction,
        });

        const completionTimeout = setTimeout(async () => {
          if (!this.stopped) {
            // Re-read source file to get current content (file may have grown since partial sync)
            try {
              const currentContent = await readFile(sourceFilePath);
              this.config.logger.log(
                `Completing partial sync: ${relativePath} (${direction}) - ${currentContent.length} bytes`
              );
              await writeFilePromise(destFilePath, currentContent);
            } catch (err) {
              // File may have been deleted
              if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.config.logger.error(`Error completing partial sync for ${relativePath}:`, err);
              }
            }
          }
          this.pendingSyncs.delete(completionKey);
          this.pendingPartialCompletions.delete(completionKey);
        }, completionDelay);

        this.pendingSyncs.set(completionKey, completionTimeout);
      } else {
        // Full sync: write complete file
        this.config.logger.log(
          `Full sync: ${relativePath} (${direction}) - ${content.length} bytes`
        );

        // Ensure destination directory exists
        const { mkdir } = await import('fs/promises');
        const { dirname } = await import('path');
        await mkdir(dirname(destFilePath), { recursive: true });

        // Write complete file
        const { writeFile: writeFilePromise } = await import('fs/promises');
        await writeFilePromise(destFilePath, content);
      }
    } catch (error) {
      // Ignore ENOENT errors (file deleted before sync)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Complete all pending partial syncs immediately.
   * This ensures files are in a valid state before validation.
   */
  async completePendingPartialSyncs(): Promise<void> {
    if (this.pendingPartialCompletions.size === 0) {
      return;
    }

    this.config.logger.log(
      `Completing ${this.pendingPartialCompletions.size} pending partial sync(s)...`
    );

    const { writeFile: writeFilePromise } = await import('fs/promises');

    const completionPromises: Promise<void>[] = [];

    for (const [key, info] of this.pendingPartialCompletions.entries()) {
      const promise = (async () => {
        try {
          const currentContent = await readFile(info.sourceFilePath);
          const relativePath = info.destFilePath.includes(this.sd1Path)
            ? info.destFilePath.substring(this.sd1Path.length)
            : info.destFilePath.substring(this.sd2Path.length);

          this.config.logger.log(
            `Force-completing partial sync: ${relativePath} (${info.direction}) - ${currentContent.length} bytes`
          );
          await writeFilePromise(info.destFilePath, currentContent);
        } catch (err) {
          // File may have been deleted
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            this.config.logger.error(`Error force-completing partial sync for ${key}:`, err);
          }
        }

        // Clear the scheduled timeout since we completed it manually
        const timeout = this.pendingSyncs.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.pendingSyncs.delete(key);
        }
      })();

      completionPromises.push(promise);
    }

    await Promise.all(completionPromises);
    this.pendingPartialCompletions.clear();

    this.config.logger.log('All pending partial syncs completed');
  }

  /**
   * Stop the file sync simulator
   */
  async stop(): Promise<void> {
    this.config.logger.log('Stopping file sync simulator...');
    this.stopped = true;

    // Clear poll interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Complete all pending partial syncs before clearing timeouts
    // This ensures files are in a valid state for validation
    await this.completePendingPartialSyncs();

    // Clear all pending syncs (non-partial syncs that haven't started yet)
    for (const timeout of this.pendingSyncs.values()) {
      clearTimeout(timeout);
    }
    this.pendingSyncs.clear();

    // Close all watchers
    await Promise.all(this.watchers.map((watcher) => watcher.close()));
    this.watchers = [];

    // Clear file size cache
    this.fileSizes.clear();

    this.config.logger.log('File sync simulator stopped');
  }
}

// Import FSWatcher type from chokidar
type FSWatcher = import('chokidar').FSWatcher;
