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
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: response.statusText }))) as {
      message?: string;
    };
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

// WebSocket connection for real-time updates
let ws: WebSocket | null = null;
const eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map<
  string,
  Set<(...args: unknown[]) => void>
>();

/**
 * Connect to WebSocket for real-time updates
 */
function connectWebSocket(): void {
  const token = getToken();
  if (!token) return;

  const serverUrl = getServerUrl();
  const wsUrl = serverUrl.replace(/^http/, 'ws') + `/ws?token=${token}`;

  ws = new WebSocket(wsUrl);

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

  ws.onclose = () => {
    // Reconnect after a delay
    setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = (err) => {
    console.error('[WebClient] WebSocket error:', err);
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
    duplicate: browserNotAvailable('note.duplicate'),
    togglePin: async (noteId: string) => {
      await apiRequest('POST', `/api/notes/${noteId}/toggle-pin`);
    },
    move: async (noteId: string, newFolderId: string | null) => {
      await apiRequest('POST', `/api/notes/${noteId}/move`, { folderId: newFolderId });
    },
    moveToSD: browserNotAvailable('note.moveToSD'),
    getMetadata: async (noteId: string) => {
      return apiRequest('GET', `/api/notes/${noteId}`);
    },
    updateTitle: async (noteId: string, title: string, contentText?: string) => {
      await apiRequest('POST', `/api/notes/${noteId}/title`, { title, contentText });
    },
    list: async (sdId: string, folderId?: string | null) => {
      const params = new URLSearchParams({ sdId });
      if (folderId !== undefined && folderId !== null) {
        params.append('folderId', folderId);
      }
      return apiRequest('GET', `/api/notes?${params.toString()}`);
    },
    search: async (query: string, limit?: number) => {
      const params = new URLSearchParams({ q: query });
      if (limit !== undefined) {
        params.append('limit', limit.toString());
      }
      return apiRequest('GET', `/api/search?${params.toString()}`);
    },
    getCountForFolder: async (sdId: string, folderId: string | null) => {
      const params = new URLSearchParams({ sdId });
      if (folderId !== null) {
        params.append('folderId', folderId);
      }
      const response = await apiRequest<{ count: number }>(
        'GET',
        `/api/notes/count?${params.toString()}`
      );
      return response.count;
    },
    getAllNotesCount: async (sdId: string) => {
      const response = await apiRequest<{ count: number }>(
        'GET',
        `/api/notes/count/all?sdId=${sdId}`
      );
      return response.count;
    },
    getDeletedNoteCount: async (sdId: string) => {
      const response = await apiRequest<{ count: number }>(
        'GET',
        `/api/notes/count/deleted?sdId=${sdId}`
      );
      return response.count;
    },
    createSnapshot: browserNotAvailable('note.createSnapshot'),
    checkExistsInSD: browserNotAvailable('note.checkExistsInSD'),
    getInfo: async (noteId: string) => {
      return apiRequest('GET', `/api/notes/${noteId}/info`);
    },
    reloadFromCRDTLogs: browserNotAvailable('note.reloadFromCRDTLogs'),
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
        callback(data as { noteId: string; title: string });
      }),
    onMoved: (callback) =>
      subscribe('note:moved', (data) => {
        callback(
          data as { noteId: string; oldFolderId: string | null; newFolderId: string | null }
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
      return apiRequest('GET', '/api/tags');
    },
  },

  link: {
    getBacklinks: async (noteId: string) => {
      return apiRequest('GET', `/api/notes/${noteId}/backlinks`);
    },
    searchNotesForAutocomplete: async (query: string) => {
      return apiRequest('GET', `/api/notes/autocomplete?q=${encodeURIComponent(query)}`);
    },
  },

  folder: {
    list: async (sdId: string) => {
      return apiRequest('GET', `/api/folders?sdId=${sdId}`);
    },
    listAll: async () => {
      return apiRequest('GET', '/api/folders/all');
    },
    get: async (sdId: string, folderId: string) => {
      return apiRequest('GET', `/api/folders/${sdId}/${folderId}`);
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
      return apiRequest('GET', '/api/storage-directories');
    },
    create: browserNotAvailable('sd.create'),
    setActive: browserNotAvailable('sd.setActive'),
    getActive: async () => {
      return apiRequest('GET', '/api/storage-directories/active');
    },
    delete: browserNotAvailable('sd.delete'),
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
    onProgress: noopSubscription,
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
    onCreateSnapshot: noopSubscription,
    onViewHistory: noopSubscription,
    onNoteInfo: noopSubscription,
    onAbout: noopSubscription,
    onExportSelectedNotes: noopSubscription,
    onExportAllNotes: noopSubscription,
    onReloadFromCRDTLogs: noopSubscription,
    onReindexNotes: noopSubscription,
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
      };
    },
  },

  shell: {
    openExternal: async (url: string) => {
      await Promise.resolve();
      window.open(url, '_blank');
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
