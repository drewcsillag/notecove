/**
 * Web Server Manager
 *
 * Manages the web server lifecycle and integrates it with the application's
 * service layer. This bridges the REST API with the existing IPC handlers.
 */

import { join } from 'path';
import * as fs from 'fs';
import { app } from 'electron';

/**
 * Check if app.getAppPath() returns dist-electron/main (vs package root or asar).
 *
 * This varies by launch method:
 * - Dev mode (`pnpm dev`): package root
 * - Test with `args: ['.']`: package root
 * - Test with explicit main path: dist-electron/main
 * - Production (asar): path to asar file (NOT dist-electron/main inside)
 *
 * Note: For dist-browser path resolution, production uses app.isPackaged check
 * with process.resourcesPath, so this function is only used for dev/test cases.
 */
function isAppPathInDistElectronMain(): boolean {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron/main');
}
import { WebServer, ConnectedClientInfo } from './server';
import { AuthManager } from './auth';
import { TLSManager, TLSCredentials, CertificateInfo } from './tls';
import { MDNSManager } from './mdns';
import { setRouteContext, ServiceHandlers } from './routes/context';
import {
  ConfigManager,
  TLSMode,
  WebServerConfig as StoredWebServerConfig,
} from '../config/manager';
import type { Database, NoteCache, FolderCache, SearchResult } from '@notecove/shared';
import type { CRDTManager } from '../crdt';
import type { IPCHandlers } from '../ipc';
import * as Y from 'yjs';

const DEFAULT_PORT = 8765;
const DEFAULT_TLS_MODE: TLSMode = 'self-signed';

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
  localhostOnly: boolean;
  tlsMode: TLSMode;
  tlsEnabled: boolean;
}

/**
 * Settings that can be changed by the user
 */
export interface WebServerSettings {
  port: number;
  localhostOnly: boolean;
  tlsMode: TLSMode;
  customCertPath?: string;
  customKeyPath?: string;
}

/**
 * Manages the web server lifecycle and provides integration with app services
 */
export class WebServerManager {
  private server: WebServer | null = null;
  private authManager: AuthManager;
  private tlsManager: TLSManager;
  private mdnsManager: MDNSManager;
  private database: Database;
  private crdtManager: CRDTManager;
  private ipcHandlers: IPCHandlers;
  private configManager: ConfigManager;
  private cachedConfig: StoredWebServerConfig = {};

  constructor(config: WebServerManagerConfig) {
    this.database = config.database;
    this.crdtManager = config.crdtManager;
    this.ipcHandlers = config.ipcHandlers;
    this.configManager = config.configManager;
    this.authManager = new AuthManager();
    this.mdnsManager = new MDNSManager();

    // Initialize TLS manager with cert directory in userData
    const certDir = join(app.getPath('userData'), 'certs');
    this.tlsManager = new TLSManager({ certDir });
  }

  /**
   * Initialize the manager and restore config from storage
   */
  async initialize(): Promise<void> {
    this.cachedConfig = await this.configManager.getWebServerConfig();

    if (this.cachedConfig.token) {
      // Restore saved token
      this.authManager.setCurrentToken(this.cachedConfig.token);
    } else {
      // Generate and save new token
      const token = this.authManager.regenerateToken();
      this.cachedConfig.token = token;
      await this.configManager.setWebServerConfig({ token });
    }

    // Set defaults for new options if not present
    this.cachedConfig.localhostOnly ??= false;
    this.cachedConfig.tlsMode ??= DEFAULT_TLS_MODE;
  }

  /**
   * Start the web server
   */
  async start(port?: number): Promise<WebServerStatus> {
    if (this.server?.isRunning()) {
      return this.getStatus();
    }

    // Get settings from cached config
    const serverPort = port ?? this.cachedConfig.port ?? DEFAULT_PORT;
    const localhostOnly = this.cachedConfig.localhostOnly ?? false;
    const tlsMode = this.cachedConfig.tlsMode ?? DEFAULT_TLS_MODE;

    // Set up service handlers for the routes
    const services = this.createServiceHandlers();
    setRouteContext({ services });

    // Path to browser bundle
    // Resolution varies by launch method - see isAppPathInDistElectronMain()
    let distBrowserPath: string;
    if (app.isPackaged) {
      distBrowserPath = join(process.resourcesPath, 'dist-browser');
    } else if (isAppPathInDistElectronMain()) {
      // Launched with explicit main path (e.g., E2E tests)
      // app.getAppPath() = dist-electron/main, so go up two levels
      distBrowserPath = join(app.getAppPath(), '..', '..', 'dist-browser');
    } else {
      // Dev mode or test with args: ['.']
      // app.getAppPath() = package root
      distBrowserPath = join(app.getAppPath(), 'dist-browser');
    }

    // Determine host based on localhostOnly setting
    const host = localhostOnly ? '127.0.0.1' : '0.0.0.0';

    // Get TLS credentials based on mode
    let tlsCredentials: TLSCredentials | undefined;
    const useHttps = tlsMode !== 'off';

    try {
      if (tlsMode === 'self-signed') {
        // Generate or load self-signed certificate
        tlsCredentials = this.tlsManager.ensureCertificate({
          commonName: 'NoteCove Local Server',
          altNames: ['localhost', '127.0.0.1'],
        });
      } else if (tlsMode === 'custom') {
        // Load user-provided certificate
        const certPath = this.cachedConfig.customCertPath;
        const keyPath = this.cachedConfig.customKeyPath;
        if (!certPath || !keyPath) {
          throw new Error(
            'Custom TLS mode requires both certificate and key paths to be configured.'
          );
        }
        if (!fs.existsSync(certPath)) {
          throw new Error(`Certificate file not found: ${certPath}`);
        }
        if (!fs.existsSync(keyPath)) {
          throw new Error(`Key file not found: ${keyPath}`);
        }
        try {
          tlsCredentials = {
            cert: fs.readFileSync(certPath, 'utf8'),
            key: fs.readFileSync(keyPath, 'utf8'),
          };
        } catch (readError) {
          throw new Error(
            `Failed to read certificate files: ${readError instanceof Error ? readError.message : 'Unknown error'}`
          );
        }
      }
    } catch (certError) {
      throw new Error(
        `TLS certificate error: ${certError instanceof Error ? certError.message : 'Unknown error'}`
      );
    }

    // Create and start server
    this.server = new WebServer({
      port: serverPort,
      host,
      https: useHttps,
      ...(tlsCredentials ? { tlsCredentials } : {}),
      authManager: this.authManager,
      staticFilesPath: distBrowserPath,
    });

    // Register broadcast callback with IPC handlers to forward to WebSocket clients
    this.ipcHandlers.setWebBroadcastCallback((channel, ...args) => {
      if (this.server) {
        // Convert Uint8Array to regular arrays for JSON serialization
        // (JSON.stringify turns Uint8Array into {"0":1,"1":2,...} not [1,2,...])
        const serializedArgs = args.map((arg) =>
          arg instanceof Uint8Array ? Array.from(arg) : arg
        );
        // Send in format expected by web-client.ts: { channel, args }
        this.server.broadcast({ channel, args: serializedArgs });
      }
    });

    await this.server.start();

    // Save config
    this.cachedConfig.enabled = true;
    this.cachedConfig.port = serverPort;
    await this.configManager.setWebServerConfig({
      enabled: true,
      port: serverPort,
    });

    console.log(
      `[WebServerManager] Server started on port ${serverPort} (TLS: ${tlsMode}, localhost-only: ${localhostOnly})`
    );

    // Start mDNS advertisement (non-blocking, failures are logged but don't fail server start)
    if (!localhostOnly) {
      this.mdnsManager.start({
        port: serverPort,
        tlsEnabled: useHttps,
      });
    }

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

    // Stop mDNS advertisement
    this.mdnsManager.stop();

    console.log('[WebServerManager] Server stopped');
  }

  /**
   * Get current server status
   */
  getStatus(): WebServerStatus {
    const tlsMode = this.cachedConfig.tlsMode ?? DEFAULT_TLS_MODE;
    return {
      running: this.server?.isRunning() ?? false,
      port: this.server?.getPort() ?? this.cachedConfig.port ?? DEFAULT_PORT,
      url: this.server?.getUrl() ?? null,
      token: this.authManager.getCurrentToken(),
      connectedClients: this.server?.getConnectedClientCount() ?? 0,
      localhostOnly: this.cachedConfig.localhostOnly ?? false,
      tlsMode,
      tlsEnabled: tlsMode !== 'off',
    };
  }

  /**
   * Get current settings (can be called when server is stopped)
   */
  getSettings(): WebServerSettings {
    const settings: WebServerSettings = {
      port: this.cachedConfig.port ?? DEFAULT_PORT,
      localhostOnly: this.cachedConfig.localhostOnly ?? false,
      tlsMode: this.cachedConfig.tlsMode ?? DEFAULT_TLS_MODE,
    };
    if (this.cachedConfig.customCertPath !== undefined) {
      settings.customCertPath = this.cachedConfig.customCertPath;
    }
    if (this.cachedConfig.customKeyPath !== undefined) {
      settings.customKeyPath = this.cachedConfig.customKeyPath;
    }
    return settings;
  }

  /**
   * Update settings (must stop and restart server for changes to take effect)
   */
  async setSettings(settings: Partial<WebServerSettings>): Promise<void> {
    // Update cached config
    if (settings.port !== undefined) {
      this.cachedConfig.port = settings.port;
    }
    if (settings.localhostOnly !== undefined) {
      this.cachedConfig.localhostOnly = settings.localhostOnly;
    }
    if (settings.tlsMode !== undefined) {
      this.cachedConfig.tlsMode = settings.tlsMode;
    }
    if (settings.customCertPath !== undefined) {
      this.cachedConfig.customCertPath = settings.customCertPath;
    }
    if (settings.customKeyPath !== undefined) {
      this.cachedConfig.customKeyPath = settings.customKeyPath;
    }

    // Persist to config file
    const configToSave: Partial<StoredWebServerConfig> = {};
    if (this.cachedConfig.port !== undefined) {
      configToSave.port = this.cachedConfig.port;
    }
    if (this.cachedConfig.localhostOnly !== undefined) {
      configToSave.localhostOnly = this.cachedConfig.localhostOnly;
    }
    if (this.cachedConfig.tlsMode !== undefined) {
      configToSave.tlsMode = this.cachedConfig.tlsMode;
    }
    if (this.cachedConfig.customCertPath !== undefined) {
      configToSave.customCertPath = this.cachedConfig.customCertPath;
    }
    if (this.cachedConfig.customKeyPath !== undefined) {
      configToSave.customKeyPath = this.cachedConfig.customKeyPath;
    }
    await this.configManager.setWebServerConfig(configToSave);
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
   * Get list of connected clients with their info
   */
  getConnectedClients(): ConnectedClientInfo[] {
    return this.server?.getConnectedClients() ?? [];
  }

  /**
   * Disconnect a specific client by ID
   */
  disconnectClient(clientId: string): boolean {
    return this.server?.disconnectClient(clientId) ?? false;
  }

  /**
   * Disconnect all connected clients
   */
  disconnectAllClients(): void {
    this.server?.disconnectAllClients();
  }

  /**
   * Get certificate information
   */
  getCertificateInfo(): (CertificateInfo & { path: string }) | null {
    const info = this.tlsManager.getCertificateInfo();
    if (!info) {
      return null;
    }
    return {
      ...info,
      path: this.tlsManager.getCertPath(),
    };
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
