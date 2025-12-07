/**
 * Browser stub for window.electronAPI
 *
 * This provides a minimal stub implementation that allows the app to load
 * in a browser context. Methods throw errors indicating they need the
 * real web client implementation (to be added in Phase 4).
 *
 * This file is used during the Phase 0 spike to prove the build works.
 */

type StubAsyncFunction = (...args: unknown[]) => Promise<never>;

const notImplemented = (method: string): StubAsyncFunction => {
  return () => {
    throw new Error(`[Browser] ${method} not yet implemented. Web client coming in Phase 4.`);
  };
};

// Event subscription stub - returns a no-op unsubscribe function
const stubEventSubscription = (_callback: unknown): (() => void) => {
  return () => {
    /* no-op unsubscribe */
  };
};

/**
 * Stub implementation of window.electronAPI for browser context.
 * All methods throw "not implemented" errors.
 */
export const browserApiStub: typeof window.electronAPI = {
  platform: 'browser',

  note: {
    load: notImplemented('note.load'),
    unload: notImplemented('note.unload'),
    getState: notImplemented('note.getState'),
    applyUpdate: notImplemented('note.applyUpdate'),
    create: notImplemented('note.create'),
    delete: notImplemented('note.delete'),
    restore: notImplemented('note.restore'),
    permanentDelete: notImplemented('note.permanentDelete'),
    duplicate: notImplemented('note.duplicate'),
    togglePin: notImplemented('note.togglePin'),
    move: notImplemented('note.move'),
    moveToSD: notImplemented('note.moveToSD'),
    getMetadata: notImplemented('note.getMetadata'),
    updateTitle: notImplemented('note.updateTitle'),
    list: notImplemented('note.list'),
    search: notImplemented('note.search'),
    getCountForFolder: notImplemented('note.getCountForFolder'),
    getAllNotesCount: notImplemented('note.getAllNotesCount'),
    getDeletedNoteCount: notImplemented('note.getDeletedNoteCount'),
    createSnapshot: notImplemented('note.createSnapshot'),
    checkExistsInSD: notImplemented('note.checkExistsInSD'),
    getInfo: notImplemented('note.getInfo'),
    reloadFromCRDTLogs: notImplemented('note.reloadFromCRDTLogs'),
    onUpdated: stubEventSubscription,
    onDeleted: stubEventSubscription,
    onRestored: stubEventSubscription,
    onPermanentDeleted: stubEventSubscription,
    onPinned: stubEventSubscription,
    onCreated: stubEventSubscription,
    onExternalUpdate: stubEventSubscription,
    onTitleUpdated: stubEventSubscription,
    onMoved: stubEventSubscription,
  },

  history: {
    getTimeline: notImplemented('history.getTimeline'),
    getStats: notImplemented('history.getStats'),
    reconstructAt: notImplemented('history.reconstructAt'),
    getSessionPreview: notImplemented('history.getSessionPreview'),
  },

  tag: {
    getAll: notImplemented('tag.getAll'),
  },

  link: {
    getBacklinks: notImplemented('link.getBacklinks'),
    searchNotesForAutocomplete: notImplemented('link.searchNotesForAutocomplete'),
  },

  folder: {
    list: notImplemented('folder.list'),
    listAll: notImplemented('folder.listAll'),
    get: notImplemented('folder.get'),
    create: notImplemented('folder.create'),
    rename: notImplemented('folder.rename'),
    delete: notImplemented('folder.delete'),
    move: notImplemented('folder.move'),
    reorder: notImplemented('folder.reorder'),
    onUpdated: stubEventSubscription,
    emitSelected: notImplemented('folder.emitSelected'),
    onSelected: stubEventSubscription,
  },

  sd: {
    list: notImplemented('sd.list'),
    create: notImplemented('sd.create'),
    setActive: notImplemented('sd.setActive'),
    getActive: notImplemented('sd.getActive'),
    delete: notImplemented('sd.delete'),
    selectPath: notImplemented('sd.selectPath'),
    getCloudStoragePaths: notImplemented('sd.getCloudStoragePaths'),
    onOpenSettings: stubEventSubscription,
    onUpdated: stubEventSubscription,
    onInitProgress: stubEventSubscription,
    onInitComplete: stubEventSubscription,
    onInitError: stubEventSubscription,
  },

  sync: {
    openWindow: notImplemented('sync.openWindow'),
    getStatus: notImplemented('sync.getStatus'),
    getStaleSyncs: notImplemented('sync.getStaleSyncs'),
    skipStaleEntry: notImplemented('sync.skipStaleEntry'),
    retryStaleEntry: notImplemented('sync.retryStaleEntry'),
    exportDiagnostics: notImplemented('sync.exportDiagnostics'),
    onProgress: stubEventSubscription,
    onStatusChanged: stubEventSubscription,
    onStaleEntriesChanged: stubEventSubscription,
  },

  appState: {
    get: notImplemented('appState.get'),
    set: notImplemented('appState.set'),
  },

  shutdown: {
    onProgress: stubEventSubscription,
    onComplete: stubEventSubscription,
  },

  config: {
    getDatabasePath: notImplemented('config.getDatabasePath'),
    setDatabasePath: notImplemented('config.setDatabasePath'),
  },

  telemetry: {
    getSettings: notImplemented('telemetry.getSettings'),
    updateSettings: notImplemented('telemetry.updateSettings'),
  },

  recovery: {
    getStaleMoves: notImplemented('recovery.getStaleMoves'),
    takeOverMove: notImplemented('recovery.takeOverMove'),
    cancelMove: notImplemented('recovery.cancelMove'),
  },

  diagnostics: {
    getDuplicateNotes: notImplemented('diagnostics.getDuplicateNotes'),
    getOrphanedCRDTFiles: notImplemented('diagnostics.getOrphanedCRDTFiles'),
    getMissingCRDTFiles: notImplemented('diagnostics.getMissingCRDTFiles'),
    getStaleMigrationLocks: notImplemented('diagnostics.getStaleMigrationLocks'),
    getOrphanedActivityLogs: notImplemented('diagnostics.getOrphanedActivityLogs'),
    removeStaleMigrationLock: notImplemented('diagnostics.removeStaleMigrationLock'),
    cleanupOrphanedActivityLog: notImplemented('diagnostics.cleanupOrphanedActivityLog'),
    importOrphanedCRDT: notImplemented('diagnostics.importOrphanedCRDT'),
    deleteMissingCRDTEntry: notImplemented('diagnostics.deleteMissingCRDTEntry'),
    deleteDuplicateNote: notImplemented('diagnostics.deleteDuplicateNote'),
  },

  backup: {
    createPreOperationSnapshot: notImplemented('backup.createPreOperationSnapshot'),
    createManualBackup: notImplemented('backup.createManualBackup'),
    listBackups: notImplemented('backup.listBackups'),
    restoreFromBackup: notImplemented('backup.restoreFromBackup'),
    restoreFromCustomPath: notImplemented('backup.restoreFromCustomPath'),
    deleteBackup: notImplemented('backup.deleteBackup'),
    cleanupOldSnapshots: notImplemented('backup.cleanupOldSnapshots'),
    setBackupDirectory: notImplemented('backup.setBackupDirectory'),
    getBackupDirectory: notImplemented('backup.getBackupDirectory'),
  },

  menu: {
    onNewNote: stubEventSubscription,
    onNewFolder: stubEventSubscription,
    onFind: stubEventSubscription,
    onFindInNote: stubEventSubscription,
    onToggleDarkMode: stubEventSubscription,
    onToggleFolderPanel: stubEventSubscription,
    onToggleTagsPanel: stubEventSubscription,
    onCreateSnapshot: stubEventSubscription,
    onViewHistory: stubEventSubscription,
    onNoteInfo: stubEventSubscription,
    onAbout: stubEventSubscription,
    onExportSelectedNotes: stubEventSubscription,
    onExportAllNotes: stubEventSubscription,
    onReloadFromCRDTLogs: stubEventSubscription,
    onReindexNotes: stubEventSubscription,
    onSyncStatus: stubEventSubscription,
  },

  tools: {
    reindexNotes: notImplemented('tools.reindexNotes'),
    onReindexProgress: stubEventSubscription,
    onReindexComplete: stubEventSubscription,
    onReindexError: stubEventSubscription,
  },

  export: {
    selectDirectory: notImplemented('export.selectDirectory'),
    writeFile: notImplemented('export.writeFile'),
    createDirectory: notImplemented('export.createDirectory'),
    getNotesForExport: notImplemented('export.getNotesForExport'),
    showCompletionMessage: notImplemented('export.showCompletionMessage'),
  },

  testing: {
    createWindow: notImplemented('testing.createWindow'),
    setNoteTimestamp: notImplemented('testing.setNoteTimestamp'),
  },

  app: {
    getInfo: notImplemented('app.getInfo'),
  },

  webServer: {
    start: notImplemented('webServer.start'),
    stop: notImplemented('webServer.stop'),
    getStatus: notImplemented('webServer.getStatus'),
    getSettings: notImplemented('webServer.getSettings'),
    setSettings: notImplemented('webServer.setSettings'),
    regenerateToken: notImplemented('webServer.regenerateToken'),
    getConnectedClients: notImplemented('webServer.getConnectedClients'),
    disconnectClient: notImplemented('webServer.disconnectClient'),
    disconnectAllClients: notImplemented('webServer.disconnectAllClients'),
    getCertificateInfo: notImplemented('webServer.getCertificateInfo'),
  },

  shell: {
    openExternal: notImplemented('shell.openExternal'),
  },

  clipboard: {
    writeText: notImplemented('clipboard.writeText'),
    readText: notImplemented('clipboard.readText'),
  },

  windowState: {
    reportCurrentNote: notImplemented('windowState.reportCurrentNote'),
    reportEditorState: notImplemented('windowState.reportEditorState'),
    getSavedState: notImplemented('windowState.getSavedState'),
  },
};

/**
 * Initialize the browser stub on window.electronAPI if running in browser context.
 * Call this early in the app bootstrap before any components try to use the API.
 */
export function initBrowserApiStub(): void {
  if (typeof window !== 'undefined' && typeof window.electronAPI === 'undefined') {
    console.log('[Browser] Installing electronAPI stub');
    window.electronAPI = browserApiStub;
  }
}
