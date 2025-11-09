/**
 * Note Move Manager
 *
 * Manages cross-SD note moves with state machine for atomicity and crash recovery.
 * Implements Option A (Instance Ownership) with state tracking and recovery.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Database, NoteMove, NoteMoveState } from '@notecove/shared';

/**
 * Valid state transitions for the move state machine
 * Maps current state -> allowed next states
 */
const STATE_TRANSITIONS: Record<NoteMoveState, NoteMoveState[]> = {
  initiated: ['copying', 'cancelled', 'rolled_back'],
  copying: ['files_copied', 'rolled_back'],
  files_copied: ['db_updated', 'rolled_back'],
  db_updated: ['cleaning', 'rolled_back'],
  cleaning: ['completed', 'rolled_back'],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
  rolled_back: [], // Terminal state
};

/**
 * Options for initiating a move
 */
export interface InitiateMoveOptions {
  noteId: string;
  sourceSdUuid: string;
  targetSdUuid: string;
  targetFolderId: string | null;
  sourceSdPath: string;
  targetSdPath: string;
  instanceId: string;
}

/**
 * Result of move execution
 */
export interface MoveExecutionResult {
  success: boolean;
  moveId: string;
  error?: string;
}

/**
 * NoteMoveManager
 *
 * Handles cross-SD note moves with atomic operations and state tracking
 */
export class NoteMoveManager {
  constructor(
    private readonly database: Database,
    private readonly instanceId: string
  ) {}

  /**
   * Validate state transition
   * Returns true if transition from current state to next state is valid
   */
  private isValidTransition(currentState: NoteMoveState, nextState: NoteMoveState): boolean {
    const allowedStates = STATE_TRANSITIONS[currentState];
    return allowedStates.includes(nextState);
  }

  /**
   * Create a new move record in 'initiated' state
   */
  async initiateMove(options: InitiateMoveOptions): Promise<string> {
    const moveId = randomUUID();
    const now = Date.now();

    const move: NoteMove = {
      id: moveId,
      noteId: options.noteId,
      sourceSdUuid: options.sourceSdUuid,
      targetSdUuid: options.targetSdUuid,
      targetFolderId: options.targetFolderId,
      state: 'initiated',
      initiatedBy: options.instanceId,
      initiatedAt: now,
      lastModified: now,
      sourceSdPath: options.sourceSdPath,
      targetSdPath: options.targetSdPath,
      error: null,
    };

    await this.createMoveRecord(move);
    console.log(`[NoteMoveManager] Initiated move ${moveId} for note ${options.noteId}`);

    return moveId;
  }

  /**
   * Update move state with validation
   */
  async updateMoveState(moveId: string, newState: NoteMoveState, error?: string): Promise<void> {
    const move = await this.getMoveRecord(moveId);
    if (!move) {
      throw new Error(`Move record not found: ${moveId}`);
    }

    // Validate state transition
    if (!this.isValidTransition(move.state, newState)) {
      throw new Error(`Invalid state transition for move ${moveId}: ${move.state} -> ${newState}`);
    }

    const now = Date.now();

    await this.database.getAdapter().exec(
      `UPDATE note_moves
       SET state = ?, last_modified = ?, error = ?
       WHERE id = ?`,
      [newState, now, error ?? null, moveId]
    );

    console.log(
      `[NoteMoveManager] Move ${moveId} state: ${move.state} -> ${newState}${
        error ? ` (error: ${error})` : ''
      }`
    );
  }

  /**
   * Get move record by ID
   */
  async getMoveRecord(moveId: string): Promise<NoteMove | null> {
    const row = await this.database.getAdapter().get<{
      id: string;
      note_id: string;
      source_sd_uuid: string;
      target_sd_uuid: string;
      target_folder_id: string | null;
      state: NoteMoveState;
      initiated_by: string;
      initiated_at: number;
      last_modified: number;
      source_sd_path: string;
      target_sd_path: string;
      error: string | null;
    }>('SELECT * FROM note_moves WHERE id = ?', [moveId]);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      noteId: row.note_id,
      sourceSdUuid: row.source_sd_uuid,
      targetSdUuid: row.target_sd_uuid,
      targetFolderId: row.target_folder_id,
      state: row.state,
      initiatedBy: row.initiated_by,
      initiatedAt: row.initiated_at,
      lastModified: row.last_modified,
      sourceSdPath: row.source_sd_path,
      targetSdPath: row.target_sd_path,
      error: row.error,
    };
  }

  /**
   * Create move record in database
   */
  private async createMoveRecord(move: NoteMove): Promise<void> {
    await this.database.getAdapter().exec(
      `INSERT INTO note_moves (
        id, note_id, source_sd_uuid, target_sd_uuid, target_folder_id,
        state, initiated_by, initiated_at, last_modified,
        source_sd_path, target_sd_path, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        move.id,
        move.noteId,
        move.sourceSdUuid,
        move.targetSdUuid,
        move.targetFolderId,
        move.state,
        move.initiatedBy,
        move.initiatedAt,
        move.lastModified,
        move.sourceSdPath,
        move.targetSdPath,
        move.error,
      ]
    );
  }

  /**
   * Get all incomplete moves for this instance
   * Returns moves that are not in terminal states (completed, cancelled, rolled_back)
   */
  async getIncompleteMoves(): Promise<NoteMove[]> {
    const rows = await this.database.getAdapter().all<{
      id: string;
      note_id: string;
      source_sd_uuid: string;
      target_sd_uuid: string;
      target_folder_id: string | null;
      state: NoteMoveState;
      initiated_by: string;
      initiated_at: number;
      last_modified: number;
      source_sd_path: string;
      target_sd_path: string;
      error: string | null;
    }>(
      `SELECT * FROM note_moves
       WHERE initiated_by = ?
       AND state NOT IN ('completed', 'cancelled', 'rolled_back')
       ORDER BY initiated_at ASC`,
      [this.instanceId]
    );

    return rows.map((row) => ({
      id: row.id,
      noteId: row.note_id,
      sourceSdUuid: row.source_sd_uuid,
      targetSdUuid: row.target_sd_uuid,
      targetFolderId: row.target_folder_id,
      state: row.state,
      initiatedBy: row.initiated_by,
      initiatedAt: row.initiated_at,
      lastModified: row.last_modified,
      sourceSdPath: row.source_sd_path,
      targetSdPath: row.target_sd_path,
      error: row.error,
    }));
  }

  /**
   * Get all stale moves (incomplete moves from any instance older than 5 minutes)
   */
  async getStaleMoves(): Promise<NoteMove[]> {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const rows = await this.database.getAdapter().all<{
      id: string;
      note_id: string;
      source_sd_uuid: string;
      target_sd_uuid: string;
      target_folder_id: string | null;
      state: NoteMoveState;
      initiated_by: string;
      initiated_at: number;
      last_modified: number;
      source_sd_path: string;
      target_sd_path: string;
      error: string | null;
    }>(
      `SELECT * FROM note_moves
       WHERE state NOT IN ('completed', 'cancelled', 'rolled_back')
       AND last_modified < ?
       ORDER BY initiated_at ASC`,
      [fiveMinutesAgo]
    );

    return rows.map((row) => ({
      id: row.id,
      noteId: row.note_id,
      sourceSdUuid: row.source_sd_uuid,
      targetSdUuid: row.target_sd_uuid,
      targetFolderId: row.target_folder_id,
      state: row.state,
      initiatedBy: row.initiated_by,
      initiatedAt: row.initiated_at,
      lastModified: row.last_modified,
      sourceSdPath: row.source_sd_path,
      targetSdPath: row.target_sd_path,
      error: row.error,
    }));
  }

  /**
   * Clean up old completed/cancelled/rolled_back move records (older than 30 days)
   */
  async cleanupOldMoves(): Promise<number> {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Count how many will be deleted
    const countResult = await this.database.getAdapter().get<{ count: number }>(
      `SELECT COUNT(*) as count FROM note_moves
       WHERE state IN ('completed', 'cancelled', 'rolled_back')
       AND last_modified < ?`,
      [thirtyDaysAgo]
    );

    const deletedCount = countResult?.count ?? 0;

    if (deletedCount > 0) {
      // Actually delete them
      await this.database.getAdapter().exec(
        `DELETE FROM note_moves
         WHERE state IN ('completed', 'cancelled', 'rolled_back')
         AND last_modified < ?`,
        [thirtyDaysAgo]
      );

      console.log(`[NoteMoveManager] Cleaned up ${deletedCount} old move records`);
    }

    return deletedCount;
  }

  /**
   * Recover incomplete moves on startup
   * Resumes moves initiated by this instance and logs warnings for stale moves
   */
  async recoverIncompleteMoves(): Promise<void> {
    console.log('[NoteMoveManager] Checking for incomplete moves...');

    // Get all incomplete moves for this instance
    const incompleteMoves = await this.getIncompleteMoves();

    if (incompleteMoves.length === 0) {
      console.log('[NoteMoveManager] No incomplete moves found for this instance');
    } else {
      console.log(
        `[NoteMoveManager] Found ${incompleteMoves.length} incomplete move(s) for this instance`
      );

      for (const move of incompleteMoves) {
        await this.recoverMove(move);
      }
    }

    // Check for stale moves from other instances
    const staleMoves = await this.getStaleMoves();
    const staleMovesFromOthers = staleMoves.filter((m) => m.initiatedBy !== this.instanceId);

    if (staleMovesFromOthers.length > 0) {
      console.warn(
        `[NoteMoveManager] Found ${staleMovesFromOthers.length} stale move(s) from other instances:`
      );
      for (const move of staleMovesFromOthers) {
        const age = Math.floor((Date.now() - move.lastModified) / 60000);
        console.warn(
          `  - Move ${move.id} for note ${move.noteId} (state: ${move.state}, age: ${age}min, instance: ${move.initiatedBy})`
        );
      }
    }
  }

  /**
   * Recover a single incomplete move
   */
  private async recoverMove(move: NoteMove): Promise<void> {
    console.log(`[NoteMoveManager] Recovering move ${move.id} from state: ${move.state}`);

    // Check if both SDs are accessible
    const sourceSd = await this.database.getStorageDirByUuid(move.sourceSdUuid);
    const targetSd = await this.database.getStorageDirByUuid(move.targetSdUuid);

    if (!sourceSd || !targetSd) {
      console.warn(
        `[NoteMoveManager] Cannot recover move ${move.id}: ` +
          `source SD ${!sourceSd ? 'not' : ''} accessible, ` +
          `target SD ${!targetSd ? 'not' : ''} accessible`
      );
      return;
    }

    // Update paths to current mounted paths (they may have changed)
    move.sourceSdPath = sourceSd.path;
    move.targetSdPath = targetSd.path;

    try {
      // Resume from current state
      await this.resumeMoveFromState(move);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[NoteMoveManager] Failed to recover move ${move.id}:`, errorMessage);

      // Try to rollback
      await this.rollback(move, `Recovery failed: ${errorMessage}`);
    }
  }

  /**
   * Resume move execution from current state
   */
  private async resumeMoveFromState(move: NoteMove): Promise<void> {
    switch (move.state) {
      case 'initiated':
        // Start from the beginning
        console.log(`[NoteMoveManager] Resuming move ${move.id} from initiated state`);
        await this.copyFilesToTemp(move);
        await this.updateDatabase(move);
        await this.renameToFinal(move);
        await this.cleanupSource(move);
        await this.updateMoveState(move.id, 'completed');
        break;

      case 'copying':
        // Restart copying (clean temp dir first)
        console.log(`[NoteMoveManager] Resuming move ${move.id} from copying state`);
        if (move.targetSdPath) {
          const tempPath = this.getTempDirPath(move.targetSdPath, move.noteId);
          if (fs.existsSync(tempPath)) {
            await fs.promises.rm(tempPath, { recursive: true, force: true });
          }
        }
        // Call performFileCopy directly (already in 'copying' state, don't transition again)
        await this.performFileCopy(move);
        await this.updateMoveState(move.id, 'files_copied');
        await this.updateDatabase(move);
        await this.renameToFinal(move);
        await this.updateMoveState(move.id, 'cleaning');
        await this.performSourceCleanup(move);
        await this.updateMoveState(move.id, 'completed');
        break;

      case 'files_copied':
        // Continue with DB update
        console.log(`[NoteMoveManager] Resuming move ${move.id} from files_copied state`);
        await this.updateDatabase(move);
        await this.renameToFinal(move);
        await this.cleanupSource(move);
        await this.updateMoveState(move.id, 'completed');
        break;

      case 'db_updated': {
        // Verify DB state and continue with file finalization
        console.log(`[NoteMoveManager] Resuming move ${move.id} from db_updated state`);
        const note = await this.database.getNote(move.noteId);
        if (!note) {
          throw new Error('Note not found in database after db_updated state');
        }
        const targetSd = await this.database.getStorageDirByUuid(move.targetSdUuid);
        if (!targetSd || note.sdId !== targetSd.id) {
          throw new Error('Note not in target SD as expected');
        }
        await this.renameToFinal(move);
        await this.cleanupSource(move);
        await this.updateMoveState(move.id, 'completed');
        break;
      }

      case 'cleaning':
        // Retry file operations
        console.log(`[NoteMoveManager] Resuming move ${move.id} from cleaning state`);
        // Verify temp dir was renamed
        if (move.targetSdPath) {
          const tempPath = this.getTempDirPath(move.targetSdPath, move.noteId);
          const finalPath = this.getNoteDirPath(move.targetSdPath, move.noteId);
          if (fs.existsSync(tempPath) && !fs.existsSync(finalPath)) {
            // Temp dir still exists, rename it
            await this.renameToFinal(move);
          }
        }
        // Call performSourceCleanup directly (already in 'cleaning' state, don't transition again)
        await this.performSourceCleanup(move);
        await this.updateMoveState(move.id, 'completed');
        break;

      default:
        console.warn(`[NoteMoveManager] Unknown state for move ${move.id}: ${move.state}`);
    }
  }

  /**
   * Get temporary directory path for a move
   */
  private getTempDirPath(targetSdPath: string, noteId: string): string {
    return path.join(targetSdPath, 'notes', `.moving-${noteId}`);
  }

  /**
   * Get final note directory path
   */
  private getNoteDirPath(sdPath: string, noteId: string): string {
    return path.join(sdPath, 'notes', noteId);
  }

  /**
   * Execute atomic move operation
   * Implements state machine with rollback on failure
   */
  async executeMove(moveId: string): Promise<MoveExecutionResult> {
    return this.executeMoveToState(moveId, 'completed');
  }

  /**
   * Execute move operation up to a specific state (for testing controlled interruption)
   * @param moveId - The move record ID
   * @param stopAtState - The state to stop at (move will end in this state)
   * @returns MoveExecutionResult indicating success/failure
   *
   * This method executes a move from 'initiated' state up to (and including) the specified state.
   * Used for testing crash recovery by simulating interruption at specific points.
   *
   * Examples:
   * - stopAtState='initiated': Returns immediately, move stays in 'initiated'
   * - stopAtState='copying': Transitions to 'copying', then returns (files may be partially copied)
   * - stopAtState='files_copied': Completes file copying, move ends in 'files_copied'
   * - stopAtState='db_updated': Completes DB update, move ends in 'db_updated'
   * - stopAtState='cleaning': Transitions to 'cleaning', then returns
   * - stopAtState='completed': Executes full move (same as executeMove)
   */
  async executeMoveToState(
    moveId: string,
    stopAtState: NoteMoveState
  ): Promise<MoveExecutionResult> {
    const move = await this.getMoveRecord(moveId);
    if (!move) {
      return {
        success: false,
        moveId,
        error: 'Move record not found',
      };
    }

    if (move.state !== 'initiated') {
      return {
        success: false,
        moveId,
        error: `executeMoveToState expects move to be in 'initiated' state, but found: ${move.state}`,
      };
    }

    console.log(
      `[NoteMoveManager] Executing move ${moveId} for note ${move.noteId} (stop at: ${stopAtState})`
    );

    try {
      // Return immediately if stopping at initiated
      if (stopAtState === 'initiated') {
        return { success: true, moveId };
      }

      // Step 1: Start copying files (transitions to 'copying')
      await this.updateMoveState(moveId, 'copying');
      if (stopAtState === 'copying') {
        return { success: true, moveId };
      }

      // Complete the file copy (transitions to 'files_copied')
      await this.performFileCopy(move);
      await this.updateMoveState(moveId, 'files_copied');
      if (stopAtState === 'files_copied') {
        return { success: true, moveId };
      }

      // Step 2: Update database (transitions to 'db_updated')
      await this.updateDatabase(move);
      if (stopAtState === 'db_updated') {
        return { success: true, moveId };
      }

      // Step 3: Rename temp to final (transitions to 'cleaning')
      await this.renameToFinal(move);
      await this.updateMoveState(moveId, 'cleaning');
      if (stopAtState === 'cleaning') {
        return { success: true, moveId };
      }

      // Step 4: Clean up source files (transitions to 'completed')
      await this.performSourceCleanup(move);
      await this.updateMoveState(moveId, 'completed');

      console.log(`[NoteMoveManager] Move ${moveId} completed successfully`);

      return {
        success: true,
        moveId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[NoteMoveManager] Move ${moveId} failed:`, errorMessage);

      // Attempt rollback
      await this.rollback(move, errorMessage);

      return {
        success: false,
        moveId,
        error: errorMessage,
      };
    }
  }

  /**
   * Perform actual file copy operation (without state transitions)
   * Used by executeMoveToState for controlled interruption testing
   */
  private async performFileCopy(move: NoteMove): Promise<void> {
    if (!move.sourceSdPath || !move.targetSdPath) {
      throw new Error('Source or target SD path is missing');
    }

    const sourcePath = this.getNoteDirPath(move.sourceSdPath, move.noteId);
    const tempPath = this.getTempDirPath(move.targetSdPath, move.noteId);

    // Create temp directory
    await fs.promises.mkdir(tempPath, { recursive: true });

    // Copy all files from source to temp
    const files = await fs.promises.readdir(sourcePath);
    for (const file of files) {
      const sourceFile = path.join(sourcePath, file);
      const targetFile = path.join(tempPath, file);

      // Copy file (or directory recursively)
      const stats = await fs.promises.stat(sourceFile);
      if (stats.isDirectory()) {
        await this.copyDirRecursive(sourceFile, targetFile);
      } else {
        await fs.promises.copyFile(sourceFile, targetFile);
      }
    }

    console.log(`[NoteMoveManager] Copied files for move ${move.id} to ${tempPath}`);
  }

  /**
   * Step 1: Copy CRDT files to temporary directory
   * Used by recovery logic - includes state transitions
   */
  private async copyFilesToTemp(move: NoteMove): Promise<void> {
    await this.updateMoveState(move.id, 'copying');
    await this.performFileCopy(move);
    await this.updateMoveState(move.id, 'files_copied');
  }

  /**
   * Recursively copy directory
   */
  private async copyDirRecursive(source: string, target: string): Promise<void> {
    await fs.promises.mkdir(target, { recursive: true });
    const files = await fs.promises.readdir(source);

    for (const file of files) {
      const sourceFile = path.join(source, file);
      const targetFile = path.join(target, file);
      const stats = await fs.promises.stat(sourceFile);

      if (stats.isDirectory()) {
        await this.copyDirRecursive(sourceFile, targetFile);
      } else {
        await fs.promises.copyFile(sourceFile, targetFile);
      }
    }
  }

  /**
   * Step 2: Update database (insert note in target SD, delete from source SD)
   */
  private async updateDatabase(move: NoteMove): Promise<void> {
    // Get note data from source SD
    const note = await this.database.getNote(move.noteId);
    if (!note) {
      throw new Error(`Note ${move.noteId} not found in database`);
    }

    // Get source and target SD info
    const sourceSd = await this.database.getStorageDirByUuid(move.sourceSdUuid);
    if (!sourceSd) {
      throw new Error(`Source SD ${move.sourceSdUuid} not found`);
    }

    const targetSd = await this.database.getStorageDirByUuid(move.targetSdUuid);
    if (!targetSd) {
      throw new Error(`Target SD ${move.targetSdUuid} not found`);
    }

    // Begin transaction
    // CRITICAL: Since id is PRIMARY KEY (globally unique), we must DELETE before INSERT
    // to avoid UNIQUE constraint violations during cross-SD moves
    await this.database.transaction(async () => {
      // Delete note from source SD first
      // This frees up the id for insertion into target SD
      await this.database
        .getAdapter()
        .exec('DELETE FROM notes WHERE id = ? AND sd_id = ?', [move.noteId, sourceSd.id]);

      console.log(`[NoteMoveManager] Deleted note ${move.noteId} from source SD ${sourceSd.id}`);

      // Now insert into target SD (or update if it somehow already exists from previous failed attempt)
      const existingInTarget = await this.database
        .getAdapter()
        .get('SELECT id FROM notes WHERE id = ? AND sd_id = ?', [note.id, targetSd.id]);

      if (existingInTarget) {
        // Note already exists in target - this is a recovery scenario
        // Update it instead of inserting
        console.log(
          `[NoteMoveManager] Note ${note.id} already exists in target SD ${targetSd.id}, updating instead`
        );
        await this.database.getAdapter().exec(
          `UPDATE notes
           SET title = ?, folder_id = ?, modified = ?, deleted = ?, pinned = ?, content_preview = ?, content_text = ?
           WHERE id = ? AND sd_id = ?`,
          [
            note.title,
            move.targetFolderId,
            note.modified,
            note.deleted ? 1 : 0,
            note.pinned ? 1 : 0,
            note.contentPreview,
            note.contentText,
            note.id,
            targetSd.id,
          ]
        );
      } else {
        // Insert note into target SD
        await this.database.getAdapter().exec(
          `INSERT INTO notes (id, title, sd_id, folder_id, created, modified, deleted, pinned, content_preview, content_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            note.id,
            note.title,
            targetSd.id,
            move.targetFolderId,
            note.created,
            note.modified,
            note.deleted ? 1 : 0,
            note.pinned ? 1 : 0,
            note.contentPreview,
            note.contentText,
          ]
        );
      }

      console.log(`[NoteMoveManager] Inserted note ${move.noteId} into target SD ${targetSd.id}`);
    });

    await this.updateMoveState(move.id, 'db_updated');
    console.log(`[NoteMoveManager] Updated database for move ${move.id}`);
  }

  /**
   * Step 3: Atomic rename from temp directory to final location
   */
  private async renameToFinal(move: NoteMove): Promise<void> {
    if (!move.targetSdPath) {
      throw new Error('Target SD path is missing');
    }

    const tempPath = this.getTempDirPath(move.targetSdPath, move.noteId);
    const finalPath = this.getNoteDirPath(move.targetSdPath, move.noteId);

    // Ensure parent directory exists
    await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });

    // Atomic rename
    await fs.promises.rename(tempPath, finalPath);

    console.log(`[NoteMoveManager] Renamed ${tempPath} to ${finalPath}`);
  }

  /**
   * Perform actual source cleanup (without state transitions)
   * Used by executeMoveToState for controlled interruption testing
   */
  private async performSourceCleanup(move: NoteMove): Promise<void> {
    if (!move.sourceSdPath) {
      throw new Error('Source SD path is missing');
    }

    const sourcePath = this.getNoteDirPath(move.sourceSdPath, move.noteId);

    // Recursively delete source directory
    await fs.promises.rm(sourcePath, { recursive: true, force: true });

    console.log(`[NoteMoveManager] Cleaned up source files for move ${move.id}`);
  }

  /**
   * Step 4: Clean up source files
   * Used by recovery logic - includes state transitions
   */
  private async cleanupSource(move: NoteMove): Promise<void> {
    await this.updateMoveState(move.id, 'cleaning');
    await this.performSourceCleanup(move);
  }

  /**
   * Rollback failed move
   */
  private async rollback(move: NoteMove, error: string): Promise<void> {
    console.log(`[NoteMoveManager] Rolling back move ${move.id}...`);

    try {
      // Clean up temporary directory if it exists
      if (move.targetSdPath) {
        const tempPath = this.getTempDirPath(move.targetSdPath, move.noteId);
        if (fs.existsSync(tempPath)) {
          await fs.promises.rm(tempPath, { recursive: true, force: true });
          console.log(`[NoteMoveManager] Removed temp directory ${tempPath}`);
        }
      }

      // If database was updated, we need to revert it
      // Check if note exists in target SD
      const note = await this.database.getNote(move.noteId);
      if (note) {
        const targetSd = await this.database.getStorageDirByUuid(move.targetSdUuid);
        if (targetSd && note.sdId === targetSd.id) {
          // Note is in target SD - need to move it back to source
          const sourceSd = await this.database.getStorageDirByUuid(move.sourceSdUuid);
          if (sourceSd) {
            await this.database
              .getAdapter()
              .exec('UPDATE notes SET sd_id = ? WHERE id = ?', [sourceSd.id, move.noteId]);
            console.log(`[NoteMoveManager] Reverted note ${move.noteId} to source SD`);
          }
        }
      }

      // Mark as rolled back
      await this.updateMoveState(move.id, 'rolled_back', error);
    } catch (rollbackError) {
      console.error(`[NoteMoveManager] Rollback failed for move ${move.id}:`, rollbackError);
      // Still try to mark as rolled back with both errors
      await this.updateMoveState(
        move.id,
        'rolled_back',
        `${error} | Rollback error: ${String(rollbackError)}`
      );
    }
  }
}
