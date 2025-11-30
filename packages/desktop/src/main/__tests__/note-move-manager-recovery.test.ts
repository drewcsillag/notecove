/**
 * Integration tests for NoteMoveManager crash recovery
 *
 * These tests simulate crashes at various points in the move process
 * and verify that recovery completes the move correctly.
 */

import { rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { NoteMoveManager } from '../note-move-manager';
import { SqliteDatabase } from '../database/database';
import { BetterSqliteAdapter } from '../database/adapter';
import type { Database } from '@notecove/shared';

describe('NoteMoveManager Recovery Integration Tests', () => {
  let testDir: string;
  let database: Database;
  let sourceSdPath: string;
  let targetSdPath: string;
  let sourceSdUuid: string;
  let targetSdUuid: string;
  let sourceSdId: string;
  let targetSdId: string;
  const instanceId = 'test-instance-recovery';
  const noteId = 'test-note-1';

  beforeEach(async () => {
    // Create temporary directory for file operations
    testDir = join(tmpdir(), `note-move-recovery-test-${Date.now()}-${Math.random()}`);
    await mkdir(testDir, { recursive: true });

    sourceSdPath = join(testDir, 'source-sd');
    targetSdPath = join(testDir, 'target-sd');
    sourceSdUuid = 'source-sd-uuid-test';
    targetSdUuid = 'target-sd-uuid-test';

    // Create source and target SD directories
    await mkdir(join(sourceSdPath, 'notes'), { recursive: true });
    await mkdir(join(targetSdPath, 'notes'), { recursive: true });

    // Create source note with test files
    const sourceNotePath = join(sourceSdPath, 'notes', noteId);
    await mkdir(sourceNotePath, { recursive: true });
    await writeFile(join(sourceNotePath, 'state.bin'), 'test CRDT data');
    await writeFile(join(sourceNotePath, 'meta.json'), JSON.stringify({ version: 1 }));

    // Initialize real database
    const dbPath = join(testDir, 'test.db');
    const adapter = new BetterSqliteAdapter(dbPath);
    database = new SqliteDatabase(adapter);
    await database.initialize();

    // Add storage directories manually (bypass SdUuidManager which requires TextEncoder)
    sourceSdId = randomUUID();
    targetSdId = randomUUID();

    await database.getAdapter().exec(
      `INSERT INTO storage_dirs (id, name, path, uuid, created, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sourceSdId, 'Source SD', sourceSdPath, sourceSdUuid, Date.now(), 1]
    );

    await database.getAdapter().exec(
      `INSERT INTO storage_dirs (id, name, path, uuid, created, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [targetSdId, 'Target SD', targetSdPath, targetSdUuid, Date.now(), 0]
    );

    // Add test note to source SD
    await database.upsertNote({
      id: noteId,
      title: 'Test Note',
      sdId: sourceSdId,
      folderId: null,
      created: Date.now(),
      modified: Date.now(),
      deleted: false,
      pinned: false,
      contentPreview: 'Test content',
      contentText: 'Test content',
    });
  });

  afterEach(async () => {
    // Close database
    await database.close();

    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Recovery from initiated state', () => {
    it('should complete move when recovering from initiated state', async () => {
      const manager1 = new NoteMoveManager(database, instanceId);

      // Step 1: Initiate move and stop at 'initiated' state
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId,
      });

      const result1 = await manager1.executeMoveToState(moveId, 'initiated');
      expect(result1.success).toBe(true);

      // Verify move is in initiated state
      const move = await manager1.getMoveRecord(moveId);
      expect(move?.state).toBe('initiated');

      // Verify source files still exist
      const sourceNotePath = join(sourceSdPath, 'notes', noteId);
      expect(fs.existsSync(sourceNotePath)).toBe(true);

      // Step 2: Simulate crash - create new manager instance
      const manager2 = new NoteMoveManager(database, instanceId);

      // Step 3: Trigger recovery
      await manager2.recoverIncompleteMoves();

      // Step 4: Verify move completed
      const recoveredMove = await manager2.getMoveRecord(moveId);
      expect(recoveredMove?.state).toBe('completed');

      // Verify files were moved
      const targetNotePath = join(targetSdPath, 'notes', noteId);
      expect(fs.existsSync(targetNotePath)).toBe(true);
      expect(fs.existsSync(join(targetNotePath, 'state.bin'))).toBe(true);
      expect(fs.existsSync(join(targetNotePath, 'meta.json'))).toBe(true);

      // Verify source was cleaned up
      expect(fs.existsSync(sourceNotePath)).toBe(false);

      // Verify database was updated
      const note = await database.getNote(noteId);
      expect(note?.sdId).toBe(targetSdId);
    });
  });

  describe('Recovery from copying state', () => {
    it('should complete move when recovering from copying state', async () => {
      const manager1 = new NoteMoveManager(database, instanceId);

      // Step 1: Initiate move and stop at 'copying' state
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId,
      });

      const result1 = await manager1.executeMoveToState(moveId, 'copying');
      expect(result1.success).toBe(true);

      // Verify move is in copying state
      const move = await manager1.getMoveRecord(moveId);
      expect(move?.state).toBe('copying');

      // Step 2: Simulate crash - create new manager instance
      const manager2 = new NoteMoveManager(database, instanceId);

      // Step 3: Trigger recovery
      await manager2.recoverIncompleteMoves();

      // Step 4: Verify move completed
      const recoveredMove = await manager2.getMoveRecord(moveId);
      if (recoveredMove?.state !== 'completed') {
        console.log('[Test] Recovery from copying failed:');
        console.log('[Test] Move state:', recoveredMove?.state);
        console.log('[Test] Move error:', recoveredMove?.error);
      }
      expect(recoveredMove?.state).toBe('completed');

      // Verify files were moved
      const targetNotePath = join(targetSdPath, 'notes', noteId);
      expect(fs.existsSync(targetNotePath)).toBe(true);

      // Verify source was cleaned up
      const sourceNotePath = join(sourceSdPath, 'notes', noteId);
      expect(fs.existsSync(sourceNotePath)).toBe(false);

      // Verify database was updated
      const note = await database.getNote(noteId);
      expect(note?.sdId).toBe(targetSdId);
    });
  });

  describe('Recovery from files_copied state', () => {
    it('should complete move when recovering from files_copied state', async () => {
      const manager1 = new NoteMoveManager(database, instanceId);

      // Step 1: Initiate move and stop at 'files_copied' state
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId,
      });

      const result1 = await manager1.executeMoveToState(moveId, 'files_copied');
      expect(result1.success).toBe(true);

      // Verify move is in files_copied state
      const move = await manager1.getMoveRecord(moveId);
      expect(move?.state).toBe('files_copied');

      // Verify temp directory exists with files
      const tempPath = join(targetSdPath, 'notes', `.moving-${noteId}`);
      expect(fs.existsSync(tempPath)).toBe(true);
      expect(fs.existsSync(join(tempPath, 'state.bin'))).toBe(true);

      // Verify note still in source SD in database
      let note = await database.getNote(noteId);
      expect(note?.sdId).toBe(sourceSdId);

      // Step 2: Simulate crash - create new manager instance
      const manager2 = new NoteMoveManager(database, instanceId);

      // Step 3: Trigger recovery
      await manager2.recoverIncompleteMoves();

      // Step 4: Verify move completed
      const recoveredMove = await manager2.getMoveRecord(moveId);
      expect(recoveredMove?.state).toBe('completed');

      // Verify files in final location
      const finalPath = join(targetSdPath, 'notes', noteId);
      expect(fs.existsSync(finalPath)).toBe(true);

      // Verify temp directory was removed
      expect(fs.existsSync(tempPath)).toBe(false);

      // Verify database was updated
      note = await database.getNote(noteId);
      expect(note?.sdId).toBe(targetSdId);

      // Verify source was cleaned up
      const sourceNotePath = join(sourceSdPath, 'notes', noteId);
      expect(fs.existsSync(sourceNotePath)).toBe(false);
    });
  });

  describe('Recovery from db_updated state', () => {
    it('should complete move when recovering from db_updated state', async () => {
      const manager1 = new NoteMoveManager(database, instanceId);

      // Step 1: Initiate move and stop at 'db_updated' state
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId,
      });

      const result1 = await manager1.executeMoveToState(moveId, 'db_updated');
      expect(result1.success).toBe(true);

      // Verify move is in db_updated state
      const move = await manager1.getMoveRecord(moveId);
      expect(move?.state).toBe('db_updated');

      // Verify database was updated
      let note = await database.getNote(noteId);
      expect(note?.sdId).toBe(targetSdId);

      // Verify temp directory still exists
      const tempPath = join(targetSdPath, 'notes', `.moving-${noteId}`);
      expect(fs.existsSync(tempPath)).toBe(true);

      // Verify source files still exist
      const sourceNotePath = join(sourceSdPath, 'notes', noteId);
      expect(fs.existsSync(sourceNotePath)).toBe(true);

      // Step 2: Simulate crash - create new manager instance
      const manager2 = new NoteMoveManager(database, instanceId);

      // Step 3: Trigger recovery
      await manager2.recoverIncompleteMoves();

      // Step 4: Verify move completed
      const recoveredMove = await manager2.getMoveRecord(moveId);
      expect(recoveredMove?.state).toBe('completed');

      // Verify files in final location
      const finalPath = join(targetSdPath, 'notes', noteId);
      expect(fs.existsSync(finalPath)).toBe(true);

      // Verify temp directory was removed
      expect(fs.existsSync(tempPath)).toBe(false);

      // Verify source was cleaned up
      expect(fs.existsSync(sourceNotePath)).toBe(false);

      // Verify database still correct
      note = await database.getNote(noteId);
      expect(note?.sdId).toBe(targetSdId);
    });
  });

  describe('Recovery from cleaning state', () => {
    it('should complete move when recovering from cleaning state', async () => {
      const manager1 = new NoteMoveManager(database, instanceId);

      // Step 1: Initiate move and stop at 'cleaning' state
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId,
      });

      const result1 = await manager1.executeMoveToState(moveId, 'cleaning');
      expect(result1.success).toBe(true);

      // Verify move is in cleaning state
      const move = await manager1.getMoveRecord(moveId);
      expect(move?.state).toBe('cleaning');

      // Verify files in final location
      const finalPath = join(targetSdPath, 'notes', noteId);
      expect(fs.existsSync(finalPath)).toBe(true);

      // Verify database was updated
      let note = await database.getNote(noteId);
      expect(note?.sdId).toBe(targetSdId);

      // Source files still exist at this point
      const sourceNotePath = join(sourceSdPath, 'notes', noteId);
      expect(fs.existsSync(sourceNotePath)).toBe(true);

      // Step 2: Simulate crash - create new manager instance
      const manager2 = new NoteMoveManager(database, instanceId);

      // Step 3: Trigger recovery
      await manager2.recoverIncompleteMoves();

      // Step 4: Verify move completed
      const recoveredMove = await manager2.getMoveRecord(moveId);
      expect(recoveredMove?.state).toBe('completed');

      // Verify source was cleaned up
      expect(fs.existsSync(sourceNotePath)).toBe(false);

      // Verify files still in final location
      expect(fs.existsSync(finalPath)).toBe(true);

      // Verify database still correct
      note = await database.getNote(noteId);
      expect(note?.sdId).toBe(targetSdId);
    });
  });

  describe('Recovery with missing SD access', () => {
    it('should warn and skip recovery when source SD is not accessible', async () => {
      const manager1 = new NoteMoveManager(database, instanceId);

      // Step 1: Initiate move and stop at 'files_copied' state
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId,
      });

      await manager1.executeMoveToState(moveId, 'files_copied');

      // Step 2: Simulate source SD becoming unavailable (remove from database)
      // Note: We can't actually remove the SD as it would violate foreign key constraints
      // Instead, we'll mark it as inactive or use a different approach
      // For this test, we'll update the UUID to simulate it not being found
      await database
        .getAdapter()
        .exec('UPDATE storage_dirs SET uuid = ? WHERE id = ?', ['invalid-uuid', sourceSdId]);

      // Step 3: Create new manager and trigger recovery
      const manager2 = new NoteMoveManager(database, instanceId);

      // Spy on console.warn to verify warning is logged
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await manager2.recoverIncompleteMoves();

      // Verify warning was logged
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot recover move'));

      // Verify move is still in files_copied state (not completed)
      const move = await manager2.getMoveRecord(moveId);
      expect(move?.state).toBe('files_copied');

      warnSpy.mockRestore();
    });

    it('should warn and skip recovery when target SD is not accessible', async () => {
      const manager1 = new NoteMoveManager(database, instanceId);

      // Step 1: Initiate move and stop at 'files_copied' state
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId,
      });

      await manager1.executeMoveToState(moveId, 'files_copied');

      // Step 2: Simulate target SD becoming unavailable
      await database
        .getAdapter()
        .exec('UPDATE storage_dirs SET uuid = ? WHERE id = ?', ['invalid-uuid', targetSdId]);

      // Step 3: Create new manager and trigger recovery
      const manager2 = new NoteMoveManager(database, instanceId);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await manager2.recoverIncompleteMoves();

      // Verify warning was logged
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot recover move'));

      // Verify move is still in files_copied state (not completed)
      const move = await manager2.getMoveRecord(moveId);
      expect(move?.state).toBe('files_copied');

      warnSpy.mockRestore();
    });
  });

  describe('Stale move detection', () => {
    it('should warn about stale moves from other instances', async () => {
      const otherInstanceId = 'other-instance-456';
      const manager1 = new NoteMoveManager(database, otherInstanceId);

      // Step 1: Initiate move from a different instance
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId: otherInstanceId,
      });

      await manager1.executeMoveToState(moveId, 'copying');

      // Step 2: Manually set last_modified to 6 minutes ago
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      await database
        .getAdapter()
        .exec('UPDATE note_moves SET last_modified = ? WHERE id = ?', [sixMinutesAgo, moveId]);

      // Step 3: Create manager with different instance ID
      const manager2 = new NoteMoveManager(database, instanceId);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Step 4: Trigger recovery (should detect stale move but not recover it)
      await manager2.recoverIncompleteMoves();

      // Verify warnings were logged for stale move
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 stale move(s) from other instances:')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Move.*for note.*state: copying.*age:.*instance:/)
      );

      // Verify move was NOT completed (belongs to other instance)
      const move = await manager2.getMoveRecord(moveId);
      expect(move?.state).toBe('copying');

      warnSpy.mockRestore();
    });

    it('should not warn about recent incomplete moves', async () => {
      const manager1 = new NoteMoveManager(database, instanceId);

      // Step 1: Initiate move
      const moveId = await manager1.initiateMove({
        noteId,
        sourceSdUuid,
        targetSdUuid,
        targetFolderId: null,
        sourceSdPath,
        targetSdPath,
        instanceId,
      });

      await manager1.executeMoveToState(moveId, 'copying');

      // Step 2: Create new manager (same instance)
      const manager2 = new NoteMoveManager(database, instanceId);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Step 3: Trigger recovery
      await manager2.recoverIncompleteMoves();

      // Verify no stale move warnings (it's our own move, and it's recent)
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('stale move'));

      warnSpy.mockRestore();
    });
  });
});
