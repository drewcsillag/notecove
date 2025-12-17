/**
 * Backup and Diagnostics API
 */

import { ipcRenderer } from 'electron';

export const backupApi = {
  createPreOperationSnapshot: (
    sdId: string,
    noteIds: string[],
    description: string
  ): Promise<{
    backupId: string;
    sdUuid: string;
    sdName: string;
    timestamp: number;
    noteCount: number;
    folderCount: number;
    sizeBytes: number;
    type: 'manual' | 'pre-operation';
    isPacked: boolean;
    description?: string;
    backupPath: string;
  }> =>
    ipcRenderer.invoke('backup:createPreOperationSnapshot', sdId, noteIds, description) as Promise<{
      backupId: string;
      sdUuid: string;
      sdName: string;
      timestamp: number;
      noteCount: number;
      folderCount: number;
      sizeBytes: number;
      type: 'manual' | 'pre-operation';
      isPacked: boolean;
      description?: string;
      backupPath: string;
    }>,
  createManualBackup: (
    sdId: string,
    packAndSnapshot: boolean,
    description?: string,
    customBackupPath?: string
  ): Promise<{
    backupId: string;
    sdUuid: string;
    sdName: string;
    timestamp: number;
    noteCount: number;
    folderCount: number;
    sizeBytes: number;
    type: 'manual' | 'pre-operation';
    isPacked: boolean;
    description?: string;
    backupPath: string;
  }> =>
    ipcRenderer.invoke(
      'backup:createManualBackup',
      sdId,
      packAndSnapshot,
      description,
      customBackupPath
    ) as Promise<{
      backupId: string;
      sdUuid: string;
      sdName: string;
      timestamp: number;
      noteCount: number;
      folderCount: number;
      sizeBytes: number;
      type: 'manual' | 'pre-operation';
      isPacked: boolean;
      description?: string;
      backupPath: string;
    }>,
  listBackups: (): Promise<
    {
      backupId: string;
      sdUuid: string;
      sdName: string;
      timestamp: number;
      noteCount: number;
      folderCount: number;
      sizeBytes: number;
      type: 'manual' | 'pre-operation';
      isPacked: boolean;
      description?: string;
      backupPath: string;
    }[]
  > =>
    ipcRenderer.invoke('backup:listBackups') as Promise<
      {
        backupId: string;
        sdUuid: string;
        sdName: string;
        timestamp: number;
        noteCount: number;
        folderCount: number;
        sizeBytes: number;
        type: 'manual' | 'pre-operation';
        isPacked: boolean;
        description?: string;
        backupPath: string;
      }[]
    >,
  restoreFromBackup: (
    backupId: string,
    targetPath: string,
    registerAsNew: boolean
  ): Promise<{ sdId: string; sdPath: string }> =>
    ipcRenderer.invoke('backup:restoreFromBackup', backupId, targetPath, registerAsNew) as Promise<{
      sdId: string;
      sdPath: string;
    }>,
  restoreFromCustomPath: (
    backupPath: string,
    targetPath: string,
    registerAsNew: boolean
  ): Promise<{ sdId: string; sdPath: string }> =>
    ipcRenderer.invoke(
      'backup:restoreFromCustomPath',
      backupPath,
      targetPath,
      registerAsNew
    ) as Promise<{
      sdId: string;
      sdPath: string;
    }>,
  deleteBackup: (backupId: string): Promise<void> =>
    ipcRenderer.invoke('backup:deleteBackup', backupId) as Promise<void>,
  cleanupOldSnapshots: (): Promise<number> =>
    ipcRenderer.invoke('backup:cleanupOldSnapshots') as Promise<number>,
  setBackupDirectory: (customPath: string): Promise<void> =>
    ipcRenderer.invoke('backup:setBackupDirectory', customPath) as Promise<void>,
  getBackupDirectory: (): Promise<string> =>
    ipcRenderer.invoke('backup:getBackupDirectory') as Promise<string>,
};

export const diagnosticsApi = {
  getDuplicateNotes: (): Promise<
    {
      noteId: string;
      noteTitle: string;
      instances: {
        sdId: number;
        sdName: string;
        sdPath: string;
        modifiedAt: string;
        size: number;
        blockCount: number;
        preview: string;
      }[];
    }[]
  > =>
    ipcRenderer.invoke('diagnostics:getDuplicateNotes') as Promise<
      {
        noteId: string;
        noteTitle: string;
        instances: {
          sdId: number;
          sdName: string;
          sdPath: string;
          modifiedAt: string;
          size: number;
          blockCount: number;
          preview: string;
        }[];
      }[]
    >,
  getOrphanedCRDTFiles: (): Promise<
    {
      noteId: string;
      sdId: number;
      sdName: string;
      sdPath: string;
      filePath: string;
      title: string;
      preview: string;
      modifiedAt: string;
      size: number;
      blockCount: number;
    }[]
  > =>
    ipcRenderer.invoke('diagnostics:getOrphanedCRDTFiles') as Promise<
      {
        noteId: string;
        sdId: number;
        sdName: string;
        sdPath: string;
        filePath: string;
        title: string;
        preview: string;
        modifiedAt: string;
        size: number;
        blockCount: number;
      }[]
    >,
  getMissingCRDTFiles: (): Promise<
    {
      noteId: string;
      noteTitle: string;
      sdId: number;
      sdName: string;
      sdPath: string;
      expectedPath: string;
      lastModified: string;
    }[]
  > =>
    ipcRenderer.invoke('diagnostics:getMissingCRDTFiles') as Promise<
      {
        noteId: string;
        noteTitle: string;
        sdId: number;
        sdName: string;
        sdPath: string;
        expectedPath: string;
        lastModified: string;
      }[]
    >,
  getStaleMigrationLocks: (): Promise<
    {
      sdId: number;
      sdName: string;
      sdPath: string;
      lockPath: string;
      ageMinutes: number;
      createdAt: string;
    }[]
  > =>
    ipcRenderer.invoke('diagnostics:getStaleMigrationLocks') as Promise<
      {
        sdId: number;
        sdName: string;
        sdPath: string;
        lockPath: string;
        ageMinutes: number;
        createdAt: string;
      }[]
    >,
  getOrphanedActivityLogs: (): Promise<
    {
      instanceId: string;
      sdId: number;
      sdName: string;
      sdPath: string;
      logPath: string;
      lastSeen: string;
      daysSinceLastSeen: number;
      sizeBytes: number;
    }[]
  > =>
    ipcRenderer.invoke('diagnostics:getOrphanedActivityLogs') as Promise<
      {
        instanceId: string;
        sdId: number;
        sdName: string;
        sdPath: string;
        logPath: string;
        lastSeen: string;
        daysSinceLastSeen: number;
        sizeBytes: number;
      }[]
    >,
  removeStaleMigrationLock: (sdId: number): Promise<void> =>
    ipcRenderer.invoke('diagnostics:removeStaleMigrationLock', sdId) as Promise<void>,
  cleanupOrphanedActivityLog: (sdId: number, instanceId: string): Promise<void> =>
    ipcRenderer.invoke('diagnostics:cleanupOrphanedActivityLog', sdId, instanceId) as Promise<void>,
  importOrphanedCRDT: (noteId: string, sdId: number): Promise<void> =>
    ipcRenderer.invoke('diagnostics:importOrphanedCRDT', noteId, sdId) as Promise<void>,
  deleteMissingCRDTEntry: (noteId: string, sdId: number): Promise<void> =>
    ipcRenderer.invoke('diagnostics:deleteMissingCRDTEntry', noteId, sdId) as Promise<void>,
  deleteDuplicateNote: (noteId: string, sdId: number): Promise<void> =>
    ipcRenderer.invoke('diagnostics:deleteDuplicateNote', noteId, sdId) as Promise<void>,
};
