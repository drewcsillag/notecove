/**
 * Sync Fuzz Test - Main test runner
 *
 * Usage:
 *   NODE_ENV=test node packages/shared/dist/esm/__manual__/sync-fuzz-test.js --scenario rapid-same-note --duration 60
 *   NODE_ENV=test node packages/shared/dist/esm/__manual__/sync-fuzz-test.js --scenario chaos --duration 300
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventLog } from './event-log.js';
import { SyncDaemon } from './sync-daemon.js';
import { TestInstance } from './test-instance.js';
import { validateConvergence, generateMarkdownReport } from './validation.js';
import { generateASCIITimeline, generateHTMLTimeline } from './timeline-visualizer.js';

export interface TestScenarioConfig {
  name: string;
  duration: number; // seconds
  description: string;

  // Sync daemon config
  syncDelayRange: [number, number];
  syncDirection: 'bidirectional' | 'instance1-to-instance2' | 'instance2-to-instance1';
  enableOutOfOrder: boolean;
  enableBatching: boolean;
  batchWindowMs: number;
  partialWriteProbability: number;

  // Instance operations
  instance1Operations: Operation[];
  instance2Operations: Operation[];

  // GC and snapshot config
  gcIntervalSeconds?: number;
  snapshotIntervalSeconds?: number;
}

export interface Operation {
  type: 'create' | 'edit' | 'delete';
  noteId?: string; // Specific note ID, or undefined for random
  delayMs: number; // Delay before next operation
  repeat?: number; // How many times to repeat
  textLength?: number; // For edits, how much text to add
}

/**
 * Built-in test scenarios
 */
export const scenarios: Record<string, TestScenarioConfig> = {
  'rapid-same-note': {
    name: 'Rapid edits to same note',
    duration: 60,
    description: 'Both instances rapidly edit the same note to stress-test CRDT merging',
    syncDelayRange: [500, 2000],
    syncDirection: 'bidirectional',
    enableOutOfOrder: true,
    enableBatching: true,
    batchWindowMs: 500,
    partialWriteProbability: 0.2,
    instance1Operations: [
      { type: 'create', noteId: 'shared-note-1', delayMs: 0 },
      { type: 'edit', noteId: 'shared-note-1', delayMs: 100, repeat: 50, textLength: 50 },
    ],
    instance2Operations: [
      { type: 'edit', noteId: 'shared-note-1', delayMs: 150, repeat: 50, textLength: 50 },
    ],
  },

  'many-notes': {
    name: 'Many different notes',
    duration: 120,
    description: 'Each instance creates and edits many different notes',
    syncDelayRange: [1000, 3000],
    syncDirection: 'bidirectional',
    enableOutOfOrder: true,
    enableBatching: true,
    batchWindowMs: 500,
    partialWriteProbability: 0.3,
    instance1Operations: [
      { type: 'create', delayMs: 200, repeat: 20 },
      { type: 'edit', delayMs: 300, repeat: 40, textLength: 100 },
    ],
    instance2Operations: [
      { type: 'create', delayMs: 250, repeat: 20 },
      { type: 'edit', delayMs: 350, repeat: 40, textLength: 100 },
    ],
    gcIntervalSeconds: 30,
  },

  'half-duplex-test': {
    name: 'Half-duplex sync (instance1 -> instance2 only)',
    duration: 90,
    description: 'Tests one-way sync to verify instance2 receives all changes from instance1',
    syncDelayRange: [500, 2000],
    syncDirection: 'instance1-to-instance2',
    enableOutOfOrder: true,
    enableBatching: false,
    batchWindowMs: 0,
    partialWriteProbability: 0.25,
    instance1Operations: [
      { type: 'create', delayMs: 200, repeat: 15 },
      { type: 'edit', delayMs: 400, repeat: 30, textLength: 75 },
    ],
    instance2Operations: [
      // Instance 2 doesn't write, only receives
    ],
  },

  chaos: {
    name: 'Chaos test',
    duration: 300,
    description: 'Maximum sloppiness with creates, edits, and deletes on both instances',
    syncDelayRange: [100, 5000],
    syncDirection: 'bidirectional',
    enableOutOfOrder: true,
    enableBatching: true,
    batchWindowMs: 500,
    partialWriteProbability: 0.4,
    instance1Operations: [
      { type: 'create', delayMs: 300, repeat: 30 },
      { type: 'edit', delayMs: 200, repeat: 100, textLength: 150 },
      { type: 'delete', delayMs: 1000, repeat: 10 },
    ],
    instance2Operations: [
      { type: 'create', delayMs: 350, repeat: 30 },
      { type: 'edit', delayMs: 250, repeat: 100, textLength: 150 },
      { type: 'delete', delayMs: 1200, repeat: 10 },
    ],
    gcIntervalSeconds: 60,
    snapshotIntervalSeconds: 90,
  },

  'quick-smoke': {
    name: 'Quick smoke test',
    duration: 30,
    description: 'Quick sanity check that basic sync works',
    syncDelayRange: [500, 1500],
    syncDirection: 'bidirectional',
    enableOutOfOrder: true,
    enableBatching: false,
    batchWindowMs: 0,
    partialWriteProbability: 0.1,
    instance1Operations: [
      { type: 'create', delayMs: 100, repeat: 5 },
      { type: 'edit', delayMs: 200, repeat: 10, textLength: 50 },
    ],
    instance2Operations: [
      { type: 'create', delayMs: 150, repeat: 5 },
      { type: 'edit', delayMs: 250, repeat: 10, textLength: 50 },
    ],
  },
};

/**
 * Run a fuzz test
 */
export async function runFuzzTest(scenario: TestScenarioConfig, outputDir: string): Promise<void> {
  console.log('═'.repeat(80));
  console.log(`🧪 Sync Fuzz Test: ${scenario.name}`);
  console.log(`📝 ${scenario.description}`);
  console.log(`⏱️  Duration: ${scenario.duration}s`);
  console.log('═'.repeat(80));
  console.log('');

  // Setup output directory
  await fs.mkdir(outputDir, { recursive: true });

  // Initialize event log
  const eventLog = new EventLog(path.join(outputDir, 'event-log.jsonl'));
  await eventLog.initialize();

  // Initialize instances
  const instance1Dir = path.join(outputDir, 'instance-1');
  const instance2Dir = path.join(outputDir, 'instance-2');

  const instance1 = new TestInstance({
    instanceId: 'instance-1',
    sdPath: instance1Dir,
    eventLog,
  });

  const instance2 = new TestInstance({
    instanceId: 'instance-2',
    sdPath: instance2Dir,
    eventLog,
  });

  await instance1.initialize();
  await instance2.initialize();

  // Initialize sync daemon
  const syncDaemon = new SyncDaemon({
    instance1Dir,
    instance2Dir,
    eventLog,
    delayRange: scenario.syncDelayRange,
    enableOutOfOrder: scenario.enableOutOfOrder,
    enableBatching: scenario.enableBatching,
    batchWindowMs: scenario.batchWindowMs,
    partialWriteProbability: scenario.partialWriteProbability,
    syncDirection: scenario.syncDirection,
  });

  await syncDaemon.start();

  // Start operation runners
  const startTime = Date.now();
  const endTime = startTime + scenario.duration * 1000;

  const runners: Promise<void>[] = [];

  // Instance 1 operations
  runners.push(runOperations(instance1, scenario.instance1Operations, endTime, 'instance-1'));

  // Instance 2 operations
  runners.push(runOperations(instance2, scenario.instance2Operations, endTime, 'instance-2'));

  // GC runner
  if (scenario.gcIntervalSeconds) {
    runners.push(runGC(instance1, instance2, scenario.gcIntervalSeconds, endTime));
  }

  // Snapshot runner
  if (scenario.snapshotIntervalSeconds) {
    runners.push(runSnapshots(instance1, instance2, scenario.snapshotIntervalSeconds, endTime));
  }

  // Sync runner (periodic sync from other instances)
  runners.push(runPeriodicSync(instance1, instance2, endTime));

  // Wait for all operations to complete
  await Promise.all(runners);

  console.log('');
  console.log('✅ Operations completed');
  console.log('⏳ Waiting for convergence...');

  // Wait for all pending syncs (longer timeout to handle partial writes)
  await syncDaemon.waitForPendingSyncs(180000); // 3 minutes

  // Wait additional settling time
  await sleep(30000);

  // Stop sync daemon
  await syncDaemon.stop();

  console.log('');
  console.log('🔍 Validating convergence...');

  // Validate
  const validationReport = await validateConvergence(instance1, instance2, eventLog);

  // Close event log
  await eventLog.close();

  // Save outputs
  await fs.writeFile(
    path.join(outputDir, 'validation-report.json'),
    JSON.stringify(validationReport, null, 2),
    'utf-8'
  );

  const markdownReport = generateMarkdownReport(validationReport);
  await fs.writeFile(path.join(outputDir, 'validation-report.md'), markdownReport, 'utf-8');

  // Generate timelines
  const asciiTimeline = generateASCIITimeline(eventLog, { maxEvents: 100 });
  await fs.writeFile(path.join(outputDir, 'timeline.txt'), asciiTimeline, 'utf-8');

  await generateHTMLTimeline(eventLog, path.join(outputDir, 'timeline.html'));

  // Cleanup
  await instance1.cleanup();
  await instance2.cleanup();

  // Print results
  console.log('');
  console.log('═'.repeat(80));
  if (validationReport.success) {
    console.log('✅ TEST PASSED - Instances converged successfully!');
  } else {
    console.log('❌ TEST FAILED - Divergence detected!');
    console.log('');
    console.log(`Reason: ${validationReport.reason}`);
    if (validationReport.divergences) {
      console.log(`Divergences: ${validationReport.divergences.length}`);
    }
  }
  console.log('═'.repeat(80));
  console.log('');
  console.log(`📊 Full report: ${outputDir}/validation-report.md`);
  console.log(`📈 HTML Timeline: ${outputDir}/timeline.html`);
  console.log('');

  if (!validationReport.success) {
    process.exit(1);
  }
}

/**
 * Run operations for an instance
 */
async function runOperations(
  instance: TestInstance,
  operations: Operation[],
  endTime: number,
  instanceName: string
): Promise<void> {
  const createdNotes: string[] = [];
  let opIndex = 0;

  for (const op of operations) {
    const repeat = op.repeat || 1;

    for (let i = 0; i < repeat; i++) {
      if (Date.now() >= endTime) break;

      try {
        if (op.type === 'create') {
          const title = `Note from ${instanceName} (${opIndex++})`;
          const noteId = await instance.createNote(title, `Initial content for ${title}`);

          if (op.noteId) {
            // If specific note ID requested, track it
            createdNotes.push(noteId);
          } else {
            createdNotes.push(noteId);
          }
        } else if (op.type === 'edit') {
          let targetNoteId = op.noteId;

          if (!targetNoteId && createdNotes.length > 0) {
            // Pick random note
            targetNoteId = createdNotes[Math.floor(Math.random() * createdNotes.length)]!;
          }

          if (targetNoteId) {
            const textLength = op.textLength || 50;
            const text = ` Edit-${opIndex++}-`
              .repeat(Math.ceil(textLength / 10))
              .substring(0, textLength);
            await instance.editNote(targetNoteId, text);
          }
        } else if (op.type === 'delete') {
          if (createdNotes.length > 0) {
            const targetNoteId = createdNotes.pop()!;
            await instance.deleteNote(targetNoteId);
          }
        }
      } catch (error) {
        console.error(`[${instanceName}] Operation ${op.type} failed:`, error);
      }

      await sleep(op.delayMs);
    }

    if (Date.now() >= endTime) break;
  }
}

/**
 * Run periodic GC
 */
async function runGC(
  instance1: TestInstance,
  instance2: TestInstance,
  intervalSeconds: number,
  endTime: number
): Promise<void> {
  while (Date.now() < endTime) {
    await sleep(intervalSeconds * 1000);

    if (Date.now() >= endTime) break;

    try {
      await instance1.triggerGarbageCollection();
      await instance2.triggerGarbageCollection();
    } catch (error) {
      console.error('[GC] Failed:', error);
    }
  }
}

/**
 * Run periodic snapshots
 */
async function runSnapshots(
  instance1: TestInstance,
  instance2: TestInstance,
  intervalSeconds: number,
  endTime: number
): Promise<void> {
  while (Date.now() < endTime) {
    await sleep(intervalSeconds * 1000);

    if (Date.now() >= endTime) break;

    try {
      const notes1 = await instance1.getAllNotes();
      const notes2 = await instance2.getAllNotes();

      if (notes1.length > 0) {
        const randomNote = notes1[Math.floor(Math.random() * notes1.length)];
        await instance1.triggerSnapshot(randomNote.id);
      }

      if (notes2.length > 0) {
        const randomNote = notes2[Math.floor(Math.random() * notes2.length)];
        await instance2.triggerSnapshot(randomNote.id);
      }
    } catch (error) {
      console.error('[Snapshots] Failed:', error);
    }
  }
}

/**
 * Run periodic sync from other instances
 */
async function runPeriodicSync(
  instance1: TestInstance,
  instance2: TestInstance,
  endTime: number
): Promise<void> {
  while (Date.now() < endTime) {
    await sleep(1000); // Sync every second

    if (Date.now() >= endTime) break;

    try {
      await instance1.syncFromOthers();
      await instance2.syncFromOthers();
    } catch (error) {
      console.error('[Sync] Failed:', error);
    }
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let scenarioName = 'quick-smoke';
  let duration: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && args[i + 1]) {
      scenarioName = args[i + 1]!;
    }
    if (args[i] === '--duration' && args[i + 1]) {
      duration = parseInt(args[i + 1]);
    }
  }

  const scenario = scenarios[scenarioName];
  if (!scenario) {
    console.error(`❌ Unknown scenario: ${scenarioName}`);
    console.error(`Available scenarios: ${Object.keys(scenarios).join(', ')}`);
    process.exit(1);
  }

  // Override duration if specified
  if (duration) {
    scenario.duration = duration;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = `/tmp/fuzz-test-${scenarioName}-${timestamp}`;

  await runFuzzTest(scenario, outputDir);
}

// Run if called directly
if (require.main === module) {
  void main();
}
