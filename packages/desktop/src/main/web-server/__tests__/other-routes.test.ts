/**
 * @jest-environment node
 */

/**
 * Tests for Tags, Storage Directories, History, and Diagnostics API Routes
 */

import { WebServer } from '../server';
import { AuthManager } from '../auth';
import { setRouteContext, ServiceHandlers, ApiTag, ApiStorageDirectory } from '../routes/context';
import * as http from 'http';

describe('Other API Routes', () => {
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

  const mockTags: ApiTag[] = [
    { id: 'tag-1', name: 'work', count: 5 },
    { id: 'tag-2', name: 'personal', count: 3 },
    { id: 'tag-3', name: 'important', count: 10 },
  ];

  const mockStorageDirectories: ApiStorageDirectory[] = [
    {
      id: 'sd-1',
      name: 'Main Storage',
      path: '/path/to/storage',
      created: Date.now() - 100000,
      isActive: true,
    },
    {
      id: 'sd-2',
      name: 'Backup',
      path: '/path/to/backup',
      created: Date.now() - 50000,
      isActive: false,
    },
  ];

  const mockTimeline = [
    { timestamp: Date.now() - 3600000, type: 'edit', size: 150 },
    { timestamp: Date.now() - 7200000, type: 'edit', size: 200 },
    { timestamp: Date.now() - 86400000, type: 'create', size: 50 },
  ];

  const mockHistoryStats = {
    totalUpdates: 25,
    totalSessions: 5,
    firstEdit: Date.now() - 86400000,
    lastEdit: Date.now() - 3600000,
  };

  const mockDiagnosticsStatus = {
    duplicateNotes: 0,
    orphanedFiles: 2,
    missingFiles: 1,
  };

  beforeEach(async () => {
    mockServices = {
      tagGetAll: jest.fn().mockResolvedValue(mockTags),
      sdList: jest.fn().mockResolvedValue(mockStorageDirectories),
      sdGetActive: jest.fn().mockResolvedValue('sd-1'),
      historyGetTimeline: jest.fn().mockResolvedValue(mockTimeline),
      historyGetStats: jest.fn().mockResolvedValue(mockHistoryStats),
      diagnosticsGetStatus: jest.fn().mockResolvedValue(mockDiagnosticsStatus),
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

  describe('Tag Routes', () => {
    describe('GET /api/tags', () => {
      it('should list all tags', async () => {
        const response = await makeRequest('GET', '/api/tags', { token: validToken });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBe(3);
        expect(body[0].name).toBe('work');
        expect(mockServices.tagGetAll).toHaveBeenCalled();
      });
    });
  });

  describe('Storage Directory Routes', () => {
    describe('GET /api/storage-directories', () => {
      it('should list all storage directories', async () => {
        const response = await makeRequest('GET', '/api/storage-directories', {
          token: validToken,
        });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBe(2);
        expect(body[0].name).toBe('Main Storage');
        expect(mockServices.sdList).toHaveBeenCalled();
      });
    });

    describe('GET /api/storage-directories/active', () => {
      it('should get active storage directory', async () => {
        const response = await makeRequest('GET', '/api/storage-directories/active', {
          token: validToken,
        });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.id).toBe('sd-1');
        expect(mockServices.sdGetActive).toHaveBeenCalled();
      });

      it('should return null when no active directory', async () => {
        (mockServices.sdGetActive as jest.Mock).mockResolvedValue(null);

        const response = await makeRequest('GET', '/api/storage-directories/active', {
          token: validToken,
        });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.id).toBeNull();
      });
    });
  });

  describe('History Routes', () => {
    describe('GET /api/notes/:noteId/history/timeline', () => {
      it('should get timeline for a note', async () => {
        const response = await makeRequest('GET', '/api/notes/note-1/history/timeline', {
          token: validToken,
        });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBe(3);
        expect(mockServices.historyGetTimeline).toHaveBeenCalledWith('note-1');
      });
    });

    describe('GET /api/notes/:noteId/history/stats', () => {
      it('should get history stats for a note', async () => {
        const response = await makeRequest('GET', '/api/notes/note-1/history/stats', {
          token: validToken,
        });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.totalUpdates).toBe(25);
        expect(body.totalSessions).toBe(5);
        expect(mockServices.historyGetStats).toHaveBeenCalledWith('note-1');
      });
    });
  });

  describe('Diagnostics Routes', () => {
    describe('GET /api/diagnostics/status', () => {
      it('should get diagnostics status', async () => {
        const response = await makeRequest('GET', '/api/diagnostics/status', { token: validToken });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.duplicateNotes).toBe(0);
        expect(body.orphanedFiles).toBe(2);
        expect(body.missingFiles).toBe(1);
        expect(mockServices.diagnosticsGetStatus).toHaveBeenCalled();
      });

      it('should return 500 when service fails with generic error', async () => {
        (mockServices.diagnosticsGetStatus as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const response = await makeRequest('GET', '/api/diagnostics/status', { token: validToken });
        expect(response.statusCode).toBe(500);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when tag service fails with generic error', async () => {
      (mockServices.tagGetAll as jest.Mock).mockRejectedValue(new Error('Service error'));

      const response = await makeRequest('GET', '/api/tags', { token: validToken });
      expect(response.statusCode).toBe(500);
    });

    it('should return 500 when sd list fails with generic error', async () => {
      (mockServices.sdList as jest.Mock).mockRejectedValue(new Error('Service error'));

      const response = await makeRequest('GET', '/api/storage-directories', {
        token: validToken,
      });
      expect(response.statusCode).toBe(500);
    });

    it('should return 500 when active sd fails with generic error', async () => {
      (mockServices.sdGetActive as jest.Mock).mockRejectedValue(new Error('Service error'));

      const response = await makeRequest('GET', '/api/storage-directories/active', {
        token: validToken,
      });
      expect(response.statusCode).toBe(500);
    });

    it('should return 404 when history timeline fails with not found', async () => {
      (mockServices.historyGetTimeline as jest.Mock).mockRejectedValue(new Error('Note not found'));

      const response = await makeRequest('GET', '/api/notes/note-1/history/timeline', {
        token: validToken,
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 404 when history stats fails with not found', async () => {
      (mockServices.historyGetStats as jest.Mock).mockRejectedValue(new Error('Note not found'));

      const response = await makeRequest('GET', '/api/notes/note-1/history/stats', {
        token: validToken,
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 500 when history timeline fails with generic error', async () => {
      (mockServices.historyGetTimeline as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await makeRequest('GET', '/api/notes/note-1/history/timeline', {
        token: validToken,
      });
      expect(response.statusCode).toBe(500);
    });

    it('should return 500 when history stats fails with generic error', async () => {
      (mockServices.historyGetStats as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await makeRequest('GET', '/api/notes/note-1/history/stats', {
        token: validToken,
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

    it('should return 503 when services not configured for tags', async () => {
      const response = await makeRequest('GET', '/api/tags', { token: validToken });
      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Services not configured');
    });

    it('should return 503 when services not configured for storage directories', async () => {
      const response = await makeRequest('GET', '/api/storage-directories', { token: validToken });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for active sd', async () => {
      const response = await makeRequest('GET', '/api/storage-directories/active', {
        token: validToken,
      });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for history timeline', async () => {
      const response = await makeRequest('GET', '/api/notes/note-1/history/timeline', {
        token: validToken,
      });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for history stats', async () => {
      const response = await makeRequest('GET', '/api/notes/note-1/history/stats', {
        token: validToken,
      });
      expect(response.statusCode).toBe(503);
    });

    it('should return 503 when services not configured for diagnostics', async () => {
      const response = await makeRequest('GET', '/api/diagnostics/status', { token: validToken });
      expect(response.statusCode).toBe(503);
    });
  });
});
