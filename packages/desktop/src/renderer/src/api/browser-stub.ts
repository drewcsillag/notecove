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
    emptyTrash: notImplemented('note.emptyTrash'),
    createSnapshot: notImplemented('note.createSnapshot'),
    checkExistsInSD: notImplemented('note.checkExistsInSD'),
    getInfo: notImplemented('note.getInfo'),
    reloadFromCRDTLogs: notImplemented('note.reloadFromCRDTLogs'),
    getSyncEvents: notImplemented('note.getSyncEvents'),
    onUpdated: stubEventSubscription,
    onDeleted: stubEventSubscription,
    onRestored: stubEventSubscription,
    onPermanentDeleted: stubEventSubscription,
    onPinned: stubEventSubscription,
    onCreated: stubEventSubscription,
    onExternalUpdate: stubEventSubscription,
    onTitleUpdated: stubEventSubscription,
    onMoved: stubEventSubscription,
    onModifiedUpdated: stubEventSubscription,
    onSyncEvent: stubEventSubscription,
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
    getHeadingsForNote: notImplemented('link.getHeadingsForNote'),
  },

  folder: {
    list: notImplemented('folder.list'),
    listAll: notImplemented('folder.listAll'),
    get: notImplemented('folder.get'),
    getChildInfo: notImplemented('folder.getChildInfo'),
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
    rename: notImplemented('sd.rename'),
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
    exportDiagnostics: notImplemented('sync.exportDiagnostics'),
    onProgress: stubEventSubscription,
    onStatusChanged: stubEventSubscription,
    getActiveSyncs: notImplemented('sync.getActiveSyncs'),
    onActiveSyncsChanged: stubEventSubscription,
  },

  polling: {
    getSettings: notImplemented('polling.getSettings'),
    setSettings: notImplemented('polling.setSettings'),
    getSettingsForSd: notImplemented('polling.getSettingsForSd'),
    setSettingsForSd: notImplemented('polling.setSettingsForSd'),
    getGroupStatus: notImplemented('polling.getGroupStatus'),
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
    onToggleNotesListPanel: stubEventSubscription,
    onCreateSnapshot: stubEventSubscription,
    onViewHistory: stubEventSubscription,
    onNoteInfo: stubEventSubscription,
    onExportSelectedNotes: stubEventSubscription,
    onExportAllNotes: stubEventSubscription,
    onImportMarkdown: stubEventSubscription,
    onReloadFromCRDTLogs: stubEventSubscription,
    onReindexNotes: stubEventSubscription,
    onStorageInspector: stubEventSubscription,
    onFeatureFlags: stubEventSubscription,
    onPrint: stubEventSubscription,
    onViewNoteJSON: stubEventSubscription,
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
    copyImageFile: notImplemented('export.copyImageFile'),
  },

  import: {
    selectSource: notImplemented('import.selectSource'),
    scanSource: notImplemented('import.scanSource'),
    execute: notImplemented('import.execute'),
    cancel: notImplemented('import.cancel'),
    onProgress: stubEventSubscription,
  },

  testing: {
    createWindow: notImplemented('testing.createWindow'),
    setNoteTimestamp: notImplemented('testing.setNoteTimestamp'),
    getAllTags: notImplemented('testing.getAllTags'),
    getTagsForNote: notImplemented('testing.getTagsForNote'),
    getNoteById: notImplemented('testing.getNoteById'),
    onFileWatcherEvent: stubEventSubscription,
    onGracePeriodEnded: stubEventSubscription,
    onActivitySyncComplete: stubEventSubscription,
    onActivityWatcherDebug: stubEventSubscription,
    onInitialSyncComplete: stubEventSubscription,
    onAllInitialSyncsComplete: stubEventSubscription,
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
    writeRich: notImplemented('clipboard.writeRich'),
  },

  windowState: {
    reportCurrentNote: notImplemented('windowState.reportCurrentNote'),
    reportEditorState: notImplemented('windowState.reportEditorState'),
    reportPanelLayout: notImplemented('windowState.reportPanelLayout'),
    getSavedState: notImplemented('windowState.getSavedState'),
    reportVisibleNotes: notImplemented('windowState.reportVisibleNotes'),
  },

  window: {
    openNoteInfo: notImplemented('window.openNoteInfo'),
    openStorageInspector: notImplemented('window.openStorageInspector'),
    openPrintPreview: notImplemented('window.openPrintPreview'),
    openJSONViewer: notImplemented('window.openJSONViewer'),
  },

  image: {
    save: notImplemented('image.save'),
    getDataUrl: notImplemented('image.getDataUrl'),
    getPath: notImplemented('image.getPath'),
    delete: notImplemented('image.delete'),
    exists: notImplemented('image.exists'),
    getMetadata: notImplemented('image.getMetadata'),
    list: notImplemented('image.list'),
    getStorageStats: notImplemented('image.getStorageStats'),
    pickAndSave: notImplemented('image.pickAndSave'),
    downloadAndSave: notImplemented('image.downloadAndSave'),
    copyToClipboard: notImplemented('image.copyToClipboard'),
    saveAs: notImplemented('image.saveAs'),
    openExternal: notImplemented('image.openExternal'),
    copyToSD: notImplemented('image.copyToSD'),
    onAvailable: () => () => {
      /* No-op in browser mode */
    },
  },

  thumbnail: {
    get: notImplemented('thumbnail.get'),
    getDataUrl: notImplemented('thumbnail.getDataUrl'),
    exists: notImplemented('thumbnail.exists'),
    delete: notImplemented('thumbnail.delete'),
    generate: notImplemented('thumbnail.generate'),
  },

  inspector: {
    listSDContents: notImplemented('inspector.listSDContents'),
    readFileInfo: notImplemented('inspector.readFileInfo'),
    parseFile: notImplemented('inspector.parseFile'),
  },

  comment: {
    getThreads: notImplemented('comment.getThreads'),
    addThread: notImplemented('comment.addThread'),
    updateThread: notImplemented('comment.updateThread'),
    deleteThread: notImplemented('comment.deleteThread'),
    addReply: notImplemented('comment.addReply'),
    getReplies: notImplemented('comment.getReplies'),
    updateReply: notImplemented('comment.updateReply'),
    deleteReply: notImplemented('comment.deleteReply'),
    getReactions: notImplemented('comment.getReactions'),
    addReaction: notImplemented('comment.addReaction'),
    removeReaction: notImplemented('comment.removeReaction'),
    onThreadAdded: stubEventSubscription,
    onThreadUpdated: stubEventSubscription,
    onThreadDeleted: stubEventSubscription,
    onReplyAdded: stubEventSubscription,
    onReplyUpdated: stubEventSubscription,
    onReplyDeleted: stubEventSubscription,
    onReactionAdded: stubEventSubscription,
    onReactionRemoved: stubEventSubscription,
  },

  mention: {
    getUsers: notImplemented('mention.getUsers'),
  },

  user: {
    getCurrentProfile: notImplemented('user.getCurrentProfile'),
    getProfileMode: () => Promise.resolve('local' as const),
    onProfileChanged: stubEventSubscription,
  },

  theme: {
    set: notImplemented('theme.set'),
    onChanged: stubEventSubscription,
  },

  checkboxSettings: {
    onChanged: stubEventSubscription,
  },

  featureFlags: {
    getAll: notImplemented('featureFlags.getAll'),
    get: notImplemented('featureFlags.get'),
    set: notImplemented('featureFlags.set'),
    onChange: stubEventSubscription,
  },

  oembed: {
    unfurl: notImplemented('oembed.unfurl'),
    refresh: notImplemented('oembed.refresh'),
    clearCache: notImplemented('oembed.clearCache'),
    getCacheStats: notImplemented('oembed.getCacheStats'),
    getFavicon: notImplemented('oembed.getFavicon'),
    debug: {
      listFavicons: notImplemented('oembed.debug.listFavicons'),
      listThumbnails: notImplemented('oembed.debug.listThumbnails'),
      listFetchCache: notImplemented('oembed.debug.listFetchCache'),
      deleteFavicon: notImplemented('oembed.debug.deleteFavicon'),
      deleteThumbnail: notImplemented('oembed.debug.deleteThumbnail'),
      clearAllFavicons: notImplemented('oembed.debug.clearAllFavicons'),
      clearAllThumbnails: notImplemented('oembed.debug.clearAllThumbnails'),
    },
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
