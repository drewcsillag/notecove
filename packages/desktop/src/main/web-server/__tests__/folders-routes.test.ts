/**
 * Tests for Folder API Routes
 */

import { WebServer } from '../server';
import { AuthManager } from '../auth';
import { setRouteContext, ServiceHandlers, ApiFolderData } from '../routes/context';
import * as http from 'http';

describe('Folder API Routes', () => {
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

  const mockFolders: ApiFolderData[] = [
    {
      id: 'folder-1',
      name: 'Work',
      parentId: null,
      sdId: 'sd-1',
      order: 0,
      created: Date.now() - 10000,
      modified: Date.now(),
    },
    {
      id: 'folder-2',
      name: 'Personal',
      parentId: null,
      sdId: 'sd-1',
      order: 1,
      created: Date.now() - 20000,
      modified: Date.now() - 5000,
    },
    {
      id: 'folder-3',
      name: 'Subfolder',
      parentId: 'folder-1',
      sdId: 'sd-1',
      order: 0,
      created: Date.now() - 5000,
      modified: Date.now() - 1000,
    },
  ];

  beforeEach(async () => {
    // Setup mock services
    mockServices = {
      folderList: jest.fn().mockResolvedValue(mockFolders),
      folderCreate: jest.fn().mockResolvedValue('new-folder-id'),
      folderRename: jest.fn().mockResolvedValue(undefined),
      folderDelete: jest.fn().mockResolvedValue(undefined),
      folderMove: jest.fn().mockResolvedValue(undefined),
      folderReorder: jest.fn().mockResolvedValue(undefined),
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

  describe('GET /api/folders', () => {
    it('should list folders for a storage directory', async () => {
      const response = await makeRequest('GET', '/api/folders?sdId=sd-1', { token: validToken });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(3);
      expect(mockServices.folderList).toHaveBeenCalledWith('sd-1');
    });

    it('should return 400 if sdId is missing', async () => {
      const response = await makeRequest('GET', '/api/folders', { token: validToken });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/folders', () => {
    it('should create a new folder', async () => {
      const response = await makeRequest('POST', '/api/folders', {
        token: validToken,
        body: { sdId: 'sd-1', parentId: null, name: 'New Folder' },
      });
      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.id).toBe('new-folder-id');
      expect(mockServices.folderCreate).toHaveBeenCalledWith('sd-1', null, 'New Folder');
    });

    it('should create folder with parent', async () => {
      const response = await makeRequest('POST', '/api/folders', {
        token: validToken,
        body: { sdId: 'sd-1', parentId: 'folder-1', name: 'Child Folder' },
      });
      expect(response.statusCode).toBe(201);
      expect(mockServices.folderCreate).toHaveBeenCalledWith('sd-1', 'folder-1', 'Child Folder');
    });

    it('should return 400 if sdId is missing', async () => {
      const response = await makeRequest('POST', '/api/folders', {
        token: validToken,
        body: { name: 'Test Folder' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if name is missing', async () => {
      const response = await makeRequest('POST', '/api/folders', {
        token: validToken,
        body: { sdId: 'sd-1' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/folders/:sdId/:id', () => {
    it('should rename a folder', async () => {
      const response = await makeRequest('PUT', '/api/folders/sd-1/folder-1', {
        token: validToken,
        body: { name: 'Renamed Folder' },
      });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockServices.folderRename).toHaveBeenCalledWith('sd-1', 'folder-1', 'Renamed Folder');
    });

    it('should return 400 if name is missing', async () => {
      const response = await makeRequest('PUT', '/api/folders/sd-1/folder-1', {
        token: validToken,
        body: {},
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/folders/:sdId/:id', () => {
    it('should delete a folder', async () => {
      const response = await makeRequest('DELETE', '/api/folders/sd-1/folder-1', {
        token: validToken,
      });
      expect(response.statusCode).toBe(204);
      expect(mockServices.folderDelete).toHaveBeenCalledWith('sd-1', 'folder-1');
    });
  });

  describe('POST /api/folders/:sdId/:id/move', () => {
    it('should move a folder to a different parent', async () => {
      const response = await makeRequest('POST', '/api/folders/sd-1/folder-3/move', {
        token: validToken,
        body: { parentId: 'folder-2' },
      });
      expect(response.statusCode).toBe(200);
      expect(mockServices.folderMove).toHaveBeenCalledWith('sd-1', 'folder-3', 'folder-2');
    });

    it('should move folder to root (null parent)', async () => {
      const response = await makeRequest('POST', '/api/folders/sd-1/folder-3/move', {
        token: validToken,
        body: { parentId: null },
      });
      expect(response.statusCode).toBe(200);
      expect(mockServices.folderMove).toHaveBeenCalledWith('sd-1', 'folder-3', null);
    });
  });

  describe('POST /api/folders/:sdId/:id/reorder', () => {
    it('should reorder a folder', async () => {
      const response = await makeRequest('POST', '/api/folders/sd-1/folder-1/reorder', {
        token: validToken,
        body: { order: 2 },
      });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockServices.folderReorder).toHaveBeenCalledWith('sd-1', 'folder-1', 2);
    });

    it('should return 400 if order is missing', async () => {
      const response = await makeRequest('POST', '/api/folders/sd-1/folder-1/reorder', {
        token: validToken,
        body: {},
      });
      expect(response.statusCode).toBe(400);
    });

    it('should accept order of 0', async () => {
      const response = await makeRequest('POST', '/api/folders/sd-1/folder-2/reorder', {
        token: validToken,
        body: { order: 0 },
      });
      expect(response.statusCode).toBe(200);
      expect(mockServices.folderReorder).toHaveBeenCalledWith('sd-1', 'folder-2', 0);
    });
  });
});
