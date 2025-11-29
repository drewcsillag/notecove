/**
 * Electron Main Process
 */

import { app, BrowserWindow, Menu, shell, ipcMain, powerMonitor } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { BetterSqliteAdapter, SqliteDatabase } from './database';
import type { Database } from '@notecove/shared';
import {
  AppendLogManager,
  SyncDirectoryStructure,
  ActivityLogger,
  ActivitySync,
  type ActivitySyncCallbacks,
  DeletionLogger,
  DeletionSync,
  type DeletionSyncCallbacks,
  extractTitleFromDoc,
  extractTags,
  SDMarker,
  type SDType,
} from '@notecove/shared';
import { IPCHandlers } from './ipc/handlers';
import { CRDTManagerImpl, type CRDTManager } from './crdt';
import { NodeFileSystemAdapter } from './storage/node-fs-adapter';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { NodeFileWatcher } from './storage/node-file-watcher';
import { randomUUID } from 'crypto';
import * as Y from 'yjs';
import { ConfigManager } from './config/manager';
import { initializeTelemetry } from './telemetry/config';
import { getSyncMetrics } from './telemetry/sync-metrics';
import { NoteMoveManager } from './note-move-manager';
import { DiagnosticsManager } from './diagnostics-manager';
import { BackupManager } from './backup-manager';
import { showProfilePicker, getProfileStorage } from './profile-picker';
import { parseCliArgs } from './cli/cli-parser';

let mainWindow: BrowserWindow | null = null;
let database: Database | null = null;
let configManager: ConfigManager | null = null;
let selectedProfileId: string | null = null;
let selectedProfileName: string | null = null;
let ipcHandlers: IPCHandlers | null = null;
let compactionInterval: NodeJS.Timeout | null = null;
let storageManager: AppendLogManager | null = null;
let crdtManager: CRDTManager | null = null;
let noteMoveManager: NoteMoveManager | null = null;
let diagnosticsManager: DiagnosticsManager | null = null;
let backupManager: BackupManager | null = null;
let sdMarker: SDMarker | null = null;
const allWindows: BrowserWindow[] = [];

// Multi-SD support: Store watchers and activity syncs per SD
const sdFileWatchers = new Map<string, NodeFileWatcher>();
const sdActivityWatchers = new Map<string, NodeFileWatcher>();
const sdActivitySyncs = new Map<string, ActivitySync>();
const sdActivityLoggers = new Map<string, ActivityLogger>();
const sdActivityPollIntervals = new Map<string, NodeJS.Timeout>();

// Deletion sync support: track permanent deletions across instances
const sdDeletionLoggers = new Map<string, DeletionLogger>();
const sdDeletionSyncs = new Map<string, DeletionSync>();
const sdDeletionWatchers = new Map<string, NodeFileWatcher>();
const sdDeletionPollIntervals = new Map<string, NodeJS.Timeout>();

/**
 * Reindex tags for a set of notes after external sync
 */
async function reindexTagsForNotes(
  noteIds: Set<string>,
  crdtManager: CRDTManager,
  database: Database
): Promise<void> {
  if (noteIds.size === 0) {
    return;
  }

  console.log(`[TagSync] Reindexing tags for ${noteIds.size} notes after external sync`);

  for (const noteId of noteIds) {
    try {
      // Get the note from database to verify it exists
      const note = await database.getNote(noteId);
      if (!note || note.deleted) {
        console.log(`[TagSync] Skipping deleted or non-existent note: ${noteId}`);
        continue;
      }

      // Get the CRDT document
      const doc = crdtManager.getDocument(noteId);
      if (!doc) {
        console.warn(`[TagSync] No CRDT document found for note ${noteId}`);
        continue;
      }

      // Extract plain text from the document
      const content = doc.getXmlFragment('content');
      let contentText = '';

      // Simple text extraction from Y.XmlFragment
      content.forEach((item) => {
        if (item instanceof Y.XmlText) {
          contentText += String(item.toString()) + '\n';
        } else if (item instanceof Y.XmlElement) {
          // Recursively extract text from elements
          const extractText = (elem: Y.XmlElement): string => {
            let text = '';
            elem.forEach((child) => {
              if (child instanceof Y.XmlText) {
                text += String(child.toString());
              } else if (child instanceof Y.XmlElement) {
                text += extractText(child);
              }
            });
            return text;
          };
          contentText += extractText(item) + '\n';
        }
      });

      // Extract and update tags
      const tags = extractTags(contentText);
      console.log(`[TagSync] Found ${tags.length} tags in note ${noteId}: ${tags.join(', ')}`);

      // Get existing tags for this note
      const existingTags = await database.getTagsForNote(noteId);
      const existingTagsMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));

      // Build a set of new tag names for O(1) lookup
      const newTagNames = new Set(tags);

      // Determine which tags to remove
      const tagsToRemove = existingTags.filter((tag) => !newTagNames.has(tag.name.toLowerCase()));

      // Determine which tags to add
      const tagsToAdd = tags.filter((tagName) => !existingTagsMap.has(tagName));

      // Process removals
      for (const tag of tagsToRemove) {
        console.log(`[TagSync] Removing tag ${tag.name} from note ${noteId}`);
        await database.removeTagFromNote(noteId, tag.id);
      }

      // Process additions
      for (const tagName of tagsToAdd) {
        let tag = await database.getTagByName(tagName);
        if (!tag) {
          console.log(`[TagSync] Creating new tag: ${tagName}`);
          tag = await database.createTag(tagName);
        }
        console.log(`[TagSync] Adding tag ${tag.name} to note ${noteId}`);
        await database.addTagToNote(noteId, tag.id);
      }
    } catch (err) {
      console.error(`[TagSync] Failed to reindex tags for note ${noteId}:`, err);
      // Continue with other notes even if one fails
    }
  }

  console.log(`[TagSync] Completed tag reindexing for ${noteIds.size} notes`);
}

/**
 * Get the window title based on current profile
 */
function getWindowTitle(): string {
  const isDevBuild = !app.isPackaged;
  const devPrefix = isDevBuild ? '[DEV] ' : '';
  const profileSuffix = selectedProfileName ? ` - ${selectedProfileName}` : '';
  return `${devPrefix}NoteCove${profileSuffix}`;
}

function createWindow(options?: { noteId?: string; minimal?: boolean }): void {
  // Create the browser window
  const newWindow = new BrowserWindow({
    width: options?.minimal ? 800 : 1200,
    height: 800,
    show: false,
    autoHideMenuBar: false,
    title: getWindowTitle(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  newWindow.on('ready-to-show', () => {
    // Don't show window in test mode (headless E2E tests)
    if (process.env['NODE_ENV'] !== 'test') {
      newWindow.show();
    }
  });

  newWindow.on('closed', () => {
    const index = allWindows.indexOf(newWindow);
    if (index > -1) {
      allWindows.splice(index, 1);
    }
    // Only set mainWindow to null if this was the main window
    if (mainWindow === newWindow) {
      mainWindow = null;
    }
  });

  // Track window
  allWindows.push(newWindow);

  // If this is the first window, set it as main
  mainWindow ??= newWindow;

  // Build URL with parameters
  let url: string;
  const params = new URLSearchParams();
  if (options?.noteId) {
    params.set('noteId', options.noteId);
  }
  if (options?.minimal) {
    params.set('minimal', 'true');
  }

  const queryString = params.toString();
  const hash = queryString ? `?${queryString}` : '';

  // Load the renderer
  // In test mode, always use the built files, not the dev server
  if (process.env['NODE_ENV'] === 'test' || !is.dev || !process.env['ELECTRON_RENDERER_URL']) {
    url = join(__dirname, '../renderer/index.html') + hash;
    void newWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: queryString });
  } else {
    url = process.env['ELECTRON_RENDERER_URL'] + hash;
    void newWindow.loadURL(url);
  }
}

/**
 * Initialize database
 *
 * @param profileId - Optional profile ID for profile-specific database path
 */
async function initializeDatabase(profileId?: string): Promise<Database> {
  // Initialize config manager if not already done
  if (!configManager) {
    const configPath = process.env['TEST_CONFIG_PATH'] ?? undefined;
    configManager = new ConfigManager(configPath);
  }

  // Determine database path:
  // 1. Use TEST_DB_PATH if in test mode
  // 2. If profileId provided, use profile-specific database path
  // 3. Otherwise use custom path from config if set
  // 4. Fall back to default userData/notecove.db
  let dbPath: string;
  if (process.env['TEST_DB_PATH']) {
    dbPath = process.env['TEST_DB_PATH'];
  } else if (profileId) {
    // Use profile-specific database path
    const appDataDir = app.getPath('userData');
    const profileStorage = getProfileStorage(appDataDir);
    dbPath = profileStorage.getProfileDatabasePath(profileId);
    // Ensure profile directory exists
    await profileStorage.ensureProfileDataDir(profileId);
    console.log(`[Profile] Using profile database: ${dbPath}`);
  } else {
    dbPath = await configManager.getDatabasePath();
  }

  if (process.env['NODE_ENV'] === 'test') {
    console.log(`[TEST MODE] Initializing database at: ${dbPath}`);
  }

  const adapter = new BetterSqliteAdapter(dbPath);
  const db = new SqliteDatabase(adapter);
  await db.initialize();

  if (process.env['NODE_ENV'] === 'test') {
    console.log('[TEST MODE] Database initialized successfully');
  }

  return db;
}

/**
 * Check if there are activity logs from other instances in the SD
 * This indicates content may be syncing from another machine
 * @param sdPath Path to the storage directory
 * @param instanceId Our instance ID (to exclude our own log)
 * @returns Array of other instance IDs that have activity logs
 */
async function getOtherInstanceActivityLogs(sdPath: string, instanceId: string): Promise<string[]> {
  const activityDir = join(sdPath, 'activity');
  try {
    const files = await fs.readdir(activityDir);
    return files
      .filter((f) => f.endsWith('.log') && f !== `${instanceId}.log`)
      .map((f) => f.replace('.log', ''));
  } catch {
    // Activity directory might not exist yet
    return [];
  }
}

/**
 * Check if there are CRDT log files from other instances in a note's logs directory
 * This indicates content from another machine has synced
 * @param logsPath Path to the note's logs directory
 * @param instanceId Our instance ID (to exclude our own logs)
 * @returns Array of other instance IDs that have CRDT log files
 */
async function getOtherInstanceCRDTLogs(logsPath: string, instanceId: string): Promise<string[]> {
  try {
    const files = await fs.readdir(logsPath);
    const otherInstances = new Set<string>();
    for (const file of files) {
      if (file.endsWith('.crdtlog')) {
        // File format: {instanceId}_{timestamp}.crdtlog
        const parts = file.replace('.crdtlog', '').split('_');
        if (parts.length >= 2) {
          const fileInstanceId = parts.slice(0, -1).join('_'); // Handle instance IDs with underscores
          if (fileInstanceId !== instanceId) {
            otherInstances.add(fileInstanceId);
          }
        }
      }
    }
    return Array.from(otherInstances);
  } catch {
    // Logs directory might not exist yet
    return [];
  }
}

/**
 * Ensure a default note exists for the user
 * @param db Database instance
 * @param crdtMgr CRDT manager instance
 * @param defaultStoragePath Path to use for the default storage directory (e.g., from TEST_STORAGE_DIR in tests)
 * @param instanceId Our instance ID (to avoid checking our own activity logs)
 */
async function ensureDefaultNote(
  db: Database,
  crdtMgr: CRDTManager,
  defaultStoragePath?: string,
  instanceId?: string
): Promise<void> {
  const DEFAULT_NOTE_ID = 'default-note';

  // Ensure default SD exists
  let DEFAULT_SD_ID: string;
  const existingSDs = await db.getAllStorageDirs();
  if (existingSDs.length === 0) {
    // Create default SD - use provided path or fallback to Documents folder
    const defaultPath = defaultStoragePath ?? join(app.getPath('documents'), 'NoteCove');
    DEFAULT_SD_ID = 'default';
    await db.createStorageDir(DEFAULT_SD_ID, 'Default', defaultPath);
    console.log('[Main] Created default SD at:', defaultPath);
  } else {
    // Use the active SD or the first one
    const activeSD = await db.getActiveStorageDir();
    DEFAULT_SD_ID = activeSD ? activeSD.id : (existingSDs[0]?.id ?? 'default');
    console.log('[Main] Using existing SD:', DEFAULT_SD_ID);
  }

  // Check if the default note exists in ANY SD (not just the default SD)
  // This is important because the note might have been moved to another SD
  const defaultNoteInAnySD = await db.getNote(DEFAULT_NOTE_ID);

  if (defaultNoteInAnySD) {
    // Default note exists somewhere, use it
    console.log(
      '[ensureDefaultNote] Found default note in SD:',
      defaultNoteInAnySD.sdId,
      '(might have been moved)'
    );

    // Load the note from CRDT to sync metadata (handles folder moves from other instances)
    await crdtMgr.loadNote(DEFAULT_NOTE_ID, defaultNoteInAnySD.sdId);
    const noteDoc = crdtMgr.getNoteDoc(DEFAULT_NOTE_ID);
    if (noteDoc) {
      const crdtMetadata = noteDoc.getMetadata();
      // Defensive fallbacks are handled in getMetadata() itself
      const folderId = crdtMetadata.folderId;
      const deleted = crdtMetadata.deleted;
      const modified = crdtMetadata.modified;
      if (folderId !== defaultNoteInAnySD.folderId || deleted !== defaultNoteInAnySD.deleted) {
        console.log('[ensureDefaultNote] Syncing CRDT metadata to database:', {
          folderId,
          deleted,
        });
        await db.upsertNote({
          ...defaultNoteInAnySD,
          folderId,
          deleted,
          modified,
        });
      }
    }

    await db.setState('selectedNoteId', DEFAULT_NOTE_ID);
    return;
  }

  // Check if other notes exist in the default SD
  const existingNotes = await db.getNotesBySd(DEFAULT_SD_ID);
  const defaultNote = existingNotes.find((note) => note.id === DEFAULT_NOTE_ID);

  if (defaultNote) {
    // Default note exists, check if it has content
    console.log('[ensureDefaultNote] Found default note, checking content');
    await crdtMgr.loadNote(DEFAULT_NOTE_ID, DEFAULT_SD_ID);
    const doc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
    if (doc) {
      const content = doc.getXmlFragment('content');
      if (content.length === 0) {
        // No content, add the welcome message
        console.log('[ensureDefaultNote] Default note is empty, adding content');
        const paragraph = new Y.XmlElement('paragraph');
        const text = new Y.XmlText();
        text.insert(
          0,
          'Welcome to NoteCove! Open multiple windows to see real-time collaboration in action.'
        );
        paragraph.insert(0, [text]);
        content.insert(0, [paragraph]);
      }

      // Sync CRDT metadata to database (handles folder moves from other instances)
      const noteDoc = crdtMgr.getNoteDoc(DEFAULT_NOTE_ID);
      if (noteDoc) {
        const crdtMetadata = noteDoc.getMetadata();
        // Defensive fallbacks are handled in getMetadata() itself
        const folderId = crdtMetadata.folderId;
        const deleted = crdtMetadata.deleted;
        const modified = crdtMetadata.modified;
        if (folderId !== defaultNote.folderId || deleted !== defaultNote.deleted) {
          console.log('[ensureDefaultNote] Syncing CRDT metadata to database:', {
            folderId,
            deleted,
          });
          await db.upsertNote({
            ...defaultNote,
            folderId,
            deleted,
            modified,
          });
        }
      }
    }
    await db.setState('selectedNoteId', DEFAULT_NOTE_ID);
    return;
  }

  // Check if user has permanently deleted the default note
  const defaultNoteDeleted = await db.getState('defaultNoteDeleted');
  if (defaultNoteDeleted === 'true') {
    console.log('[ensureDefaultNote] Default note was permanently deleted by user, not recreating');
    // If other notes exist, select the first one
    if (existingNotes.length > 0) {
      const firstNote = existingNotes[0];
      if (firstNote) {
        console.log('[ensureDefaultNote] Selecting first available note:', firstNote.id);
        await db.setState('selectedNoteId', firstNote.id);
      }
    }
    return;
  }

  // Check if any other notes exist
  if (existingNotes.length > 0) {
    // Other notes exist, select the first one
    const firstNote = existingNotes[0];
    if (firstNote) {
      console.log(
        '[ensureDefaultNote] Found existing note:',
        firstNote.id,
        'title:',
        firstNote.title
      );
      await db.setState('selectedNoteId', firstNote.id);
    }
    return;
  }

  console.log('[ensureDefaultNote] No existing notes in database, loading from CRDT');

  // Get the SD path to check for activity logs from other instances
  const sdRecord = await db.getStorageDir(DEFAULT_SD_ID);
  const sdPath = sdRecord?.path ?? defaultStoragePath;

  // No notes exist in database, but CRDT files might exist
  // Load the note to check if it already has content from sync directory
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await crdtMgr.loadNote(DEFAULT_NOTE_ID, DEFAULT_SD_ID);

  // Get the document to check/insert initial content
  const doc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
  if (doc) {
    // Check if content already exists (from sync directory)
    const content = doc.getXmlFragment('content');
    if (content.length === 0) {
      // Check if there are activity logs OR CRDT logs from other instances
      // If so, wait for content to sync before creating welcome content
      const noteLogsPath = join(sdPath ?? '', 'notes', DEFAULT_NOTE_ID, 'logs');
      const otherActivityInstances =
        sdPath && instanceId ? await getOtherInstanceActivityLogs(sdPath, instanceId) : [];
      const otherCRDTInstances =
        sdPath && instanceId ? await getOtherInstanceCRDTLogs(noteLogsPath, instanceId) : [];

      // Combine both sources of other instance detection
      const allOtherInstances = [...new Set([...otherActivityInstances, ...otherCRDTInstances])];

      if (allOtherInstances.length > 0) {
        console.log(
          `[ensureDefaultNote] Found ${allOtherInstances.length} other instance(s): ${allOtherInstances.join(', ')}`
        );
        console.log(
          `[ensureDefaultNote]   Activity logs: ${otherActivityInstances.length}, CRDT logs: ${otherCRDTInstances.length}`
        );
        console.log('[ensureDefaultNote] Waiting for content to sync from other instances...');

        // Poll for content to arrive (max 10 seconds in 500ms intervals)
        const maxWaitMs = 10000;
        const pollIntervalMs = 500;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
          // Reload the note to check for new content
          await crdtMgr.loadNote(DEFAULT_NOTE_ID, DEFAULT_SD_ID);
          const reloadedDoc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
          if (reloadedDoc) {
            const reloadedContent = reloadedDoc.getXmlFragment('content');
            if (reloadedContent.length > 0) {
              console.log(
                '[ensureDefaultNote] Content arrived from another instance, skipping welcome content creation'
              );
              break;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        // Check one more time after waiting
        const finalDoc = crdtMgr.getDocument(DEFAULT_NOTE_ID);
        if (finalDoc) {
          const finalContent = finalDoc.getXmlFragment('content');
          if (finalContent.length > 0) {
            console.log('[ensureDefaultNote] Content found after waiting, using synced content');
          } else {
            console.log(
              '[ensureDefaultNote] Timeout waiting for content from other instances, creating welcome content'
            );
            // Create welcome content since nothing arrived
            const paragraph = new Y.XmlElement('paragraph');
            const text = new Y.XmlText();
            text.insert(
              0,
              'Welcome to NoteCove! Open multiple windows to see real-time collaboration in action.'
            );
            paragraph.insert(0, [text]);
            finalContent.insert(0, [paragraph]);
          }
        }
      } else {
        // No other instances, create welcome content immediately
        console.log('[ensureDefaultNote] CRDT is empty, adding welcome content');
        // ProseMirror structure: paragraph containing text
        const paragraph = new Y.XmlElement('paragraph');
        const text = new Y.XmlText();
        text.insert(
          0,
          'Welcome to NoteCove! Open multiple windows to see real-time collaboration in action.'
        );
        paragraph.insert(0, [text]);
        content.insert(0, [paragraph]);
      }
    } else {
      console.log(
        '[ensureDefaultNote] CRDT already has content from sync directory, skipping welcome content'
      );
    }
  }

  // Create note cache entry in SQLite
  await db.upsertNote({
    id: DEFAULT_NOTE_ID,
    title: 'Welcome to NoteCove',
    sdId: DEFAULT_SD_ID,
    folderId: null,
    created: Date.now(),
    modified: Date.now(),
    deleted: false,
    pinned: false,
    contentPreview: 'Welcome to NoteCove!',
    contentText:
      'Welcome to NoteCove! Open multiple windows to see real-time collaboration in action.',
  });

  // Set as selected note
  await db.setState('selectedNoteId', DEFAULT_NOTE_ID);
}

// App lifecycle
// Create application menu
/**
 * Set up file watchers and activity sync for a Storage Directory
 */
async function setupSDWatchers(
  sdId: string,
  sdPath: string,
  fsAdapter: NodeFileSystemAdapter,
  instanceId: string,
  storageManager: AppendLogManager,
  crdtManager: CRDTManager,
  db: Database
): Promise<void> {
  console.log(`[Init] Setting up watchers for SD: ${sdId} at ${sdPath}`);

  const folderLogsPath = join(sdPath, 'folders', 'logs');
  const activityDir = join(sdPath, 'activity');
  const deletionDir = join(sdPath, 'deleted');

  // Create and initialize ActivityLogger for this SD
  const activityLogger = new ActivityLogger(fsAdapter, activityDir);
  activityLogger.setInstanceId(instanceId);
  await activityLogger.initialize();

  // Register the activity logger with CRDT Manager
  // Type assertion needed due to TypeScript module resolution quirk between dist and src
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
  crdtManager.setActivityLogger(sdId, activityLogger as any);

  // Store logger for periodic compaction
  sdActivityLoggers.set(sdId, activityLogger);

  // Create and initialize DeletionLogger for this SD
  const deletionLogger = new DeletionLogger(fsAdapter, deletionDir);
  deletionLogger.setInstanceId(instanceId);
  await deletionLogger.initialize();
  sdDeletionLoggers.set(sdId, deletionLogger);

  // Create ActivitySync for this SD
  const activitySyncCallbacks: ActivitySyncCallbacks = {
    reloadNote: async (noteId: string, sdIdFromSync: string) => {
      // Debug: broadcast that we're attempting to reload
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('test:activity-watcher-debug', {
          sdId,
          filename: 'reloadNote',
          reason: 'reload-attempt',
          noteId,
        });
      }

      try {
        const existingNote = await db.getNote(noteId);

        if (!existingNote) {
          // Note created in another instance
          // Debug: broadcast that note doesn't exist
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: 'reloadNote',
              reason: 'note-not-exists',
              noteId,
            });
          }

          await crdtManager.loadNote(noteId, sdIdFromSync);

          // Extract metadata and insert into database
          const noteDoc = crdtManager.getNoteDoc(noteId);
          const doc = crdtManager.getDocument(noteId);
          if (!doc) {
            console.error(`[ActivitySync] Failed to get document for note ${noteId}`);
            // Debug: broadcast load failure
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('test:activity-watcher-debug', {
                sdId,
                filename: 'reloadNote',
                reason: 'doc-load-failed',
                noteId,
              });
            }
            return;
          }

          const crdtMetadata = noteDoc?.getMetadata();
          const folderId = crdtMetadata?.folderId ?? null;

          // Extract text content for caching
          const content = doc.getXmlFragment('content');

          // Debug: broadcast content length
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: 'reloadNote',
              reason: 'content-length',
              noteId,
              contentLength: content.length,
            });
          }

          // Skip empty notes to prevent importing blank/incomplete notes
          // This prevents spurious blank notes appearing on startup
          //
          // IMPORTANT: Throw an error instead of returning, so pollAndReload
          // can retry with exponential backoff
          if (content.length === 0) {
            console.log(
              `[ActivitySync] Note ${noteId} has no content - file may be incomplete, will retry`
            );
            // Debug: broadcast empty note
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('test:activity-watcher-debug', {
                sdId,
                filename: 'reloadNote',
                reason: 'empty-note-retrying',
                noteId,
              });
            }
            // Unload the note since we're not importing it
            await crdtManager.unloadNote(noteId);
            throw new Error('Note is incomplete - content is empty');
          }

          let contentText = '';
          content.forEach((item) => {
            if (item instanceof Y.XmlText) {
              contentText += String(item.toString()) + '\n';
            } else if (item instanceof Y.XmlElement) {
              const extractText = (el: Y.XmlElement | Y.XmlText): string => {
                if (el instanceof Y.XmlText) {
                  return String(el.toString());
                }
                let text = '';
                el.forEach((child: unknown) => {
                  const childElement = child as Y.XmlElement | Y.XmlText;
                  text += extractText(childElement);
                });
                return text;
              };
              contentText += extractText(item) + '\n';
            }
          });

          // Generate content preview (first 200 chars after title)
          const lines = contentText.split('\n');
          const contentAfterTitle = lines.slice(1).join('\n').trim();
          const contentPreview = contentAfterTitle.substring(0, 200);

          // Extract title and strip any HTML/XML tags
          let newNoteTitle = extractTitleFromDoc(doc, 'content');
          newNoteTitle = newNoteTitle.replace(/<[^>]+>/g, '').trim() || 'Untitled';

          await db.upsertNote({
            id: noteId,
            title: newNoteTitle,
            sdId: sdIdFromSync,
            folderId,
            created: crdtMetadata?.created ?? Date.now(),
            modified: crdtMetadata?.modified ?? Date.now(),
            deleted: crdtMetadata?.deleted ?? false,
            pinned: crdtMetadata?.pinned ?? false,
            contentPreview,
            contentText,
          });

          // Broadcast to all windows
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('note:created', { sdId: sdIdFromSync, noteId, folderId });
          }

          // Debug: broadcast successful import
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: 'reloadNote',
              reason: 'note-imported',
              noteId,
              title: newNoteTitle,
            });
          }
        } else {
          // Note exists, reload and update metadata
          // First check if the note is currently loaded in memory
          const wasLoaded = crdtManager.getNoteDoc(noteId) !== undefined;

          if (wasLoaded) {
            // Note is open - reload it in place
            await crdtManager.reloadNote(noteId);
          } else {
            // Note is NOT open - temporarily load it to sync metadata
            // This is critical for syncing title/folder/pin changes on unopened notes
            await crdtManager.loadNote(noteId, existingNote.sdId);
          }

          // Extract updated title and metadata from the (now loaded) document
          const noteDoc = crdtManager.getNoteDoc(noteId);
          const doc = crdtManager.getDocument(noteId);
          if (doc) {
            // CRITICAL: Broadcast the updated CRDT state to all renderer windows
            // This allows TipTap editors to update their Y.Doc with the new state
            const stateUpdate = Y.encodeStateAsUpdate(doc);

            // Log actual content for debugging
            const contentFrag = doc.getXmlFragment('content');
            let debugContentText = '';
            contentFrag.forEach((item) => {
              if (item instanceof Y.XmlText) {
                debugContentText += String(item.toString());
              } else if (item instanceof Y.XmlElement) {
                item.forEach((child: unknown) => {
                  if (child instanceof Y.XmlText) {
                    debugContentText += String(child.toString());
                  }
                });
              }
            });

            console.log(
              `[ActivitySync] Broadcasting note:updated for ${noteId} (${stateUpdate.length} bytes), content: "${debugContentText.substring(0, 50)}..."`
            );
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('note:updated', noteId, stateUpdate);
            }

            const crdtMetadata = noteDoc?.getMetadata();
            // Extract title and strip any HTML/XML tags
            let newTitle = extractTitleFromDoc(doc, 'content');
            newTitle = newTitle.replace(/<[^>]+>/g, '').trim() || 'Untitled';

            // Extract content if not already cached
            let contentText = existingNote.contentText;
            let contentPreview = existingNote.contentPreview;

            if (!contentText) {
              const content = doc.getXmlFragment('content');
              contentText = '';
              content.forEach((item) => {
                if (item instanceof Y.XmlText) {
                  contentText += String(item.toString()) + '\n';
                } else if (item instanceof Y.XmlElement) {
                  const extractText = (el: Y.XmlElement | Y.XmlText): string => {
                    if (el instanceof Y.XmlText) {
                      return String(el.toString());
                    }
                    let text = '';
                    el.forEach((child: unknown) => {
                      const childElement = child as Y.XmlElement | Y.XmlText;
                      text += extractText(childElement);
                    });
                    return text;
                  };
                  contentText += extractText(item) + '\n';
                }
              });

              // Generate content preview
              const lines = contentText.split('\n');
              const contentAfterTitle = lines.slice(1).join('\n').trim();
              contentPreview = contentAfterTitle.substring(0, 200);
            }

            // Detect folder change (for note:moved event)
            const oldFolderId = existingNote.folderId;
            const newFolderId = crdtMetadata?.folderId ?? existingNote.folderId;
            const folderChanged = oldFolderId !== newFolderId;

            await db.upsertNote({
              id: noteId,
              title: newTitle,
              sdId: existingNote.sdId,
              folderId: newFolderId,
              created: existingNote.created,
              modified: crdtMetadata?.modified ?? Date.now(),
              deleted: crdtMetadata?.deleted ?? false,
              pinned: crdtMetadata?.pinned ?? existingNote.pinned,
              contentPreview,
              contentText,
            });

            // Broadcast title update to all windows
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send('note:title-updated', {
                noteId,
                title: newTitle,
              });
            }

            // Broadcast folder change if folderId changed (synced from another instance)
            if (folderChanged) {
              console.log(
                `[ActivitySync] Note ${noteId} folder changed: ${oldFolderId} -> ${newFolderId}`
              );
              for (const window of BrowserWindow.getAllWindows()) {
                window.webContents.send('note:moved', { noteId, oldFolderId, newFolderId });
              }
            }

            // If note wasn't originally loaded, unload it to free memory
            // Keep notes that were already open (user is editing them)
            if (!wasLoaded) {
              await crdtManager.unloadNote(noteId);
            }
          }
        }
      } catch (error) {
        console.error(`[ActivitySync] Error in reloadNote callback:`, error);
        // Debug: broadcast error
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('test:activity-watcher-debug', {
            sdId,
            filename: 'reloadNote',
            reason: 'reload-error',
            noteId,
            error: String(error),
          });
        }
        // Re-throw the error so pollAndReload can handle it
        throw error;
      }
    },
    getLoadedNotes: () => crdtManager.getLoadedNotes(),
    checkCRDTLogExists: async (noteId: string, instanceId: string, expectedSequence: number) => {
      return crdtManager.checkCRDTLogExists(noteId, sdId, instanceId, expectedSequence);
    },
    checkNoteExists: (noteId: string) => {
      // Check if the note directory exists on disk
      // If it doesn't exist, the note was permanently deleted and we should skip syncing
      const noteDirPath = join(sdPath, 'notes', noteId);
      return Promise.resolve(existsSync(noteDirPath));
    },
    metrics: {
      recordSyncSuccess: (
        latencyMs: number,
        attempts: number,
        noteId: string,
        metricSdId: string
      ) => {
        getSyncMetrics().recordSyncSuccess(latencyMs, attempts, {
          note_id: noteId,
          sd_id: metricSdId,
        });
      },
      recordSyncFailure: (noteId: string, metricSdId: string) => {
        getSyncMetrics().recordSyncFailure({ note_id: noteId, sd_id: metricSdId });
      },
      recordSyncTimeout: (attempts: number, noteId: string, metricSdId: string) => {
        getSyncMetrics().recordSyncTimeout(attempts, { note_id: noteId, sd_id: metricSdId });
      },
      recordFullScan: (notesReloaded: number, metricSdId: string) => {
        getSyncMetrics().recordFullScan(notesReloaded, { sd_id: metricSdId });
      },
      recordActivityLogProcessed: (instanceIdAttr: string, metricSdId: string) => {
        getSyncMetrics().recordActivityLogProcessed({
          instance_id: instanceIdAttr,
          sd_id: metricSdId,
        });
      },
    },
  };

  const activitySync = new ActivitySync(
    fsAdapter,
    instanceId,
    activityDir,
    sdId,
    activitySyncCallbacks
  );

  // Clean up orphaned activity logs on startup
  await activitySync.cleanupOrphanedLogs();

  // Store the ActivitySync instance
  sdActivitySyncs.set(sdId, activitySync);

  // Create DeletionSync for this SD
  const deletionSyncCallbacks: DeletionSyncCallbacks = {
    processRemoteDeletion: async (noteId: string) => {
      console.log(`[DeletionSync] Processing remote deletion for note ${noteId}`);

      // Check if note exists in database
      const existingNote = await db.getNote(noteId);
      if (!existingNote) {
        console.log(`[DeletionSync] Note ${noteId} already not in database`);
        return false;
      }

      // Delete from database
      await db.deleteNote(noteId);

      // Unload from CRDT manager if loaded
      if (crdtManager.getNoteDoc(noteId)) {
        await crdtManager.unloadNote(noteId);
      }

      // Broadcast to all windows
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('note:permanentDeleted', { noteId, sdId });
      }

      console.log(`[DeletionSync] Successfully processed remote deletion for note ${noteId}`);
      return true;
    },
    checkNoteExists: async (noteId: string) => {
      const note = await db.getNote(noteId);
      return note !== null;
    },
  };

  const deletionSync = new DeletionSync(fsAdapter, instanceId, deletionDir, deletionSyncCallbacks);

  // Store the DeletionSync instance
  sdDeletionSyncs.set(sdId, deletionSync);

  // Set up deletion watcher
  const deletionWatcher = new NodeFileWatcher();
  await deletionWatcher.watch(deletionDir, (event) => {
    console.log(`[DeletionWatcher ${sdId}] Detected deletion log change:`, event.filename);

    // Ignore our own log file (we write to it, don't need to read it)
    if (event.filename === `${instanceId}.log`) {
      return;
    }

    // Only process .log files
    if (!event.filename.endsWith('.log')) {
      return;
    }

    // Sync deletions from other instances
    void (async () => {
      try {
        const deletedNotes = await deletionSync.syncFromOtherInstances();
        if (deletedNotes.size > 0) {
          console.log(
            `[DeletionWatcher ${sdId}] Synced ${deletedNotes.size} deletions:`,
            Array.from(deletedNotes)
          );
        }
      } catch (error) {
        console.error(`[DeletionWatcher ${sdId}] Sync failed:`, error);
      }
    })();
  });

  sdDeletionWatchers.set(sdId, deletionWatcher);

  // Set up deletion polling (backup for file watcher failures)
  const deletionPollInterval = setInterval(
    () => {
      void (async () => {
        try {
          await deletionSync.syncFromOtherInstances();
        } catch (error) {
          // Don't log ENOENT - directory might not exist yet
          if (!String(error).includes('ENOENT')) {
            console.error(`[DeletionSync Poll ${sdId}] Poll failed:`, error);
          }
        }
      })();
    },
    10000 // Poll every 10 seconds
  );

  sdDeletionPollIntervals.set(sdId, deletionPollInterval);

  // Initial deletion sync on startup
  void deletionSync.syncFromOtherInstances().catch((error) => {
    console.error(`[DeletionSync ${sdId}] Initial sync failed:`, error);
  });

  // Set up folder logs watcher (new format uses .crdtlog files)
  const folderWatcher = new NodeFileWatcher();
  await folderWatcher.watch(folderLogsPath, (event) => {
    console.log(`[FileWatcher ${sdId}] Detected folder log file change:`, event.filename);

    // Ignore directory creation events and temporary files
    if (event.filename === 'logs' || event.filename.endsWith('.tmp')) {
      return;
    }

    // Only process .crdtlog files
    if (!event.filename.endsWith('.crdtlog')) {
      return;
    }

    // Reload folder tree from disk using storage manager
    const folderTree = crdtManager.getFolderTree(sdId);
    if (folderTree) {
      storageManager
        .loadFolderTree(sdId)
        .then((result) => {
          // Apply loaded state to folder tree
          Y.applyUpdate(folderTree.doc, Y.encodeStateAsUpdate(result.doc), 'external-sync');
          result.doc.destroy();

          // Broadcast update to all windows
          const windows = BrowserWindow.getAllWindows();
          for (const window of windows) {
            window.webContents.send('folder:updated', {
              sdId,
              operation: 'external-sync',
              folderId: 'unknown',
            });
          }
        })
        .catch((err) => {
          console.error(`[FileWatcher ${sdId}] Failed to reload folder tree:`, err);
        });
    }
  });

  sdFileWatchers.set(sdId, folderWatcher);

  // Set up activity watcher with startup grace period
  let startupComplete = false;
  const activityWatcher = new NodeFileWatcher();
  await activityWatcher.watch(activityDir, (event) => {
    console.log(`[ActivityWatcher ${sdId}] Detected activity log change:`, event.filename);

    // Broadcast to renderer for test instrumentation
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('test:file-watcher-event', {
        sdId,
        filename: event.filename,
        type: 'activity',
        gracePeriodActive: !startupComplete,
      });
    }

    // Ignore events during startup to prevent duplicate imports
    // The initial sync (line 663) handles startup properly
    if (!startupComplete) {
      console.log(
        `[ActivityWatcher ${sdId}] Ignoring event during startup grace period:`,
        event.filename
      );
      // Broadcast for test debugging
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('test:activity-watcher-debug', {
          sdId,
          filename: event.filename,
          reason: 'grace-period',
        });
      }
      return;
    }

    // Ignore directory creation events and our own log file
    if (event.filename === '.activity' || event.filename === `${instanceId}.log`) {
      console.log(`[ActivityWatcher ${sdId}] Ignoring own log file or directory:`, event.filename);
      // Broadcast for test debugging
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('test:activity-watcher-debug', {
          sdId,
          filename: event.filename,
          reason: 'own-log',
          instanceId,
        });
      }
      return;
    }

    // Only process .log files
    if (!event.filename.endsWith('.log')) {
      console.log(`[ActivityWatcher ${sdId}] Ignoring non-.log file:`, event.filename);
      // Broadcast for test debugging
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('test:activity-watcher-debug', {
          sdId,
          filename: event.filename,
          reason: 'not-log-file',
        });
      }
      return;
    }

    // Sync from other instances
    void (async () => {
      try {
        // Broadcast that we're starting sync
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('test:activity-watcher-debug', {
            sdId,
            filename: event.filename,
            reason: 'starting-sync',
          });
        }

        console.log(`[ActivitySync ${sdId}] Starting sync from other instances...`);
        const affectedNotes = await activitySync.syncFromOtherInstances();
        console.log(
          `[ActivitySync ${sdId}] Sync complete, affected notes:`,
          affectedNotes.size,
          Array.from(affectedNotes)
        );

        // Wait for all pending syncs to complete before broadcasting
        // This ensures CRDT state is up-to-date when renderers reload
        await activitySync.waitForPendingSyncs();

        // Reindex tags for affected notes
        if (affectedNotes.size > 0) {
          await reindexTagsForNotes(affectedNotes, crdtManager, db);
        }

        // Broadcast updates to all windows for affected notes
        if (affectedNotes.size > 0) {
          const noteIds = Array.from(affectedNotes);
          console.log(
            `[ActivitySync ${sdId}] Broadcasting to ${BrowserWindow.getAllWindows().length} windows`
          );
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('note:external-update', {
              operation: 'sync',
              noteIds,
            });
          }

          // Broadcast to test instrumentation
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-sync-complete', {
              sdId,
              noteIds,
            });
          }
        } else {
          console.log(`[ActivitySync ${sdId}] No affected notes to broadcast`);
          // Broadcast that there were no affected notes
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('test:activity-watcher-debug', {
              sdId,
              filename: event.filename,
              reason: 'no-affected-notes',
            });
          }
        }
      } catch (error) {
        console.error(`[ActivityWatcher ${sdId}] Failed to sync from other instances:`, error);
        // Broadcast the error for debugging
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('test:activity-watcher-debug', {
            sdId,
            filename: event.filename,
            reason: 'sync-error',
            error: String(error),
          });
        }
      }
    })();
  });

  sdActivityWatchers.set(sdId, activityWatcher);

  // Perform initial sync from other instances on startup
  console.log(`[Init] Performing initial sync from other instances for SD: ${sdId}`);
  try {
    const affectedNotes = await activitySync.syncFromOtherInstances();

    // Wait for all pending syncs to complete before broadcasting
    await activitySync.waitForPendingSyncs();

    console.log(
      `[Init] Initial sync complete for SD: ${sdId}, affected notes:`,
      affectedNotes.size
    );

    // Reindex tags for affected notes
    if (affectedNotes.size > 0) {
      await reindexTagsForNotes(affectedNotes, crdtManager, db);
    }

    // Broadcast updates to all windows for affected notes
    if (affectedNotes.size > 0) {
      const noteIds = Array.from(affectedNotes);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('note:external-update', {
          operation: 'sync',
          noteIds,
        });
      }
    }
  } catch (error) {
    console.error(`[Init] Failed to perform initial sync for SD: ${sdId}:`, error);
  } finally {
    // Mark startup as complete to allow file watcher to process subsequent changes
    // This prevents race conditions where file watcher triggers during initial sync
    startupComplete = true;
    console.log(`[Init] Startup grace period ended for SD: ${sdId}`);

    // Broadcast to renderer for test instrumentation
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('test:grace-period-ended', { sdId });
    }
  }

  // Set up polling backup for activity sync
  // Chokidar may miss/coalesce rapid file changes, so poll every 3 seconds as backup
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    void (async () => {
      pollCount++;
      try {
        // Log watermarks every 10th poll (30 seconds) for debugging
        if (pollCount % 10 === 0) {
          const watermarks = activitySync.getWatermarks();
          console.log(`[ActivitySync Poll ${sdId}] Watermarks:`, Object.fromEntries(watermarks));
        }

        const affectedNotes = await activitySync.syncFromOtherInstances();

        if (affectedNotes.size > 0) {
          console.log(
            `[ActivitySync Poll ${sdId}] Found changes via poll:`,
            Array.from(affectedNotes)
          );
          // Also log watermarks when changes found
          console.log(
            `[ActivitySync Poll ${sdId}] Watermarks after sync:`,
            Object.fromEntries(activitySync.getWatermarks())
          );

          // Wait for pending syncs to complete
          await activitySync.waitForPendingSyncs();

          // Reindex tags for affected notes
          await reindexTagsForNotes(affectedNotes, crdtManager, db);

          // Broadcast updates to all windows
          const noteIds = Array.from(affectedNotes);
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('note:external-update', {
              operation: 'sync',
              noteIds,
            });
          }
        }
      } catch (error) {
        // Don't log every poll failure, just errors
        if (!String(error).includes('ENOENT')) {
          console.error(`[ActivitySync Poll ${sdId}] Poll failed:`, error);
        }
      }
    })();
  }, 3000);

  // Store interval for cleanup
  sdActivityPollIntervals.set(sdId, pollInterval);

  console.log(`[Init] Watchers set up successfully for SD: ${sdId}`);
}

function createMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS application menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: 'About NoteCove',
                click: () => {
                  // TODO: Show About dialog
                  if (mainWindow) {
                    mainWindow.webContents.send('menu:about');
                  }
                },
              },
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'Cmd+,',
                click: () => {
                  if (ipcHandlers) {
                    ipcHandlers.openSettings();
                  }
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // TODO: Create new note
            if (mainWindow) {
              mainWindow.webContents.send('menu:new-note');
            }
          },
        },
        {
          label: 'New Folder',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            // TODO: Create new folder
            if (mainWindow) {
              mainWindow.webContents.send('menu:new-folder');
            }
          },
        },
        {
          label: 'New Window',
          accelerator: isMac ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
          click: () => {
            createWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Export Selected Notes to Markdown...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:export-selected-notes');
            }
          },
        },
        {
          label: 'Export All Notes to Markdown...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:export-all-notes');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Switch Profile...',
          click: () => {
            // Show profile picker and restart with new profile if selected
            void (async () => {
              const appDataDir = app.getPath('userData');
              const isDevBuild = !app.isPackaged;

              const result = await showProfilePicker({
                isDevBuild,
                appDataDir,
              });

              if (result.profileId && result.profileId !== selectedProfileId) {
                // User selected a different profile - restart the app with it
                console.log(`[Profile] Switching to profile: ${result.profileId}`);
                app.relaunch({
                  args: process.argv.slice(1).concat([`--profile-id=${result.profileId}`]),
                });
                app.exit(0);
              }
            })();
          },
        },
        { type: 'separator' },
        // Settings on Windows/Linux only (on macOS it's in App menu)
        ...(!isMac
          ? [
              {
                label: 'Settings...',
                accelerator: 'Ctrl+,',
                click: () => {
                  if (ipcHandlers) {
                    ipcHandlers.openSettings();
                  }
                },
              },
              { type: 'separator' as const },
            ]
          : []),
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          role: 'close' as const,
        },
        ...(!isMac ? [{ type: 'separator' as const }, { role: 'quit' as const }] : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            // TODO: Focus search box in UI
            if (mainWindow) {
              mainWindow.webContents.send('menu:find');
            }
          },
        },
        {
          label: 'Find in Note',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            // TODO: Open in-editor search
            if (mainWindow) {
              mainWindow.webContents.send('menu:find-in-note');
            }
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            // TODO: Toggle dark mode
            if (mainWindow) {
              mainWindow.webContents.send('menu:toggle-dark-mode');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Folder Panel',
          accelerator: 'CmdOrCtrl+Shift+1',
          click: () => {
            // TODO: Toggle folder panel
            if (mainWindow) {
              mainWindow.webContents.send('menu:toggle-folder-panel');
            }
          },
        },
        {
          label: 'Toggle Tags Panel',
          accelerator: 'CmdOrCtrl+Shift+2',
          click: () => {
            // TODO: Toggle tags panel (when implemented)
            if (mainWindow) {
              mainWindow.webContents.send('menu:toggle-tags-panel');
            }
          },
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Note Info',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:noteInfo');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Create Snapshot',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:createSnapshot');
            }
          },
        },
        {
          label: 'View History',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:viewHistory');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Advanced',
          submenu: [
            {
              label: 'Reload Note from CRDT Logs',
              click: () => {
                if (mainWindow) {
                  mainWindow.webContents.send('menu:reloadFromCRDTLogs');
                }
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Reindex Notes',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:reindexNotes');
            }
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            // TODO: Update with actual docs URL when available
            void shell.openExternal('https://github.com/anthropics/notecove/wiki');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            void shell.openExternal('https://github.com/anthropics/notecove/issues/new');
          },
        },
        { type: 'separator' },
        {
          label: 'Show Logs',
          click: () => {
            const logsPath = app.getPath('logs');
            void shell.openPath(logsPath);
          },
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: 'About NoteCove',
                click: () => {
                  // TODO: Show About dialog
                  if (mainWindow) {
                    mainWindow.webContents.send('menu:about');
                  }
                },
              },
            ]
          : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

void app.whenReady().then(async () => {
  try {
    // Parse CLI arguments
    const cliArgs = parseCliArgs(process.argv);

    // Check for --debug-profiles flag
    if (cliArgs.debugProfiles) {
      const appDataDir = app.getPath('userData');
      const profileStorage = getProfileStorage(appDataDir);
      const config = await profileStorage.loadProfiles();
      console.log('[Profile Debug] profiles.json contents:');
      console.log(JSON.stringify(config, null, 2));
    }

    // Initialize telemetry (local mode always on, remote opt-in)
    await initializeTelemetry({
      remoteMetricsEnabled: false, // Will be controlled via settings panel
      devMode: process.env['NODE_ENV'] !== 'production',
    });
    console.log('[Telemetry] OpenTelemetry initialized');

    // Debug logging for environment (test mode only)
    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] App ready, starting initialization...');
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await fs.appendFile(
          '/var/tmp/electron-env.log',
          `\n=== New Launch ===\nNODE_ENV: ${process.env['NODE_ENV']}\nTEST_DB_PATH: ${process.env['TEST_DB_PATH']}\n`
        );
      } catch (e) {
        console.error('Failed to write env log:', e);
      }
    }

    // Profile selection - skip if in test mode
    // Test mode is indicated by TEST_STORAGE_DIR, TEST_DB_PATH, or NODE_ENV=test
    const isTestMode =
      !!process.env['TEST_STORAGE_DIR'] ||
      !!process.env['TEST_DB_PATH'] ||
      process.env['NODE_ENV'] === 'test';

    if (!isTestMode) {
      const appDataDir = app.getPath('userData');
      const isDevBuild = !app.isPackaged;
      const profileStorage = getProfileStorage(appDataDir);

      // Handle --reset-picker CLI flag (clears "don't ask again" preference)
      if (cliArgs.resetPicker) {
        console.log('[Profile] CLI: Resetting picker preference...');
        await profileStorage.clearSkipPicker();
      }

      // Handle --profile-id=<id> CLI argument (used by Switch Profile restart)
      if (cliArgs.profileId) {
        console.log(`[Profile] CLI: Using profile ID "${cliArgs.profileId}"...`);
        const config = await profileStorage.loadProfiles();
        const profile = config.profiles.find((p) => p.id === cliArgs.profileId);

        if (!profile) {
          // Profile not found - this shouldn't happen but handle gracefully
          console.error(
            `[Profile] CLI: Profile ID "${cliArgs.profileId}" not found, showing picker`
          );
          // Fall through to show picker
        } else {
          // Check dev/prod compatibility
          if (!isDevBuild && profile.isDev) {
            const { dialog } = await import('electron');
            dialog.showErrorBox(
              'Cannot Access Development Profile',
              `The profile "${profile.name}" is a development profile and cannot be accessed from a production build.`
            );
            app.quit();
            return;
          }

          // Dev build warning when accessing production profile
          if (isDevBuild && !profile.isDev) {
            const { dialog } = await import('electron');
            const result = await dialog.showMessageBox({
              type: 'warning',
              title: 'Access Production Data?',
              message: "You're about to access production data with a development build.",
              detail: `The profile "${profile.name}" is a production profile. Development builds may have bugs that could corrupt your data. Are you sure you want to continue?`,
              buttons: ['Cancel', 'Continue Anyway'],
              defaultId: 0,
              cancelId: 0,
            });

            if (result.response === 0) {
              // User cancelled - show picker instead
              console.log('[Profile] CLI: User cancelled accessing production profile');
              // Fall through to show picker
            } else {
              selectedProfileId = profile.id;
              console.log(
                `[Profile] CLI: User confirmed accessing production profile "${profile.name}" (${profile.id})`
              );
            }
          } else {
            selectedProfileId = profile.id;
          }

          if (selectedProfileId) {
            console.log(`[Profile] CLI: Using profile "${profile.name}" (${profile.id})`);

            // Update lastUsed
            await profileStorage.updateLastUsed(profile.id);
          }
        }
      }

      // Handle --profile=<name> CLI argument
      if (!selectedProfileId && cliArgs.profileName) {
        console.log(`[Profile] CLI: Looking for profile "${cliArgs.profileName}"...`);
        const config = await profileStorage.loadProfiles();
        const profile = config.profiles.find((p) => p.name === cliArgs.profileName);

        if (!profile) {
          // Profile not found - show error dialog
          const { dialog } = await import('electron');
          dialog.showErrorBox(
            'Profile Not Found',
            `The profile "${cliArgs.profileName}" does not exist.\n\nAvailable profiles:\n${config.profiles.map((p) => `  - ${p.name}`).join('\n') || '  (none)'}`
          );
          app.quit();
          return;
        }

        // Check dev/prod compatibility
        if (!isDevBuild && profile.isDev) {
          const { dialog } = await import('electron');
          dialog.showErrorBox(
            'Cannot Access Development Profile',
            `The profile "${profile.name}" is a development profile and cannot be accessed from a production build.`
          );
          app.quit();
          return;
        }

        // Dev build warning when accessing production profile
        if (isDevBuild && !profile.isDev) {
          const { dialog } = await import('electron');
          const result = await dialog.showMessageBox({
            type: 'warning',
            title: 'Access Production Data?',
            message: "You're about to access production data with a development build.",
            detail: `The profile "${profile.name}" is a production profile. Development builds may have bugs that could corrupt your data. Are you sure you want to continue?`,
            buttons: ['Cancel', 'Continue Anyway'],
            defaultId: 0,
            cancelId: 0,
          });

          if (result.response === 0) {
            // User cancelled - quit app
            app.quit();
            return;
          }
        }

        selectedProfileId = profile.id;
        console.log(`[Profile] CLI: Selected profile "${profile.name}" (${profile.id})`);

        // Update lastUsed
        await profileStorage.updateLastUsed(profile.id);
      }

      // --skip-picker: use default or first available profile
      if (!selectedProfileId && cliArgs.skipPicker) {
        console.log('[Profile] CLI: Skipping picker, using default profile...');
        const config = await profileStorage.loadProfiles();

        // Filter profiles based on build type
        const availableProfiles = isDevBuild
          ? config.profiles
          : config.profiles.filter((p) => !p.isDev);

        if (availableProfiles.length === 0) {
          // No profiles available - create a default one
          console.log('[Profile] No profiles available, creating default...');
          const newProfile = await profileStorage.createProfile(
            isDevBuild ? 'Development' : 'Default',
            isDevBuild
          );
          selectedProfileId = newProfile.id;
        } else if (config.defaultProfileId) {
          // Use the saved default if it exists and is compatible
          const defaultProfile = availableProfiles.find((p) => p.id === config.defaultProfileId);
          if (defaultProfile) {
            selectedProfileId = defaultProfile.id;
            await profileStorage.updateLastUsed(defaultProfile.id);
          } else {
            // Default is incompatible, use first available
            const firstProfile = availableProfiles[0];
            if (firstProfile) {
              selectedProfileId = firstProfile.id;
              await profileStorage.updateLastUsed(firstProfile.id);
            }
          }
        } else {
          // No default, use first available
          const firstProfile = availableProfiles[0];
          if (firstProfile) {
            selectedProfileId = firstProfile.id;
            await profileStorage.updateLastUsed(firstProfile.id);
          }
        }

        console.log(`[Profile] CLI: Using profile: ${selectedProfileId}`);
      }

      // Show profile picker if no profile selected yet
      if (!selectedProfileId) {
        console.log('[Profile] Showing profile picker...');
        const result = await showProfilePicker({
          isDevBuild,
          appDataDir,
        });

        if (result.profileId === null) {
          // User cancelled - quit the app
          console.log('[Profile] User cancelled profile selection, quitting...');
          app.quit();
          return;
        }

        selectedProfileId = result.profileId;
        console.log(`[Profile] Selected profile: ${selectedProfileId}`);
      }

      // Get profile name for window title
      if (selectedProfileId) {
        const config = await profileStorage.loadProfiles();
        const profile = config.profiles.find((p) => p.id === selectedProfileId);
        selectedProfileName = profile?.name ?? null;
      }
    } else {
      console.log('[Profile] Test mode - skipping profile picker');
    }

    // Initialize database (with profile ID if selected)
    database = await initializeDatabase(selectedProfileId ?? undefined);

    // Clean up orphaned data from deleted SDs
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const cleanupPromise = database.cleanupOrphanedData();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    cleanupPromise
      .then(() => {
        console.log('[Database] Orphaned data cleanup completed');
      })
      .catch((error: unknown) => {
        console.error('[Database] Failed to cleanup orphaned data:', error);
      });

    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] Database ready, initializing CRDT manager...');
    }

    // Initialize file system adapter
    const fsAdapter = new NodeFileSystemAdapter();

    // Initialize SD marker for dev/prod safety checks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    sdMarker = new SDMarker(fsAdapter as any);
    const isDevBuild = !app.isPackaged;
    const currentSDType: SDType = isDevBuild ? 'dev' : 'prod';

    // Determine storage directory (shared across instances for sync)
    const storageDir = process.env['TEST_STORAGE_DIR'] ?? join(app.getPath('userData'), 'storage');

    // Initialize SD structure with config
    const sdConfig = {
      id: 'default',
      path: storageDir,
      label: 'Default Storage',
    };
    const sdStructure = new SyncDirectoryStructure(fsAdapter, sdConfig);

    // Initialize SD directory structure
    await sdStructure.initialize();

    // Ensure SD has a marker file (for dev/prod safety)
    // Skip for test mode to avoid breaking E2E tests
    if (!process.env['TEST_STORAGE_DIR']) {
      await sdMarker.ensureMarker(storageDir, currentSDType);
    }

    // Ensure folders/logs directory exists BEFORE creating CRDT manager
    // This prevents ENOENT errors when demo folders are created
    const folderLogsPath = join(storageDir, 'folders', 'logs');
    await fsAdapter.mkdir(folderLogsPath);

    // Initialize AppendLogManager with database (multi-SD aware)
    const instanceId = process.env['INSTANCE_ID'] ?? randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    storageManager = new AppendLogManager(fsAdapter as any, database, instanceId);

    // Register the default SD
    storageManager.registerSD('default', storageDir);

    // Load all Storage Directories from database and register them
    // Also perform safety checks for dev/prod mismatches
    const allSDs = await database.getAllStorageDirs();
    for (const sd of allSDs) {
      if (sd.id !== 'default') {
        // Check SD marker for safety (skip in test mode)
        if (!process.env['TEST_STORAGE_DIR']) {
          const existingMarker = await sdMarker.readSDMarker(sd.path);

          // Production build: refuse to load dev SDs
          if (!isDevBuild && existingMarker === 'dev') {
            console.warn(`[Init] Skipping dev SD in production: ${sd.name} at ${sd.path}`);
            continue;
          }

          // Ensure marker exists (will write current build type if missing)
          await sdMarker.ensureMarker(sd.path, currentSDType);
        }

        // Default is already registered above
        storageManager.registerSD(sd.id, sd.path);
        console.log(`[Init] Registered SD: ${sd.name} at ${sd.path}`);
      }
    }

    // Initialize CRDT manager with database reference
    // Type assertion needed due to TypeScript module resolution quirk between dist and src
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    crdtManager = new CRDTManagerImpl(storageManager as any, database);

    // Eagerly load folder tree to trigger demo folder creation
    // This ensures demo folders are created while we know the updates directory exists
    await crdtManager.loadFolderTree('default');

    // Handler for when new SD is created (for IPC)
    const handleNewStorageDir = async (sdId: string, sdPath: string): Promise<void> => {
      if (!database) {
        console.error('[Init] Database not initialized');
        throw new Error('Database not initialized');
      }

      if (!storageManager) {
        console.error('[Init] StorageManager not initialized');
        throw new Error('StorageManager not initialized');
      }

      if (!crdtManager) {
        console.error('[Init] CRDTManager not initialized');
        throw new Error('CRDTManager not initialized');
      }

      // Helper to broadcast progress to all windows
      const sendProgress = (step: number, total: number, message: string) => {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('sd:init-progress', { sdId, step, total, message });
        });
      };

      try {
        console.log(`[Init] ===== Initializing new SD: ${sdId} at ${sdPath} =====`);

        // 1. Create SD config and initialize structure
        sendProgress(1, 6, 'Creating storage directory structure...');
        console.log(`[Init] Step 1: Creating SD structure`);
        const sdConfig = { id: sdId, path: sdPath, label: '' };
        const newSdStructure = new SyncDirectoryStructure(fsAdapter, sdConfig);
        await newSdStructure.initialize();
        console.log(`[Init] Step 1: SD structure created successfully`);

        // Write SD marker file for dev/prod safety (skip in test mode)
        if (!process.env['TEST_STORAGE_DIR'] && sdMarker) {
          await sdMarker.writeSDMarker(sdPath, currentSDType);
          console.log(`[Init] Step 1.5: SD marker written (${currentSDType})`);
        }

        // 2. Ensure activity directory exists (required for watchers)
        sendProgress(2, 6, 'Setting up activity tracking...');
        const activityDir = join(sdPath, 'activity');
        console.log(`[Init] Step 2: Creating activity directory at ${activityDir}`);
        await fsAdapter.mkdir(activityDir);
        console.log(`[Init] Step 2: Activity directory created successfully`);

        // 3. Register with StorageManager
        sendProgress(3, 6, 'Registering storage directory...');
        console.log(`[Init] Step 3: Registering with StorageManager`);
        storageManager.registerSD(sdId, sdPath);
        console.log(`[Init] Step 3: Registered with StorageManager`);

        // 4. Load folder tree for this SD
        sendProgress(4, 6, 'Loading folder structure...');
        console.log(`[Init] Step 4: Loading folder tree`);
        await crdtManager.loadFolderTree(sdId);
        console.log(`[Init] Step 4: Folder tree loaded`);

        // 5. Set up watchers for this SD
        sendProgress(5, 6, 'Setting up file watchers...');
        console.log(`[Init] Step 5: Setting up watchers`);
        await setupSDWatchers(
          sdId,
          sdPath,
          fsAdapter,
          instanceId,
          storageManager,
          crdtManager,
          database
        );
        console.log(`[Init] Step 5: Watchers set up successfully`);

        // 6. Scan for existing notes on disk and load them into database
        console.log(`[Init] Step 6: Scanning for existing notes`);
        try {
          const notesDir = join(sdPath, 'notes');
          const noteDirectories = await fsAdapter.listFiles(notesDir);
          let loadedCount = 0;

          // Filter to count only valid note IDs (same logic as loading loop)
          const isValidNoteId = (id: string): boolean => {
            return (
              !id.startsWith('.') &&
              id.length > 0 &&
              id !== 'undefined' &&
              id !== 'Icon' &&
              !id.includes('\r') &&
              id !== 'desktop.ini' &&
              id !== 'Thumbs.db' &&
              !/\s\(\d+\)$/.test(id) &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
            );
          };

          const totalNotes = noteDirectories.filter(isValidNoteId).length;

          sendProgress(6, 6, `Loading ${totalNotes} notes and indexing tags...`);

          for (const noteId of noteDirectories) {
            // Skip invalid note IDs and system files
            if (!isValidNoteId(noteId)) {
              console.log(`[Init] Skipping invalid/system file: ${noteId}`);
              continue;
            }

            // Check if note is already in database
            const existingNote = await database.getNote(noteId);
            if (existingNote) continue;

            try {
              // Load note from disk
              await crdtManager.loadNote(noteId, sdId);

              // Extract metadata and insert into database
              const noteDoc = crdtManager.getNoteDoc(noteId);
              const doc = crdtManager.getDocument(noteId);
              if (doc) {
                const crdtMetadata = noteDoc?.getMetadata();
                const folderId = crdtMetadata?.folderId ?? null;
                // Extract title and strip any HTML/XML tags that might be present
                let title = extractTitleFromDoc(doc, 'content');
                // Strip HTML/XML tags from title
                title = title.replace(/<[^>]+>/g, '').trim() || 'Untitled';

                // Extract text content for tag indexing and caching
                const content = doc.getXmlFragment('content');
                let contentText = '';
                content.forEach((item) => {
                  if (item instanceof Y.XmlText) {
                    const textStr = String(item.toString());
                    contentText += textStr + '\n';
                  } else if (item instanceof Y.XmlElement) {
                    const extractText = (el: Y.XmlElement | Y.XmlText): string => {
                      if (el instanceof Y.XmlText) {
                        return String(el.toString());
                      }
                      let text = '';
                      el.forEach((child: unknown) => {
                        const childElement = child as Y.XmlElement | Y.XmlText;
                        text += extractText(childElement);
                      });
                      return text;
                    };
                    contentText += extractText(item) + '\n';
                  }
                });

                // Generate content preview (first 200 chars after title)
                const lines = contentText.split('\n');
                const contentAfterTitle = lines.slice(1).join('\n').trim();
                const contentPreview = contentAfterTitle.substring(0, 200);

                await database.upsertNote({
                  id: noteId,
                  title,
                  sdId,
                  folderId,
                  created: crdtMetadata?.created ?? Date.now(),
                  modified: crdtMetadata?.modified ?? Date.now(),
                  deleted: crdtMetadata?.deleted ?? false,
                  pinned: crdtMetadata?.pinned ?? false,
                  contentPreview,
                  contentText,
                });

                // Extract and index tags
                const tags = extractTags(contentText);
                for (const tagName of tags) {
                  const tag =
                    (await database.getTagByName(tagName)) ?? (await database.createTag(tagName));
                  await database.addTagToNote(noteId, tag.id);
                }

                loadedCount++;
              }
            } catch (error) {
              console.error(`[Init] Failed to load note ${noteId}:`, error);
            }
          }

          console.log(`[Init] Step 6: Loaded ${loadedCount} existing notes from disk`);
        } catch (error) {
          console.error(`[Init] Failed to scan for existing notes:`, error);
        }

        // Send completion
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('sd:init-complete', { sdId });
        });

        console.log(`[Init] ===== Successfully initialized new SD: ${sdId} =====`);
      } catch (error) {
        console.error(`[Init] ERROR initializing new SD ${sdId}:`, error);

        // Send error
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('sd:init-error', {
            sdId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

        throw error;
      }
    };

    // Initialize NoteMoveManager for atomic cross-SD moves
    noteMoveManager = new NoteMoveManager(database, instanceId);
    console.log('[Init] NoteMoveManager initialized');

    // Initialize DiagnosticsManager for advanced recovery diagnostics
    diagnosticsManager = new DiagnosticsManager(database);
    console.log('[Init] DiagnosticsManager initialized');

    // Initialize BackupManager for backup and restore operations
    const userDataPath = app.getPath('userData');
    backupManager = new BackupManager(database, userDataPath, undefined, handleNewStorageDir);
    console.log('[Init] BackupManager initialized');

    // Initialize IPC handlers (pass createWindow for testing support and SD callback)
    if (!configManager) {
      throw new Error('ConfigManager not initialized');
    }
    ipcHandlers = new IPCHandlers(
      crdtManager,
      database,
      configManager,
      storageManager,
      noteMoveManager,
      diagnosticsManager,
      backupManager,
      createWindow,
      handleNewStorageDir,
      (sdId: string) => sdDeletionLoggers.get(sdId)
    );

    // Set up broadcast callback for CRDT manager to send updates to renderer
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- crdtManager is definitely assigned by this point
    crdtManager.setBroadcastCallback((noteId: string, update: Uint8Array) => {
      ipcHandlers?.broadcastToAll('note:updated', noteId, update);
    });
    if (process.env['NODE_ENV'] === 'test') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await fs.appendFile(
        '/var/tmp/auto-cleanup.log',
        `${new Date().toISOString()} [Init] IPC handlers created\n`
      );
    }

    // Create default note if none exists
    // IMPORTANT: Do this BEFORE setupSDWatchers to prevent race condition where
    // activity sync imports empty note files before welcome note is created
    await ensureDefaultNote(database, crdtManager, storageDir, instanceId);

    // Set up watchers for default SD AFTER ensureDefaultNote
    // This ensures the welcome note is created before activity sync runs
    await setupSDWatchers(
      'default',
      storageDir,
      fsAdapter,
      instanceId,
      storageManager,
      crdtManager,
      database
    );
    if (process.env['NODE_ENV'] === 'test') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await fs.appendFile(
        '/var/tmp/auto-cleanup.log',
        `${new Date().toISOString()} [Init] Default note ensured\n`
      );
    }

    // Run auto-cleanup for old deleted notes (30-day threshold)
    console.log('[Init] Running auto-cleanup for old deleted notes...');
    if (process.env['NODE_ENV'] === 'test') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await fs.appendFile(
        '/var/tmp/auto-cleanup.log',
        `${new Date().toISOString()} [Init] About to run auto-cleanup\n`
      );
    }
    await ipcHandlers.runAutoCleanup(30);
    if (process.env['NODE_ENV'] === 'test') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await fs.appendFile(
        '/var/tmp/auto-cleanup.log',
        `${new Date().toISOString()} [Init] Auto-cleanup completed\n`
      );
    }

    // Recover incomplete cross-SD note moves
    console.log('[Init] Checking for incomplete note moves...');
    await noteMoveManager.recoverIncompleteMoves();
    await noteMoveManager.cleanupOldMoves();
    console.log('[Init] Note move recovery completed');

    // Set up watchers for all other registered SDs (only if fully initialized)
    for (const sd of allSDs) {
      if (sd.id !== 'default') {
        // Check if SD has basic structure (notes directory)
        const notesPath = join(sd.path, 'notes');
        const isInitialized = await fsAdapter.exists(notesPath);

        if (isInitialized) {
          // Ensure folders/logs exists (create if missing)
          const folderLogsPath = join(sd.path, 'folders', 'logs');
          if (!(await fsAdapter.exists(folderLogsPath))) {
            console.log(`[Init] Creating folders/logs for SD: ${sd.id}`);
            await fsAdapter.mkdir(folderLogsPath);
          }

          console.log(`[Init] Setting up watchers for SD: ${sd.id}`);
          await setupSDWatchers(
            sd.id,
            sd.path,
            fsAdapter,
            instanceId,
            storageManager,
            crdtManager,
            database
          );
        } else {
          console.log(
            `[Init] Skipping watchers for SD: ${sd.id} (not fully initialized: ${sd.path})`
          );
        }
      }
    }

    // Periodic compaction of activity logs for all SDs (every 5 minutes)
    compactionInterval = setInterval(
      () => {
        for (const [sdId, logger] of sdActivityLoggers) {
          logger.compact().catch((err) => {
            console.error(`[ActivityLogger] Failed to compact log for SD ${sdId}:`, err);
          });
        }
      },
      5 * 60 * 1000
    );

    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] IPC handlers ready, creating window...');
    }

    // Register profile debug IPC handler for DevTools inspection
    ipcMain.handle('profile:getInfo', async () => {
      const appDataDir = app.getPath('userData');
      const profileStorage = getProfileStorage(appDataDir);
      const config = await profileStorage.loadProfiles();
      const currentProfile = config.profiles.find((p) => p.id === selectedProfileId) ?? null;
      return {
        profileId: selectedProfileId,
        profile: currentProfile,
        isDevBuild: !app.isPackaged,
      };
    });

    // Create menu
    createMenu();

    createWindow();

    if (process.env['NODE_ENV'] === 'test') {
      console.log('[TEST MODE] Window created successfully');
    }

    app.on('activate', () => {
      // On macOS re-create window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

void app.on('window-all-closed', () => {
  // On macOS, keep app running unless explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle system resume from sleep/suspend
// This triggers a sync from other instances to catch up on changes made while sleeping
powerMonitor.on('resume', () => {
  console.log('[PowerMonitor] System resumed from sleep, triggering activity and deletion sync...');

  // Sync all storage directories - activity sync
  for (const [sdId, activitySync] of sdActivitySyncs.entries()) {
    console.log(`[PowerMonitor] Syncing activity for SD ${sdId}...`);
    void (async () => {
      try {
        const affectedNotes = await activitySync.syncFromOtherInstances();
        console.log(
          `[PowerMonitor] SD ${sdId} activity sync complete, affected notes:`,
          Array.from(affectedNotes)
        );

        // Broadcast updates to all windows if there were changes
        if (affectedNotes.size > 0) {
          const noteIds = Array.from(affectedNotes);
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('note:externalUpdate', {
              operation: 'sync-resume',
              noteIds,
            });
          }
        }
      } catch (error) {
        console.error(`[PowerMonitor] Failed to sync activity for SD ${sdId}:`, error);
      }
    })();
  }

  // Sync all storage directories - deletion sync
  for (const [sdId, deletionSync] of sdDeletionSyncs.entries()) {
    console.log(`[PowerMonitor] Syncing deletions for SD ${sdId}...`);
    void (async () => {
      try {
        const deletedNotes = await deletionSync.syncFromOtherInstances();
        console.log(
          `[PowerMonitor] SD ${sdId} deletion sync complete, deleted notes:`,
          Array.from(deletedNotes)
        );
      } catch (error) {
        console.error(`[PowerMonitor] Failed to sync deletions for SD ${sdId}:`, error);
      }
    })();
  }
});

// Clean up on app quit
// Note: We use will-quit with async cleanup to ensure CRDT updates are flushed
let isQuitting = false;

app.on('will-quit', (event) => {
  if (isQuitting) {
    // Already cleaned up, allow quit to proceed
    return;
  }

  // Prevent quit until cleanup is done
  event.preventDefault();
  isQuitting = true;

  console.log('[App] Starting graceful shutdown...');

  // In test mode, add a timeout to force quit if cleanup hangs
  const isTestMode = process.env['NODE_ENV'] === 'test';
  if (isTestMode) {
    setTimeout(() => {
      console.warn('[App] Shutdown timeout reached in test mode, forcing quit');
      app.exit(1);
    }, 3000); // 3 second timeout in test mode
  }

  // Perform async cleanup
  void (async () => {
    try {
      // 1. Flush all pending CRDT updates to disk
      const manager = crdtManager;
      if (manager) {
        console.log('[App] Flushing pending CRDT updates...');
        await manager.flush();
        console.log('[App] CRDT updates flushed successfully');

        // 2. Create snapshots for modified notes (show progress if >5)
        const pendingCount = manager.getPendingSnapshotCount();
        if (pendingCount > 0) {
          console.log(`[App] Creating shutdown snapshots for ${pendingCount} notes...`);

          // Show progress UI if many notes need saving
          const showProgress = pendingCount > 5;
          const progressCallback = showProgress
            ? (current: number, total: number) => {
                BrowserWindow.getAllWindows().forEach((window) => {
                  window.webContents.send('shutdown:progress', { current, total });
                });
              }
            : undefined;

          await manager.flushSnapshots(progressCallback);

          // Signal completion
          if (showProgress) {
            BrowserWindow.getAllWindows().forEach((window) => {
              window.webContents.send('shutdown:complete');
            });
          }

          console.log('[App] Shutdown snapshots created successfully');
        }

        // 3. Destroy CRDT manager
        console.log('[App] Destroying CRDT manager...');
        manager.destroy();
      }

      // 3. Destroy IPC handlers
      if (ipcHandlers) {
        console.log('[App] Destroying IPC handlers...');
        ipcHandlers.destroy();
      }

      // 4. Clean up all SD file watchers
      console.log('[App] Cleaning up file watchers...');
      for (const watcher of sdFileWatchers.values()) {
        await watcher.unwatch();
      }
      sdFileWatchers.clear();

      // 5. Clean up all SD activity watchers
      console.log('[App] Cleaning up activity watchers...');
      for (const watcher of sdActivityWatchers.values()) {
        await watcher.unwatch();
      }
      sdActivityWatchers.clear();

      // 5a. Wait for pending activity syncs to complete (with timeout)
      console.log('[App] Waiting for pending activity syncs...');
      const SYNC_TIMEOUT_MS = 5000; // 5 second timeout to prevent indefinite hang
      const syncPromises: Promise<void>[] = [];
      for (const activitySync of sdActivitySyncs.values()) {
        syncPromises.push(activitySync.waitForPendingSyncs());
      }
      if (syncPromises.length > 0) {
        try {
          await Promise.race([
            Promise.all(syncPromises),
            new Promise<void>((_, reject) => {
              setTimeout(() => {
                reject(new Error('Sync timeout'));
              }, SYNC_TIMEOUT_MS);
            }),
          ]);
          console.log('[App] All pending syncs completed');
        } catch {
          console.warn(
            '[App] Pending syncs timed out after',
            SYNC_TIMEOUT_MS,
            'ms, continuing shutdown'
          );
        }
      }
      sdActivitySyncs.clear();

      // 5b. Clear activity poll intervals
      console.log('[App] Cleaning up activity poll intervals...');
      for (const interval of sdActivityPollIntervals.values()) {
        clearInterval(interval);
      }
      sdActivityPollIntervals.clear();

      // 5c. Clear deletion syncs and watchers
      console.log('[App] Cleaning up deletion syncs...');
      for (const watcher of sdDeletionWatchers.values()) {
        await watcher.unwatch();
      }
      sdDeletionWatchers.clear();
      for (const interval of sdDeletionPollIntervals.values()) {
        clearInterval(interval);
      }
      sdDeletionPollIntervals.clear();
      sdDeletionSyncs.clear();
      sdDeletionLoggers.clear();

      // 6. Clear compaction interval
      if (compactionInterval) {
        clearInterval(compactionInterval);
      }

      // 7. Close database
      if (database) {
        console.log('[App] Closing database...');
        await database.close();
        console.log('[App] Database closed successfully');
      }

      console.log('[App] Graceful shutdown complete');

      // Now allow the app to quit
      // Use exit() instead of quit() because we already prevented will-quit
      // Calling quit() again would re-trigger will-quit causing recursion
      app.exit(0);
    } catch (error: unknown) {
      console.error('[App] Error during graceful shutdown:', error);
      // Still quit even if cleanup fails
      app.exit(1);
    }
  })();
});
