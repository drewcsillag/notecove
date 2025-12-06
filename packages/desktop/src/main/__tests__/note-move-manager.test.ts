/**
 * Unit tests for NoteMoveManager
 */

import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { NoteMoveManager } from '../note-move-manager';
import type { Database, NoteMove, NoteMoveState, NoteCache } from '@notecove/shared';

interface MockAdapter {
  exec: jest.Mock;
  get: jest.Mock;
  all: jest.Mock;
}

describe('NoteMoveManager', () => {
  let mockDatabase: jest.Mocked<Database>;
  let mockAdapter: MockAdapter;
  let noteMoveManager: NoteMoveManager;
  let testDir: string;
  const instanceId = 'test-instance-123';

  beforeEach(async () => {
    // Create temporary directory for file operations
    testDir = join(tmpdir(), `note-move-test-${Date.now()}-${Math.random()}`);
    await mkdir(testDir, { recursive: true });

    // Create a single mock adapter instance
    mockAdapter = {
      exec: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    };

    // Mock database
    mockDatabase = {
      getAdapter: jest.fn(() => mockAdapter),
      getNote: jest.fn(),
      getStorageDirByUuid: jest.fn(),
      transaction: jest.fn((callback) => callback()),
    } as any;

    noteMoveManager = new NoteMoveManager(mockDatabase, instanceId);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('State Machine Transitions', () => {
    it('should allow valid state transitions from initiated', async () => {
      const moveId = 'test-move-1';
      const mockMove: NoteMove = {
        id: moveId,
        noteId: 'note-1',
        sourceSdUuid: 'sd-source',
        targetSdUuid: 'sd-target',
        targetFolderId: null,
        state: 'initiated',
        initiatedBy: instanceId,
        initiatedAt: Date.now(),
        lastModified: Date.now(),
        sourceSdPath: '/source',
        targetSdPath: '/target',
        error: null,
      };

      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'initiated',
        initiated_by: instanceId,
        initiated_at: mockMove.initiatedAt,
        last_modified: mockMove.lastModified,
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      });

      // Test valid transitions: initiated -> copying
      await expect(noteMoveManager.updateMoveState(moveId, 'copying')).resolves.not.toThrow();

      // Test valid transitions: initiated -> cancelled
      await expect(noteMoveManager.updateMoveState(moveId, 'cancelled')).resolves.not.toThrow();

      // Test valid transitions: initiated -> rolled_back
      await expect(noteMoveManager.updateMoveState(moveId, 'rolled_back')).resolves.not.toThrow();
    });

    it('should reject invalid state transitions', async () => {
      const moveId = 'test-move-2';
      const mockMove: NoteMove = {
        id: moveId,
        noteId: 'note-1',
        sourceSdUuid: 'sd-source',
        targetSdUuid: 'sd-target',
        targetFolderId: null,
        state: 'initiated',
        initiatedBy: instanceId,
        initiatedAt: Date.now(),
        lastModified: Date.now(),
        sourceSdPath: '/source',
        targetSdPath: '/target',
        error: null,
      };

      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'initiated',
        initiated_by: instanceId,
        initiated_at: mockMove.initiatedAt,
        last_modified: mockMove.lastModified,
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      });

      // Test invalid transition: initiated -> completed (must go through intermediate states)
      await expect(noteMoveManager.updateMoveState(moveId, 'completed')).rejects.toThrow(
        /Invalid state transition.*initiated.*completed/
      );
    });

    it('should reject transitions from terminal states', async () => {
      const moveId = 'test-move-3';

      // Test completed (terminal state)
      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'completed',
        initiated_by: instanceId,
        initiated_at: Date.now(),
        last_modified: Date.now(),
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      });

      await expect(noteMoveManager.updateMoveState(moveId, 'copying')).rejects.toThrow(
        /Invalid state transition/
      );
    });

    it('should validate all state transitions in the state machine', async () => {
      const moveId = 'test-move-4';
      const transitions: { from: NoteMoveState; to: NoteMoveState; valid: boolean }[] = [
        // From initiated
        { from: 'initiated', to: 'copying', valid: true },
        { from: 'initiated', to: 'cancelled', valid: true },
        { from: 'initiated', to: 'rolled_back', valid: true },
        { from: 'initiated', to: 'completed', valid: false },
        // From copying
        { from: 'copying', to: 'files_copied', valid: true },
        { from: 'copying', to: 'rolled_back', valid: true },
        { from: 'copying', to: 'completed', valid: false },
        // From files_copied
        { from: 'files_copied', to: 'db_updated', valid: true },
        { from: 'files_copied', to: 'rolled_back', valid: true },
        { from: 'files_copied', to: 'completed', valid: false },
        // From db_updated
        { from: 'db_updated', to: 'cleaning', valid: true },
        { from: 'db_updated', to: 'rolled_back', valid: true },
        { from: 'db_updated', to: 'completed', valid: false },
        // From cleaning
        { from: 'cleaning', to: 'completed', valid: true },
        { from: 'cleaning', to: 'rolled_back', valid: true },
        { from: 'cleaning', to: 'copying', valid: false },
      ];

      for (const { from, to, valid } of transitions) {
        mockAdapter.get.mockResolvedValue({
          id: moveId,
          note_id: 'note-1',
          source_sd_uuid: 'sd-source',
          target_sd_uuid: 'sd-target',
          target_folder_id: null,
          state: from,
          initiated_by: instanceId,
          initiated_at: Date.now(),
          last_modified: Date.now(),
          source_sd_path: '/source',
          target_sd_path: '/target',
          error: null,
        });

        if (valid) {
          await expect(noteMoveManager.updateMoveState(moveId, to)).resolves.not.toThrow();
        } else {
          await expect(noteMoveManager.updateMoveState(moveId, to)).rejects.toThrow(
            /Invalid state transition/
          );
        }
      }
    });
  });

  describe('Move Record CRUD Operations', () => {
    it('should create a new move record in initiated state', async () => {
      const options = {
        noteId: 'note-1',
        sourceSdUuid: 'sd-source-uuid',
        targetSdUuid: 'sd-target-uuid',
        targetFolderId: 'folder-1',
        sourceSdPath: '/path/to/source',
        targetSdPath: '/path/to/target',
        instanceId: instanceId,
      };

      const moveId = await noteMoveManager.initiateMove(options);

      expect(moveId).toBeTruthy();
      expect(typeof moveId).toBe('string');
      expect(mockAdapter.exec).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO note_moves'),
        expect.arrayContaining([
          moveId,
          'note-1',
          'sd-source-uuid',
          'sd-target-uuid',
          'folder-1',
          'initiated',
          instanceId,
          expect.any(Number),
          expect.any(Number),
          '/path/to/source',
          '/path/to/target',
          null,
        ])
      );
    });

    it('should get move record by ID', async () => {
      const moveId = 'test-move-id';
      const mockRow = {
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: 'folder-1',
        state: 'initiated' as NoteMoveState,
        initiated_by: instanceId,
        initiated_at: 1234567890,
        last_modified: 1234567890,
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      };

      mockAdapter.get.mockResolvedValue(mockRow);

      const move = await noteMoveManager.getMoveRecord(moveId);

      expect(move).toEqual({
        id: moveId,
        noteId: 'note-1',
        sourceSdUuid: 'sd-source',
        targetSdUuid: 'sd-target',
        targetFolderId: 'folder-1',
        state: 'initiated',
        initiatedBy: instanceId,
        initiatedAt: 1234567890,
        lastModified: 1234567890,
        sourceSdPath: '/source',
        targetSdPath: '/target',
        error: null,
      });

      expect(mockAdapter.get).toHaveBeenCalledWith('SELECT * FROM note_moves WHERE id = ?', [
        moveId,
      ]);
    });

    it('should return null for non-existent move record', async () => {
      mockAdapter.get.mockResolvedValue(null);

      const move = await noteMoveManager.getMoveRecord('non-existent');

      expect(move).toBeNull();
    });

    it('should update move state with timestamp', async () => {
      const moveId = 'test-move-id';
      const mockMove = {
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'initiated' as NoteMoveState,
        initiated_by: instanceId,
        initiated_at: 1234567890,
        last_modified: 1234567890,
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      };

      mockAdapter.get.mockResolvedValue(mockMove);

      await noteMoveManager.updateMoveState(moveId, 'copying');

      expect(mockAdapter.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE note_moves'),
        expect.arrayContaining(['copying', expect.any(Number), null, moveId])
      );
    });

    it('should update move state with error message', async () => {
      const moveId = 'test-move-id';
      const mockMove = {
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'initiated' as NoteMoveState,
        initiated_by: instanceId,
        initiated_at: 1234567890,
        last_modified: 1234567890,
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      };

      mockAdapter.get.mockResolvedValue(mockMove);

      const errorMessage = 'Test error occurred';
      await noteMoveManager.updateMoveState(moveId, 'rolled_back', errorMessage);

      expect(mockAdapter.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE note_moves'),
        expect.arrayContaining(['rolled_back', expect.any(Number), errorMessage, moveId])
      );
    });

    it('should throw error when updating non-existent move record', async () => {
      mockAdapter.get.mockResolvedValue(null);

      await expect(noteMoveManager.updateMoveState('non-existent', 'copying')).rejects.toThrow(
        'Move record not found: non-existent'
      );
    });
  });

  describe('Recovery Logic', () => {
    it('should get incomplete moves for current instance', async () => {
      const mockRows = [
        {
          id: 'move-1',
          note_id: 'note-1',
          source_sd_uuid: 'sd-source',
          target_sd_uuid: 'sd-target',
          target_folder_id: null,
          state: 'copying' as NoteMoveState,
          initiated_by: instanceId,
          initiated_at: 1234567890,
          last_modified: 1234567890,
          source_sd_path: '/source',
          target_sd_path: '/target',
          error: null,
        },
        {
          id: 'move-2',
          note_id: 'note-2',
          source_sd_uuid: 'sd-source',
          target_sd_uuid: 'sd-target',
          target_folder_id: null,
          state: 'files_copied' as NoteMoveState,
          initiated_by: instanceId,
          initiated_at: 1234567891,
          last_modified: 1234567891,
          source_sd_path: '/source',
          target_sd_path: '/target',
          error: null,
        },
      ];

      mockAdapter.all.mockResolvedValue(mockRows);

      const moves = await noteMoveManager.getIncompleteMoves();

      expect(moves).toHaveLength(2);
      expect(moves[0]!.state).toBe('copying');
      expect(moves[1]!.state).toBe('files_copied');
      expect(mockAdapter.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE initiated_by = ?'),
        [instanceId]
      );
    });

    it('should get stale moves from any instance', async () => {
      const now = Date.now();
      const sixMinutesAgo = now - 6 * 60 * 1000;

      const mockRows = [
        {
          id: 'stale-move-1',
          note_id: 'note-1',
          source_sd_uuid: 'sd-source',
          target_sd_uuid: 'sd-target',
          target_folder_id: null,
          state: 'copying' as NoteMoveState,
          initiated_by: 'other-instance',
          initiated_at: sixMinutesAgo,
          last_modified: sixMinutesAgo,
          source_sd_path: '/source',
          target_sd_path: '/target',
          error: null,
        },
      ];

      // Ensure mockAdapter.all returns the mock rows
      mockAdapter.all.mockResolvedValueOnce(mockRows);

      const staleMoves = await noteMoveManager.getStaleMoves();

      expect(staleMoves).toHaveLength(1);
      expect(staleMoves[0]!.id).toBe('stale-move-1');
      expect(mockAdapter.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE state NOT IN'),
        expect.arrayContaining([expect.any(Number)])
      );
    });

    it('should not return recent incomplete moves as stale', async () => {
      // Mock getStaleMoves query to return empty array for recent moves
      mockAdapter.all.mockResolvedValueOnce([]);

      const staleMoves = await noteMoveManager.getStaleMoves();

      expect(staleMoves).toHaveLength(0);
    });
  });

  describe('Cleanup Logic', () => {
    it('should clean up old completed moves older than 30 days', async () => {
      const count = 5;
      mockAdapter.get.mockResolvedValueOnce({ count });

      const deletedCount = await noteMoveManager.cleanupOldMoves();

      expect(deletedCount).toBe(5);
      expect(mockAdapter.get).toHaveBeenCalledWith(
        expect.stringContaining("WHERE state IN ('completed', 'cancelled', 'rolled_back')"),
        expect.arrayContaining([expect.any(Number)])
      );
      expect(mockAdapter.exec).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM note_moves'),
        expect.arrayContaining([expect.any(Number)])
      );
    });

    it('should not delete recent completed moves', async () => {
      mockAdapter.get.mockResolvedValueOnce({ count: 0 });

      const deletedCount = await noteMoveManager.cleanupOldMoves();

      expect(deletedCount).toBe(0);
      expect(mockAdapter.exec).not.toHaveBeenCalled();
    });

    it('should use 30-day retention period', async () => {
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      mockAdapter.get.mockResolvedValueOnce({ count: 0 });

      await noteMoveManager.cleanupOldMoves();

      // Verify that the timestamp is approximately 30 days ago (within 1 second tolerance)
      const call = mockAdapter.get.mock.calls[0];
      const timestamp = call[1][0];
      expect(timestamp).toBeGreaterThan(now - thirtyDays - 1000);
      expect(timestamp).toBeLessThan(now - thirtyDays + 1000);
    });
  });

  describe('Execute Move Integration', () => {
    let sourcePath: string;
    let targetPath: string;

    beforeEach(async () => {
      sourcePath = join(testDir, 'source-sd');
      targetPath = join(testDir, 'target-sd');

      // Create source and target SD directories
      await mkdir(join(sourcePath, 'notes'), { recursive: true });
      await mkdir(join(targetPath, 'notes'), { recursive: true });

      // Create source note with test files
      const sourceNotePath = join(sourcePath, 'notes', 'note-1');
      await mkdir(sourceNotePath, { recursive: true });
      await fs.promises.writeFile(join(sourceNotePath, 'state.bin'), 'test data');
      await fs.promises.writeFile(join(sourceNotePath, 'meta.json'), '{}');
    });

    it('should execute full move successfully', async () => {
      const moveId = 'test-move-exec';
      const noteId = 'note-1';

      // Mock the move record
      const mockMove: NoteMove = {
        id: moveId,
        noteId,
        sourceSdUuid: 'sd-source-uuid',
        targetSdUuid: 'sd-target-uuid',
        targetFolderId: 'folder-1',
        state: 'initiated',
        initiatedBy: instanceId,
        initiatedAt: Date.now(),
        lastModified: Date.now(),
        sourceSdPath: sourcePath,
        targetSdPath: targetPath,
        error: null,
      };

      // First call returns the move record, subsequent calls return updated states
      let getCallCount = 0;
      mockAdapter.get.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM note_moves')) {
          getCallCount++;
          const state =
            getCallCount === 1
              ? 'initiated'
              : getCallCount === 2
                ? 'initiated'
                : getCallCount === 3
                  ? 'copying'
                  : getCallCount === 4
                    ? 'files_copied'
                    : getCallCount === 5
                      ? 'db_updated'
                      : 'cleaning';
          return {
            ...mockMove,
            state,
            id: moveId,
            note_id: noteId,
            source_sd_uuid: mockMove.sourceSdUuid,
            target_sd_uuid: mockMove.targetSdUuid,
            target_folder_id: mockMove.targetFolderId,
            initiated_by: mockMove.initiatedBy,
            initiated_at: mockMove.initiatedAt,
            last_modified: mockMove.lastModified,
            source_sd_path: sourcePath,
            target_sd_path: targetPath,
            error: null,
          };
        }
        // For checking existing note in target during UPDATE
        return null;
      });

      // Mock note data
      const mockNote: NoteCache = {
        id: noteId,
        title: 'Test Note',
        sdId: 'source-sd-id',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'Test content',
        contentText: 'Test content',
      };

      mockDatabase.getNote.mockResolvedValue(mockNote);
      mockDatabase.getStorageDirByUuid.mockImplementation(async (uuid: string) => {
        if (uuid === 'sd-source-uuid') {
          return {
            id: 'source-sd-id',
            path: sourcePath,
            uuid: 'sd-source-uuid',
            name: 'Source SD',
            created: Date.now(),
            isActive: true,
          };
        }
        if (uuid === 'sd-target-uuid') {
          return {
            id: 'target-sd-id',
            path: targetPath,
            uuid: 'sd-target-uuid',
            name: 'Target SD',
            created: Date.now(),
            isActive: true,
          };
        }
        return null;
      });

      const result = await noteMoveManager.executeMove(moveId);

      expect(result.success).toBe(true);
      expect(result.moveId).toBe(moveId);

      // Verify files were moved
      const finalPath = join(targetPath, 'notes', noteId);
      expect(fs.existsSync(finalPath)).toBe(true);
      expect(fs.existsSync(join(finalPath, 'state.bin'))).toBe(true);
      expect(fs.existsSync(join(finalPath, 'meta.json'))).toBe(true);

      // Verify source was cleaned up
      const oldSourcePath = join(sourcePath, 'notes', noteId);
      expect(fs.existsSync(oldSourcePath)).toBe(false);

      // Verify state transitions
      expect(mockAdapter.exec).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE note_moves'),
        expect.arrayContaining(['completed', expect.any(Number), null, moveId])
      );
    });

    it('should rollback on failure', async () => {
      const moveId = 'test-move-fail';
      const noteId = 'note-1';

      let currentState: NoteMoveState = 'initiated';

      // Mock getMoveRecord to track state changes
      mockAdapter.get.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM note_moves')) {
          return {
            id: moveId,
            note_id: noteId,
            source_sd_uuid: 'sd-source-uuid',
            target_sd_uuid: 'sd-target-uuid',
            target_folder_id: null,
            state: currentState,
            initiated_by: instanceId,
            initiated_at: Date.now(),
            last_modified: Date.now(),
            source_sd_path: sourcePath,
            target_sd_path: targetPath,
            error: null,
          };
        }
        return null;
      });

      // Mock exec to track state updates
      mockAdapter.exec.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('UPDATE note_moves') && sql.includes('SET state = ?')) {
          currentState = params[0];
        }
      });

      // Mock database failure
      mockDatabase.getNote.mockRejectedValue(new Error('Database error'));

      const result = await noteMoveManager.executeMove(moveId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');

      // Verify final state is rolled_back
      expect(currentState).toBe('rolled_back');
    });
  });

  describe('takeOverMove', () => {
    it('should return error when move record is not found', async () => {
      mockAdapter.get.mockResolvedValue(null);

      const result = await noteMoveManager.takeOverMove('non-existent-move');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Move record not found');
    });

    it('should return error when move is already in terminal state', async () => {
      const moveId = 'test-move-terminal';
      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'completed',
        initiated_by: 'other-instance',
        initiated_at: Date.now(),
        last_modified: Date.now(),
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      });

      const result = await noteMoveManager.takeOverMove(moveId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('terminal state');
    });

    it('should return error when source SD is not accessible', async () => {
      const moveId = 'test-move-no-source';
      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'initiated',
        initiated_by: 'other-instance',
        initiated_at: Date.now(),
        last_modified: Date.now(),
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      });
      mockDatabase.getStorageDirByUuid.mockResolvedValue(null);

      const result = await noteMoveManager.takeOverMove(moveId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot access');
      expect(result.error).toContain('source');
    });

    it('should return error when target SD is not accessible', async () => {
      const moveId = 'test-move-no-target';
      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'initiated',
        initiated_by: 'other-instance',
        initiated_at: Date.now(),
        last_modified: Date.now(),
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      });
      mockDatabase.getStorageDirByUuid.mockImplementation(async (uuid: string) => {
        if (uuid === 'sd-source') {
          return { id: 'source-id', uuid: 'sd-source', name: 'Source', path: '/source' };
        }
        return null;
      });

      const result = await noteMoveManager.takeOverMove(moveId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot access');
      expect(result.error).toContain('target');
    });
  });

  describe('cancelMove', () => {
    it('should return error when move record is not found', async () => {
      mockAdapter.get.mockResolvedValue(null);

      const result = await noteMoveManager.cancelMove('non-existent-move');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Move record not found');
    });

    it('should return error when move is already in terminal state', async () => {
      const moveId = 'test-move-completed';
      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'rolled_back',
        initiated_by: instanceId,
        initiated_at: Date.now(),
        last_modified: Date.now(),
        source_sd_path: '/source',
        target_sd_path: '/target',
        error: null,
      });

      const result = await noteMoveManager.cancelMove(moveId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('terminal state');
    });

    it('should successfully cancel a move in initiated state', async () => {
      const moveId = 'test-move-cancel';
      const sourcePath = join(testDir, 'source-sd');
      const targetPath = join(testDir, 'target-sd');

      await mkdir(sourcePath, { recursive: true });
      await mkdir(targetPath, { recursive: true });

      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'initiated',
        initiated_by: instanceId,
        initiated_at: Date.now(),
        last_modified: Date.now(),
        source_sd_path: sourcePath,
        target_sd_path: targetPath,
        error: null,
      });

      mockDatabase.getStorageDirByUuid.mockImplementation(async (uuid: string) => {
        if (uuid === 'sd-source') {
          return { id: 'source-id', uuid: 'sd-source', name: 'Source', path: sourcePath };
        }
        if (uuid === 'sd-target') {
          return { id: 'target-id', uuid: 'sd-target', name: 'Target', path: targetPath };
        }
        return null;
      });
      mockDatabase.getNote.mockResolvedValue(null);

      const result = await noteMoveManager.cancelMove(moveId);

      expect(result.success).toBe(true);
      expect(result.moveId).toBe(moveId);
    });

    it('should cleanup temp directory if it exists', async () => {
      const moveId = 'test-move-cleanup';
      const sourcePath = join(testDir, 'source-sd');
      const targetPath = join(testDir, 'target-sd');
      const tempPath = join(targetPath, 'notes', '.moving-note-1');

      await mkdir(tempPath, { recursive: true });
      fs.writeFileSync(join(tempPath, 'snapshot.yjs'), 'test');

      mockAdapter.get.mockResolvedValue({
        id: moveId,
        note_id: 'note-1',
        source_sd_uuid: 'sd-source',
        target_sd_uuid: 'sd-target',
        target_folder_id: null,
        state: 'initiated',
        initiated_by: instanceId,
        initiated_at: Date.now(),
        last_modified: Date.now(),
        source_sd_path: sourcePath,
        target_sd_path: targetPath,
        error: null,
      });

      mockDatabase.getStorageDirByUuid.mockImplementation(async (uuid: string) => {
        if (uuid === 'sd-source') {
          return { id: 'source-id', uuid: 'sd-source', name: 'Source', path: sourcePath };
        }
        if (uuid === 'sd-target') {
          return { id: 'target-id', uuid: 'sd-target', name: 'Target', path: targetPath };
        }
        return null;
      });
      mockDatabase.getNote.mockResolvedValue(null);

      const result = await noteMoveManager.cancelMove(moveId);

      expect(result.success).toBe(true);
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });
});
