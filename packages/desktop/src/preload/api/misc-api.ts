/**
 * Miscellaneous APIs: tools, export, import, testing, webServer, inspector, featureFlags
 */

import { ipcRenderer } from 'electron';
import type { NoteCache, FeatureFlag, FeatureFlagMetadata } from '@notecove/shared';

export const toolsApi = {
  reindexNotes: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('tools:reindexNotes') as Promise<{ success: boolean; error?: string }>,
  onReindexProgress: (
    callback: (data: { current: number; total: number }) => void
  ): (() => void) => {
    const listener = (_event: unknown, data: { current: number; total: number }): void => {
      callback(data);
    };
    ipcRenderer.on('tools:reindex-progress', listener);
    return () => {
      ipcRenderer.removeListener('tools:reindex-progress', listener);
    };
  },
  onReindexComplete: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('tools:reindex-complete', listener);
    return () => {
      ipcRenderer.removeListener('tools:reindex-complete', listener);
    };
  },
  onReindexError: (callback: (data: { error: string }) => void): (() => void) => {
    const listener = (_event: unknown, data: { error: string }): void => {
      callback(data);
    };
    ipcRenderer.on('tools:reindex-error', listener);
    return () => {
      ipcRenderer.removeListener('tools:reindex-error', listener);
    };
  },
};

export const exportApi = {
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('export:selectDirectory') as Promise<string | null>,
  writeFile: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('export:writeFile', filePath, content) as Promise<{
      success: boolean;
      error?: string;
    }>,
  createDirectory: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('export:createDirectory', dirPath) as Promise<{
      success: boolean;
      error?: string;
    }>,
  getNotesForExport: (
    noteIds: string[]
  ): Promise<
    {
      id: string;
      title: string;
      folderId: string | null;
      sdId: string;
      content: unknown;
      isEmpty: boolean;
    }[]
  > =>
    ipcRenderer.invoke('export:getNotesForExport', noteIds) as Promise<
      {
        id: string;
        title: string;
        folderId: string | null;
        sdId: string;
        content: unknown;
        isEmpty: boolean;
      }[]
    >,
  showCompletionMessage: (
    exportedCount: number,
    skippedCount: number,
    destinationPath: string,
    errors: string[]
  ): Promise<void> =>
    ipcRenderer.invoke(
      'export:showCompletionMessage',
      exportedCount,
      skippedCount,
      destinationPath,
      errors
    ) as Promise<void>,
  copyImageFile: (
    sdId: string,
    imageId: string,
    destPath: string
  ): Promise<{ success: boolean; error?: string; extension?: string }> =>
    ipcRenderer.invoke('export:copyImageFile', sdId, imageId, destPath) as Promise<{
      success: boolean;
      error?: string;
      extension?: string;
    }>,
};

export const importApi = {
  selectSource: (type: 'file' | 'folder'): Promise<string | null> =>
    ipcRenderer.invoke('import:selectSource', type) as Promise<string | null>,
  scanSource: (
    sourcePath: string
  ): Promise<{
    success: boolean;
    result?: {
      rootPath: string;
      isDirectory: boolean;
      totalFiles: number;
      totalSize: number;
      files: {
        absolutePath: string;
        relativePath: string;
        name: string;
        parentPath: string;
        size: number;
        modifiedAt: number;
      }[];
      tree: {
        name: string;
        path: string;
        isFolder: boolean;
        children?: unknown[];
      };
    };
    error?: string;
  }> =>
    ipcRenderer.invoke('import:scanSource', sourcePath) as Promise<{
      success: boolean;
      result?: {
        rootPath: string;
        isDirectory: boolean;
        totalFiles: number;
        totalSize: number;
        files: {
          absolutePath: string;
          relativePath: string;
          name: string;
          parentPath: string;
          size: number;
          modifiedAt: number;
        }[];
        tree: {
          name: string;
          path: string;
          isFolder: boolean;
          children?: unknown[];
        };
      };
      error?: string;
    }>,
  execute: (
    sourcePath: string,
    options: {
      sdId: string;
      targetFolderId: string | null;
      folderMode: 'preserve' | 'container' | 'flatten';
      containerName?: string;
      duplicateHandling: 'rename' | 'skip';
    }
  ): Promise<{
    success: boolean;
    notesCreated?: number;
    foldersCreated?: number;
    skipped?: number;
    noteIds?: string[];
    folderIds?: string[];
    error?: string;
  }> =>
    ipcRenderer.invoke('import:execute', sourcePath, options) as Promise<{
      success: boolean;
      notesCreated?: number;
      foldersCreated?: number;
      skipped?: number;
      noteIds?: string[];
      folderIds?: string[];
      error?: string;
    }>,
  cancel: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('import:cancel') as Promise<{ success: boolean }>,
  onProgress: (
    callback: (progress: {
      phase: 'scanning' | 'folders' | 'notes' | 'complete' | 'cancelled' | 'error';
      processedFiles: number;
      totalFiles: number;
      currentFile?: string;
      foldersCreated: number;
      notesCreated: number;
      notesSkipped: number;
      errors: { type: string; item: string; message: string }[];
    }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: {
        phase: 'scanning' | 'folders' | 'notes' | 'complete' | 'cancelled' | 'error';
        processedFiles: number;
        totalFiles: number;
        currentFile?: string;
        foldersCreated: number;
        notesCreated: number;
        notesSkipped: number;
        errors: { type: string; item: string; message: string }[];
      }
    ) => {
      callback(progress);
    };
    ipcRenderer.on('import:progress', handler);
    return () => {
      ipcRenderer.removeListener('import:progress', handler);
    };
  },
};

export const testingApi = {
  createWindow: (options?: { noteId?: string; minimal?: boolean }): Promise<void> =>
    ipcRenderer.invoke('testing:createWindow', options) as Promise<void>,
  // Test-only: Set note timestamp (only available in NODE_ENV=test)
  setNoteTimestamp: (
    noteId: string,
    field: 'created' | 'modified' | 'deleted_at',
    timestamp: number
  ): Promise<void> =>
    ipcRenderer.invoke('test:setNoteTimestamp', noteId, field, timestamp) as Promise<void>,
  // Test-only: Tag database queries (only available in NODE_ENV=test)
  getAllTags: (): Promise<{ id: string; name: string }[]> =>
    ipcRenderer.invoke('test:getAllTags') as Promise<{ id: string; name: string }[]>,
  getTagsForNote: (noteId: string): Promise<{ id: string; name: string }[]> =>
    ipcRenderer.invoke('test:getTagsForNote', noteId) as Promise<{ id: string; name: string }[]>,
  getNoteById: (noteId: string): Promise<NoteCache | null> =>
    ipcRenderer.invoke('test:getNoteById', noteId) as Promise<NoteCache | null>,

  // Test instrumentation: File watcher events
  onFileWatcherEvent: (
    callback: (data: {
      sdId: string;
      filename: string;
      type: string;
      gracePeriodActive: boolean;
    }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { sdId: string; filename: string; type: string; gracePeriodActive: boolean }
    ): void => {
      callback(data);
    };
    ipcRenderer.on('test:file-watcher-event', listener);
    return () => {
      ipcRenderer.removeListener('test:file-watcher-event', listener);
    };
  },
  onGracePeriodEnded: (callback: (data: { sdId: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { sdId: string }): void => {
      callback(data);
    };
    ipcRenderer.on('test:grace-period-ended', listener);
    return () => {
      ipcRenderer.removeListener('test:grace-period-ended', listener);
    };
  },
  onActivitySyncComplete: (
    callback: (data: { sdId: string; noteIds: string[] }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { sdId: string; noteIds: string[] }
    ): void => {
      callback(data);
    };
    ipcRenderer.on('test:activity-sync-complete', listener);
    return () => {
      ipcRenderer.removeListener('test:activity-sync-complete', listener);
    };
  },
  onActivityWatcherDebug: (
    callback: (data: {
      sdId: string;
      filename: string;
      reason: string;
      instanceId?: string;
    }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { sdId: string; filename: string; reason: string; instanceId?: string }
    ): void => {
      callback(data);
    };
    ipcRenderer.on('test:activity-watcher-debug', listener);
    return () => {
      ipcRenderer.removeListener('test:activity-watcher-debug', listener);
    };
  },

  // Initial sync completion events (fired from main process during startup)
  onInitialSyncComplete: (callback: (data: { sdId: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { sdId: string }): void => {
      callback(data);
    };
    ipcRenderer.on('sync:initial-sync-complete', listener);
    return () => {
      ipcRenderer.removeListener('sync:initial-sync-complete', listener);
    };
  },
  onAllInitialSyncsComplete: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('sync:all-initial-syncs-complete', listener);
    return () => {
      ipcRenderer.removeListener('sync:all-initial-syncs-complete', listener);
    };
  },
};

export const webServerApi = {
  start: (
    port?: number
  ): Promise<{
    running: boolean;
    port: number | null;
    url: string | null;
    token: string | null;
    connectedClients: number;
    localhostOnly: boolean;
    tlsMode: 'off' | 'self-signed' | 'custom';
    tlsEnabled: boolean;
  }> =>
    ipcRenderer.invoke('webServer:start', port) as Promise<{
      running: boolean;
      port: number | null;
      url: string | null;
      token: string | null;
      connectedClients: number;
      localhostOnly: boolean;
      tlsMode: 'off' | 'self-signed' | 'custom';
      tlsEnabled: boolean;
    }>,
  stop: (): Promise<void> => ipcRenderer.invoke('webServer:stop') as Promise<void>,
  getStatus: (): Promise<{
    running: boolean;
    port: number | null;
    url: string | null;
    token: string | null;
    connectedClients: number;
    localhostOnly: boolean;
    tlsMode: 'off' | 'self-signed' | 'custom';
    tlsEnabled: boolean;
  }> =>
    ipcRenderer.invoke('webServer:getStatus') as Promise<{
      running: boolean;
      port: number | null;
      url: string | null;
      token: string | null;
      connectedClients: number;
      localhostOnly: boolean;
      tlsMode: 'off' | 'self-signed' | 'custom';
      tlsEnabled: boolean;
    }>,
  getSettings: (): Promise<{
    port: number;
    localhostOnly: boolean;
    tlsMode: 'off' | 'self-signed' | 'custom';
    customCertPath?: string;
    customKeyPath?: string;
  }> =>
    ipcRenderer.invoke('webServer:getSettings') as Promise<{
      port: number;
      localhostOnly: boolean;
      tlsMode: 'off' | 'self-signed' | 'custom';
      customCertPath?: string;
      customKeyPath?: string;
    }>,
  setSettings: (settings: {
    port?: number;
    localhostOnly?: boolean;
    tlsMode?: 'off' | 'self-signed' | 'custom';
    customCertPath?: string;
    customKeyPath?: string;
  }): Promise<void> => ipcRenderer.invoke('webServer:setSettings', settings) as Promise<void>,
  regenerateToken: (): Promise<string> =>
    ipcRenderer.invoke('webServer:regenerateToken') as Promise<string>,
  getConnectedClients: (): Promise<
    {
      id: string;
      ip: string;
      userAgent: string;
      connectedAt: number;
    }[]
  > =>
    ipcRenderer.invoke('webServer:getConnectedClients') as Promise<
      {
        id: string;
        ip: string;
        userAgent: string;
        connectedAt: number;
      }[]
    >,
  disconnectClient: (clientId: string): Promise<boolean> =>
    ipcRenderer.invoke('webServer:disconnectClient', clientId) as Promise<boolean>,
  disconnectAllClients: (): Promise<void> =>
    ipcRenderer.invoke('webServer:disconnectAllClients') as Promise<void>,
  getCertificateInfo: (): Promise<{
    commonName: string;
    validFrom: string;
    validTo: string;
    isSelfSigned: boolean;
    fingerprint: string;
    path: string;
  } | null> => ipcRenderer.invoke('webServer:getCertificateInfo'),
};

export const inspectorApi = {
  /**
   * List contents of a storage directory for inspection
   * @param sdPath Path to the storage directory
   */
  listSDContents: (sdPath: string) =>
    ipcRenderer.invoke('inspector:listSDContents', sdPath) as Promise<{
      root: string;
      children: {
        name: string;
        path: string;
        type:
          | 'crdtlog'
          | 'snapshot'
          | 'activity'
          | 'profile'
          | 'image'
          | 'identity'
          | 'directory'
          | 'unknown';
        size?: number;
        modified?: Date;
        children?: unknown[];
      }[];
      error?: string;
    }>,

  /**
   * Read file info from a storage directory
   * @param sdPath Path to the storage directory
   * @param relativePath Path relative to the SD root
   */
  readFileInfo: (sdPath: string, relativePath: string) =>
    ipcRenderer.invoke('inspector:readFileInfo', sdPath, relativePath) as Promise<{
      path: string;
      type:
        | 'crdtlog'
        | 'snapshot'
        | 'activity'
        | 'profile'
        | 'image'
        | 'identity'
        | 'directory'
        | 'unknown';
      size: number;
      modified: Date;
      data: Uint8Array;
      error?: string;
    }>,

  /**
   * Parse a file's binary data and return structured result with byte offsets
   * for hex viewer color coding
   * @param data Raw file data
   * @param type File type
   */
  parseFile: (
    data: Uint8Array,
    type:
      | 'crdtlog'
      | 'snapshot'
      | 'activity'
      | 'profile'
      | 'image'
      | 'identity'
      | 'directory'
      | 'unknown'
  ) =>
    ipcRenderer.invoke('inspector:parseFile', data, type) as Promise<{
      type:
        | 'crdtlog'
        | 'snapshot'
        | 'activity'
        | 'profile'
        | 'image'
        | 'identity'
        | 'directory'
        | 'unknown';
      crdtLog?: {
        fields: {
          name: string;
          value: string | number;
          startOffset: number;
          endOffset: number;
          type:
            | 'magic'
            | 'version'
            | 'timestamp'
            | 'sequence'
            | 'length'
            | 'data'
            | 'error'
            | 'vectorClock'
            | 'status';
          error?: string;
        }[];
        records: {
          index: number;
          timestamp: number;
          sequence: number;
          dataSize: number;
          startOffset: number;
          endOffset: number;
          dataStartOffset: number;
          fields: {
            name: string;
            value: string | number;
            startOffset: number;
            endOffset: number;
            type:
              | 'magic'
              | 'version'
              | 'timestamp'
              | 'sequence'
              | 'length'
              | 'data'
              | 'error'
              | 'vectorClock'
              | 'status';
            error?: string;
          }[];
        }[];
        error?: string;
      };
      snapshot?: {
        fields: {
          name: string;
          value: string | number;
          startOffset: number;
          endOffset: number;
          type:
            | 'magic'
            | 'version'
            | 'timestamp'
            | 'sequence'
            | 'length'
            | 'data'
            | 'error'
            | 'vectorClock'
            | 'status';
          error?: string;
        }[];
        vectorClockEntries: {
          instanceId: string;
          sequence: number;
          offset: number;
          filename: string;
          startOffset: number;
          endOffset: number;
          fields: {
            name: string;
            value: string | number;
            startOffset: number;
            endOffset: number;
            type:
              | 'magic'
              | 'version'
              | 'timestamp'
              | 'sequence'
              | 'length'
              | 'data'
              | 'error'
              | 'vectorClock'
              | 'status';
            error?: string;
          }[];
        }[];
        documentStateOffset: number;
        documentStateSize: number;
        complete: boolean;
        error?: string;
      };
      error?: string;
    }>,
};

/**
 * Feature flag info returned from the API
 */
export interface FeatureFlagInfo {
  flag: FeatureFlag;
  enabled: boolean;
  metadata: FeatureFlagMetadata;
}

export const featureFlagsApi = {
  /**
   * Get all feature flags with their current values and metadata
   */
  getAll: (): Promise<FeatureFlagInfo[]> =>
    ipcRenderer.invoke('featureFlags:getAll') as Promise<FeatureFlagInfo[]>,

  /**
   * Get a specific feature flag value
   * @param flag The feature flag to get
   */
  get: (flag: FeatureFlag): Promise<boolean> =>
    ipcRenderer.invoke('featureFlags:get', flag) as Promise<boolean>,

  /**
   * Set a feature flag value
   * @param flag The feature flag to set
   * @param enabled Whether to enable or disable the feature
   * @returns Object with success status and whether restart is required
   */
  set: (
    flag: FeatureFlag,
    enabled: boolean
  ): Promise<{ success: boolean; requiresRestart: boolean }> =>
    ipcRenderer.invoke('featureFlags:set', flag, enabled) as Promise<{
      success: boolean;
      requiresRestart: boolean;
    }>,

  /**
   * Subscribe to feature flag changes
   * @param callback Called when a feature flag changes
   * @returns Cleanup function to unsubscribe
   */
  onChange: (callback: (data: { flag: FeatureFlag; enabled: boolean }) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { flag: FeatureFlag; enabled: boolean }
    ): void => {
      callback(data);
    };
    ipcRenderer.on('featureFlags:changed', listener);
    return () => {
      ipcRenderer.removeListener('featureFlags:changed', listener);
    };
  },
};
