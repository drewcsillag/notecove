/**
 * @jest-environment node
 */

/**
 * Tests for REST API Routes
 */

import { WebServer } from '../server';
import { AuthManager } from '../auth';
import * as http from 'http';

describe('API Routes', () => {
  let server: WebServer;
  let authManager: AuthManager;
  let validToken: string;
  let port: number;

  // Helper to make HTTP requests
  const makeRequest = (
    method: string,
    path: string,
    options: { body?: unknown; token?: string } = {}
  ): Promise<{ statusCode: number; body: string }> => {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
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

  beforeEach(async () => {
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
  });

  describe('Route Registration', () => {
    it('should have /api/info endpoint', async () => {
      const response = await makeRequest('GET', '/api/info', { token: validToken });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.version).toBeDefined();
      expect(body.api).toBe('v1');
    });

    it('should require auth for /api/* routes', async () => {
      const response = await makeRequest('GET', '/api/info');
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for unknown API routes with valid auth', async () => {
      const response = await makeRequest('GET', '/api/unknown-route', { token: validToken });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for 401', async () => {
      const response = await makeRequest('GET', '/api/info');
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.message).toBeDefined();
    });

    it('should return consistent error format for 404', async () => {
      const response = await makeRequest('GET', '/api/nonexistent', { token: validToken });
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });
  });

  describe('CORS Headers', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/api/info',
            method: 'OPTIONS',
            headers: {
              Origin: 'http://localhost:3000',
              'Access-Control-Request-Method': 'GET',
            },
          },
          resolve
        );
        req.on('error', reject);
        req.end();
      });

      // CORS preflight should succeed
      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
