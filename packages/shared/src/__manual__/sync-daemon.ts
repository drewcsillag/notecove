/**
 * Sync Daemon - Simulates sloppy file sync like Google Drive or iCloud
 *
 * Uses polling (not file watchers) to simulate real cloud sync behavior.
 * Polls directories every 1-2 seconds to detect changes.
 *
 * Features:
 * - Polling-based detection (more realistic than instant watch)
 * - Random delays
 * - Out-of-order delivery
 * - Partial writes (file written incompletely, then completed later)
 * - Batched delivery
 * - Configurable sync direction (uni/bidirectional)
 */

/* eslint-disable @typescript-eslint/require-await */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { EventLog } from './event-log.js';

export interface SyncDaemonConfig {
  instance1Dir: string;
  instance2Dir: string;
  eventLog: EventLog;

  // Delay configuration
  delayRange: [number, number]; // [min, max] in milliseconds

  // Sloppiness toggles
  enableOutOfOrder: boolean; // Shuffle delivery order
  enableBatching: boolean; // Group files that arrive within window
  batchWindowMs: number; // Time window for batching
  partialWriteProbability: number; // 0.0 - 1.0, chance of partial write

  // Sync direction
  syncDirection: 'bidirectional' | 'instance1-to-instance2' | 'instance2-to-instance1';
}

interface QueuedSync {
  id: string;
  sourcePath: string;
  destPath: string;
  sourceInstance: 'instance-1' | 'instance-2';
  destInstance: 'instance-1' | 'instance-2';
  queuedAt: number;
  executeAt: number;
  isPartial?: boolean;
  partialSize?: number;
}

export class SyncDaemon {
  private config: SyncDaemonConfig;
  private syncQueue: QueuedSync[] = [];
  private nextSyncId = 0;
  private running = false;
  private processInterval: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  // Track files we've seen: filepath -> mtimeMs
  private seenFiles = new Map<string, number>();
  private readonly MAX_QUEUE_SIZE = 500; // Prevent runaway queue growth

  constructor(config: SyncDaemonConfig) {
    this.config = config;
  }

  /**
   * Start polling directories and processing syncs
   */
  async start(): Promise<void> {
    this.running = true;

    // Start processing queue every 100ms
    this.processInterval = setInterval(() => void this.processQueue(), 100);

    // Start polling every 1-2 seconds (randomized to avoid sync)
    const startPolling = async (): Promise<void> => {
      if (!this.running) return;

      await this.pollDirectories();

      // Random delay 1-2 seconds
      const delay = 1000 + Math.random() * 1000;
      this.pollInterval = setTimeout(() => void startPolling(), delay);
    };

    void startPolling();

    console.log(
      `[Sync Daemon] Started polling (${this.config.syncDirection}, delay: ${this.config.delayRange[0]}-${this.config.delayRange[1]}ms)`
    );
  }

  /**
   * Stop polling and processing
   */
  async stop(): Promise<void> {
    this.running = false;

    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }

    console.log('[Sync Daemon] Stopped');
  }

  /**
   * Poll directories for changes
   */
  private async pollDirectories(): Promise<void> {
    // Poll instance 1 -> instance 2
    if (
      this.config.syncDirection === 'bidirectional' ||
      this.config.syncDirection === 'instance1-to-instance2'
    ) {
      await this.pollDirectory(this.config.instance1Dir, this.config.instance2Dir, 'instance-1');
    }

    // Poll instance 2 -> instance 1
    if (
      this.config.syncDirection === 'bidirectional' ||
      this.config.syncDirection === 'instance2-to-instance1'
    ) {
      await this.pollDirectory(this.config.instance2Dir, this.config.instance1Dir, 'instance-2');
    }
  }

  /**
   * Poll a single directory for changes
   */
  private async pollDirectory(
    sourceDir: string,
    destDir: string,
    sourceInstance: 'instance-1' | 'instance-2'
  ): Promise<void> {
    try {
      const files = await this.getAllFiles(sourceDir);

      for (const relPath of files) {
        if (!this.running) break;

        // Skip temporary files
        if (relPath.includes('.tmp') || relPath.includes('.migration')) continue;

        const sourcePath = path.join(sourceDir, relPath);
        const destPath = path.join(destDir, relPath);

        // Check if file has changed
        try {
          const stat = await fs.stat(sourcePath);
          const key = `${sourceInstance}:${relPath}`;
          const lastMtime = this.seenFiles.get(key);

          if (lastMtime === undefined || stat.mtimeMs > lastMtime) {
            // New or modified file
            this.seenFiles.set(key, stat.mtimeMs);

            // Queue sync
            await this.queueSync(sourcePath, destPath, sourceInstance);
          }
        } catch {
          // File disappeared, ignore
        }
      }
    } catch {
      // Directory doesn't exist yet, ignore
    }
  }

  /**
   * Recursively get all files in a directory
   */
  private async getAllFiles(dir: string, prefix = ''): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const relPath = prefix ? path.join(prefix, entry.name) : entry.name;

        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(path.join(dir, entry.name), relPath);
          files.push(...subFiles);
        } else {
          files.push(relPath);
        }
      }
    } catch {
      // Ignore errors
    }

    return files;
  }

  /**
   * Queue a file sync with random delay
   */
  private async queueSync(
    sourcePath: string,
    destPath: string,
    sourceInstance: 'instance-1' | 'instance-2'
  ): Promise<void> {
    // Limit queue size to prevent runaway growth
    if (this.syncQueue.length >= this.MAX_QUEUE_SIZE) {
      return; // Skip if queue is full
    }

    const destInstance = sourceInstance === 'instance-1' ? 'instance-2' : 'instance-1';

    // Calculate delay
    const [minDelay, maxDelay] = this.config.delayRange;
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    const executeAt = Date.now() + delay;

    // Determine if this should be a partial write
    const isPartial = Math.random() < this.config.partialWriteProbability;

    const sync: QueuedSync = {
      id: `sync-${this.nextSyncId++}`,
      sourcePath,
      destPath,
      sourceInstance,
      destInstance,
      queuedAt: Date.now(),
      executeAt,
      isPartial,
    };

    this.syncQueue.push(sync);

    // Only log sync-queued events occasionally to avoid bloating event log
    // (we still log sync-started and sync-completed for every file)
    if (Math.random() < 0.1) {
      await this.config.eventLog.record({
        instanceId: 'sync-daemon',
        type: 'sync-queued',
        filePath: sourcePath,
        metadata: {
          syncId: sync.id,
          sourceInstance,
          destInstance,
          delayMs: delay,
          isPartial,
        },
      });
    }
  }

  /**
   * Process queued syncs
   */
  private async processQueue(): Promise<void> {
    const now = Date.now();
    const ready = this.syncQueue.filter((s) => s.executeAt <= now);

    if (ready.length === 0) return;

    // Apply out-of-order shuffling if enabled
    if (this.config.enableOutOfOrder && ready.length > 1) {
      // Fisher-Yates shuffle
      for (let i = ready.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ready[i], ready[j]] = [ready[j], ready[i]];
      }
    }

    // Apply batching if enabled
    if (this.config.enableBatching) {
      // Group syncs that were queued within the batch window
      const batches: QueuedSync[][] = [];
      let currentBatch: QueuedSync[] = [];

      for (const sync of ready) {
        if (currentBatch.length === 0) {
          currentBatch.push(sync);
        } else {
          const lastSync = currentBatch[currentBatch.length - 1];
          if (sync.queuedAt - lastSync.queuedAt <= this.config.batchWindowMs) {
            currentBatch.push(sync);
          } else {
            batches.push(currentBatch);
            currentBatch = [sync];
          }
        }
      }
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      // Process batches
      for (const batch of batches) {
        await Promise.all(batch.map((sync) => this.executeSync(sync)));
      }
    } else {
      // Process individually
      for (const sync of ready) {
        await this.executeSync(sync);
      }
    }

    // Remove processed syncs
    this.syncQueue = this.syncQueue.filter((s) => s.executeAt > now);
  }

  /**
   * Execute a single sync
   */
  private async executeSync(sync: QueuedSync): Promise<void> {
    try {
      // Ensure destination directory exists
      await fs.mkdir(path.dirname(sync.destPath), { recursive: true });

      // Check if source still exists
      try {
        await fs.access(sync.sourcePath);
      } catch {
        // Source deleted, skip
        return;
      }

      await this.config.eventLog.record({
        instanceId: 'sync-daemon',
        type: 'sync-started',
        filePath: sync.sourcePath,
        metadata: {
          syncId: sync.id,
          destPath: sync.destPath,
          isPartial: sync.isPartial,
        },
      });

      if (sync.isPartial) {
        // Partial write: write part of the file, then complete later
        await this.executePartialSync(sync);
      } else {
        // Normal sync: copy entire file
        const content = await fs.readFile(sync.sourcePath);
        await fs.writeFile(sync.destPath, content);

        await this.config.eventLog.record({
          instanceId: 'sync-daemon',
          type: 'sync-completed',
          filePath: sync.sourcePath,
          fileSize: content.length,
          metadata: {
            syncId: sync.id,
            destPath: sync.destPath,
          },
        });
      }
    } catch (error) {
      console.error(`[Sync Daemon] Failed to sync ${sync.sourcePath}:`, error);
    }
  }

  /**
   * Execute a partial sync (write part of file, then complete later)
   *
   * Simulates sloppy file sync where:
   * 1. File appears with partial data (30-70% of content) and 0x00 flag
   * 2. Some time later (100-600ms), file is completed with full data and 0x01 flag
   *
   * Source files already have flag byte structure: 0x01 [data]
   * We need to handle .yjson files specially to maintain flag byte protocol
   */
  private async executePartialSync(sync: QueuedSync): Promise<void> {
    const content = await fs.readFile(sync.sourcePath);

    // Check if this is a .yjson file (has flag byte)
    const isYjson = sync.sourcePath.endsWith('.yjson');

    if (isYjson && content.length > 1) {
      // Source file has flag byte: 0x01 [actual data]
      // Strip the flag byte to get actual data
      const actualData = content.subarray(1);

      // Write 30-70% of the actual data (not including flag byte)
      const partialRatio = 0.3 + Math.random() * 0.4;
      const partialSize = Math.floor(actualData.length * partialRatio);
      const partialData = actualData.subarray(0, partialSize);

      // Write with 0x00 flag (not ready) + partial data
      const partialContent = Buffer.concat([Buffer.from([0x00]), partialData]);
      await fs.writeFile(sync.destPath, partialContent);

      await this.config.eventLog.record({
        instanceId: 'sync-daemon',
        type: 'partial-write-started',
        filePath: sync.sourcePath,
        fileSize: partialContent.length,
        metadata: {
          syncId: sync.id,
          totalSize: content.length,
          partialSize: partialContent.length,
        },
      });

      // Wait a bit before completing
      const completeDelay = 100 + Math.random() * 500; // 100-600ms
      await new Promise((resolve) => setTimeout(resolve, completeDelay));

      // Complete the write - full content as-is (already has 0x01 flag)
      await fs.writeFile(sync.destPath, content);
    } else {
      // Non-.yjson file, just do partial copy of raw bytes
      const partialRatio = 0.3 + Math.random() * 0.4;
      const partialSize = Math.floor(content.length * partialRatio);
      const partialContent = content.subarray(0, partialSize);

      await fs.writeFile(sync.destPath, partialContent);

      await this.config.eventLog.record({
        instanceId: 'sync-daemon',
        type: 'partial-write-started',
        filePath: sync.sourcePath,
        fileSize: partialSize,
        metadata: {
          syncId: sync.id,
          totalSize: content.length,
          partialSize,
        },
      });

      const completeDelay = 100 + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, completeDelay));

      await fs.writeFile(sync.destPath, content);
    }

    await this.config.eventLog.record({
      instanceId: 'sync-daemon',
      type: 'partial-write-completed',
      filePath: sync.sourcePath,
      fileSize: content.length,
      metadata: {
        syncId: sync.id,
        delayMs: 0, // Delay already happened above
      },
    });

    await this.config.eventLog.record({
      instanceId: 'sync-daemon',
      type: 'sync-completed',
      filePath: sync.sourcePath,
      fileSize: content.length,
      metadata: {
        syncId: sync.id,
        destPath: sync.destPath,
        wasPartial: true,
      },
    });
  }

  /**
   * Get number of pending syncs
   */
  getPendingCount(): number {
    return this.syncQueue.length;
  }

  /**
   * Get pending syncs (for debugging)
   */
  getPendingSyncs(): QueuedSync[] {
    return [...this.syncQueue];
  }

  /**
   * Wait for all pending syncs to complete
   */
  async waitForPendingSyncs(maxWaitMs = 60000): Promise<boolean> {
    const startTime = Date.now();

    while (this.syncQueue.length > 0) {
      if (Date.now() - startTime > maxWaitMs) {
        console.warn(
          `[Sync Daemon] Timeout waiting for pending syncs (${this.syncQueue.length} remaining)`
        );
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return true;
  }
}
