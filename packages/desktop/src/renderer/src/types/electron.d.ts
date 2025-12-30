/**
 * Electron API Type Definitions for Renderer
 */

import type {
  NoteMetadata,
  SyncProgress,
  SyncStatus,
  StaleSyncEntry,
} from '../../../main/ipc/types';

declare global {
  interface Window {
    electronAPI: {
      platform: string;

      note: {
        load: (noteId: string) => Promise<void>;
        unload: (noteId: string) => Promise<void>;
        getState: (noteId: string, stateVector?: Uint8Array) => Promise<Uint8Array>;
        applyUpdate: (noteId: string, update: Uint8Array) => Promise<void>;
        create: (sdId: string, folderId: string, initialContent: string) => Promise<string>;
        delete: (noteId: string) => Promise<void>;
        restore: (noteId: string) => Promise<void>;
        permanentDelete: (noteId: string) => Promise<void>;
        duplicate: (noteId: string) => Promise<string>;
        togglePin: (noteId: string) => Promise<void>;
        move: (noteId: string, newFolderId: string | null) => Promise<void>;
        moveToSD: (
          noteId: string,
          sourceSdId: string,
          targetSdId: string,
          targetFolderId: string | null,
          conflictResolution: 'replace' | 'keepBoth' | null
        ) => Promise<void>;
        getMetadata: (noteId: string) => Promise<NoteMetadata>;
        updateTitle: (noteId: string, title: string, contentText?: string) => Promise<void>;
        list: (
          sdId: string,
          folderId?: string | null
        ) => Promise<
          {
            id: string;
            title: string;
            sdId: string;
            folderId: string | null;
            created: number;
            modified: number;
            deleted: boolean;
            pinned: boolean;
            contentPreview: string;
            contentText: string;
          }[]
        >;
        search: (
          query: string,
          limit?: number
        ) => Promise<
          {
            noteId: string;
            title: string;
            snippet: string;
            rank: number;
          }[]
        >;
        getCountForFolder: (sdId: string, folderId: string | null) => Promise<number>;
        getAllNotesCount: (sdId: string) => Promise<number>;
        getDeletedNoteCount: (sdId: string) => Promise<number>;
        emptyTrash: (sdId: string) => Promise<number>;
        createSnapshot: (
          noteId: string
        ) => Promise<{ success: boolean; filename?: string; error?: string }>;
        checkExistsInSD: (
          noteId: string,
          targetSdId: string
        ) => Promise<{ exists: boolean; isDeleted: boolean }>;
        getInfo: (noteId: string) => Promise<{
          id: string;
          title: string;
          sdId: string;
          sdName: string;
          sdPath: string;
          folderId: string | null;
          folderName: string | null;
          folderPath: string | null;
          fullFolderPath: string;
          created: number;
          modified: number;
          tags: string[];
          characterCount: number;
          wordCount: number;
          paragraphCount: number;
          vectorClock: Record<string, { sequence: number; offset: number; file: string }>;
          documentHash: string;
          crdtUpdateCount: number;
          noteDirPath: string;
          totalFileSize: number;
          snapshotCount: number;
          deleted: boolean;
          pinned: boolean;
          contentPreview: string;
        } | null>;
        reloadFromCRDTLogs: (noteId: string) => Promise<{ success: boolean; error?: string }>;
        getSyncEvents: (noteId: string) => Promise<
          {
            id: string;
            timestamp: number;
            noteId: string;
            direction: 'outgoing' | 'incoming';
            instanceId: string;
            summary: string;
            sequence: number;
            updateSize: number;
          }[]
        >;
        onUpdated: (callback: (noteId: string, update: Uint8Array) => void) => () => void;
        onDeleted: (callback: (noteId: string) => void) => () => void;
        onRestored: (callback: (noteId: string) => void) => () => void;
        onPermanentDeleted: (callback: (noteId: string) => void) => () => void;
        onPinned: (callback: (data: { noteId: string; pinned: boolean }) => void) => () => void;
        onCreated: (
          callback: (data: { sdId: string; noteId: string; folderId: string | null }) => void
        ) => () => void;
        onExternalUpdate: (
          callback: (data: { operation: string; noteIds: string[] }) => void
        ) => () => void;
        onTitleUpdated: (
          callback: (data: {
            noteId: string;
            title: string;
            modified: number;
            contentPreview?: string;
          }) => void
        ) => () => void;
        onMoved: (
          callback: (data: {
            noteId: string;
            oldFolderId: string | null;
            newFolderId: string | null;
          }) => void
        ) => () => void;
        onModifiedUpdated: (
          callback: (data: { noteId: string; modified: number }) => void
        ) => () => void;
        onSyncEvent: (
          callback: (event: {
            id: string;
            timestamp: number;
            noteId: string;
            direction: 'outgoing' | 'incoming';
            instanceId: string;
            summary: string;
            sequence: number;
            updateSize: number;
          }) => void
        ) => () => void;
      };

      history: {
        getTimeline: (noteId: string) => Promise<
          {
            id: string;
            startTime: number;
            endTime: number;
            updateCount: number;
            instanceIds: string[];
            updates: {
              instanceId: string;
              timestamp: number;
              sequence: number;
              data: Uint8Array;
            }[];
          }[]
        >;
        getStats: (noteId: string) => Promise<{
          totalUpdates: number;
          totalSessions: number;
          firstEdit: number | null;
          lastEdit: number | null;
          instanceCount: number;
          instances: string[];
        }>;
        reconstructAt: (
          noteId: string,
          point: { timestamp: number; updateIndex?: number }
        ) => Promise<Uint8Array>;
        getSessionPreview: (
          noteId: string,
          sessionId: string
        ) => Promise<{ firstPreview: string; lastPreview: string }>;
      };

      tag: {
        getAll: () => Promise<{ id: string; name: string; count: number }[]>;
      };

      link: {
        getBacklinks: (noteId: string) => Promise<
          {
            id: string;
            title: string;
            sdId: string;
            folderId: string | null;
            created: number;
            modified: number;
            deleted: boolean;
            pinned: boolean;
            contentPreview: string;
            contentText: string;
          }[]
        >;
        searchNotesForAutocomplete: (query: string) => Promise<
          {
            id: string;
            title: string;
            sdId: string;
            folderId: string | null;
            folderPath: string;
            created: number;
            modified: number;
          }[]
        >;
      };

      folder: {
        list: (sdId: string) => Promise<
          {
            id: string;
            name: string;
            parentId: string | null;
            sdId: string;
            order: number;
            deleted: boolean;
          }[]
        >;
        listAll: () => Promise<
          {
            sdId: string;
            sdName: string;
            folders: {
              id: string;
              name: string;
              parentId: string | null;
              sdId: string;
              order: number;
              deleted: boolean;
            }[];
          }[]
        >;
        get: (
          sdId: string,
          folderId: string
        ) => Promise<{
          id: string;
          name: string;
          parentId: string | null;
          sdId: string;
          order: number;
          deleted: boolean;
        } | null>;
        getChildInfo: (
          sdId: string,
          folderId: string
        ) => Promise<{ hasChildren: boolean; childCount: number; descendantCount: number }>;
        create: (sdId: string, parentId: string | null, name: string) => Promise<string>;
        rename: (sdId: string, folderId: string, newName: string) => Promise<void>;
        delete: (
          sdId: string,
          folderId: string,
          mode?: 'simple' | 'cascade' | 'reparent'
        ) => Promise<void>;
        move: (sdId: string, folderId: string, newParentId: string | null) => Promise<void>;
        reorder: (sdId: string, folderId: string, newIndex: number) => Promise<void>;
        onUpdated: (
          callback: (data: { sdId: string; operation: string; folderId: string }) => void
        ) => () => void;
        emitSelected: (folderId: string) => Promise<void>;
        onSelected: (callback: (folderId: string) => void) => () => void;
      };

      sd: {
        list: () => Promise<
          {
            id: string;
            name: string;
            path: string;
            created: number;
            isActive: boolean;
          }[]
        >;
        create: (name: string, path: string) => Promise<string>;
        setActive: (sdId: string) => Promise<void>;
        getActive: () => Promise<string | null>;
        delete: (sdId: string) => Promise<void>;
        rename: (sdId: string, newName: string) => Promise<void>;
        selectPath: (defaultPath?: string) => Promise<string | null>;
        getCloudStoragePaths: () => Promise<Record<string, string>>;
        onOpenSettings: (callback: () => void) => () => void;
        onUpdated: (callback: (data: { operation: string; sdId: string }) => void) => () => void;
        onInitProgress: (
          callback: (data: { sdId: string; step: number; total: number; message: string }) => void
        ) => () => void;
        onInitComplete: (callback: (data: { sdId: string }) => void) => () => void;
        onInitError: (callback: (data: { sdId: string; error: string }) => void) => () => void;
      };

      sync: {
        openWindow: () => Promise<void>;
        getStatus: () => Promise<SyncStatus>;
        getStaleSyncs: () => Promise<StaleSyncEntry[]>;
        skipStaleEntry: (
          sdId: string,
          noteId: string,
          sourceInstanceId: string
        ) => Promise<{ success: boolean; error?: string }>;
        retryStaleEntry: (
          sdId: string,
          noteId: string,
          sourceInstanceId: string
        ) => Promise<{ success: boolean; error?: string }>;
        exportDiagnostics: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
        onProgress: (callback: (sdId: string, progress: SyncProgress) => void) => () => void;
        onStatusChanged: (callback: (status: SyncStatus) => void) => () => void;
        onStaleEntriesChanged: (callback: (entries: StaleSyncEntry[]) => void) => () => void;
      };

      appState: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<void>;
      };

      shutdown: {
        onProgress: (callback: (data: { current: number; total: number }) => void) => () => void;
        onComplete: (callback: () => void) => () => void;
      };

      config: {
        getDatabasePath: () => Promise<string>;
        setDatabasePath: (path: string) => Promise<void>;
      };

      webServer: {
        start: (port?: number) => Promise<{
          running: boolean;
          port: number | null;
          url: string | null;
          token: string | null;
          connectedClients: number;
          localhostOnly: boolean;
          tlsMode: 'off' | 'self-signed' | 'custom';
          tlsEnabled: boolean;
        }>;
        stop: () => Promise<void>;
        getStatus: () => Promise<{
          running: boolean;
          port: number | null;
          url: string | null;
          token: string | null;
          connectedClients: number;
          localhostOnly: boolean;
          tlsMode: 'off' | 'self-signed' | 'custom';
          tlsEnabled: boolean;
        }>;
        getSettings: () => Promise<{
          port: number;
          localhostOnly: boolean;
          tlsMode: 'off' | 'self-signed' | 'custom';
          customCertPath?: string;
          customKeyPath?: string;
        }>;
        setSettings: (settings: {
          port?: number;
          localhostOnly?: boolean;
          tlsMode?: 'off' | 'self-signed' | 'custom';
          customCertPath?: string;
          customKeyPath?: string;
        }) => Promise<void>;
        regenerateToken: () => Promise<string>;
        getConnectedClients: () => Promise<
          {
            id: string;
            ip: string;
            userAgent: string;
            connectedAt: number;
          }[]
        >;
        disconnectClient: (clientId: string) => Promise<boolean>;
        disconnectAllClients: () => Promise<void>;
        getCertificateInfo: () => Promise<{
          commonName: string;
          validFrom: string;
          validTo: string;
          isSelfSigned: boolean;
          fingerprint: string;
          path: string;
        } | null>;
      };

      telemetry: {
        getSettings: () => Promise<{
          consoleMetricsEnabled: boolean;
          remoteMetricsEnabled: boolean;
          datadogApiKey?: string;
        }>;
        updateSettings: (settings: {
          consoleMetricsEnabled?: boolean;
          remoteMetricsEnabled?: boolean;
          datadogApiKey?: string;
        }) => Promise<void>;
      };

      recovery: {
        getStaleMoves: () => Promise<
          {
            id: string;
            noteId: string;
            sourceSdUuid: string;
            targetSdUuid: string;
            targetFolderId: string | null;
            state: string;
            initiatedBy: string;
            initiatedAt: number;
            lastModified: number;
            sourceSdPath: string;
            targetSdPath: string;
            error: string | null;
          }[]
        >;
        takeOverMove: (moveId: string) => Promise<{ success: boolean; error?: string }>;
        cancelMove: (moveId: string) => Promise<{ success: boolean; error?: string }>;
      };

      diagnostics: {
        getDuplicateNotes: () => Promise<
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
        >;
        getOrphanedCRDTFiles: () => Promise<
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
        >;
        getMissingCRDTFiles: () => Promise<
          {
            noteId: string;
            noteTitle: string;
            sdId: number;
            sdName: string;
            sdPath: string;
            expectedPath: string;
            lastModified: string;
          }[]
        >;
        getStaleMigrationLocks: () => Promise<
          {
            sdId: number;
            sdName: string;
            sdPath: string;
            lockPath: string;
            ageMinutes: number;
            createdAt: string;
          }[]
        >;
        getOrphanedActivityLogs: () => Promise<
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
        >;
        removeStaleMigrationLock: (sdId: number) => Promise<void>;
        cleanupOrphanedActivityLog: (sdId: number, instanceId: string) => Promise<void>;
        importOrphanedCRDT: (noteId: string, sdId: number) => Promise<void>;
        deleteMissingCRDTEntry: (noteId: string, sdId: number) => Promise<void>;
        deleteDuplicateNote: (noteId: string, sdId: number) => Promise<void>;
      };

      backup: {
        createPreOperationSnapshot: (
          sdId: number,
          noteIds: string[],
          description: string
        ) => Promise<{
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
        }>;
        createManualBackup: (
          sdId: string,
          packAndSnapshot: boolean,
          description?: string,
          customBackupPath?: string
        ) => Promise<{
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
        }>;
        listBackups: () => Promise<
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
        >;
        restoreFromBackup: (
          backupId: string,
          targetPath: string,
          registerAsNew: boolean
        ) => Promise<{ sdId: number; sdPath: string }>;
        restoreFromCustomPath: (
          backupPath: string,
          targetPath: string,
          registerAsNew: boolean
        ) => Promise<{ sdId: string; sdPath: string }>;
        deleteBackup: (backupId: string) => Promise<void>;
        cleanupOldSnapshots: () => Promise<number>;
        setBackupDirectory: (customPath: string) => Promise<void>;
        getBackupDirectory: () => Promise<string>;
      };

      menu: {
        onNewNote: (callback: () => void) => () => void;
        onNewFolder: (callback: () => void) => () => void;
        onFind: (callback: () => void) => () => void;
        onFindInNote: (callback: () => void) => () => void;
        onToggleDarkMode: (callback: () => void) => () => void;
        onToggleFolderPanel: (callback: () => void) => () => void;
        onToggleTagsPanel: (callback: () => void) => () => void;
        onToggleNotesListPanel: (callback: () => void) => () => void;
        onCreateSnapshot: (callback: () => void) => () => void;
        onViewHistory: (callback: () => void) => () => void;
        onNoteInfo: (callback: () => void) => () => void;
        onExportSelectedNotes: (callback: () => void) => () => void;
        onExportAllNotes: (callback: () => void) => () => void;
        onImportMarkdown: (callback: () => void) => () => void;
        onReloadFromCRDTLogs: (callback: () => void) => () => void;
        onReindexNotes: (callback: () => void) => () => void;
        onStorageInspector: (callback: () => void) => () => void;
        onFeatureFlags: (callback: () => void) => () => void;
      };

      tools: {
        reindexNotes: () => Promise<{ success: boolean; error?: string }>;
        onReindexProgress: (
          callback: (data: { current: number; total: number }) => void
        ) => () => void;
        onReindexComplete: (callback: () => void) => () => void;
        onReindexError: (callback: (data: { error: string }) => void) => () => void;
      };

      export: {
        selectDirectory: () => Promise<string | null>;
        writeFile: (
          filePath: string,
          content: string
        ) => Promise<{ success: boolean; error?: string }>;
        createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
        getNotesForExport: (noteIds: string[]) => Promise<
          {
            id: string;
            title: string;
            folderId: string | null;
            sdId: string;
            content: unknown;
            isEmpty: boolean;
          }[]
        >;
        showCompletionMessage: (
          exportedCount: number,
          skippedCount: number,
          destinationPath: string,
          errors: string[]
        ) => Promise<void>;
        copyImageFile: (
          sdId: string,
          imageId: string,
          destPath: string
        ) => Promise<{ success: boolean; error?: string; extension?: string }>;
      };

      import: {
        selectSource: (type: 'file' | 'folder') => Promise<string | null>;
        scanSource: (sourcePath: string) => Promise<{
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
        }>;
        execute: (
          sourcePath: string,
          options: {
            sdId: string;
            targetFolderId: string | null;
            folderMode: 'preserve' | 'container' | 'flatten';
            containerName?: string;
            duplicateHandling: 'rename' | 'skip';
          }
        ) => Promise<{
          success: boolean;
          notesCreated?: number;
          foldersCreated?: number;
          skipped?: number;
          noteIds?: string[];
          folderIds?: string[];
          error?: string;
        }>;
        cancel: () => Promise<{ success: boolean }>;
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
        ) => () => void;
      };

      testing: {
        createWindow: (options?: { noteId?: string; minimal?: boolean }) => Promise<void>;
        setNoteTimestamp: (
          noteId: string,
          field: 'created' | 'modified' | 'deleted_at',
          timestamp: number
        ) => Promise<void>;
      };

      app: {
        getInfo: () => Promise<{
          version: string;
          isDevBuild: boolean;
          profileId: string | null;
          profileName: string | null;
          instanceId: string;
        }>;
      };

      shell: {
        openExternal: (url: string) => Promise<void>;
      };

      clipboard: {
        writeText: (text: string) => Promise<void>;
        readText: () => Promise<string>;
        /** Write rich format (HTML + plain text fallback) */
        writeRich: (html: string, text: string) => Promise<void>;
      };

      windowState: {
        /**
         * Report the current note being viewed in this window.
         * Called when user navigates to a new note.
         */
        reportCurrentNote: (windowId: string, noteId: string, sdId?: string) => Promise<void>;

        /**
         * Report the current editor state (scroll/cursor position).
         * Called periodically (debounced) and on beforeunload.
         */
        reportEditorState: (
          windowId: string,
          editorState: { scrollTop: number; cursorPosition: number }
        ) => Promise<void>;

        /**
         * Report the current panel layout (sizes and visibility).
         * Called when panel sizes change or panels are toggled.
         */
        reportPanelLayout: (
          windowId: string,
          panelLayout: {
            panelSizes?: number[];
            leftSidebarSizes?: number[];
            showFolderPanel?: boolean;
            showTagPanel?: boolean;
          }
        ) => Promise<void>;

        /**
         * Get the saved window state for this window (used for restoration).
         * Returns the saved state including editor scroll/cursor position and panel layout.
         */
        getSavedState: (windowId: string) => Promise<{
          noteId?: string;
          sdId?: string;
          editorState?: { scrollTop: number; cursorPosition: number };
          panelLayout?: {
            panelSizes?: number[];
            leftSidebarSizes?: number[];
            showFolderPanel?: boolean;
            showTagPanel?: boolean;
          };
        } | null>;
      };

      // Window operations
      window: {
        /**
         * Open a Note Info window for the specified note.
         * Creates a new window that displays detailed information about the note.
         */
        openNoteInfo: (noteId: string) => Promise<{ success: boolean; error?: string }>;
        /**
         * Open a Storage Inspector window for the specified storage directory.
         * Creates a new window that displays storage directory contents and allows inspection.
         */
        openStorageInspector: (
          sdId: string,
          sdPath: string,
          sdName: string
        ) => Promise<{ success: boolean; error?: string }>;
      };

      // Storage inspector operations
      inspector: {
        /**
         * List contents of a storage directory for inspection
         */
        listSDContents: (sdPath: string) => Promise<{
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
        }>;
        /**
         * Read file info from a storage directory
         */
        readFileInfo: (
          sdPath: string,
          relativePath: string
        ) => Promise<{
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
        }>;
        /**
         * Parse a file's binary data and return structured result with byte offsets
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
        ) => Promise<{
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
        }>;
      };

      image: {
        save: (
          sdId: string,
          data: Uint8Array,
          mimeType: string
        ) => Promise<{ imageId: string; filename: string }>;
        getDataUrl: (sdId: string, imageId: string) => Promise<string | null>;
        getPath: (sdId: string, imageId: string) => Promise<string | null>;
        delete: (sdId: string, imageId: string) => Promise<void>;
        exists: (sdId: string, imageId: string) => Promise<boolean>;
        getMetadata: (imageId: string) => Promise<{
          id: string;
          sdId: string;
          filename: string;
          mimeType: string;
          width: number | null;
          height: number | null;
          size: number;
          created: number;
        } | null>;
        list: (sdId: string) => Promise<
          {
            id: string;
            sdId: string;
            filename: string;
            mimeType: string;
            width: number | null;
            height: number | null;
            size: number;
            created: number;
          }[]
        >;
        getStorageStats: (sdId: string) => Promise<{ totalSize: number; imageCount: number }>;
        pickAndSave: (sdId: string) => Promise<string[]>;
        downloadAndSave: (sdId: string, url: string) => Promise<string>;
        /** Copy image to clipboard */
        copyToClipboard: (sdId: string, imageId: string) => Promise<void>;
        /** Save image as... (with file dialog) */
        saveAs: (sdId: string, imageId: string) => Promise<string | null>;
        /** Open image in external application */
        openExternal: (sdId: string, imageId: string) => Promise<void>;
        /** Copy an image from one sync directory to another */
        copyToSD: (
          sourceSdId: string,
          targetSdId: string,
          imageId: string
        ) => Promise<{
          success: boolean;
          imageId: string;
          alreadyExists?: boolean;
          error?: string;
        }>;
        /** Subscribe to image availability events (when synced images arrive) */
        onAvailable: (
          listener: (event: { sdId: string; imageId: string; filename: string }) => void
        ) => () => void;
      };

      thumbnail: {
        /** Get or generate a thumbnail for an image */
        get: (
          sdId: string,
          imageId: string
        ) => Promise<{
          path: string;
          format: 'jpeg' | 'png' | 'gif';
          width: number;
          height: number;
          size: number;
        } | null>;
        /** Get thumbnail as data URL (for rendering in browser) */
        getDataUrl: (sdId: string, imageId: string) => Promise<string | null>;
        /** Check if a thumbnail exists */
        exists: (sdId: string, imageId: string) => Promise<boolean>;
        /** Delete a thumbnail */
        delete: (sdId: string, imageId: string) => Promise<void>;
        /** Force regenerate a thumbnail */
        generate: (
          sdId: string,
          imageId: string
        ) => Promise<{
          path: string;
          format: 'jpeg' | 'png' | 'gif';
          width: number;
          height: number;
          size: number;
        } | null>;
      };

      comment: {
        /** Get all comment threads for a note */
        getThreads: (noteId: string) => Promise<
          {
            id: string;
            noteId: string;
            anchorStart: Uint8Array;
            anchorEnd: Uint8Array;
            originalText: string;
            authorId: string;
            authorName: string;
            authorHandle: string;
            content: string;
            created: number;
            modified: number;
            resolved: boolean;
            resolvedBy?: string;
            resolvedAt?: number;
          }[]
        >;
        /** Add a new comment thread to a note */
        addThread: (
          noteId: string,
          thread: {
            noteId: string;
            anchorStart: Uint8Array;
            anchorEnd: Uint8Array;
            originalText: string;
            authorId: string;
            authorName: string;
            authorHandle: string;
            content: string;
            created: number;
            modified: number;
            resolved: boolean;
            resolvedBy?: string;
            resolvedAt?: number;
          }
        ) => Promise<{ success: boolean; threadId?: string; error?: string }>;
        /** Update an existing comment thread */
        updateThread: (
          noteId: string,
          threadId: string,
          updates: {
            content?: string;
            resolved?: boolean;
            resolvedBy?: string;
            resolvedAt?: number;
          }
        ) => Promise<{ success: boolean; error?: string }>;
        /** Delete a comment thread */
        deleteThread: (
          noteId: string,
          threadId: string
        ) => Promise<{ success: boolean; error?: string }>;
        /** Add a reply to a thread */
        addReply: (
          noteId: string,
          threadId: string,
          reply: {
            threadId: string;
            authorId: string;
            authorName: string;
            authorHandle: string;
            content: string;
            created: number;
            modified: number;
          }
        ) => Promise<{ success: boolean; replyId?: string; error?: string }>;
        /** Get all replies for a thread */
        getReplies: (
          noteId: string,
          threadId: string
        ) => Promise<
          {
            id: string;
            threadId: string;
            authorId: string;
            authorName: string;
            authorHandle: string;
            content: string;
            created: number;
            modified: number;
          }[]
        >;
        /** Update a reply */
        updateReply: (
          noteId: string,
          threadId: string,
          replyId: string,
          updates: { content?: string }
        ) => Promise<{ success: boolean; error?: string }>;
        /** Delete a reply */
        deleteReply: (
          noteId: string,
          threadId: string,
          replyId: string
        ) => Promise<{ success: boolean; error?: string }>;
        /** Get all reactions for a thread */
        getReactions: (
          noteId: string,
          threadId: string
        ) => Promise<
          {
            id: string;
            targetType: 'thread' | 'reply';
            targetId: string;
            emoji: string;
            authorId: string;
            authorName: string;
            created: number;
          }[]
        >;
        /** Add a reaction to a thread or reply */
        addReaction: (
          noteId: string,
          threadId: string,
          reaction: {
            targetType: 'thread' | 'reply';
            targetId: string;
            emoji: string;
            authorId: string;
            authorName: string;
            created: number;
          }
        ) => Promise<{ success: boolean; reactionId?: string; error?: string }>;
        /** Remove a reaction */
        removeReaction: (
          noteId: string,
          threadId: string,
          reactionId: string
        ) => Promise<{ success: boolean; error?: string }>;
        /** Event listener for when a thread is added */
        onThreadAdded: (callback: (noteId: string, threadId: string) => void) => () => void;
        /** Event listener for when a thread is updated */
        onThreadUpdated: (callback: (noteId: string, threadId: string) => void) => () => void;
        /** Event listener for when a thread is deleted */
        onThreadDeleted: (callback: (noteId: string, threadId: string) => void) => () => void;
        /** Event listener for when a reply is added */
        onReplyAdded: (
          callback: (noteId: string, threadId: string, replyId: string) => void
        ) => () => void;
        /** Event listener for when a reply is updated */
        onReplyUpdated: (
          callback: (noteId: string, threadId: string, replyId: string) => void
        ) => () => void;
        /** Event listener for when a reply is deleted */
        onReplyDeleted: (
          callback: (noteId: string, threadId: string, replyId: string) => void
        ) => () => void;
        /** Event listener for when a reaction is added */
        onReactionAdded: (
          callback: (noteId: string, threadId: string, reactionId: string) => void
        ) => () => void;
        /** Event listener for when a reaction is removed */
        onReactionRemoved: (
          callback: (noteId: string, threadId: string, reactionId: string) => void
        ) => () => void;
      };

      /** Mention operations for @-mentions in comments */
      mention: {
        /** Get users available for @-mentions autocomplete */
        getUsers: () => Promise<
          {
            profileId: string;
            handle: string;
            name: string;
          }[]
        >;
      };

      /** User operations for getting current user profile */
      user: {
        /** Get the current user's profile information for comment authorship */
        getCurrentProfile: () => Promise<{
          profileId: string;
          username: string;
          handle: string;
        }>;

        /**
         * Get the current profile's mode.
         * Used to determine privacy settings and available features.
         */
        getProfileMode: () => Promise<'local' | 'cloud' | 'paranoid' | 'custom'>;

        /**
         * Listen for profile changes broadcast from main process.
         * Called when username or handle is changed in settings.
         * @returns Unsubscribe function
         */
        onProfileChanged: (
          callback: (profile: { profileId: string; username: string; handle: string }) => void
        ) => () => void;
      };

      /** Theme operations for dark mode sync across windows */
      theme: {
        /**
         * Set the theme mode. This saves to database and broadcasts to all windows.
         * Use this from Settings dialog to ensure all windows update.
         */
        set: (theme: 'light' | 'dark') => Promise<void>;
        /**
         * Listen for theme changes broadcast from main process.
         * Called when any window changes the theme (via menu or Settings).
         */
        onChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
      };

      /** Feature flags operations for experimental features */
      featureFlags: {
        /** Get all feature flags with their current values and metadata */
        getAll: () => Promise<
          {
            flag: 'telemetry' | 'viewHistory' | 'webServer';
            enabled: boolean;
            metadata: {
              name: string;
              description: string;
              requiresRestart: boolean;
            };
          }[]
        >;
        /** Get a specific feature flag value */
        get: (flag: 'telemetry' | 'viewHistory' | 'webServer') => Promise<boolean>;
        /** Set a feature flag value */
        set: (
          flag: 'telemetry' | 'viewHistory' | 'webServer',
          enabled: boolean
        ) => Promise<{ success: boolean; requiresRestart: boolean }>;
        /** Subscribe to feature flag changes */
        onChange: (
          callback: (data: {
            flag: 'telemetry' | 'viewHistory' | 'webServer';
            enabled: boolean;
          }) => void
        ) => () => void;
      };

      /** oEmbed link unfurling operations */
      oembed: {
        /** Unfurl a URL - fetch oEmbed data with caching */
        unfurl: (
          url: string,
          options?: {
            maxWidth?: number;
            maxHeight?: number;
            skipCache?: boolean;
            skipDiscovery?: boolean;
          }
        ) => Promise<{
          success: boolean;
          data?: {
            type: 'photo' | 'video' | 'link' | 'rich';
            version: '1.0';
            title?: string;
            author_name?: string;
            author_url?: string;
            provider_name?: string;
            provider_url?: string;
            cache_age?: number;
            thumbnail_url?: string;
            thumbnail_width?: number;
            thumbnail_height?: number;
            url?: string;
            html?: string;
            width?: number;
            height?: number;
          };
          error?: string;
          errorType?: string;
          fromCache?: boolean;
        }>;
        /** Force refresh - fetch fresh data bypassing cache */
        refresh: (url: string) => Promise<{
          success: boolean;
          data?: {
            type: 'photo' | 'video' | 'link' | 'rich';
            version: '1.0';
            title?: string;
            author_name?: string;
            author_url?: string;
            provider_name?: string;
            provider_url?: string;
            cache_age?: number;
            thumbnail_url?: string;
            thumbnail_width?: number;
            thumbnail_height?: number;
            url?: string;
            html?: string;
            width?: number;
            height?: number;
          };
          error?: string;
          errorType?: string;
          fromCache?: boolean;
        }>;
        /** Clear cache - optionally for a specific URL or all */
        clearCache: (url?: string) => Promise<void>;
        /** Get cache statistics */
        getCacheStats: () => Promise<{
          fetchCacheCount: number;
          faviconCount: number;
          thumbnailCount: number;
          thumbnailTotalSizeBytes: number;
          providerCount: number;
        } | null>;
        /** Get favicon for a domain (returns data URL) */
        getFavicon: (domain: string) => Promise<string | null>;

        /** Debug methods for cache inspection */
        debug: {
          /** List all cached favicons */
          listFavicons: () => Promise<
            {
              domain: string;
              dataUrl: string;
              fetchedAt: number;
            }[]
          >;
          /** List all cached thumbnails */
          listThumbnails: () => Promise<
            {
              url: string;
              dataUrl: string;
              sizeBytes: number;
              fetchedAt: number;
            }[]
          >;
          /** List all fetch cache entries */
          listFetchCache: () => Promise<
            {
              url: string;
              rawJson: string;
              fetchedAt: number;
            }[]
          >;
          /** Delete a specific cached favicon */
          deleteFavicon: (domain: string) => Promise<void>;
          /** Delete a specific cached thumbnail */
          deleteThumbnail: (url: string) => Promise<void>;
          /** Clear all cached favicons */
          clearAllFavicons: () => Promise<void>;
          /** Clear all cached thumbnails */
          clearAllThumbnails: () => Promise<void>;
        };
      };
    };
  }
}

export {};
