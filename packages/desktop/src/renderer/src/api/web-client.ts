/**
 * Web Client for Browser Access
 *
 * Implements the same interface as window.electronAPI but uses
 * HTTP REST APIs and WebSocket for browser clients.
 */

// Token storage key
const TOKEN_KEY = 'notecove_auth_token';
const SERVER_URL_KEY = 'notecove_server_url';

/**
 * Get the stored auth token
 */
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store the auth token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clear the auth token
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Get the server URL (defaults to same origin)
 */
function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) ?? window.location.origin;
}

/**
 * Set the server URL
 */
export function setServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url);
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = `${getServerUrl()}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  // Only set Content-Type and body if we have something to send
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: response.statusText }))) as {
      message?: string;
    };
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  // Handle empty responses - return empty object/array instead of undefined
  const text = await response.text();
  if (!text) {
    // For empty responses, return an empty array as a safe default
    // This prevents "Cannot read properties of undefined" errors
    return [] as unknown as T;
  }

  return JSON.parse(text) as T;
}

// WebSocket connection for real-time updates
let ws: WebSocket | null = null;
let wsConnecting = false;
let wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 2000;

const eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map<
  string,
  Set<(...args: unknown[]) => void>
>();

/**
 * Connect to WebSocket for real-time updates
 */
function connectWebSocket(): void {
  // Don't connect if already connected or connecting
  if (ws && ws.readyState === WebSocket.OPEN) return;
  if (wsConnecting) return;

  const token = getToken();
  if (!token) return;

  // Clear any pending reconnect
  if (wsReconnectTimeout) {
    clearTimeout(wsReconnectTimeout);
    wsReconnectTimeout = null;
  }

  wsConnecting = true;

  const serverUrl = getServerUrl();
  const wsUrl = serverUrl.replace(/^http/, 'ws') + `/ws?token=${token}`;

  console.log('[WebClient] Connecting to WebSocket...');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WebClient] WebSocket connected');
    wsConnecting = false;
    wsReconnectAttempts = 0; // Reset on successful connection
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as { channel: string; args: unknown[] };
      const { channel, args } = data;
      const listeners = eventListeners.get(channel);
      if (listeners) {
        for (const listener of listeners) {
          listener(...args);
        }
      }
    } catch (err: unknown) {
      console.error('[WebClient] Failed to parse WebSocket message:', err);
    }
  };

  ws.onclose = (event) => {
    wsConnecting = false;
    ws = null;

    // Don't reconnect if closed intentionally or too many attempts
    if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebClient] Max reconnect attempts reached, giving up');
      return;
    }

    // Don't reconnect on auth failure (code 1008 = policy violation, often used for auth)
    if (event.code === 1008) {
      console.warn('[WebClient] WebSocket auth failed, not reconnecting');
      return;
    }

    // Exponential backoff for reconnection
    wsReconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, wsReconnectAttempts - 1);
    console.log(
      `[WebClient] WebSocket closed, reconnecting in ${delay}ms (attempt ${wsReconnectAttempts})`
    );
    wsReconnectTimeout = setTimeout(connectWebSocket, delay);
  };

  ws.onerror = () => {
    // Error will be followed by close, so just mark as not connecting
    wsConnecting = false;
    // Don't log here - the error event doesn't have useful info and close will handle it
  };
}

/**
 * Subscribe to an event channel
 */
function subscribe(channel: string, callback: (...args: unknown[]) => void): () => void {
  if (!eventListeners.has(channel)) {
    eventListeners.set(channel, new Set());
  }
  const channelListeners = eventListeners.get(channel);
  if (channelListeners) {
    channelListeners.add(callback);
  }

  // Connect WebSocket if not connected
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket();
  }

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get(channel);
    if (listeners) {
      listeners.delete(callback);
    }
  };
}

/**
 * Feature not available in browser
 */
const browserNotAvailable = (feature: string) => {
  return () => {
    throw new Error(`[Browser] ${feature} is not available in browser mode`);
  };
};

/**
 * Returns a no-op unsubscribe function for event handlers not applicable in browser
 */
const noopSubscription = (): (() => void) => {
  return () => {
    // No-op unsubscribe - events don't apply in browser mode
  };
};

/**
 * Web client implementation of window.electronAPI
 */
export const webClient: typeof window.electronAPI = {
  platform: 'browser',

  note: {
    load: async (noteId: string) => {
      await apiRequest('POST', `/api/notes/${noteId}/load`);
    },
    unload: async (noteId: string) => {
      await apiRequest('POST', `/api/notes/${noteId}/unload`);
    },
    getState: async (noteId: string, _stateVector?: Uint8Array) => {
      const response = await apiRequest<{ state: number[] }>('GET', `/api/notes/${noteId}/state`);
      return new Uint8Array(response.state);
    },
    applyUpdate: async (noteId: string, update: Uint8Array) => {
      await apiRequest('POST', `/api/notes/${noteId}/update`, {
        update: Array.from(update),
      });
    },
    create: async (sdId: string, folderId: string | null, initialContent?: string) => {
      const response = await apiRequest<{ noteId: string }>('POST', '/api/notes', {
        sdId,
        folderId,
        initialContent,
      });
      return response.noteId;
    },
    delete: async (noteId: string) => {
      await apiRequest('DELETE', `/api/notes/${noteId}`);
    },
    restore: async (noteId: string) => {
      await apiRequest('POST', `/api/notes/${noteId}/restore`);
    },
    permanentDelete: browserNotAvailable('note.permanentDelete'),
    emptyTrash: browserNotAvailable('note.emptyTrash'),
    duplicate: browserNotAvailable('note.duplicate'),
    togglePin: async (noteId: string) => {
      await apiRequest('POST', `/api/notes/${noteId}/toggle-pin`);
    },
    move: async (noteId: string, newFolderId: string | null) => {
      await apiRequest('POST', `/api/notes/${noteId}/move`, { folderId: newFolderId });
    },
    moveToSD: browserNotAvailable('note.moveToSD'),
    getMetadata: async (noteId: string) => {
      const response = await apiRequest<{
        id: string;
        title: string;
        folderId: string | null;
        sdId: string;
        created: number;
        modified: number;
        deleted: boolean;
      }>('GET', `/api/notes/${noteId}`);

      // Map API response to IPC format
      return {
        noteId: response.id,
        title: response.title,
        folderId: response.folderId ?? '',
        sdId: response.sdId,
        createdAt: response.created,
        modifiedAt: response.modified,
        deleted: response.deleted,
      };
    },
    updateTitle: async (noteId: string, title: string, contentText?: string) => {
      await apiRequest('POST', `/api/notes/${noteId}/title`, { title, contentText });
    },
    list: async (sdId: string, folderId?: string | null) => {
      try {
        const params = new URLSearchParams({ sdId });
        if (folderId !== undefined && folderId !== null) {
          params.append('folderId', folderId);
        }
        return await apiRequest<
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
        >('GET', `/api/notes?${params.toString()}`);
      } catch {
        return [];
      }
    },
    search: async (query: string, limit?: number) => {
      try {
        const params = new URLSearchParams({ q: query });
        if (limit !== undefined) {
          params.append('limit', limit.toString());
        }
        return await apiRequest<
          {
            noteId: string;
            title: string;
            snippet: string;
            rank: number;
          }[]
        >('GET', `/api/search?${params.toString()}`);
      } catch {
        return [];
      }
    },
    getCountForFolder: async (sdId: string, folderId: string | null) => {
      // Note counts not exposed via API - calculate from list
      try {
        const params = new URLSearchParams({ sdId });
        if (folderId !== null) {
          params.append('folderId', folderId);
        }
        const notes = await apiRequest<unknown[]>('GET', `/api/notes?${params.toString()}`);
        return notes.length;
      } catch {
        return 0;
      }
    },
    getAllNotesCount: async (sdId: string) => {
      // Count all notes by listing them
      try {
        const notes = await apiRequest<unknown[]>('GET', `/api/notes?sdId=${sdId}`);
        return notes.length;
      } catch {
        return 0;
      }
    },
    getDeletedNoteCount: async (_sdId: string) => {
      // Deleted notes not exposed via web API
      await Promise.resolve();
      return 0;
    },
    createSnapshot: browserNotAvailable('note.createSnapshot'),
    checkExistsInSD: browserNotAvailable('note.checkExistsInSD'),
    getInfo: async (_noteId: string) => {
      // Note info endpoint not exposed - return null (not available in web client)
      await Promise.resolve();
      return null;
    },
    reloadFromCRDTLogs: browserNotAvailable('note.reloadFromCRDTLogs'),
    getSyncEvents: (_noteId: string) => {
      // Sync events not exposed in web client
      return Promise.resolve([]);
    },
    onUpdated: (callback) =>
      subscribe('note:updated', (noteId, update) => {
        callback(noteId as string, new Uint8Array(update as number[]));
      }),
    onDeleted: (callback) =>
      subscribe('note:deleted', (noteId) => {
        callback(noteId as string);
      }),
    onRestored: (callback) =>
      subscribe('note:restored', (noteId) => {
        callback(noteId as string);
      }),
    onPermanentDeleted: (callback) =>
      subscribe('note:permanentDeleted', (noteId) => {
        callback(noteId as string);
      }),
    onPinned: (callback) =>
      subscribe('note:pinned', (data) => {
        callback(data as { noteId: string; pinned: boolean });
      }),
    onCreated: (callback) =>
      subscribe('note:created', (data) => {
        callback(data as { sdId: string; noteId: string; folderId: string | null });
      }),
    onExternalUpdate: (callback) =>
      subscribe('note:externalUpdate', (data) => {
        callback(data as { operation: string; noteIds: string[] });
      }),
    onTitleUpdated: (callback) =>
      subscribe('note:title-updated', (data) => {
        callback(
          data as { noteId: string; title: string; modified: number; contentPreview?: string }
        );
      }),
    onMoved: (callback) =>
      subscribe('note:moved', (data) => {
        callback(
          data as { noteId: string; oldFolderId: string | null; newFolderId: string | null }
        );
      }),
    onModifiedUpdated: (callback) =>
      subscribe('note:modified-updated', (data) => {
        callback(data as { noteId: string; modified: number });
      }),
    onSyncEvent: (callback) =>
      subscribe('note:syncEvent', (data) => {
        callback(
          data as {
            id: string;
            timestamp: number;
            noteId: string;
            direction: 'outgoing' | 'incoming';
            instanceId: string;
            summary: string;
            sequence: number;
            updateSize: number;
          }
        );
      }),
  },

  history: {
    getTimeline: async (noteId: string) => {
      return apiRequest('GET', `/api/notes/${noteId}/history/timeline`);
    },
    getStats: async (noteId: string) => {
      return apiRequest('GET', `/api/notes/${noteId}/history/stats`);
    },
    reconstructAt: browserNotAvailable('history.reconstructAt'),
    getSessionPreview: browserNotAvailable('history.getSessionPreview'),
  },

  tag: {
    getAll: async () => {
      try {
        return await apiRequest<{ id: string; name: string; count: number }[]>('GET', '/api/tags');
      } catch {
        return [];
      }
    },
  },

  link: {
    getBacklinks: async (_noteId: string) => {
      // Backlinks not exposed via web API
      await Promise.resolve();
      return [];
    },
    searchNotesForAutocomplete: async (query: string) => {
      // Use search API for autocomplete
      try {
        const results = await apiRequest<
          { noteId: string; title: string; preview: string; sdId: string }[]
        >('GET', `/api/search?q=${encodeURIComponent(query)}&limit=10`);
        return results.map((r) => ({
          id: r.noteId,
          title: r.title,
          sdId: r.sdId,
          folderId: null,
          folderPath: '',
          created: 0,
          modified: 0,
        }));
      } catch {
        return [];
      }
    },
  },

  folder: {
    list: async (sdId: string) => {
      try {
        return await apiRequest<
          {
            id: string;
            name: string;
            parentId: string | null;
            sdId: string;
            order: number;
            deleted: boolean;
          }[]
        >('GET', `/api/folders?sdId=${sdId}`);
      } catch {
        return [];
      }
    },
    listAll: async () => {
      // listAll not exposed - get active SD and list its folders
      try {
        const response = await apiRequest<{ id: string | null }>(
          'GET',
          '/api/storage-directories/active'
        );
        const activeSD = response.id;
        if (!activeSD) return [];
        return await apiRequest('GET', `/api/folders?sdId=${activeSD}`);
      } catch {
        return [];
      }
    },
    get: async (sdId: string, folderId: string) => {
      // Individual folder get not exposed - find in list
      const folders = await apiRequest<
        {
          id: string;
          name: string;
          parentId: string | null;
          sdId: string;
          order: number;
          deleted: boolean;
        }[]
      >('GET', `/api/folders?sdId=${sdId}`);
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return null;
      return folder;
    },
    getChildInfo: async (sdId: string, folderId: string) => {
      // Calculate child info from folder list
      const folders = await apiRequest<
        {
          id: string;
          name: string;
          parentId: string | null;
          sdId: string;
          order: number;
          deleted: boolean;
        }[]
      >('GET', `/api/folders?sdId=${sdId}`);

      // Count direct children
      const children = folders.filter((f) => f.parentId === folderId && !f.deleted);
      const childCount = children.length;

      // Count all descendants (BFS)
      const descendants: string[] = [];
      const queue = [folderId];
      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId) break;
        const childFolders = folders.filter(
          (f) => f.parentId === currentId && !f.deleted && f.id !== folderId
        );
        for (const child of childFolders) {
          descendants.push(child.id);
          queue.push(child.id);
        }
      }

      return {
        hasChildren: childCount > 0,
        childCount,
        descendantCount: descendants.length,
      };
    },
    create: async (sdId: string, parentId: string | null, name: string) => {
      const response = await apiRequest<{ folderId: string }>('POST', '/api/folders', {
        sdId,
        parentId,
        name,
      });
      return response.folderId;
    },
    rename: async (sdId: string, folderId: string, newName: string) => {
      await apiRequest('PUT', `/api/folders/${sdId}/${folderId}`, { name: newName });
    },
    delete: async (sdId: string, folderId: string) => {
      await apiRequest('DELETE', `/api/folders/${sdId}/${folderId}`);
    },
    move: async (sdId: string, folderId: string, newParentId: string | null) => {
      await apiRequest('POST', `/api/folders/${sdId}/${folderId}/move`, {
        parentId: newParentId,
      });
    },
    reorder: async (sdId: string, folderId: string, newIndex: number) => {
      await apiRequest('POST', `/api/folders/${sdId}/${folderId}/reorder`, {
        newIndex,
      });
    },
    onUpdated: (callback) =>
      subscribe('folder:updated', (data) => {
        callback(data as { sdId: string; operation: string; folderId: string });
      }),
    emitSelected: async (_folderId: string) => {
      await Promise.resolve();
      // No-op in browser - folder selection is local state
    },
    onSelected: (callback) =>
      subscribe('folder:selected', (folderId) => {
        callback(folderId as string);
      }),
  },

  sd: {
    list: async () => {
      try {
        return await apiRequest<
          {
            id: string;
            name: string;
            path: string;
            created: number;
            isActive: boolean;
          }[]
        >('GET', '/api/storage-directories');
      } catch {
        return [];
      }
    },
    create: browserNotAvailable('sd.create'),
    setActive: browserNotAvailable('sd.setActive'),
    getActive: async () => {
      try {
        const response = await apiRequest<{ id: string | null }>(
          'GET',
          '/api/storage-directories/active'
        );
        return response.id;
      } catch {
        return null;
      }
    },
    delete: browserNotAvailable('sd.delete'),
    rename: browserNotAvailable('sd.rename'),
    selectPath: browserNotAvailable('sd.selectPath'),
    getCloudStoragePaths: browserNotAvailable('sd.getCloudStoragePaths'),
    onOpenSettings: noopSubscription,
    onUpdated: (callback) =>
      subscribe('sd:updated', (data) => {
        callback(data as { operation: string; sdId: string });
      }),
    onInitProgress: noopSubscription,
    onInitComplete: noopSubscription,
    onInitError: noopSubscription,
  },

  sync: {
    openWindow: async () => {
      // No-op in web mode - sync status is not applicable
    },
    getStatus: () => Promise.resolve({ pendingCount: 0, perSd: [], isSyncing: false }),
    getStaleSyncs: () => Promise.resolve([]),
    skipStaleEntry: () => Promise.resolve({ success: true }),
    retryStaleEntry: () => Promise.resolve({ success: true }),
    exportDiagnostics: () =>
      Promise.resolve({ success: false, error: 'Not supported in web mode' }),
    onProgress: noopSubscription,
    onStatusChanged: noopSubscription,
    onStaleEntriesChanged: noopSubscription,
  },

  appState: {
    get: async (key: string) => {
      await Promise.resolve();
      // Use localStorage for browser app state
      return localStorage.getItem(`notecove_state_${key}`);
    },
    set: async (key: string, value: string) => {
      await Promise.resolve();
      localStorage.setItem(`notecove_state_${key}`, value);
    },
  },

  shutdown: {
    onProgress: noopSubscription,
    onComplete: noopSubscription,
  },

  config: {
    getDatabasePath: browserNotAvailable('config.getDatabasePath'),
    setDatabasePath: browserNotAvailable('config.setDatabasePath'),
  },

  telemetry: {
    getSettings: browserNotAvailable('telemetry.getSettings'),
    updateSettings: browserNotAvailable('telemetry.updateSettings'),
  },

  recovery: {
    getStaleMoves: browserNotAvailable('recovery.getStaleMoves'),
    takeOverMove: browserNotAvailable('recovery.takeOverMove'),
    cancelMove: browserNotAvailable('recovery.cancelMove'),
  },

  diagnostics: {
    getDuplicateNotes: async () => {
      const status = await apiRequest<{ duplicateNotes: number }>('GET', '/api/diagnostics/status');
      // Return empty array - full diagnostics not exposed via web
      return status.duplicateNotes > 0 ? [] : [];
    },
    getOrphanedCRDTFiles: async () => {
      await Promise.resolve();
      return [];
    },
    getMissingCRDTFiles: async () => {
      await Promise.resolve();
      return [];
    },
    getStaleMigrationLocks: async () => {
      await Promise.resolve();
      return [];
    },
    getOrphanedActivityLogs: async () => {
      await Promise.resolve();
      return [];
    },
    removeStaleMigrationLock: browserNotAvailable('diagnostics.removeStaleMigrationLock'),
    cleanupOrphanedActivityLog: browserNotAvailable('diagnostics.cleanupOrphanedActivityLog'),
    importOrphanedCRDT: browserNotAvailable('diagnostics.importOrphanedCRDT'),
    deleteMissingCRDTEntry: browserNotAvailable('diagnostics.deleteMissingCRDTEntry'),
    deleteDuplicateNote: browserNotAvailable('diagnostics.deleteDuplicateNote'),
  },

  backup: {
    createPreOperationSnapshot: browserNotAvailable('backup.createPreOperationSnapshot'),
    createManualBackup: browserNotAvailable('backup.createManualBackup'),
    listBackups: browserNotAvailable('backup.listBackups'),
    restoreFromBackup: browserNotAvailable('backup.restoreFromBackup'),
    restoreFromCustomPath: browserNotAvailable('backup.restoreFromCustomPath'),
    deleteBackup: browserNotAvailable('backup.deleteBackup'),
    cleanupOldSnapshots: browserNotAvailable('backup.cleanupOldSnapshots'),
    setBackupDirectory: browserNotAvailable('backup.setBackupDirectory'),
    getBackupDirectory: browserNotAvailable('backup.getBackupDirectory'),
  },

  menu: {
    // Menu events don't apply in browser - no native menu
    onNewNote: noopSubscription,
    onNewFolder: noopSubscription,
    onFind: noopSubscription,
    onFindInNote: noopSubscription,
    onToggleDarkMode: noopSubscription,
    onToggleFolderPanel: noopSubscription,
    onToggleTagsPanel: noopSubscription,
    onToggleNotesListPanel: noopSubscription,
    onCreateSnapshot: noopSubscription,
    onViewHistory: noopSubscription,
    onNoteInfo: noopSubscription,
    onExportSelectedNotes: noopSubscription,
    onExportAllNotes: noopSubscription,
    onImportMarkdown: noopSubscription,
    onReloadFromCRDTLogs: noopSubscription,
    onReindexNotes: noopSubscription,
    onStorageInspector: noopSubscription,
    onFeatureFlags: noopSubscription,
  },

  tools: {
    reindexNotes: browserNotAvailable('tools.reindexNotes'),
    onReindexProgress: noopSubscription,
    onReindexComplete: noopSubscription,
    onReindexError: noopSubscription,
  },

  export: {
    selectDirectory: browserNotAvailable('export.selectDirectory'),
    writeFile: browserNotAvailable('export.writeFile'),
    createDirectory: browserNotAvailable('export.createDirectory'),
    getNotesForExport: browserNotAvailable('export.getNotesForExport'),
    showCompletionMessage: browserNotAvailable('export.showCompletionMessage'),
    copyImageFile: browserNotAvailable('export.copyImageFile'),
  },

  import: {
    selectSource: browserNotAvailable('import.selectSource'),
    scanSource: browserNotAvailable('import.scanSource'),
    execute: browserNotAvailable('import.execute'),
    cancel: browserNotAvailable('import.cancel'),
    onProgress: noopSubscription,
  },

  testing: {
    createWindow: browserNotAvailable('testing.createWindow'),
    setNoteTimestamp: browserNotAvailable('testing.setNoteTimestamp'),
  },

  app: {
    getInfo: async () => {
      const info = await apiRequest<{ version: string; api: string }>('GET', '/api/info');
      return {
        version: info.version,
        isDevBuild: false,
        profileId: null,
        profileName: null,
        instanceId: 'browser-client',
      };
    },
  },

  webServer: {
    // Web server control is not available from browser client
    start: browserNotAvailable('webServer.start'),
    stop: browserNotAvailable('webServer.stop'),
    getStatus: browserNotAvailable('webServer.getStatus'),
    getSettings: browserNotAvailable('webServer.getSettings'),
    setSettings: browserNotAvailable('webServer.setSettings'),
    regenerateToken: browserNotAvailable('webServer.regenerateToken'),
    getConnectedClients: browserNotAvailable('webServer.getConnectedClients'),
    disconnectClient: browserNotAvailable('webServer.disconnectClient'),
    disconnectAllClients: browserNotAvailable('webServer.disconnectAllClients'),
    getCertificateInfo: browserNotAvailable('webServer.getCertificateInfo'),
  },

  shell: {
    openExternal: async (url: string) => {
      await Promise.resolve();
      window.open(url, '_blank');
    },
  },

  clipboard: {
    writeText: async (text: string) => {
      await navigator.clipboard.writeText(text);
    },
    readText: async () => {
      return navigator.clipboard.readText();
    },
    writeRich: async (html: string, text: string) => {
      // Use Clipboard API with multiple formats if available
      // Fall back to plain text if ClipboardItem is not supported
      try {
        if (typeof ClipboardItem !== 'undefined') {
          const htmlBlob = new Blob([html], { type: 'text/html' });
          const textBlob = new Blob([text], { type: 'text/plain' });
          const item = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          });
          await navigator.clipboard.write([item]);
        } else {
          // Fallback: just write plain text
          await navigator.clipboard.writeText(text);
        }
      } catch {
        // Fallback: just write plain text
        await navigator.clipboard.writeText(text);
      }
    },
  },

  // Window state is not applicable in web client (no multi-window support)
  windowState: {
    reportCurrentNote: async () => {
      // No-op in web client - single window only
    },
    reportEditorState: async () => {
      // No-op in web client - no session restoration
    },
    reportPanelLayout: async () => {
      // No-op in web client - no per-window state
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    getSavedState: async () => {
      // No saved state in web client
      return null;
    },
  },

  window: {
    // eslint-disable-next-line @typescript-eslint/require-await
    openNoteInfo: async () => {
      // Not supported in web client - no separate windows
      return { success: false, error: 'Not supported in web client' };
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    openStorageInspector: async () => {
      // Not supported in web client - no separate windows
      return { success: false, error: 'Not supported in web client' };
    },
  },

  // Image operations via REST API
  image: {
    save: async (sdId: string, data: Uint8Array, mimeType: string) => {
      return apiRequest<{ imageId: string; filename: string }>('POST', `/api/images/${sdId}`, {
        data: Array.from(data),
        mimeType,
      });
    },
    getDataUrl: async (sdId: string, imageId: string) => {
      try {
        const response = await apiRequest<{ dataUrl: string }>(
          'GET',
          `/api/images/${sdId}/${imageId}/data`
        );
        return response.dataUrl;
      } catch {
        return null;
      }
    },
    getPath: async (_sdId: string, _imageId: string) => {
      // File paths are not meaningful in browser context
      return Promise.resolve(null);
    },
    delete: async (sdId: string, imageId: string) => {
      await apiRequest('DELETE', `/api/images/${sdId}/${imageId}`);
    },
    exists: async (sdId: string, imageId: string) => {
      try {
        await apiRequest('HEAD', `/api/images/${sdId}/${imageId}`);
        return true;
      } catch {
        return false;
      }
    },
    getMetadata: async (imageId: string) => {
      try {
        return await apiRequest<{
          id: string;
          sdId: string;
          filename: string;
          mimeType: string;
          width: number | null;
          height: number | null;
          size: number;
          created: number;
        }>('GET', `/api/images/metadata/${imageId}`);
      } catch {
        return null;
      }
    },
    list: async (sdId: string) => {
      return apiRequest<
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
      >('GET', `/api/images/${sdId}`);
    },
    getStorageStats: async (sdId: string) => {
      return apiRequest<{ totalSize: number; imageCount: number }>(
        'GET',
        `/api/images/${sdId}/stats`
      );
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    pickAndSave: async (_sdId: string) => {
      // File picker is not supported in web client
      throw new Error('File picker is not supported in browser mode');
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    downloadAndSave: async (_sdId: string, _url: string) => {
      // URL download is not supported in web client
      throw new Error('URL image download is not supported in browser mode');
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    copyToClipboard: async (_sdId: string, _imageId: string) => {
      // Clipboard copy is not supported in web client
      throw new Error('Clipboard copy is not supported in browser mode');
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    saveAs: async (_sdId: string, _imageId: string) => {
      // Save as is not supported in web client
      throw new Error('Save as is not supported in browser mode');
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    openExternal: async (_sdId: string, _imageId: string) => {
      // Open external is not supported in web client
      throw new Error('Open external is not supported in browser mode');
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    copyToSD: async (_sourceSdId: string, _targetSdId: string, _imageId: string) => {
      // Cross-SD copy is not supported in web client
      throw new Error('Cross-SD copy is not supported in browser mode');
    },
    // No-op in web client - images don't arrive via sync
    onAvailable: () => () => {
      /* No-op in web client */
    },
  },

  // Thumbnail operations via REST API
  thumbnail: {
    get: async (sdId: string, imageId: string) => {
      try {
        return await apiRequest<{
          path: string;
          format: 'jpeg' | 'png' | 'gif';
          width: number;
          height: number;
          size: number;
        }>('GET', `/api/thumbnails/${sdId}/${imageId}`);
      } catch {
        return null;
      }
    },
    getDataUrl: async (sdId: string, imageId: string) => {
      try {
        const response = await apiRequest<{ dataUrl: string }>(
          'GET',
          `/api/thumbnails/${sdId}/${imageId}/data`
        );
        return response.dataUrl;
      } catch {
        return null;
      }
    },
    exists: async (sdId: string, imageId: string) => {
      try {
        await apiRequest('HEAD', `/api/thumbnails/${sdId}/${imageId}`);
        return true;
      } catch {
        return false;
      }
    },
    delete: async (sdId: string, imageId: string) => {
      await apiRequest('DELETE', `/api/thumbnails/${sdId}/${imageId}`);
    },
    generate: async (sdId: string, imageId: string) => {
      try {
        return await apiRequest<{
          path: string;
          format: 'jpeg' | 'png' | 'gif';
          width: number;
          height: number;
          size: number;
        }>('POST', `/api/thumbnails/${sdId}/${imageId}/generate`);
      } catch {
        return null;
      }
    },
  },

  // Inspector is not available in web mode (desktop-only feature)
  inspector: {
    listSDContents: () => {
      console.warn('Storage inspector is not available in browser mode');
      return Promise.resolve({ root: '', children: [], error: 'Not available in browser mode' });
    },
    readFileInfo: () => {
      console.warn('Storage inspector is not available in browser mode');
      return Promise.resolve({
        path: '',
        type: 'unknown' as const,
        size: 0,
        modified: new Date(),
        data: new Uint8Array(),
        error: 'Not available in browser mode',
      });
    },
    parseFile: () => {
      console.warn('Storage inspector is not available in browser mode');
      return Promise.resolve({
        type: 'unknown' as const,
        error: 'Not available in browser mode',
      });
    },
  },

  comment: {
    getThreads: browserNotAvailable('comment.getThreads'),
    addThread: browserNotAvailable('comment.addThread'),
    updateThread: browserNotAvailable('comment.updateThread'),
    deleteThread: browserNotAvailable('comment.deleteThread'),
    addReply: browserNotAvailable('comment.addReply'),
    getReplies: browserNotAvailable('comment.getReplies'),
    updateReply: browserNotAvailable('comment.updateReply'),
    deleteReply: browserNotAvailable('comment.deleteReply'),
    getReactions: browserNotAvailable('comment.getReactions'),
    addReaction: browserNotAvailable('comment.addReaction'),
    removeReaction: browserNotAvailable('comment.removeReaction'),
    onThreadAdded: noopSubscription,
    onThreadUpdated: noopSubscription,
    onThreadDeleted: noopSubscription,
    onReplyAdded: noopSubscription,
    onReplyUpdated: noopSubscription,
    onReplyDeleted: noopSubscription,
    onReactionAdded: noopSubscription,
    onReactionRemoved: noopSubscription,
  },

  mention: {
    getUsers: browserNotAvailable('mention.getUsers'),
  },

  user: {
    getCurrentProfile: browserNotAvailable('user.getCurrentProfile'),
  },

  theme: {
    set: browserNotAvailable('theme.set'),
    onChanged: noopSubscription,
  },

  // Feature flags are not available in browser mode (desktop-only feature)
  featureFlags: {
    getAll: browserNotAvailable('featureFlags.getAll'),
    get: browserNotAvailable('featureFlags.get'),
    set: browserNotAvailable('featureFlags.set'),
    onChange: noopSubscription,
  },

  // oEmbed is not available in browser mode (desktop-only feature)
  oembed: {
    unfurl: browserNotAvailable('oembed.unfurl'),
    refresh: browserNotAvailable('oembed.refresh'),
    clearCache: browserNotAvailable('oembed.clearCache'),
    getCacheStats: browserNotAvailable('oembed.getCacheStats'),
    getFavicon: browserNotAvailable('oembed.getFavicon'),
    debug: {
      listFavicons: browserNotAvailable('oembed.debug.listFavicons'),
      listThumbnails: browserNotAvailable('oembed.debug.listThumbnails'),
      listFetchCache: browserNotAvailable('oembed.debug.listFetchCache'),
      deleteFavicon: browserNotAvailable('oembed.debug.deleteFavicon'),
      deleteThumbnail: browserNotAvailable('oembed.debug.deleteThumbnail'),
      clearAllFavicons: browserNotAvailable('oembed.debug.clearAllFavicons'),
      clearAllThumbnails: browserNotAvailable('oembed.debug.clearAllThumbnails'),
    },
  },
};

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Validate the token by making a test request
 */
export async function validateToken(): Promise<boolean> {
  try {
    await apiRequest('GET', '/api/info');
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize the web client on window.electronAPI
 */
export function initWebClient(): void {
  if (typeof window !== 'undefined') {
    console.log('[WebClient] Installing web client');
    window.electronAPI = webClient;

    // Connect WebSocket if authenticated
    if (isAuthenticated()) {
      connectWebSocket();
    }
  }
}
