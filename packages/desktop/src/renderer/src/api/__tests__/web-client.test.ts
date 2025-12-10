/**
 * Tests for Web Client
 */

import {
  setToken,
  clearToken,
  setServerUrl,
  isAuthenticated,
  validateToken,
  initWebClient,
  webClient,
} from '../web-client';

// Mock fetch
global.fetch = jest.fn();

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.CLOSED;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn();
}

(global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue('test clipboard text'),
  },
});

describe('Web Client', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    setServerUrl('http://localhost:8080');
  });

  describe('Token Management', () => {
    it('should set and get token', () => {
      setToken('test-token');
      expect(isAuthenticated()).toBe(true);
    });

    it('should clear token', () => {
      setToken('test-token');
      clearToken();
      expect(isAuthenticated()).toBe(false);
    });

    it('should return false for isAuthenticated when no token', () => {
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('Server URL Management', () => {
    it('should set server URL', () => {
      setServerUrl('http://localhost:8080');
      // The URL is stored in localStorage
      expect(localStorageMock.getItem('notecove_server_url')).toBe('http://localhost:8080');
    });
  });

  describe('validateToken', () => {
    it('should return true when API request succeeds', async () => {
      setToken('valid-token');
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"version":"1.0"}'),
      });

      const result = await validateToken();

      expect(result).toBe(true);
    });

    it('should return false when API request fails', async () => {
      setToken('invalid-token');
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await validateToken();

      expect(result).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      clearToken();

      const result = await validateToken();

      expect(result).toBe(false);
    });
  });

  describe('initWebClient', () => {
    it('should install web client on window.electronAPI', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      initWebClient();

      expect(window.electronAPI).toBe(webClient);
      expect(consoleSpy).toHaveBeenCalledWith('[WebClient] Installing web client');

      consoleSpy.mockRestore();
    });
  });

  describe('webClient', () => {
    it('should have platform set to browser', () => {
      expect(webClient.platform).toBe('browser');
    });

    describe('shell.openExternal', () => {
      it('should open URL in new tab', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation();

        await webClient.shell.openExternal('https://example.com');

        expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank');

        openSpy.mockRestore();
      });
    });

    describe('clipboard', () => {
      it('should write to clipboard', async () => {
        await webClient.clipboard.writeText('test text');

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
      });

      it('should read from clipboard', async () => {
        const text = await webClient.clipboard.readText();

        expect(navigator.clipboard.readText).toHaveBeenCalled();
        expect(text).toBe('test clipboard text');
      });
    });

    describe('appState', () => {
      it('should get state from localStorage', async () => {
        localStorageMock.setItem('notecove_state_testKey', 'testValue');

        const value = await webClient.appState.get('testKey');

        expect(value).toBe('testValue');
      });

      it('should set state in localStorage', async () => {
        await webClient.appState.set('newKey', 'newValue');

        expect(localStorageMock.getItem('notecove_state_newKey')).toBe('newValue');
      });
    });

    describe('sync', () => {
      it('should return empty status', async () => {
        const status = await webClient.sync.getStatus();

        expect(status).toEqual({ pendingCount: 0, perSd: [], isSyncing: false });
      });

      it('should return empty stale syncs', async () => {
        const staleSyncs = await webClient.sync.getStaleSyncs();

        expect(staleSyncs).toEqual([]);
      });
    });

    describe('note.getDeletedNoteCount', () => {
      it('should return 0', async () => {
        const count = await webClient.note.getDeletedNoteCount('sd-1');

        expect(count).toBe(0);
      });
    });

    describe('note.getInfo', () => {
      it('should return null', async () => {
        const info = await webClient.note.getInfo('note-1');

        expect(info).toBeNull();
      });
    });

    describe('link.getBacklinks', () => {
      it('should return empty array', async () => {
        const backlinks = await webClient.link.getBacklinks('note-1');

        expect(backlinks).toEqual([]);
      });
    });

    describe('diagnostics', () => {
      it('should return empty arrays for diagnostic methods', async () => {
        expect(await webClient.diagnostics.getOrphanedCRDTFiles()).toEqual([]);
        expect(await webClient.diagnostics.getMissingCRDTFiles()).toEqual([]);
        expect(await webClient.diagnostics.getStaleMigrationLocks()).toEqual([]);
        expect(await webClient.diagnostics.getOrphanedActivityLogs()).toEqual([]);
      });
    });

    describe('browserNotAvailable features', () => {
      it('should throw for sd.create', () => {
        expect(() => webClient.sd.create('name', 'path')).toThrow('not available in browser mode');
      });

      it('should throw for backup.createManualBackup', () => {
        expect(() => webClient.backup.createManualBackup('sd-1', false)).toThrow(
          'not available in browser mode'
        );
      });

      it('should throw for config.getDatabasePath', () => {
        expect(() => webClient.config.getDatabasePath()).toThrow('not available in browser mode');
      });

      it('should throw for recovery.getStaleMoves', () => {
        expect(() => webClient.recovery.getStaleMoves()).toThrow('not available in browser mode');
      });
    });

    describe('noopSubscription handlers', () => {
      it('should return unsubscribe function for menu events', () => {
        const unsubscribe = webClient.menu.onNewNote(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
        expect(() => {
          unsubscribe();
        }).not.toThrow();
      });

      it('should return unsubscribe function for sd events', () => {
        const unsubscribe = webClient.sd.onOpenSettings(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
      });

      it('should return unsubscribe function for shutdown events', () => {
        const unsubscribe = webClient.shutdown.onProgress(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
      });

      it('should return unsubscribe function for tools events', () => {
        const unsubscribe = webClient.tools.onReindexProgress(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
      });

      it('should return unsubscribe function for sync events', () => {
        const unsubscribe = webClient.sync.onProgress(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
      });
    });

    describe('additional browserNotAvailable features', () => {
      it('should throw for sd.delete', () => {
        expect(() => webClient.sd.delete('sd-1')).toThrow('not available in browser mode');
      });

      it('should throw for sd.selectPath', () => {
        expect(() => webClient.sd.selectPath()).toThrow('not available in browser mode');
      });

      it('should throw for backup.restoreFromBackup', () => {
        expect(() => webClient.backup.restoreFromBackup('backup-id', '/path', true)).toThrow(
          'not available in browser mode'
        );
      });

      it('should throw for backup.deleteBackup', () => {
        expect(() => webClient.backup.deleteBackup('backup-id')).toThrow(
          'not available in browser mode'
        );
      });

      it('should throw for config.setDatabasePath', () => {
        expect(() => webClient.config.setDatabasePath('/path')).toThrow(
          'not available in browser mode'
        );
      });

      it('should throw for testing.createWindow', () => {
        expect(() => webClient.testing.createWindow()).toThrow('not available in browser mode');
      });

      it('should throw for tools.reindexNotes', () => {
        expect(() => webClient.tools.reindexNotes()).toThrow('not available in browser mode');
      });
    });

    describe('sync stub methods', () => {
      it('should return empty result for skipStaleEntry', async () => {
        const result = await webClient.sync.skipStaleEntry('sd-1', 'note-1', 'instance-1');
        expect(result).toEqual({ success: true });
      });

      it('should return empty result for retryStaleEntry', async () => {
        const result = await webClient.sync.retryStaleEntry('sd-1', 'note-1', 'instance-1');
        expect(result).toEqual({ success: true });
      });

      it('should return not supported for exportDiagnostics', async () => {
        const result = await webClient.sync.exportDiagnostics();
        expect(result).toEqual({ success: false, error: 'Not supported in web mode' });
      });

      it('should no-op for openWindow', async () => {
        await expect(webClient.sync.openWindow()).resolves.toBeUndefined();
      });
    });

    describe('telemetry browserNotAvailable', () => {
      it('should throw for telemetry.getSettings', () => {
        expect(() => webClient.telemetry.getSettings()).toThrow('not available in browser mode');
      });

      it('should throw for telemetry.updateSettings', () => {
        expect(() => webClient.telemetry.updateSettings({ consoleMetricsEnabled: true })).toThrow(
          'not available in browser mode'
        );
      });
    });

    describe('export browserNotAvailable', () => {
      it('should throw for export.selectDirectory', () => {
        expect(() => webClient.export.selectDirectory()).toThrow('not available in browser mode');
      });

      it('should throw for export.writeFile', () => {
        expect(() => webClient.export.writeFile('/path', 'content')).toThrow(
          'not available in browser mode'
        );
      });

      it('should throw for export.createDirectory', () => {
        expect(() => webClient.export.createDirectory('/path')).toThrow(
          'not available in browser mode'
        );
      });

      it('should throw for export.getNotesForExport', () => {
        expect(() => webClient.export.getNotesForExport(['note-1'])).toThrow(
          'not available in browser mode'
        );
      });
    });

    describe('webServer browserNotAvailable', () => {
      it('should throw for webServer.start', () => {
        expect(() => webClient.webServer.start()).toThrow('not available in browser mode');
      });

      it('should throw for webServer.stop', () => {
        expect(() => webClient.webServer.stop()).toThrow('not available in browser mode');
      });

      it('should throw for webServer.getStatus', () => {
        expect(() => webClient.webServer.getStatus()).toThrow('not available in browser mode');
      });
    });

    describe('diagnostics browserNotAvailable', () => {
      it('should throw for diagnostics.removeStaleMigrationLock', () => {
        expect(() => webClient.diagnostics.removeStaleMigrationLock(1)).toThrow(
          'not available in browser mode'
        );
      });

      it('should throw for diagnostics.importOrphanedCRDT', () => {
        expect(() => webClient.diagnostics.importOrphanedCRDT('note-1', 1)).toThrow(
          'not available in browser mode'
        );
      });
    });

    describe('recovery browserNotAvailable', () => {
      it('should throw for recovery.takeOverMove', () => {
        expect(() => webClient.recovery.takeOverMove('move-1')).toThrow(
          'not available in browser mode'
        );
      });

      it('should throw for recovery.cancelMove', () => {
        expect(() => webClient.recovery.cancelMove('move-1')).toThrow(
          'not available in browser mode'
        );
      });
    });

    describe('API Calls (fetchApi)', () => {
      beforeEach(() => {
        setToken('valid-token');
      });

      it('should handle successful API response with JSON body', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([{ id: 'folder-1', name: 'Test' }])),
        });

        const folders = await webClient.folder.list('sd-1');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/folders?sdId=sd-1'),
          expect.any(Object)
        );
        expect(folders).toHaveLength(1);
      });

      it('should handle empty API response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        const result = await webClient.folder.list('sd-1');

        expect(result).toEqual([]);
      });

      it('should return empty array when API fails (folder.list catches errors)', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ message: 'Server error' }),
        });

        // folder.list catches errors and returns empty array
        const result = await webClient.folder.list('sd-1');
        expect(result).toEqual([]);
      });

      it('should send body in POST requests', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ id: 'new-folder' })),
        });

        await webClient.folder.create('sd-1', null, 'New Folder');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/folders'),
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          })
        );
      });
    });

    describe('Note Operations', () => {
      beforeEach(() => {
        setToken('valid-token');
      });

      it('should list notes for a folder', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(JSON.stringify([{ id: 'note-1', title: 'Test Note', sdId: 'sd-1' }])),
        });

        const notes = await webClient.note.list('sd-1', 'folder-1');

        expect(notes).toHaveLength(1);
        expect(notes[0]?.id).toBe('note-1');
      });

      it('should return empty array when note list fails', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const notes = await webClient.note.list('sd-1');

        expect(notes).toEqual([]);
      });

      it('should search notes', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify([{ noteId: 'note-1', title: 'Result', snippet: 'match', rank: 1 }])
            ),
        });

        const results = await webClient.note.search('test query', 10);

        expect(results).toHaveLength(1);
        expect(results[0]?.noteId).toBe('note-1');
      });

      it('should return empty array when search fails', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const results = await webClient.note.search('test');

        expect(results).toEqual([]);
      });

      it('should get note count for folder', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }])),
        });

        const count = await webClient.note.getCountForFolder('sd-1', 'folder-1');

        expect(count).toBe(3);
      });

      it('should return 0 count when get count fails', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const count = await webClient.note.getCountForFolder('sd-1', null);

        expect(count).toBe(0);
      });

      it('should get all notes count', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([{ id: 'n1' }, { id: 'n2' }])),
        });

        const count = await webClient.note.getAllNotesCount('sd-1');

        expect(count).toBe(2);
      });

      it('should return 0 all notes count on failure', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const count = await webClient.note.getAllNotesCount('sd-1');

        expect(count).toBe(0);
      });

      it('should load note', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        await webClient.note.load('note-1');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notes/note-1/load'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should unload note', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        await webClient.note.unload('note-1');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notes/note-1/unload'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should get note state', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ state: [1, 2, 3] })),
        });

        const state = await webClient.note.getState('note-1');

        expect(state).toBeInstanceOf(Uint8Array);
        expect(state).toEqual(new Uint8Array([1, 2, 3]));
      });

      it('should apply update to note', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        const update = new Uint8Array([4, 5, 6]);
        await webClient.note.applyUpdate('note-1', update);

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notes/note-1/update'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should create note', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ noteId: 'new-note-id' })),
        });

        const noteId = await webClient.note.create('sd-1', 'folder-1', 'Initial content');

        expect(noteId).toBe('new-note-id');
      });

      it('should delete note', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        await webClient.note.delete('note-1');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notes/note-1'),
          expect.objectContaining({ method: 'DELETE' })
        );
      });

      it('should restore note', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        await webClient.note.restore('note-1');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notes/note-1/restore'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should toggle note pin', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        await webClient.note.togglePin('note-1');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notes/note-1/toggle-pin'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should move note to folder', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        await webClient.note.move('note-1', 'folder-2');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notes/note-1/move'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should update note title', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        await webClient.note.updateTitle('note-1', 'New Title', 'Content text');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notes/note-1/title'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should get note metadata', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                noteId: 'note-1',
                title: 'Test',
                folderId: 'folder-1',
                createdAt: 12345,
                modifiedAt: 67890,
                deleted: false,
              })
            ),
        });

        const metadata = await webClient.note.getMetadata('note-1');

        expect(metadata.noteId).toBe('note-1');
        expect(metadata.title).toBe('Test');
      });

      it('should list notes for root (no folder specified)', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([{ id: 'note-1' }])),
        });

        const notes = await webClient.note.list('sd-1');

        expect(notes).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/notes\?sdId=sd-1$/),
          expect.any(Object)
        );
      });

      it('should get count for root folder (null folderId)', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([{ id: 'n1' }])),
        });

        const count = await webClient.note.getCountForFolder('sd-1', null);

        expect(count).toBe(1);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/notes\?sdId=sd-1$/),
          expect.any(Object)
        );
      });

      it('should search notes without limit', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([{ noteId: 'n1' }])),
        });

        const results = await webClient.note.search('query');

        expect(results).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/search\?q=query$/),
          expect.any(Object)
        );
      });

      it('should create note without initial content', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ noteId: 'new-id' })),
        });

        const noteId = await webClient.note.create('sd-1', 'folder-1', '');

        expect(noteId).toBe('new-id');
      });

      it('should list notes with folderId undefined', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([{ id: 'note-1' }])),
        });

        const notes = await webClient.note.list('sd-1', undefined);

        expect(notes).toHaveLength(1);
      });
    });

    describe('Folder Operations', () => {
      beforeEach(() => {
        setToken('valid-token');
      });

      it('should rename folder', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ success: true })),
        });

        await webClient.folder.rename('sd-1', 'folder-1', 'New Name');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/folders/sd-1/folder-1'),
          expect.objectContaining({ method: 'PUT' })
        );
      });

      it('should delete folder', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

        await webClient.folder.delete('sd-1', 'folder-1');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/folders/sd-1/folder-1'),
          expect.objectContaining({ method: 'DELETE' })
        );
      });

      it('should move folder', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ success: true })),
        });

        await webClient.folder.move('sd-1', 'folder-1', 'parent-folder');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/folders/sd-1/folder-1/move'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });
});
