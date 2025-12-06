/**
 * @jest-environment node
 */

/**
 * Tests for Note API Routes
 */

import { WebServer } from '../server';
import { AuthManager } from '../auth';
import {
  setRouteContext,
  ServiceHandlers,
  ApiNoteListItem,
  ApiNoteMetadata,
} from '../routes/context';
import * as http from 'http';

describe('Note API Routes', () => {
  let server: WebServer;
  let authManager: AuthManager;
  let validToken: string;
  let port: number;
  let mockServices: Partial<ServiceHandlers>;

  // Helper to make HTTP requests
  const makeRequest = (
    method: string,
    path: string,
    options: { body?: unknown; token?: string } = {}
  ): Promise<{ statusCode: number; body: string }> => {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};

      // Only set Content-Type if there's a body
      if (options.body) {
        headers['Content-Type'] = 'application/json';
      }

      if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
      }

      const reqOptions: http.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers,
      };

      const req = http.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk: string) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode!, body });
        });
      });
      req.on('error', reject);

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  };

  const mockNotes: ApiNoteListItem[] = [
    {
      id: 'note-1',
      title: 'Test Note 1',
      contentPreview: 'This is the preview...',
      folderId: null,
      sdId: 'sd-1',
      created: Date.now() - 10000,
      modified: Date.now(),
      pinned: false,
    },
    {
      id: 'note-2',
      title: 'Test Note 2',
      contentPreview: 'Another preview...',
      folderId: 'folder-1',
      sdId: 'sd-1',
      created: Date.now() - 20000,
      modified: Date.now() - 5000,
      pinned: true,
    },
  ];

  const mockNoteMetadata: ApiNoteMetadata = {
    id: 'note-1',
    title: 'Test Note 1',
    folderId: null,
    sdId: 'sd-1',
    created: Date.now() - 10000,
    modified: Date.now(),
    deleted: false,
    pinned: false,
  };

  beforeEach(async () => {
    // Setup mock services
    mockServices = {
      noteList: jest.fn().mockResolvedValue(mockNotes),
      noteGetMetadata: jest.fn().mockResolvedValue(mockNoteMetadata),
      noteCreate: jest.fn().mockResolvedValue('new-note-id'),
      noteDelete: jest.fn().mockResolvedValue(undefined),
      noteMove: jest.fn().mockResolvedValue(undefined),
      noteSearch: jest.fn().mockResolvedValue([]),
    };

    setRouteContext({ services: mockServices as ServiceHandlers });

    authManager = new AuthManager();
    validToken = authManager.regenerateToken();
    server = new WebServer({ port: 0, authManager });
    await server.start();
    port = server.getPort()!;
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
    setRouteContext({ services: null });
  });

  describe('GET /api/notes', () => {
    it('should list notes for a storage directory', async () => {
      const response = await makeRequest('GET', '/api/notes?sdId=sd-1', { token: validToken });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(mockServices.noteList).toHaveBeenCalledWith('sd-1', undefined);
    });

    it('should filter notes by folder', async () => {
      const response = await makeRequest('GET', '/api/notes?sdId=sd-1&folderId=folder-1', {
        token: validToken,
      });
      expect(response.statusCode).toBe(200);
      expect(mockServices.noteList).toHaveBeenCalledWith('sd-1', 'folder-1');
    });

    it('should return 400 if sdId is missing', async () => {
      const response = await makeRequest('GET', '/api/notes', { token: validToken });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/notes/:id', () => {
    it('should get note metadata', async () => {
      const response = await makeRequest('GET', '/api/notes/note-1', { token: validToken });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.id).toBe('note-1');
      expect(body.title).toBe('Test Note 1');
      expect(mockServices.noteGetMetadata).toHaveBeenCalledWith('note-1');
    });

    it('should return 404 for non-existent note', async () => {
      (mockServices.noteGetMetadata as jest.Mock).mockRejectedValue(new Error('Note not found'));

      const response = await makeRequest('GET', '/api/notes/non-existent', { token: validToken });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/notes', () => {
    it('should create a new note', async () => {
      const response = await makeRequest('POST', '/api/notes', {
        token: validToken,
        body: { sdId: 'sd-1', folderId: null },
      });
      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.id).toBe('new-note-id');
      expect(mockServices.noteCreate).toHaveBeenCalledWith('sd-1', null, undefined);
    });

    it('should create note with initial content', async () => {
      const response = await makeRequest('POST', '/api/notes', {
        token: validToken,
        body: { sdId: 'sd-1', folderId: 'folder-1', initialContent: 'Hello world' },
      });
      expect(response.statusCode).toBe(201);
      expect(mockServices.noteCreate).toHaveBeenCalledWith('sd-1', 'folder-1', 'Hello world');
    });

    it('should return 400 if sdId is missing', async () => {
      const response = await makeRequest('POST', '/api/notes', {
        token: validToken,
        body: { folderId: null },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete a note', async () => {
      const response = await makeRequest('DELETE', '/api/notes/note-1', { token: validToken });
      expect(response.statusCode).toBe(204);
      expect(mockServices.noteDelete).toHaveBeenCalledWith('note-1');
    });
  });

  describe('POST /api/notes/:id/move', () => {
    it('should move a note to a different folder', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/move', {
        token: validToken,
        body: { folderId: 'folder-2' },
      });
      expect(response.statusCode).toBe(200);
      expect(mockServices.noteMove).toHaveBeenCalledWith('note-1', 'folder-2');
    });

    it('should move note to root (null folder)', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/move', {
        token: validToken,
        body: { folderId: null },
      });
      expect(response.statusCode).toBe(200);
      expect(mockServices.noteMove).toHaveBeenCalledWith('note-1', null);
    });
  });

  describe('GET /api/search', () => {
    it('should search notes', async () => {
      (mockServices.noteSearch as jest.Mock).mockResolvedValue([
        { noteId: 'note-1', title: 'Test', preview: 'Match here', score: 1 },
      ]);

      const response = await makeRequest('GET', '/api/search?q=test', { token: validToken });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(mockServices.noteSearch).toHaveBeenCalledWith('test', undefined);
    });

    it('should return 400 if query is missing', async () => {
      const response = await makeRequest('GET', '/api/search', { token: validToken });
      expect(response.statusCode).toBe(400);
    });

    it('should support limit parameter', async () => {
      const response = await makeRequest('GET', '/api/search?q=test&limit=10', {
        token: validToken,
      });
      expect(response.statusCode).toBe(200);
      expect(mockServices.noteSearch).toHaveBeenCalledWith('test', 10);
    });
  });

  describe('POST /api/notes/:id/load', () => {
    it('should acknowledge load request (no-op)', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/load', { token: validToken });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/notes/:id/unload', () => {
    it('should acknowledge unload request (no-op)', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/unload', { token: validToken });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('GET /api/notes/:id/state', () => {
    it('should get note CRDT state', async () => {
      mockServices.noteGetState = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

      const response = await makeRequest('GET', '/api/notes/note-1/state', { token: validToken });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.state).toEqual([1, 2, 3, 4]);
      expect(mockServices.noteGetState).toHaveBeenCalledWith('note-1');
    });

    it('should return error when service fails', async () => {
      mockServices.noteGetState = jest.fn().mockRejectedValue(new Error('Note not found'));

      const response = await makeRequest('GET', '/api/notes/non-existent/state', {
        token: validToken,
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/notes/:id/update', () => {
    it('should apply CRDT update', async () => {
      mockServices.noteApplyUpdate = jest.fn().mockResolvedValue(undefined);

      const response = await makeRequest('POST', '/api/notes/note-1/update', {
        token: validToken,
        body: { update: [1, 2, 3, 4] },
      });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockServices.noteApplyUpdate).toHaveBeenCalled();
    });

    it('should return 400 if update is missing', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/update', {
        token: validToken,
        body: {},
      });
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if update is not an array', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/update', {
        token: validToken,
        body: { update: 'not-an-array' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/notes/:id/title', () => {
    it('should acknowledge title update (no-op)', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/title', {
        token: validToken,
        body: { title: 'New Title', contentText: 'Updated content' },
      });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/notes/:id/restore', () => {
    it('should restore a deleted note', async () => {
      mockServices.noteRestore = jest.fn().mockResolvedValue(undefined);

      const response = await makeRequest('POST', '/api/notes/note-1/restore', {
        token: validToken,
      });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockServices.noteRestore).toHaveBeenCalledWith('note-1');
    });

    it('should return error when restore fails', async () => {
      mockServices.noteRestore = jest.fn().mockRejectedValue(new Error('Note not found'));

      const response = await makeRequest('POST', '/api/notes/non-existent/restore', {
        token: validToken,
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Additional Error Handling', () => {
    it('should return 500 when note list fails with generic error', async () => {
      (mockServices.noteList as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await makeRequest('GET', '/api/notes?sdId=sd-1', { token: validToken });
      expect(response.statusCode).toBe(500);
    });

    it('should return 500 when note create fails with generic error', async () => {
      (mockServices.noteCreate as jest.Mock).mockRejectedValue(new Error('Failed to create'));

      const response = await makeRequest('POST', '/api/notes', {
        token: validToken,
        body: { sdId: 'sd-1' },
      });
      expect(response.statusCode).toBe(500);
    });

    it('should return 404 when note delete fails with not found', async () => {
      (mockServices.noteDelete as jest.Mock).mockRejectedValue(new Error('Note not found'));

      const response = await makeRequest('DELETE', '/api/notes/non-existent', {
        token: validToken,
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 500 when note move fails with generic error', async () => {
      (mockServices.noteMove as jest.Mock).mockRejectedValue(new Error('Cannot move'));

      const response = await makeRequest('POST', '/api/notes/note-1/move', {
        token: validToken,
        body: { folderId: 'folder-1' },
      });
      expect(response.statusCode).toBe(500);
    });

    it('should return 500 when search fails with generic error', async () => {
      (mockServices.noteSearch as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const response = await makeRequest('GET', '/api/search?q=test', { token: validToken });
      expect(response.statusCode).toBe(500);
    });

    it('should return 500 when note update fails with generic error', async () => {
      mockServices.noteApplyUpdate = jest.fn().mockRejectedValue(new Error('Update failed'));

      const response = await makeRequest('POST', '/api/notes/note-1/update', {
        token: validToken,
        body: { update: [1, 2, 3] },
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('Services Not Configured', () => {
    beforeEach(async () => {
      // Clear services to trigger 503 responses
      if (server.isRunning()) {
        await server.stop();
      }
      setRouteContext({ services: null });
      server = new WebServer({ port: 0, authManager });
      await server.start();
      port = server.getPort()!;
    });

    it('should return 503 when services not configured for note list', async () => {
      const response = await makeRequest('GET', '/api/notes?sdId=sd-1', { token: validToken });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for note get', async () => {
      const response = await makeRequest('GET', '/api/notes/note-1', { token: validToken });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for note create', async () => {
      const response = await makeRequest('POST', '/api/notes', {
        token: validToken,
        body: { sdId: 'sd-1' },
      });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for note delete', async () => {
      const response = await makeRequest('DELETE', '/api/notes/note-1', { token: validToken });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for note move', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/move', {
        token: validToken,
        body: { folderId: 'folder-1' },
      });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for search', async () => {
      const response = await makeRequest('GET', '/api/search?q=test', { token: validToken });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for note state', async () => {
      const response = await makeRequest('GET', '/api/notes/note-1/state', { token: validToken });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for note update', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/update', {
        token: validToken,
        body: { update: [1, 2, 3] },
      });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for note restore', async () => {
      const response = await makeRequest('POST', '/api/notes/note-1/restore', { token: validToken });
      expect(response.statusCode).toBe(503);
    });
  });
});
