/**
 * Cross-SD Move Fuzz Test
 *
 * Tests cross-SD move operations under various adverse conditions:
 * - Concurrent moves from multiple instances
 * - Interrupted moves (crash at each state)
 * - Missing SD access during recovery
 * - Eventual consistency verification
 *
 * Usage:
 *   NODE_ENV=test tsx packages/desktop/src/__manual__/cross-sd-move-fuzz-test.ts --scenario concurrent-moves --duration 60
 *   NODE_ENV=test tsx packages/desktop/src/__manual__/cross-sd-move-fuzz-test.ts --scenario interrupted-moves
 */

import { rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { NoteMoveManager } from '../main/note-move-manager';
import { SqliteDatabase } from '../main/database/database';
import { BetterSqliteAdapter } from '../main/database/adapter';
import type { Database, NoteMoveState } from '@notecove/shared';

interface TestScenario {
  name: string;
  description: string;
  run: (context: TestContext) => Promise<TestResult>;
}

interface TestContext {
  testDir: string;
  sd1Path: string;
  sd2Path: string;
  sd3Path: string;
  sd1Uuid: string;
  sd2Uuid: string;
  sd3Uuid: string;
}

interface TestResult {
  passed: boolean;
  details: string;
  errors: string[];
  warnings: string[];
}

/**
 * Create a test database with multiple SDs
 */
async function createTestDatabase(
  testDir: string,
  context: TestContext
): Promise<{ database: Database; sd1Id: string; sd2Id: string; sd3Id: string }> {
  const dbPath = join(testDir, 'test.db');
  const adapter = new BetterSqliteAdapter(dbPath);
  const database = new SqliteDatabase(adapter);
  await database.initialize();

  // Create SDs manually
  const sd1Id = randomUUID();
  const sd2Id = randomUUID();
  const sd3Id = randomUUID();

  await database.getAdapter().exec(
    `INSERT INTO storage_dirs (id, name, path, uuid, created, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sd1Id, 'SD1', context.sd1Path, context.sd1Uuid, Date.now(), 1]
  );

  await database.getAdapter().exec(
    `INSERT INTO storage_dirs (id, name, path, uuid, created, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sd2Id, 'SD2', context.sd2Path, context.sd2Uuid, Date.now(), 0]
  );

  await database.getAdapter().exec(
    `INSERT INTO storage_dirs (id, name, path, uuid, created, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sd3Id, 'SD3', context.sd3Path, context.sd3Uuid, Date.now(), 0]
  );

  return { database, sd1Id, sd2Id, sd3Id };
}

/**
 * Create a test note with CRDT files
 */
async function createTestNote(
  database: Database,
  sdId: string,
  sdPath: string,
  noteId: string,
  title: string
): Promise<void> {
  // Create note directory and files
  const notePath = join(sdPath, 'notes', noteId);
  await mkdir(notePath, { recursive: true });
  await writeFile(join(notePath, 'state.bin'), `CRDT data for ${title}`);
  await writeFile(join(notePath, 'meta.json'), JSON.stringify({ version: 1 }));

  // Add to database
  await database.upsertNote({
    id: noteId,
    title,
    sdId,
    folderId: null,
    created: Date.now(),
    modified: Date.now(),
    deleted: false,
    pinned: false,
    contentPreview: title,
    contentText: title,
  });
}

/**
 * Scenario 1: Concurrent moves from multiple instances
 *
 * Tests what happens when two instances try to move notes simultaneously
 */
async function scenarioConcurrentMoves(context: TestContext): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let details = '';

  const testDir = join(context.testDir, 'concurrent');
  await mkdir(testDir, { recursive: true });

  const { database, sd1Id, sd2Id, sd3Id } = await createTestDatabase(testDir, context);

  try {
    // Create 10 test notes in SD1
    const noteIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const noteId = `note-${i}`;
      await createTestNote(database, sd1Id, context.sd1Path, noteId, `Test Note ${i}`);
      noteIds.push(noteId);
    }

    // Create two manager instances simulating different app instances
    const manager1 = new NoteMoveManager(database, 'instance-1');
    const manager2 = new NoteMoveManager(database, 'instance-2');

    // Both instances try to move notes concurrently
    const moves1 = noteIds.slice(0, 5).map(async (noteId) => {
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid: context.sd1Uuid,
        targetSdUuid: context.sd2Uuid,
        targetFolderId: null,
        sourceSdPath: context.sd1Path,
        targetSdPath: context.sd2Path,
        instanceId: 'instance-1',
      });
      return manager1.executeMove(moveId);
    });

    const moves2 = noteIds.slice(5, 10).map(async (noteId) => {
      const moveId = await manager2.initiateMove({
        noteId,
        sourceSdUuid: context.sd1Uuid,
        targetSdUuid: context.sd3Uuid,
        targetFolderId: null,
        sourceSdPath: context.sd1Path,
        targetSdPath: context.sd3Path,
        instanceId: 'instance-2',
      });
      return manager2.executeMove(moveId);
    });

    // Wait for all moves to complete
    const results1 = await Promise.all(moves1);
    const results2 = await Promise.all(moves2);

    // Verify all moves succeeded
    const allResults = [...results1, ...results2];
    const failures = allResults.filter((r) => !r.success);

    if (failures.length > 0) {
      errors.push(`${failures.length} moves failed: ${failures.map((f) => f.error).join(', ')}`);
    }

    // Verify notes are in correct locations
    for (let i = 0; i < 5; i++) {
      const noteId = noteIds[i];
      if (!noteId) continue;
      const note = await database.getNote(noteId);
      if (note?.sdId !== sd2Id) {
        errors.push(`Note ${noteId} not in SD2 after move`);
      }
      const notePath = join(context.sd2Path, 'notes', noteId);
      if (!fs.existsSync(notePath)) {
        errors.push(`Note ${noteId} files not found in SD2`);
      }
    }

    for (let i = 5; i < 10; i++) {
      const noteId = noteIds[i];
      if (!noteId) continue;
      const note = await database.getNote(noteId);
      if (note?.sdId !== sd3Id) {
        errors.push(`Note ${noteId} not in SD3 after move`);
      }
      const notePath = join(context.sd3Path, 'notes', noteId);
      if (!fs.existsSync(notePath)) {
        errors.push(`Note ${noteId} files not found in SD3`);
      }
    }

    details = `Moved ${noteIds.length} notes concurrently across 2 instances. ${failures.length} failures.`;

    await database.close();

    return {
      passed: errors.length === 0,
      details,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Test failed: ${(error as Error).message}`);
    return {
      passed: false,
      details: 'Test crashed',
      errors,
      warnings,
    };
  }
}

/**
 * Scenario 2: Interrupted moves at each state
 *
 * Tests recovery from crashes at every point in the state machine
 */
async function scenarioInterruptedMoves(context: TestContext): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: string[] = [];

  const states: NoteMoveState[] = [
    'initiated',
    'copying',
    'files_copied',
    'db_updated',
    'cleaning',
  ];

  for (const state of states) {
    const testDir = join(context.testDir, `interrupted-${state}`);
    await mkdir(testDir, { recursive: true });

    const { database, sd1Id, sd2Id } = await createTestDatabase(testDir, context);

    try {
      const noteId = `note-for-${state}`;
      await createTestNote(
        database,
        sd1Id,
        context.sd1Path,
        noteId,
        `Note interrupted at ${state}`
      );

      const manager1 = new NoteMoveManager(database, 'instance-1');

      // Start move and interrupt at specific state
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid: context.sd1Uuid,
        targetSdUuid: context.sd2Uuid,
        targetFolderId: null,
        sourceSdPath: context.sd1Path,
        targetSdPath: context.sd2Path,
        instanceId: 'instance-1',
      });

      await manager1.executeMoveToState(moveId, state);

      // Simulate crash - create new manager instance
      const manager2 = new NoteMoveManager(database, 'instance-1');

      // Trigger recovery
      await manager2.recoverIncompleteMoves();

      // Verify move completed
      const recoveredMove = await manager2.getMoveRecord(moveId);
      if (recoveredMove?.state !== 'completed') {
        errors.push(`Recovery from '${state}' failed: final state is '${recoveredMove?.state}'`);
      } else {
        details.push(`✓ Recovery from '${state}' succeeded`);
      }

      // Verify note is in correct location
      const note = await database.getNote(noteId);
      if (note?.sdId !== sd2Id) {
        errors.push(`Note ${noteId} not in SD2 after recovery from '${state}'`);
      }

      const notePath = join(context.sd2Path, 'notes', noteId);
      if (!fs.existsSync(notePath)) {
        errors.push(`Note ${noteId} files not found in SD2 after recovery from '${state}'`);
      }

      await database.close();
    } catch (error) {
      errors.push(`Test for state '${state}' failed: ${(error as Error).message}`);
    }
  }

  return {
    passed: errors.length === 0,
    details: details.join('\n'),
    errors,
    warnings,
  };
}

/**
 * Scenario 3: Missing SD during recovery
 *
 * Tests handling when source or target SD is not accessible
 */
async function scenarioMissingSD(context: TestContext): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: string[] = [];

  const testDir = join(context.testDir, 'missing-sd');
  await mkdir(testDir, { recursive: true });

  const { database, sd1Id } = await createTestDatabase(testDir, context);

  try {
    const noteId = 'note-missing-sd';
    await createTestNote(database, sd1Id, context.sd1Path, noteId, 'Note for missing SD test');

    const manager1 = new NoteMoveManager(database, 'instance-1');

    // Start move and stop at files_copied state
    const moveId = await manager1.initiateMove({
      noteId,
      sourceSdUuid: context.sd1Uuid,
      targetSdUuid: context.sd2Uuid,
      targetFolderId: null,
      sourceSdPath: context.sd1Path,
      targetSdPath: context.sd2Path,
      instanceId: 'instance-1',
    });

    await manager1.executeMoveToState(moveId, 'files_copied');

    // Make source SD "unavailable" by updating its UUID
    await database
      .getAdapter()
      .exec('UPDATE storage_dirs SET uuid = ? WHERE id = ?', ['invalid-uuid', sd1Id]);

    // Simulate crash and recovery
    const manager2 = new NoteMoveManager(database, 'instance-1');

    // Spy on console.warn
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };

    await manager2.recoverIncompleteMoves();

    console.warn = originalWarn;

    // Verify warning was logged
    const hasWarning = warnings.some((w) => w.includes('Cannot recover move'));
    if (!hasWarning) {
      errors.push('Expected warning about inaccessible SD was not logged');
    } else {
      details.push('✓ Warning about inaccessible SD was logged');
    }

    // Verify move was NOT completed
    const move = await manager2.getMoveRecord(moveId);
    if (move?.state === 'completed') {
      errors.push('Move should not complete when SD is inaccessible');
    } else {
      details.push(`✓ Move remained in '${move?.state}' state when SD inaccessible`);
    }

    await database.close();
  } catch (error) {
    errors.push(`Test failed: ${(error as Error).message}`);
  }

  return {
    passed: errors.length === 0,
    details: details.join('\n'),
    errors,
    warnings,
  };
}

/**
 * Main test runner
 */
async function main() {
  const args = process.argv.slice(2);
  const scenarioName = args.find((arg) => arg.startsWith('--scenario='))?.split('=')[1] ?? 'all';

  console.log('='.repeat(80));
  console.log('Cross-SD Move Fuzz Test');
  console.log('='.repeat(80));

  // Create test context
  const testDir = join(tmpdir(), `cross-sd-move-fuzz-${Date.now()}`);
  await mkdir(testDir, { recursive: true });

  const context: TestContext = {
    testDir,
    sd1Path: join(testDir, 'sd1'),
    sd2Path: join(testDir, 'sd2'),
    sd3Path: join(testDir, 'sd3'),
    sd1Uuid: 'sd1-uuid-test',
    sd2Uuid: 'sd2-uuid-test',
    sd3Uuid: 'sd3-uuid-test',
  };

  // Create SD directories
  await mkdir(join(context.sd1Path, 'notes'), { recursive: true });
  await mkdir(join(context.sd2Path, 'notes'), { recursive: true });
  await mkdir(join(context.sd3Path, 'notes'), { recursive: true });

  const scenarios: Record<string, TestScenario> = {
    'concurrent-moves': {
      name: 'Concurrent Moves',
      description: 'Multiple instances moving notes simultaneously',
      run: scenarioConcurrentMoves,
    },
    'interrupted-moves': {
      name: 'Interrupted Moves',
      description: 'Recovery from crashes at each state',
      run: scenarioInterruptedMoves,
    },
    'missing-sd': {
      name: 'Missing SD',
      description: 'Handling of inaccessible SDs during recovery',
      run: scenarioMissingSD,
    },
  };

  const results: { scenario: string; result: TestResult }[] = [];

  const scenariosToRun = scenarioName === 'all' ? Object.keys(scenarios) : [scenarioName];

  for (const name of scenariosToRun) {
    const scenario = scenarios[name];
    if (!scenario) {
      console.error(`Unknown scenario: ${name}`);
      continue;
    }

    console.log(`\nRunning scenario: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    console.log('-'.repeat(80));

    try {
      const result = await scenario.run(context);
      results.push({ scenario: name, result });

      if (result.passed) {
        console.log(`✓ PASSED`);
      } else {
        console.log(`✗ FAILED`);
      }

      if (result.details) {
        console.log(`\nDetails:\n${result.details}`);
      }

      if (result.errors.length > 0) {
        console.log(`\nErrors:`);
        for (const error of result.errors) {
          console.log(`  - ${error}`);
        }
      }

      if (result.warnings.length > 0) {
        console.log(`\nWarnings:`);
        for (const warning of result.warnings) {
          console.log(`  - ${warning}`);
        }
      }
    } catch (error) {
      console.error(`Scenario crashed: ${(error as Error).message}`);
      results.push({
        scenario: name,
        result: {
          passed: false,
          details: 'Scenario crashed',
          errors: [(error as Error).message],
          warnings: [],
        },
      });
    }
  }

  // Cleanup
  console.log(`\nCleaning up test directory...`);
  try {
    await rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));

  const passed = results.filter((r) => r.result.passed).length;
  const failed = results.filter((r) => !r.result.passed).length;

  console.log(`Total scenarios: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log(`\nFailed scenarios:`);
    for (const { scenario, result } of results) {
      if (!result.passed) {
        console.log(`  - ${scenario}`);
      }
    }
    process.exit(1);
  } else {
    console.log(`\n✓ All scenarios passed!`);
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fuzz test crashed:', error);
  process.exit(1);
});
