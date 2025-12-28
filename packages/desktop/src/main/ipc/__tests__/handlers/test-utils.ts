/**
 * Handler Test Utilities
 *
 * Shared mock factories and test helpers for IPC handler tests.
 *
 * NOTE: jest.mock() calls must remain in individual test files due to Jest hoisting.
 * This file provides mock interfaces, factory functions, and reset helpers.
 */

import type { CRDTManager } from '../../../crdt';
import type { Database, AppendLogManager } from '@notecove/shared';
import type { ConfigManager } from '../../../config/manager';
import type { NoteMoveManager } from '../../../note-move-manager';
import type { DiagnosticsManager } from '../../../diagnostics-manager';
import type { BackupManager } from '../../../backup-manager';

// =============================================================================
// Mock Interface Types
// =============================================================================

export interface MockFolderTreeDoc {
  getActiveFolders: jest.Mock;
  getVisibleFolders: jest.Mock;
  getFolder: jest.Mock;
  getRootFolders: jest.Mock;
  getChildFolders: jest.Mock;
  getSiblings: jest.Mock;
  getDescendants: jest.Mock;
  createFolder: jest.Mock;
  updateFolder: jest.Mock;
  deleteFolder: jest.Mock;
  reorderFolder: jest.Mock;
}

export interface MockNoteDoc {
  getMetadata: jest.Mock;
  getText: jest.Mock;
  getCommentThreads?: jest.Mock;
  setMetadata?: jest.Mock;
  initializeNote?: jest.Mock;
  markDeleted?: jest.Mock;
  markRestored?: jest.Mock;
  updateMetadata?: jest.Mock;
  doc?: any;
  content?: any;
}

export interface MockCRDTManager {
  loadNote: jest.Mock;
  unloadNote: jest.Mock;
  applyUpdate: jest.Mock;
  loadFolderTree: jest.Mock;
  setActivityLogger: jest.Mock;
  recordMoveActivity: jest.Mock;
  deleteDocument: jest.Mock;
  loadDocument: jest.Mock;
  createDocument: jest.Mock;
  getNoteDoc: jest.Mock;
  getDocument: jest.Mock;
  getStaleSyncs?: jest.Mock;
}

export interface MockDatabase {
  upsertFolder: jest.Mock;
  upsertNote: jest.Mock;
  getNote: jest.Mock;
  getNotesBySd: jest.Mock;
  getNotesByFolder: jest.Mock;
  getDeletedNotes: jest.Mock;
  getNoteCountForFolder: jest.Mock;
  getAllNotesCount: jest.Mock;
  getDeletedNoteCount: jest.Mock;
  getAllTags: jest.Mock;
  getBacklinks: jest.Mock;
  getStorageDir: jest.Mock;
  getFolder: jest.Mock;
  getTagsForNote: jest.Mock;
  getLinksFromNote: jest.Mock;
  getState: jest.Mock;
  setState: jest.Mock;
  createStorageDir: jest.Mock;
  getAllStorageDirs: jest.Mock;
  getActiveStorageDir: jest.Mock;
  setActiveStorageDir: jest.Mock;
  searchNotes: jest.Mock;
  deleteNote: jest.Mock;
  deleteStorageDir: jest.Mock;
  getNoteSyncState: jest.Mock;
  renameStorageDir?: jest.Mock;
  updateNote?: jest.Mock;
  autoCleanupDeletedNotes?: jest.Mock;
  upsertImage?: jest.Mock;
  getImage?: jest.Mock;
  deleteImage?: jest.Mock;
  getImagesByNote?: jest.Mock;
  getCommentThread?: jest.Mock;
  upsertCommentThread?: jest.Mock;
  deleteCommentThread?: jest.Mock;
  getCommentThreadsForNote?: jest.Mock;
  getProfilePresenceCache?: jest.Mock;
  adapter: {
    exec: jest.Mock;
  };
}

export interface MockConfigManager {
  getDatabasePath: jest.Mock;
  setDatabasePath: jest.Mock;
  getFeatureFlags: jest.Mock;
  getFeatureFlag: jest.Mock;
  setFeatureFlag: jest.Mock;
  setFeatureFlags: jest.Mock;
}

export interface MockAppendLogManager {
  getNoteVectorClock: jest.Mock;
  writeNoteSnapshot: jest.Mock;
  loadNote: jest.Mock;
}

export interface MockNoteMoveManager {
  initiateMove: jest.Mock;
  executeMove: jest.Mock;
  recoverIncompleteMoves: jest.Mock;
  cleanupOldMoves: jest.Mock;
  getStaleMoves: jest.Mock;
  takeOverMove: jest.Mock;
  cancelMove: jest.Mock;
}

export interface MockDiagnosticsManager {
  detectDuplicateNotes: jest.Mock;
  detectOrphanedCRDTFiles: jest.Mock;
  detectMissingCRDTFiles: jest.Mock;
  detectStaleMigrationLocks: jest.Mock;
  detectOrphanedActivityLogs: jest.Mock;
  removeStaleMigrationLock: jest.Mock;
  cleanupOrphanedActivityLog: jest.Mock;
  importOrphanedCRDT: jest.Mock;
  deleteMissingCRDTEntry: jest.Mock;
  deleteDuplicateNote: jest.Mock;
}

export interface MockBackupManager {
  createPreOperationSnapshot: jest.Mock;
  createManualBackup: jest.Mock;
  listBackups: jest.Mock;
  restoreFromBackup: jest.Mock;
  restoreFromCustomPath: jest.Mock;
  deleteBackup: jest.Mock;
  cleanupOldSnapshots: jest.Mock;
  setBackupDirectory: jest.Mock;
  getBackupDirectory: jest.Mock;
}

// =============================================================================
// Mock Factory Functions
// =============================================================================

/**
 * Create a mock FolderTreeDoc
 */
export function createMockFolderTree(): MockFolderTreeDoc {
  return {
    getActiveFolders: jest.fn(),
    getVisibleFolders: jest.fn(),
    getFolder: jest.fn(),
    getRootFolders: jest.fn(),
    getChildFolders: jest.fn(),
    getSiblings: jest.fn(),
    getDescendants: jest.fn().mockReturnValue([]),
    createFolder: jest.fn(),
    updateFolder: jest.fn(),
    deleteFolder: jest.fn(),
    reorderFolder: jest.fn(),
  };
}

/**
 * Create a mock NoteDoc
 */
export function createMockNoteDoc(overrides?: Partial<MockNoteDoc>): MockNoteDoc {
  // Create a mock XmlFragment for content
  const mockContent = {
    length: 0,
    get: jest.fn(),
    toArray: jest.fn().mockReturnValue([]),
  } as any;

  return {
    getMetadata: jest.fn().mockReturnValue(null),
    getText: jest.fn().mockReturnValue({ toJSON: () => 'Content' }),
    getCommentThreads: jest.fn().mockReturnValue([]),
    setMetadata: jest.fn(),
    doc: {},
    content: mockContent,
    ...overrides,
  };
}

/**
 * Create a mock CRDTManager
 */
export function createMockCRDTManager(mockFolderTree?: MockFolderTreeDoc): MockCRDTManager {
  const folderTree = mockFolderTree ?? createMockFolderTree();

  return {
    loadNote: jest.fn().mockResolvedValue(undefined),
    unloadNote: jest.fn(),
    applyUpdate: jest.fn(),
    loadFolderTree: jest.fn().mockResolvedValue(folderTree),
    setActivityLogger: jest.fn(),
    recordMoveActivity: jest.fn().mockResolvedValue(undefined),
    deleteDocument: jest.fn().mockResolvedValue(undefined),
    loadDocument: jest.fn().mockResolvedValue({}),
    createDocument: jest.fn().mockResolvedValue('new-note-id'),
    getNoteDoc: jest.fn().mockReturnValue(createMockNoteDoc()),
    getDocument: jest.fn().mockReturnValue({ getText: () => ({ toJSON: () => 'Content' }) }),
  };
}

/**
 * Create a mock Database
 */
export function createMockDatabase(): MockDatabase {
  return {
    upsertFolder: jest.fn().mockResolvedValue(undefined),
    upsertNote: jest.fn().mockResolvedValue(undefined),
    getNote: jest.fn(),
    getNotesBySd: jest.fn().mockResolvedValue([]),
    getNotesByFolder: jest.fn().mockResolvedValue([]),
    getDeletedNotes: jest.fn().mockResolvedValue([]),
    getNoteCountForFolder: jest.fn().mockResolvedValue(0),
    getAllNotesCount: jest.fn().mockResolvedValue(0),
    getDeletedNoteCount: jest.fn().mockResolvedValue(0),
    getAllTags: jest.fn().mockResolvedValue([]),
    getBacklinks: jest.fn().mockResolvedValue([]),
    getStorageDir: jest.fn(),
    getFolder: jest.fn(),
    getTagsForNote: jest.fn().mockResolvedValue([]),
    getLinksFromNote: jest.fn().mockResolvedValue([]),
    getState: jest.fn(),
    setState: jest.fn().mockResolvedValue(undefined),
    createStorageDir: jest.fn(),
    getAllStorageDirs: jest.fn().mockResolvedValue([]),
    getActiveStorageDir: jest.fn(),
    setActiveStorageDir: jest.fn(),
    searchNotes: jest.fn().mockResolvedValue([]),
    deleteNote: jest.fn().mockResolvedValue(undefined),
    deleteStorageDir: jest.fn().mockResolvedValue(undefined),
    getNoteSyncState: jest.fn().mockResolvedValue(null),
    renameStorageDir: jest.fn().mockResolvedValue(undefined),
    updateNote: jest.fn().mockResolvedValue(undefined),
    autoCleanupDeletedNotes: jest.fn().mockResolvedValue([]),
    upsertImage: jest.fn().mockResolvedValue(undefined),
    getImage: jest.fn(),
    deleteImage: jest.fn().mockResolvedValue(undefined),
    getImagesByNote: jest.fn().mockResolvedValue([]),
    getCommentThread: jest.fn(),
    upsertCommentThread: jest.fn().mockResolvedValue(undefined),
    deleteCommentThread: jest.fn().mockResolvedValue(undefined),
    getCommentThreadsForNote: jest.fn().mockResolvedValue([]),
    getProfilePresenceCache: jest.fn().mockResolvedValue([]),
    adapter: {
      exec: jest.fn().mockResolvedValue(undefined),
    },
  };
}

/**
 * Create a mock ConfigManager
 */
export function createMockConfigManager(): MockConfigManager {
  return {
    getDatabasePath: jest.fn().mockResolvedValue('/test/path/notecove.db'),
    setDatabasePath: jest.fn().mockResolvedValue(undefined),
    getFeatureFlags: jest.fn().mockResolvedValue({
      telemetry: false,
      viewHistory: false,
      webServer: false,
    }),
    getFeatureFlag: jest.fn().mockResolvedValue(false),
    setFeatureFlag: jest.fn().mockResolvedValue(undefined),
    setFeatureFlags: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock AppendLogManager
 */
export function createMockAppendLogManager(): MockAppendLogManager {
  return {
    getNoteVectorClock: jest.fn(),
    writeNoteSnapshot: jest.fn(),
    loadNote: jest.fn(),
  };
}

/**
 * Create a mock NoteMoveManager
 */
export function createMockNoteMoveManager(): MockNoteMoveManager {
  return {
    initiateMove: jest.fn(),
    executeMove: jest.fn(),
    recoverIncompleteMoves: jest.fn(),
    cleanupOldMoves: jest.fn(),
    getStaleMoves: jest.fn().mockResolvedValue([]),
    takeOverMove: jest.fn(),
    cancelMove: jest.fn(),
  };
}

/**
 * Create a mock DiagnosticsManager
 */
export function createMockDiagnosticsManager(): MockDiagnosticsManager {
  return {
    detectDuplicateNotes: jest.fn().mockResolvedValue([]),
    detectOrphanedCRDTFiles: jest.fn().mockResolvedValue([]),
    detectMissingCRDTFiles: jest.fn().mockResolvedValue([]),
    detectStaleMigrationLocks: jest.fn().mockResolvedValue([]),
    detectOrphanedActivityLogs: jest.fn().mockResolvedValue([]),
    removeStaleMigrationLock: jest.fn().mockResolvedValue({ success: true }),
    cleanupOrphanedActivityLog: jest.fn().mockResolvedValue({ success: true }),
    importOrphanedCRDT: jest.fn().mockResolvedValue({ success: true }),
    deleteMissingCRDTEntry: jest.fn().mockResolvedValue({ success: true }),
    deleteDuplicateNote: jest.fn().mockResolvedValue({ success: true }),
  };
}

/**
 * Create a mock BackupManager
 */
export function createMockBackupManager(): MockBackupManager {
  return {
    createPreOperationSnapshot: jest.fn().mockResolvedValue({ success: true }),
    createManualBackup: jest.fn().mockResolvedValue({ success: true }),
    listBackups: jest.fn().mockResolvedValue([]),
    restoreFromBackup: jest.fn().mockResolvedValue({ success: true }),
    restoreFromCustomPath: jest.fn().mockResolvedValue({ success: true }),
    deleteBackup: jest.fn().mockResolvedValue({ success: true }),
    cleanupOldSnapshots: jest.fn().mockResolvedValue({ removed: 0 }),
    setBackupDirectory: jest.fn().mockResolvedValue(undefined),
    getBackupDirectory: jest.fn().mockResolvedValue('/test/backups'),
  };
}

// =============================================================================
// All Mocks Factory
// =============================================================================

export interface AllMocks {
  folderTree: MockFolderTreeDoc;
  crdtManager: MockCRDTManager;
  database: MockDatabase;
  configManager: MockConfigManager;
  appendLogManager: MockAppendLogManager;
  noteMoveManager: MockNoteMoveManager;
  diagnosticsManager: MockDiagnosticsManager;
  backupManager: MockBackupManager;
}

/**
 * Create all mocks at once for convenience
 */
export function createAllMocks(): AllMocks {
  const folderTree = createMockFolderTree();
  const crdtManager = createMockCRDTManager(folderTree);
  const database = createMockDatabase();
  const configManager = createMockConfigManager();
  const appendLogManager = createMockAppendLogManager();
  const noteMoveManager = createMockNoteMoveManager();
  const diagnosticsManager = createMockDiagnosticsManager();
  const backupManager = createMockBackupManager();

  return {
    folderTree,
    crdtManager,
    database,
    configManager,
    appendLogManager,
    noteMoveManager,
    diagnosticsManager,
    backupManager,
  };
}

// =============================================================================
// Type Casting Helpers
// =============================================================================

/**
 * Cast mocks to their real types for handler instantiation
 */
export function castMocksToReal(mocks: AllMocks): {
  crdtManager: CRDTManager;
  database: Database;
  configManager: ConfigManager;
  appendLogManager: AppendLogManager;
  noteMoveManager: NoteMoveManager;
  diagnosticsManager: DiagnosticsManager;
  backupManager: BackupManager;
} {
  return {
    crdtManager: mocks.crdtManager as unknown as CRDTManager,
    database: mocks.database as unknown as Database,
    configManager: mocks.configManager as unknown as ConfigManager,
    appendLogManager: mocks.appendLogManager as unknown as AppendLogManager,
    noteMoveManager: mocks.noteMoveManager as unknown as NoteMoveManager,
    diagnosticsManager: mocks.diagnosticsManager as unknown as DiagnosticsManager,
    backupManager: mocks.backupManager as unknown as BackupManager,
  };
}

// =============================================================================
// Test Event Helpers
// =============================================================================

/**
 * Create a mock IpcMainInvokeEvent
 */
export function createMockEvent(windowId = 1): any {
  return {
    sender: {
      id: windowId,
      send: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
    },
    frameId: 1,
    processId: 1,
  };
}

// =============================================================================
// IPC Handler Registry for Testing
// =============================================================================

/**
 * Registry that captures handlers registered via ipcMain.handle()
 * This allows tests to invoke handlers by channel name instead of calling
 * private methods on the IPCHandlers class.
 */
const handlerRegistry = new Map<string, (...args: unknown[]) => unknown>();

/**
 * Get the handler registry (for direct access if needed)
 */
export function getHandlerRegistry(): Map<string, (...args: unknown[]) => unknown> {
  return handlerRegistry;
}

/**
 * Clear all registered handlers (call in afterEach)
 */
export function clearHandlerRegistry(): void {
  handlerRegistry.clear();
}

/**
 * Invoke a registered handler by channel name
 * @param channel The IPC channel name (e.g., 'sd:list', 'folder:create')
 * @param args Arguments to pass to the handler (first arg is always the event)
 * @returns The handler's return value
 * @throws Error if handler is not registered
 */
export async function invokeHandler<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const handler = handlerRegistry.get(channel);
  if (!handler) {
    throw new Error(
      `Handler for channel "${channel}" not registered. ` +
        `Available channels: ${Array.from(handlerRegistry.keys()).join(', ')}`
    );
  }
  return (await handler(...args)) as T;
}

/**
 * Check if a handler is registered for a channel
 */
export function hasHandler(channel: string): boolean {
  return handlerRegistry.has(channel);
}

/**
 * Get all registered channel names
 */
export function getRegisteredChannels(): string[] {
  return Array.from(handlerRegistry.keys());
}

/**
 * Create a mock ipcMain that captures handler registrations.
 * Call this to get the mock object for jest.mock('electron', ...).
 *
 * Usage in test file:
 * ```
 * jest.mock('electron', () => ({
 *   ipcMain: createMockIpcMain(),
 *   BrowserWindow: { getAllWindows: jest.fn(() => []) },
 *   app: { getPath: jest.fn(() => '/mock/path') },
 * }));
 * ```
 */
export function createMockIpcMain(): {
  handle: jest.Mock;
  removeHandler: jest.Mock;
} {
  return {
    handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlerRegistry.set(channel, handler);
    }),
    removeHandler: jest.fn((channel: string) => {
      handlerRegistry.delete(channel);
    }),
  };
}

// =============================================================================
// Reset Helpers
// =============================================================================

/**
 * UUID counter for deterministic IDs in tests
 */
let uuidCounter = 0;

/**
 * Reset the UUID counter (call in beforeEach)
 */
export function resetUuidCounter(): void {
  uuidCounter = 0;
}

/**
 * Get the current UUID counter value
 */
export function getUuidCounter(): number {
  return uuidCounter;
}

/**
 * Increment and return a deterministic UUID (full 36-char format)
 */
export function nextUuid(): string {
  uuidCounter++;
  return `${uuidCounter.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
}

/**
 * Increment and return a deterministic compact ID (22-char base64url format)
 * Uses a predictable pattern for testing
 */
export function nextCompactId(): string {
  uuidCounter++;
  // Pad with 'A' to get 22 chars, prefix with counter
  const base = uuidCounter.toString(36).toUpperCase();
  return base.padStart(22, 'A');
}
