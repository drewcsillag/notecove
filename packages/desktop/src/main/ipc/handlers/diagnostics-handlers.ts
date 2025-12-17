/**
 * Diagnostics Handlers
 *
 * IPC handlers for diagnostics, backup, and recovery operations.
 */

/* eslint-disable @typescript-eslint/require-await */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { HandlerContext } from './types';
import type {
  DuplicateNote,
  OrphanedCRDTFile,
  MissingCRDTFile,
  StaleMigrationLock,
  OrphanedActivityLog,
} from '../../diagnostics-manager';
import type { BackupInfo } from '../../backup-manager';
import type { NoteMove } from '@notecove/shared';

/**
 * Register all diagnostics-related IPC handlers
 */
export function registerDiagnosticsHandlers(ctx: HandlerContext): void {
  // Config operations
  ipcMain.handle('config:getDatabasePath', handleGetDatabasePath(ctx));
  ipcMain.handle('config:setDatabasePath', handleSetDatabasePath(ctx));

  // Recovery operations
  ipcMain.handle('recovery:getStaleMoves', handleGetStaleMoves(ctx));
  ipcMain.handle('recovery:takeOverMove', handleTakeOverMove(ctx));
  ipcMain.handle('recovery:cancelMove', handleCancelMove(ctx));

  // Diagnostics operations
  ipcMain.handle('diagnostics:getDuplicateNotes', handleGetDuplicateNotes(ctx));
  ipcMain.handle('diagnostics:getOrphanedCRDTFiles', handleGetOrphanedCRDTFiles(ctx));
  ipcMain.handle('diagnostics:getMissingCRDTFiles', handleGetMissingCRDTFiles(ctx));
  ipcMain.handle('diagnostics:getStaleMigrationLocks', handleGetStaleMigrationLocks(ctx));
  ipcMain.handle('diagnostics:getOrphanedActivityLogs', handleGetOrphanedActivityLogs(ctx));
  ipcMain.handle('diagnostics:removeStaleMigrationLock', handleRemoveStaleMigrationLock(ctx));
  ipcMain.handle('diagnostics:cleanupOrphanedActivityLog', handleCleanupOrphanedActivityLog(ctx));
  ipcMain.handle('diagnostics:importOrphanedCRDT', handleImportOrphanedCRDT(ctx));
  ipcMain.handle('diagnostics:deleteMissingCRDTEntry', handleDeleteMissingCRDTEntry(ctx));
  ipcMain.handle('diagnostics:deleteDuplicateNote', handleDeleteDuplicateNote(ctx));

  // Backup operations
  ipcMain.handle('backup:createPreOperationSnapshot', handleCreatePreOperationSnapshot(ctx));
  ipcMain.handle('backup:createManualBackup', handleCreateManualBackup(ctx));
  ipcMain.handle('backup:listBackups', handleListBackups(ctx));
  ipcMain.handle('backup:restoreFromBackup', handleRestoreFromBackup(ctx));
  ipcMain.handle('backup:restoreFromCustomPath', handleRestoreFromCustomPath(ctx));
  ipcMain.handle('backup:deleteBackup', handleDeleteBackup(ctx));
  ipcMain.handle('backup:cleanupOldSnapshots', handleCleanupOldSnapshots(ctx));
  ipcMain.handle('backup:setBackupDirectory', handleSetBackupDirectory(ctx));
  ipcMain.handle('backup:getBackupDirectory', handleGetBackupDirectory(ctx));
}

/**
 * Unregister all diagnostics-related IPC handlers
 */
export function unregisterDiagnosticsHandlers(): void {
  ipcMain.removeHandler('config:getDatabasePath');
  ipcMain.removeHandler('config:setDatabasePath');

  ipcMain.removeHandler('recovery:getStaleMoves');
  ipcMain.removeHandler('recovery:takeOverMove');
  ipcMain.removeHandler('recovery:cancelMove');

  ipcMain.removeHandler('diagnostics:getDuplicateNotes');
  ipcMain.removeHandler('diagnostics:getOrphanedCRDTFiles');
  ipcMain.removeHandler('diagnostics:getMissingCRDTFiles');
  ipcMain.removeHandler('diagnostics:getStaleMigrationLocks');
  ipcMain.removeHandler('diagnostics:getOrphanedActivityLogs');
  ipcMain.removeHandler('diagnostics:removeStaleMigrationLock');
  ipcMain.removeHandler('diagnostics:cleanupOrphanedActivityLog');
  ipcMain.removeHandler('diagnostics:importOrphanedCRDT');
  ipcMain.removeHandler('diagnostics:deleteMissingCRDTEntry');
  ipcMain.removeHandler('diagnostics:deleteDuplicateNote');

  ipcMain.removeHandler('backup:createPreOperationSnapshot');
  ipcMain.removeHandler('backup:createManualBackup');
  ipcMain.removeHandler('backup:listBackups');
  ipcMain.removeHandler('backup:restoreFromBackup');
  ipcMain.removeHandler('backup:restoreFromCustomPath');
  ipcMain.removeHandler('backup:deleteBackup');
  ipcMain.removeHandler('backup:cleanupOldSnapshots');
  ipcMain.removeHandler('backup:setBackupDirectory');
  ipcMain.removeHandler('backup:getBackupDirectory');
}

// =============================================================================
// Config Handler Factories
// =============================================================================

function handleGetDatabasePath(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<string> => {
    return await ctx.configManager.getDatabasePath();
  };
}

function handleSetDatabasePath(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, path: string): Promise<void> => {
    await ctx.configManager.setDatabasePath(path);
  };
}

// =============================================================================
// Recovery Handler Factories
// =============================================================================

function handleGetStaleMoves(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<NoteMove[]> => {
    return await ctx.noteMoveManager.getStaleMoves();
  };
}

function handleTakeOverMove(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    moveId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await ctx.noteMoveManager.takeOverMove(moveId);
    if (result.error) {
      return { success: result.success, error: result.error };
    }
    return { success: result.success };
  };
}

function handleCancelMove(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    moveId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await ctx.noteMoveManager.cancelMove(moveId);
    if (result.error) {
      return { success: result.success, error: result.error };
    }
    return { success: result.success };
  };
}

// =============================================================================
// Diagnostics Handler Factories
// =============================================================================

function handleGetDuplicateNotes(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<DuplicateNote[]> => {
    return await ctx.diagnosticsManager.detectDuplicateNotes();
  };
}

function handleGetOrphanedCRDTFiles(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<OrphanedCRDTFile[]> => {
    return await ctx.diagnosticsManager.detectOrphanedCRDTFiles();
  };
}

function handleGetMissingCRDTFiles(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<MissingCRDTFile[]> => {
    return await ctx.diagnosticsManager.detectMissingCRDTFiles();
  };
}

function handleGetStaleMigrationLocks(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<StaleMigrationLock[]> => {
    return await ctx.diagnosticsManager.detectStaleMigrationLocks();
  };
}

function handleGetOrphanedActivityLogs(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<OrphanedActivityLog[]> => {
    return await ctx.diagnosticsManager.detectOrphanedActivityLogs();
  };
}

function handleRemoveStaleMigrationLock(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: number): Promise<void> => {
    await ctx.diagnosticsManager.removeStaleMigrationLock(sdId);
  };
}

function handleCleanupOrphanedActivityLog(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: number, instanceId: string): Promise<void> => {
    await ctx.diagnosticsManager.cleanupOrphanedActivityLog(sdId, instanceId);
  };
}

function handleImportOrphanedCRDT(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string, sdId: number): Promise<void> => {
    await ctx.diagnosticsManager.importOrphanedCRDT(noteId, sdId);
  };
}

function handleDeleteMissingCRDTEntry(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string, sdId: number): Promise<void> => {
    await ctx.diagnosticsManager.deleteMissingCRDTEntry(noteId, sdId);
  };
}

function handleDeleteDuplicateNote(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string, sdId: number): Promise<void> => {
    await ctx.diagnosticsManager.deleteDuplicateNote(noteId, sdId);
  };
}

// =============================================================================
// Backup Handler Factories
// =============================================================================

function handleCreatePreOperationSnapshot(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    noteIds: string[],
    description: string
  ): Promise<BackupInfo> => {
    return await ctx.backupManager.createPreOperationSnapshot(sdId, noteIds, description);
  };
}

function handleCreateManualBackup(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    packAndSnapshot: boolean,
    description?: string,
    customBackupPath?: string
  ): Promise<BackupInfo> => {
    return await ctx.backupManager.createManualBackup(
      sdId,
      packAndSnapshot,
      description,
      customBackupPath
    );
  };
}

function handleListBackups(ctx: HandlerContext) {
  return (_event: IpcMainInvokeEvent): BackupInfo[] => {
    return ctx.backupManager.listBackups();
  };
}

function handleRestoreFromBackup(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    backupId: string,
    targetPath: string,
    registerAsNew: boolean
  ): Promise<{ sdId: string; sdPath: string }> => {
    return await ctx.backupManager.restoreFromBackup(backupId, targetPath, registerAsNew);
  };
}

function handleRestoreFromCustomPath(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    backupPath: string,
    targetPath: string,
    registerAsNew: boolean
  ): Promise<{ sdId: string; sdPath: string }> => {
    return await ctx.backupManager.restoreFromCustomPath(backupPath, targetPath, registerAsNew);
  };
}

function handleDeleteBackup(ctx: HandlerContext) {
  return (_event: IpcMainInvokeEvent, backupId: string): void => {
    ctx.backupManager.deleteBackup(backupId);
  };
}

function handleCleanupOldSnapshots(ctx: HandlerContext) {
  return (_event: IpcMainInvokeEvent): number => {
    return ctx.backupManager.cleanupOldSnapshots();
  };
}

function handleSetBackupDirectory(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, customPath: string): Promise<void> => {
    ctx.backupManager.setBackupDirectory(customPath);
  };
}

function handleGetBackupDirectory(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent): Promise<string> => {
    return ctx.backupManager.getBackupDirectory();
  };
}
