/**
 * Web Server Manager
 *
 * Manages the web server lifecycle and integrates it with the application's
 * service layer. This bridges the REST API with the existing IPC handlers.
 */

import { join } from 'path';
import { app } from 'electron';
import { WebServer } from './server';
import { AuthManager } from './auth';
import { setRouteContext, ServiceHandlers } from './routes/context';
import { ConfigManager } from '../config/manager';
import type { Database, NoteCache, FolderCache, SearchResult } from '@notecove/shared';
import type { CRDTManager } from '../crdt';
import type { IPCHandlers } from '../ipc/handlers';
import * as Y from 'yjs';

const DEFAULT_PORT = 8765;

export interface WebServerManagerConfig {
  database: Database;
  crdtManager: CRDTManager;
  ipcHandlers: IPCHandlers;
  configManager: ConfigManager;
}

export interface WebServerStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  token: string | null;
  connectedClients: number;
}

/**
 * Manages the web server lifecycle and provides integration with app services
 */
export class WebServerManager {
  private server: WebServer | null = null;
  private authManager: AuthManager;
  private database: Database;
  private crdtManager: CRDTManager;
  private ipcHandlers: IPCHandlers;
  private configManager: ConfigManager;

  constructor(config: WebServerManagerConfig) {
    this.database = config.database;
    this.crdtManager = config.crdtManager;
    this.ipcHandlers = config.ipcHandlers;
    this.configManager = config.configManager;
    this.authManager = new AuthManager();
  }

  /**
   * Initialize the manager and restore token from config if available
   */
  async initialize(): Promise<void> {
    const webConfig = await this.configManager.getWebServerConfig();
    if (webConfig.token) {
      // Restore saved token
      this.authManager.setCurrentToken(webConfig.token);
    } else {
      // Generate and save new token
      const token = this.authManager.regenerateToken();
      await this.configManager.setWebServerConfig({ token });
    }
  }

  /**
   * Start the web server
   */
  async start(port?: number): Promise<WebServerStatus> {
    if (this.server?.isRunning()) {
      return this.getStatus();
    }

    // Get port from config or use default
    const webConfig = await this.configManager.getWebServerConfig();
    const serverPort = port ?? webConfig.port ?? DEFAULT_PORT;

    // Set up service handlers for the routes
    const services = this.createServiceHandlers();
    setRouteContext({ services });

    // Path to browser bundle
    const distBrowserPath = app.isPackaged
      ? join(process.resourcesPath, 'dist-browser')
      : join(__dirname, '../../../dist-browser');

    // Create and start server
    this.server = new WebServer({
      port: serverPort,
      host: '0.0.0.0', // Allow LAN access
      authManager: this.authManager,
      staticFilesPath: distBrowserPath,
    });

    // Register broadcast callback with IPC handlers
    // Note: WebSocket broadcast is handled separately through the WebSocket routes
    this.ipcHandlers.setWebBroadcastCallback((channel, ...args) => {
      // TODO: Implement WebSocket broadcast in Phase 6
      console.log(`[WebServerManager] Broadcast to web clients: ${channel}`, args.length, 'args');
    });

    await this.server.start();

    // Save port to config
    await this.configManager.setWebServerConfig({
      enabled: true,
      port: serverPort,
    });

    console.log(`[WebServerManager] Server started on port ${serverPort}`);
    return this.getStatus();
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    // Unregister broadcast callback
    this.ipcHandlers.setWebBroadcastCallback(undefined);

    await this.server.stop();
    this.server = null;

    // Clear route context
    setRouteContext({ services: null });

    // Update config
    await this.configManager.setWebServerConfig({ enabled: false });

    console.log('[WebServerManager] Server stopped');
  }

  /**
   * Get current server status
   */
  getStatus(): WebServerStatus {
    return {
      running: this.server?.isRunning() ?? false,
      port: this.server?.getPort() ?? null,
      url: this.server?.getUrl() ?? null,
      token: this.authManager.getCurrentToken(),
      connectedClients: this.server?.getConnectedClientCount() ?? 0,
    };
  }

  /**
   * Regenerate the auth token
   */
  async regenerateToken(): Promise<string> {
    const token = this.authManager.regenerateToken();
    await this.configManager.setWebServerConfig({ token });
    return token;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server?.isRunning() ?? false;
  }

  /**
   * Create service handlers that delegate to the app's services
   */
  private createServiceHandlers(): ServiceHandlers {
    const db = this.database;
    const crdt = this.crdtManager;

    return {
      // Note operations
      noteList: async (sdId: string, folderId?: string | null) => {
        let notes: NoteCache[];
        if (folderId) {
          notes = await db.getNotesByFolder(folderId);
        } else {
          notes = await db.getNotesBySd(sdId);
          // Filter out deleted notes
          notes = notes.filter((n) => !n.deleted);
        }
        return notes.map((n) => ({
          id: n.id,
          title: n.title,
          contentPreview: n.contentPreview,
          folderId: n.folderId,
          sdId: n.sdId,
          created: n.created,
          modified: n.modified,
          pinned: n.pinned,
        }));
      },

      noteGetMetadata: async (noteId: string) => {
        const note = await db.getNote(noteId);
        if (!note) {
          throw new Error(`Note not found: ${noteId}`);
        }
        return {
          id: note.id,
          title: note.title,
          folderId: note.folderId,
          sdId: note.sdId,
          created: note.created,
          modified: note.modified,
          deleted: note.deleted,
          pinned: note.pinned,
        };
      },

      noteGetState: async (noteId: string) => {
        // Load the note's CRDT state
        await crdt.loadNote(noteId);
        const doc = crdt.getDocument(noteId);
        if (!doc) {
          // Return empty state for new note
          const emptyDoc = new Y.Doc();
          emptyDoc.getXmlFragment('content');
          return Y.encodeStateAsUpdate(emptyDoc);
        }
        return Y.encodeStateAsUpdate(doc);
      },

      noteApplyUpdate: async (noteId: string, update: Uint8Array) => {
        await crdt.applyUpdate(noteId, update);
      },

      noteCreate: async (sdId: string, folderId: string | null, _initialContent?: string) => {
        // Use IPC handler's createNote logic via a workaround
        // For now, we'll create a note by upserting to the cache
        // The proper way would be to expose createNote on IPCHandlers
        const noteId = crypto.randomUUID();
        const now = Date.now();
        await db.upsertNote({
          id: noteId,
          title: 'Untitled',
          contentPreview: '',
          contentText: '', // Required for FTS5 search
          folderId,
          sdId,
          created: now,
          modified: now,
          deleted: false,
          pinned: false,
        });
        return noteId;
      },

      noteDelete: async (noteId: string) => {
        // Soft delete by updating the deleted flag
        const note = await db.getNote(noteId);
        if (note) {
          await db.upsertNote({
            ...note,
            deleted: true,
            modified: Date.now(),
          });
        }
      },

      noteRestore: async (noteId: string) => {
        // Restore by clearing the deleted flag
        const note = await db.getNote(noteId);
        if (note) {
          await db.upsertNote({
            ...note,
            deleted: false,
            modified: Date.now(),
          });
        }
      },

      noteMove: async (noteId: string, newFolderId: string | null) => {
        const note = await db.getNote(noteId);
        if (note) {
          await db.upsertNote({
            ...note,
            folderId: newFolderId,
            modified: Date.now(),
          });
        }
      },

      noteSearch: async (query: string, limit?: number) => {
        const results: SearchResult[] = await db.searchNotes(query, limit);
        return results.map((r) => ({
          noteId: r.noteId,
          title: r.title,
          contentPreview: r.snippet,
          sdId: '', // SearchResult doesn't include sdId currently
          folderId: null,
          score: r.rank,
        }));
      },

      // Folder operations
      folderList: async (sdId: string) => {
        const folders: FolderCache[] = await db.getFoldersBySd(sdId);
        return folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          sdId: f.sdId,
          order: f.order,
          // Note: FolderCache doesn't have created/modified - return 0 for API compatibility
          created: 0,
          modified: 0,
        }));
      },

      folderCreate: async (sdId: string, parentId: string | null, name: string) => {
        const folderId = crypto.randomUUID();
        // Get max order for sibling folders
        const siblings = parentId
          ? await db.getChildFolders(parentId)
          : await db.getRootFolders(sdId);
        const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), -1);

        await db.upsertFolder({
          id: folderId,
          name,
          parentId,
          sdId,
          order: maxOrder + 1,
          deleted: false,
        });
        return folderId;
      },

      folderRename: async (_sdId: string, folderId: string, newName: string) => {
        const folder = await db.getFolder(folderId);
        if (folder) {
          await db.upsertFolder({
            ...folder,
            name: newName,
          });
        }
      },

      folderDelete: async (_sdId: string, folderId: string) => {
        await db.deleteFolder(folderId);
      },

      folderMove: async (_sdId: string, folderId: string, newParentId: string | null) => {
        const folder = await db.getFolder(folderId);
        if (folder) {
          await db.upsertFolder({
            ...folder,
            parentId: newParentId,
          });
        }
      },

      folderReorder: async (_sdId: string, folderId: string, newOrder: number) => {
        const folder = await db.getFolder(folderId);
        if (folder) {
          await db.upsertFolder({
            ...folder,
            order: newOrder,
          });
        }
      },

      // Tag operations
      tagGetAll: async () => {
        const tags = await db.getAllTags();
        return tags.map((t) => ({
          id: t.id,
          name: t.name,
          count: t.count,
        }));
      },

      // Storage directory operations
      sdList: async () => {
        const sds = await db.getAllStorageDirs();
        const activeSD = await db.getActiveStorageDir();
        const activeId = activeSD?.id ?? null;
        return sds.map((sd) => ({
          id: sd.id,
          name: sd.name,
          path: sd.path,
          created: sd.created,
          isActive: sd.id === activeId,
        }));
      },

      sdGetActive: async () => {
        const activeSD = await db.getActiveStorageDir();
        return activeSD?.id ?? null;
      },

      // History operations
      historyGetTimeline: (_noteId: string) => {
        // TODO: Implement history timeline
        return Promise.resolve([]);
      },

      historyGetStats: (_noteId: string) => {
        // TODO: Implement history stats
        return Promise.resolve({
          totalUpdates: 0,
          totalSessions: 0,
          firstEdit: null,
          lastEdit: null,
        });
      },

      // Diagnostics
      diagnosticsGetStatus: () => {
        // TODO: Implement diagnostics
        return Promise.resolve({
          duplicateNotes: 0,
          orphanedFiles: 0,
          missingFiles: 0,
        });
      },
    };
  }
}
