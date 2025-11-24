/**
 * Sloppy Sync Fuzz Test
 *
 * Tests CRDT log sync under adverse conditions that simulate cloud sync services:
 * - Files sync at different times/rates (sloppy inter-file sync)
 * - Individual file changes arrive in order (ordered intra-file sync)
 * - Files may be partially synced (truncated)
 *
 * Usage:
 *   npx tsx packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts
 *   npx tsx packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts --scenario partial-file
 *   npx tsx packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts --scenario delayed-sync
 *   npx tsx packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts --duration 120
 */

import * as path from 'path';
import { LogWriter } from '../storage/log-writer.js';
import { LogReader } from '../storage/log-reader.js';
import { LogSync } from '../storage/log-sync.js';
import { NoteStorageManager } from '../storage/note-storage-manager.js';
import type { FileSystemAdapter, FileStats } from '../storage/types.js';
import type { NoteSyncState } from '../database/schema.js';

// =============================================================================
// Test Infrastructure
// =============================================================================

/**
 * In-memory file system that simulates sloppy sync behavior
 */
class SloppySyncFileSystem implements FileSystemAdapter {
  private files = new Map<string, Uint8Array>();
  private visibleFiles = new Set<string>(); // Files visible to readers
  private pendingVisibility: Array<{ path: string; visibleAt: number }> = [];

  // Configuration
  private syncDelayRange: [number, number] = [100, 2000]; // ms delay before file becomes visible
  private partialSyncProbability = 0.0; // probability of partial file sync
  private partialSyncRatio: [number, number] = [0.3, 0.9]; // how much of file to show

  constructor(config?: {
    syncDelayRange?: [number, number];
    partialSyncProbability?: number;
    partialSyncRatio?: [number, number];
  }) {
    if (config?.syncDelayRange) this.syncDelayRange = config.syncDelayRange;
    if (config?.partialSyncProbability !== undefined)
      this.partialSyncProbability = config.partialSyncProbability;
    if (config?.partialSyncRatio) this.partialSyncRatio = config.partialSyncRatio;
  }

  /**
   * Process any files that should now be visible
   */
  tick(): void {
    const now = Date.now();
    const stillPending: typeof this.pendingVisibility = [];

    for (const item of this.pendingVisibility) {
      if (now >= item.visibleAt) {
        this.visibleFiles.add(item.path);
      } else {
        stillPending.push(item);
      }
    }

    this.pendingVisibility = stillPending;
  }

  /**
   * Make all files immediately visible (for final convergence check)
   */
  makeAllVisible(): void {
    for (const [filePath] of this.files) {
      this.visibleFiles.add(filePath);
    }
    this.pendingVisibility = [];
  }

  /**
   * Get stats about current state
   */
  getStats(): { totalFiles: number; visibleFiles: number; pendingFiles: number } {
    return {
      totalFiles: this.files.size,
      visibleFiles: this.visibleFiles.size,
      pendingFiles: this.pendingVisibility.length,
    };
  }

  // FileSystemAdapter implementation

  exists(filePath: string): Promise<boolean> {
    this.tick();
    return Promise.resolve(this.visibleFiles.has(filePath));
  }

  async mkdir(_dirPath: string): Promise<void> {
    // No-op for in-memory FS
  }

  readFile(filePath: string): Promise<Uint8Array> {
    this.tick();

    if (!this.visibleFiles.has(filePath)) {
      const error = new Error(`ENOENT: no such file: ${filePath}`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      return Promise.reject(error);
    }

    const data = this.files.get(filePath);
    if (!data) {
      const error = new Error(`ENOENT: no such file: ${filePath}`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      return Promise.reject(error);
    }

    // Simulate partial sync
    if (Math.random() < this.partialSyncProbability) {
      const ratio =
        this.partialSyncRatio[0] +
        Math.random() * (this.partialSyncRatio[1] - this.partialSyncRatio[0]);
      const visibleBytes = Math.floor(data.length * ratio);
      return Promise.resolve(data.slice(0, visibleBytes));
    }

    return Promise.resolve(data);
  }

  writeFile(filePath: string, data: Uint8Array): Promise<void> {
    this.files.set(filePath, new Uint8Array(data));
    this.scheduleVisibility(filePath);
    return Promise.resolve();
  }

  appendFile(filePath: string, data: Uint8Array): Promise<void> {
    const existing = this.files.get(filePath) ?? new Uint8Array(0);
    const combined = new Uint8Array(existing.length + data.length);
    combined.set(existing, 0);
    combined.set(data, existing.length);
    this.files.set(filePath, combined);

    // File already visible? Keep it visible (but with new content)
    // File not visible yet? Schedule visibility
    if (!this.visibleFiles.has(filePath)) {
      this.scheduleVisibility(filePath);
    }
    return Promise.resolve();
  }

  deleteFile(filePath: string): Promise<void> {
    this.files.delete(filePath);
    this.visibleFiles.delete(filePath);
    return Promise.resolve();
  }

  listFiles(dirPath: string): Promise<string[]> {
    this.tick();

    const results: string[] = [];
    const dirWithSlash = dirPath.endsWith('/') ? dirPath : dirPath + '/';

    for (const filePath of this.visibleFiles) {
      if (filePath.startsWith(dirWithSlash)) {
        const relativePath = filePath.substring(dirWithSlash.length);
        // Only include direct children (no nested paths)
        if (!relativePath.includes('/')) {
          results.push(relativePath);
        }
      }
    }

    return Promise.resolve(results);
  }

  joinPath(...segments: string[]): string {
    return segments.join('/');
  }

  basename(filePath: string): string {
    return path.basename(filePath);
  }

  stat(filePath: string): Promise<FileStats> {
    this.tick();

    if (!this.visibleFiles.has(filePath)) {
      const error = new Error(`ENOENT: no such file: ${filePath}`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      return Promise.reject(error);
    }

    const data = this.files.get(filePath);
    return Promise.resolve({
      size: data?.length ?? 0,
      mtimeMs: Date.now(),
      ctimeMs: Date.now(),
    });
  }

  private scheduleVisibility(filePath: string): void {
    const delay =
      this.syncDelayRange[0] + Math.random() * (this.syncDelayRange[1] - this.syncDelayRange[0]);
    this.pendingVisibility.push({
      path: filePath,
      visibleAt: Date.now() + delay,
    });
  }
}

// =============================================================================
// Test Scenarios
// =============================================================================

interface TestResult {
  passed: boolean;
  scenario: string;
  details: string;
  errors: string[];
  stats: {
    recordsWritten: number;
    recordsRead: number;
    syncCycles: number;
  };
}

/**
 * Scenario: Basic sloppy sync
 * Two instances write records, sync is delayed and out of order
 */
async function scenarioBasicSloppySync(duration: number): Promise<TestResult> {
  const errors: string[] = [];
  const logsDir = '/test/notes/note-1/logs';

  // Create sloppy FS with moderate delays
  const sloppyFs = new SloppySyncFileSystem({
    syncDelayRange: [200, 1000],
    partialSyncProbability: 0.0, // No partial files in basic test
  });

  // Create two writers (simulating two app instances)
  const writer1 = new LogWriter(logsDir, 'instance-1', sloppyFs);
  const writer2 = new LogWriter(logsDir, 'instance-2', sloppyFs);

  // Create sync readers
  const sync1 = new LogSync(sloppyFs, 'instance-1', {
    applyUpdate: async () => {},
    reloadNote: async () => {},
    getLoadedNotes: () => [],
  });
  const sync2 = new LogSync(sloppyFs, 'instance-2', {
    applyUpdate: async () => {},
    reloadNote: async () => {},
    getLoadedNotes: () => [],
  });

  let recordsWritten = 0;
  let totalRecordsRead = 0;
  let syncCycles = 0;

  const startTime = Date.now();
  const endTime = startTime + duration * 1000;

  // Run test loop
  while (Date.now() < endTime) {
    // Instance 1 writes a record
    const data1 = new TextEncoder().encode(`Record from instance-1 at ${Date.now()}`);
    await writer1.appendRecord(Date.now(), recordsWritten + 1, data1);
    recordsWritten++;

    // Small delay
    await sleep(50);

    // Instance 2 writes a record
    const data2 = new TextEncoder().encode(`Record from instance-2 at ${Date.now()}`);
    await writer2.appendRecord(Date.now(), recordsWritten + 1, data2);
    recordsWritten++;

    // Both instances try to sync
    const result1 = await sync1.syncFromLogs(logsDir);
    const result2 = await sync2.syncFromLogs(logsDir);
    totalRecordsRead += result1.newRecordCount + result2.newRecordCount;
    syncCycles++;

    await sleep(100);
  }

  // Wait for all files to become visible
  sloppyFs.makeAllVisible();
  await sleep(100);

  // Final sync
  const finalResult1 = await sync1.syncFromLogs(logsDir);
  const finalResult2 = await sync2.syncFromLogs(logsDir);
  totalRecordsRead += finalResult1.newRecordCount + finalResult2.newRecordCount;

  // Verify convergence: both instances should see all records from the other
  // (Each sync reads from the OTHER instance, so total should equal records written)
  const fsStats = sloppyFs.getStats();

  // Read all records directly to verify
  const allFiles = await LogReader.listLogFiles(logsDir, sloppyFs);
  let totalRecordsInFiles = 0;
  for (const file of allFiles) {
    const records = await LogReader.readAllRecords(file.path, sloppyFs);
    totalRecordsInFiles += records.length;
  }

  if (totalRecordsInFiles !== recordsWritten) {
    errors.push(
      `Record count mismatch: wrote ${recordsWritten}, found ${totalRecordsInFiles} in files`
    );
  }

  return {
    passed: errors.length === 0,
    scenario: 'basic-sloppy-sync',
    details: `Wrote ${recordsWritten} records across 2 instances, ${syncCycles} sync cycles, ${fsStats.totalFiles} log files`,
    errors,
    stats: {
      recordsWritten,
      recordsRead: totalRecordsRead,
      syncCycles,
    },
  };
}

/**
 * Scenario: Partial file sync
 * Files may arrive partially (simulating cloud sync in progress)
 */
async function scenarioPartialFileSync(duration: number): Promise<TestResult> {
  const errors: string[] = [];
  const logsDir = '/test/notes/note-1/logs';

  // Create sloppy FS with partial file probability
  const sloppyFs = new SloppySyncFileSystem({
    syncDelayRange: [100, 500],
    partialSyncProbability: 0.3, // 30% chance of partial file
    partialSyncRatio: [0.5, 0.9], // Show 50-90% of file
  });

  const writer = new LogWriter(logsDir, 'instance-1', sloppyFs);
  const sync = new LogSync(sloppyFs, 'instance-2', {
    applyUpdate: async () => {},
    reloadNote: async () => {},
    getLoadedNotes: () => [],
  });

  let recordsWritten = 0;
  let syncErrors = 0;
  let successfulSyncs = 0;

  const startTime = Date.now();
  const endTime = startTime + duration * 1000;

  while (Date.now() < endTime) {
    // Write some records
    for (let i = 0; i < 5; i++) {
      const data = new TextEncoder().encode(`Record ${recordsWritten} at ${Date.now()}`);
      await writer.appendRecord(Date.now(), recordsWritten + 1, data);
      recordsWritten++;
    }

    // Try to sync (may encounter partial files)
    try {
      await sync.syncFromLogs(logsDir);
      successfulSyncs++;
    } catch (error) {
      syncErrors++;
      // This is expected with partial files - should be handled gracefully
      const msg = (error as Error).message;
      if (!msg.includes('Truncated') && !msg.includes('Incomplete')) {
        errors.push(`Unexpected error during sync: ${msg}`);
      }
    }

    await sleep(100);
  }

  // Make all files fully visible
  sloppyFs.makeAllVisible();

  // Final sync should succeed
  try {
    await sync.syncFromLogs(logsDir);
  } catch (error) {
    errors.push(`Final sync failed: ${(error as Error).message}`);
  }

  return {
    passed: errors.length === 0,
    scenario: 'partial-file-sync',
    details: `Wrote ${recordsWritten} records, ${successfulSyncs} successful syncs, ${syncErrors} sync errors (expected with partial files)`,
    errors,
    stats: {
      recordsWritten,
      recordsRead: successfulSyncs,
      syncCycles: successfulSyncs + syncErrors,
    },
  };
}

/**
 * Scenario: Rapid edits to same note
 * Stress test with rapid writes to see if all changes sync correctly
 */
async function scenarioRapidEdits(duration: number): Promise<TestResult> {
  const errors: string[] = [];
  const logsDir = '/test/notes/note-1/logs';

  const sloppyFs = new SloppySyncFileSystem({
    syncDelayRange: [50, 300], // Faster sync for rapid test
    partialSyncProbability: 0.1,
  });

  const writer1 = new LogWriter(logsDir, 'instance-1', sloppyFs);
  const writer2 = new LogWriter(logsDir, 'instance-2', sloppyFs);

  let recordsWritten = 0;
  let instance1Records = 0;
  let instance2Records = 0;

  const startTime = Date.now();
  const endTime = startTime + duration * 1000;

  // Rapid alternating writes
  while (Date.now() < endTime) {
    // Instance 1: rapid burst
    for (let i = 0; i < 3; i++) {
      const data = new TextEncoder().encode(`I1-${instance1Records}`);
      await writer1.appendRecord(Date.now(), ++instance1Records, data);
      recordsWritten++;
    }

    await sleep(20);

    // Instance 2: rapid burst
    for (let i = 0; i < 3; i++) {
      const data = new TextEncoder().encode(`I2-${instance2Records}`);
      await writer2.appendRecord(Date.now(), ++instance2Records, data);
      recordsWritten++;
    }

    await sleep(20);
  }

  // Wait and verify
  sloppyFs.makeAllVisible();
  await sleep(100);

  const allFiles = await LogReader.listLogFiles(logsDir, sloppyFs);
  let totalRecordsInFiles = 0;
  let instance1Count = 0;
  let instance2Count = 0;

  for (const file of allFiles) {
    try {
      const records = await LogReader.readAllRecords(file.path, sloppyFs);
      totalRecordsInFiles += records.length;

      if (file.instanceId === 'instance-1') {
        instance1Count += records.length;
      } else if (file.instanceId === 'instance-2') {
        instance2Count += records.length;
      }
    } catch (error) {
      errors.push(`Failed to read ${file.filename}: ${(error as Error).message}`);
    }
  }

  if (totalRecordsInFiles !== recordsWritten) {
    errors.push(
      `Record count mismatch: wrote ${recordsWritten}, found ${totalRecordsInFiles} in files`
    );
  }

  if (instance1Count !== instance1Records) {
    errors.push(`Instance 1 record mismatch: wrote ${instance1Records}, found ${instance1Count}`);
  }

  if (instance2Count !== instance2Records) {
    errors.push(`Instance 2 record mismatch: wrote ${instance2Records}, found ${instance2Count}`);
  }

  return {
    passed: errors.length === 0,
    scenario: 'rapid-edits',
    details: `Wrote ${recordsWritten} records (I1: ${instance1Records}, I2: ${instance2Records}), found ${totalRecordsInFiles} in files`,
    errors,
    stats: {
      recordsWritten,
      recordsRead: totalRecordsInFiles,
      syncCycles: 0,
    },
  };
}

/**
 * Scenario: Note loading with partial files
 * Tests that NoteStorageManager.loadNote handles truncated files gracefully
 */
async function scenarioNoteLoadPartialFiles(_duration: number): Promise<TestResult> {
  const errors: string[] = [];
  const logsDir = '/test/notes/note-1/logs';
  const snapshotsDir = '/test/notes/note-1/snapshots';

  // Create sloppy FS with high partial probability
  const sloppyFs = new SloppySyncFileSystem({
    syncDelayRange: [0, 50], // Fast visibility
    partialSyncProbability: 0.5, // 50% chance of partial
    partialSyncRatio: [0.3, 0.8],
  });

  // Mock database
  const mockDb = {
    getNoteSyncState(): Promise<NoteSyncState | null> {
      return Promise.resolve(null); // No cache, always load from files
    },
    async upsertNoteSyncState(): Promise<void> {
      // No-op
    },
  };

  // Write some records first (with no partial sync)
  const writer = new LogWriter(logsDir, 'instance-1', sloppyFs);
  const recordsWritten = 20;

  for (let i = 1; i <= recordsWritten; i++) {
    const data = new TextEncoder().encode(`Record ${i} content`);
    await writer.appendRecord(Date.now(), i, data);
    await sleep(10);
  }

  // Make files visible (with partial sync enabled)
  sloppyFs.makeAllVisible();

  // Create NoteStorageManager and try to load the note
  const manager = new NoteStorageManager(sloppyFs, mockDb, 'instance-2');
  let loadAttempts = 0;
  let successfulLoads = 0;
  const partialLoads = 0;

  // Try loading multiple times (partial probability varies)
  for (let i = 0; i < 10; i++) {
    loadAttempts++;
    try {
      const result = await manager.loadNote('sd-1', 'note-1', {
        logs: logsDir,
        snapshots: snapshotsDir,
      });

      // Check how many records we got
      // The document might have fewer records due to partial sync
      successfulLoads++;

      // We can't easily check record count without parsing the doc,
      // but if we got here without error, the load was graceful
      if (result.doc) {
        result.doc.destroy();
      }
    } catch (error) {
      // This should NOT happen with our fix
      errors.push(`Load attempt ${i + 1} failed: ${(error as Error).message}`);
    }
  }

  return {
    passed: errors.length === 0,
    scenario: 'note-load-partial-files',
    details: `${loadAttempts} load attempts, ${successfulLoads} successful, ${partialLoads} partial (all should succeed)`,
    errors,
    stats: {
      recordsWritten,
      recordsRead: successfulLoads,
      syncCycles: loadAttempts,
    },
  };
}

// =============================================================================
// Main
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let scenario = 'all';
  let duration = 30; // seconds

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && args[i + 1]) {
      scenario = args[i + 1];
    }
    if (args[i] === '--duration' && args[i + 1]) {
      duration = parseInt(args[i + 1], 10);
    }
  }

  console.log('='.repeat(80));
  console.log('Sloppy Sync Fuzz Test');
  console.log('='.repeat(80));
  console.log(`Duration: ${duration}s per scenario`);
  console.log('');

  const scenarios: Record<string, (duration: number) => Promise<TestResult>> = {
    'basic-sloppy-sync': scenarioBasicSloppySync,
    'partial-file-sync': scenarioPartialFileSync,
    'rapid-edits': scenarioRapidEdits,
    'note-load-partial-files': scenarioNoteLoadPartialFiles,
  };

  const results: TestResult[] = [];
  const scenariosToRun = scenario === 'all' ? Object.keys(scenarios) : [scenario];

  for (const name of scenariosToRun) {
    const scenarioFn = scenarios[name];
    if (!scenarioFn) {
      console.error(`Unknown scenario: ${name}`);
      console.error(`Available: ${Object.keys(scenarios).join(', ')}`);
      process.exit(1);
    }

    console.log(`\nRunning: ${name}`);
    console.log('-'.repeat(40));

    try {
      const result = await scenarioFn(duration);
      results.push(result);

      if (result.passed) {
        console.log(`PASSED`);
      } else {
        console.log(`FAILED`);
      }
      console.log(`Details: ${result.details}`);

      if (result.errors.length > 0) {
        console.log('Errors:');
        for (const error of result.errors) {
          console.log(`  - ${error}`);
        }
      }
    } catch (error) {
      console.error(`Scenario crashed: ${(error as Error).message}`);
      console.error((error as Error).stack);
      results.push({
        passed: false,
        scenario: name,
        details: 'Crashed',
        errors: [(error as Error).message],
        stats: { recordsWritten: 0, recordsRead: 0, syncCycles: 0 },
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\nFailed scenarios:');
    for (const result of results) {
      if (!result.passed) {
        console.log(`  - ${result.scenario}: ${result.errors.join(', ')}`);
      }
    }
    process.exit(1);
  }

  console.log('\nAll scenarios passed!');
}

main().catch((error) => {
  console.error('Fuzz test crashed:', error);
  process.exit(1);
});
