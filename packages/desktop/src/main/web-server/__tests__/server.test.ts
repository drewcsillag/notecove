/**
 * Tests for Web Server
 */

import { WebServer, DEFAULT_WEB_SERVER_CONFIG } from '../server';
import { TLSManager } from '../tls';
import { AuthManager } from '../auth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('WebServer', () => {
  let server: WebServer | undefined;

  afterEach(async () => {
    if (server?.isRunning()) {
      await server.stop();
    }
  });

  describe('Construction', () => {
    it('should create with default configuration', () => {
      server = new WebServer();
      expect(server.getConfig()).toMatchObject({
        port: DEFAULT_WEB_SERVER_CONFIG.port,
        host: DEFAULT_WEB_SERVER_CONFIG.host,
      });
    });

    it('should create with custom port', () => {
      server = new WebServer({ port: 9999 });
      expect(server.getConfig().port).toBe(9999);
    });

    it('should create with custom host', () => {
      server = new WebServer({ host: '127.0.0.1' });
      expect(server.getConfig().host).toBe('127.0.0.1');
    });

    it('should not be running initially', () => {
      server = new WebServer();
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('Start and Stop', () => {
    it('should start successfully', async () => {
      server = new WebServer({ port: 0 }); // Port 0 = random available port
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should return server address after start', async () => {
      server = new WebServer({ port: 0 });
      const address = await server.start();
      expect(address).toBeDefined();
      expect(address.port).toBeGreaterThan(0);
    });

    it('should stop successfully', async () => {
      server = new WebServer({ port: 0 });
      await server.start();
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should throw when starting twice', async () => {
      server = new WebServer({ port: 0 });
      await server.start();
      await expect(server.start()).rejects.toThrow('already running');
    });

    it('should not throw when stopping a stopped server', async () => {
      server = new WebServer({ port: 0 });
      await expect(server.stop()).resolves.not.toThrow();
    });

    it('should allow restart after stop', async () => {
      server = new WebServer({ port: 0 });
      await server.start();
      await server.stop();
      await server.start();
      expect(server.isRunning()).toBe(true);
    });
  });

  describe('HTTP Responses', () => {
    it('should respond to health check endpoint', async () => {
      server = new WebServer({ port: 0 });
      await server.start();

      // Use node http module for actual request testing
      const http = await import('http');
      const port = server.getPort();

      const response = await new Promise<{ statusCode: number; body: string }>(
        (resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
            let body = '';
            res.on('data', (chunk: Buffer | string) => {
              body += String(chunk);
            });
            res.on('end', () => {
              resolve({ statusCode: res.statusCode!, body });
            });
          });
          req.on('error', reject);
        }
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });

    it('should return 404 for unknown routes', async () => {
      server = new WebServer({ port: 0 });
      await server.start();

      const http = await import('http');
      const port = server.getPort();

      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/unknown`, (res) => {
          res.resume(); // Consume response data
          res.on('end', () => {
            resolve({ statusCode: res.statusCode! });
          });
        });
        req.on('error', reject);
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Configuration', () => {
    it('should expose current port after start', async () => {
      server = new WebServer({ port: 0 });
      await server.start();
      expect(server.getPort()).toBeGreaterThan(0);
    });

    it('should return null port when not running', () => {
      server = new WebServer({ port: 8080 });
      expect(server.getPort()).toBeNull();
    });

    it('should expose server URL after start', async () => {
      server = new WebServer({ port: 0 });
      await server.start();
      const url = server.getUrl();
      expect(url).toMatch(/^http:\/\/.*:\d+$/);
    });

    it('should return null URL when not running', () => {
      server = new WebServer();
      expect(server.getUrl()).toBeNull();
    });
  });

  describe('Default Configuration', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_WEB_SERVER_CONFIG.port).toBe(8765);
      expect(DEFAULT_WEB_SERVER_CONFIG.host).toBe('0.0.0.0');
    });
  });

  describe('HTTPS Support', () => {
    let tempDir: string;
    let tlsManager: TLSManager;

    beforeEach(() => {
      // Create temp directory and generate test certificate
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notecove-https-test-'));
      tlsManager = new TLSManager({ certDir: tempDir });
      tlsManager.generateSelfSignedCert();
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should start with HTTPS when TLS credentials are provided', async () => {
      const creds = tlsManager.loadCredentials();
      server = new WebServer({ port: 0, https: true, tlsCredentials: creds! });
      await server.start();

      expect(server.isRunning()).toBe(true);
      expect(server.getUrl()).toMatch(/^https:\/\//);
    });

    it('should respond to health check over HTTPS', async () => {
      const creds = tlsManager.loadCredentials();
      server = new WebServer({ port: 0, https: true, tlsCredentials: creds! });
      await server.start();

      const https = await import('https');
      const port = server.getPort();

      const response = await new Promise<{ statusCode: number; body: string }>(
        (resolve, reject) => {
          const req = https.get(
            `https://127.0.0.1:${port}/health`,
            { rejectUnauthorized: false }, // Accept self-signed cert
            (res) => {
              let body = '';
              res.on('data', (chunk: Buffer | string) => {
                body += String(chunk);
              });
              res.on('end', () => {
                resolve({ statusCode: res.statusCode!, body });
              });
            }
          );
          req.on('error', reject);
        }
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });

    it('should throw when HTTPS enabled but no credentials provided', async () => {
      server = new WebServer({ port: 0, https: true });
      await expect(server.start()).rejects.toThrow('TLS credentials required');
    });
  });

  describe('Authentication Middleware', () => {
    let authManager: AuthManager;
    let validToken: string;

    beforeEach(() => {
      authManager = new AuthManager();
      validToken = authManager.regenerateToken();
    });

    it('should allow health endpoint without authentication', async () => {
      server = new WebServer({ port: 0, authManager });
      await server.start();

      const http = await import('http');
      const port = server.getPort();

      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
          res.resume();
          res.on('end', () => {
            resolve({ statusCode: res.statusCode! });
          });
        });
        req.on('error', reject);
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject API requests without token', async () => {
      server = new WebServer({ port: 0, authManager });
      await server.start();

      const http = await import('http');
      const port = server.getPort();

      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/test`, (res) => {
          res.resume();
          res.on('end', () => {
            resolve({ statusCode: res.statusCode! });
          });
        });
        req.on('error', reject);
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject API requests with invalid token', async () => {
      server = new WebServer({ port: 0, authManager });
      await server.start();

      const http = await import('http');
      const port = server.getPort();

      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${port}/api/test`,
          { headers: { Authorization: 'Bearer invalid-token' } },
          (res) => {
            res.resume();
            res.on('end', () => {
              resolve({ statusCode: res.statusCode! });
            });
          }
        );
        req.on('error', reject);
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow API requests with valid token in Authorization header', async () => {
      server = new WebServer({ port: 0, authManager });
      await server.start();

      const http = await import('http');
      const port = server.getPort();

      // Note: /api/test will return 404 since no route exists, but that's fine
      // We're testing auth middleware, not the route itself
      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${port}/api/test`,
          { headers: { Authorization: `Bearer ${validToken}` } },
          (res) => {
            res.resume();
            res.on('end', () => {
              resolve({ statusCode: res.statusCode! });
            });
          }
        );
        req.on('error', reject);
      });

      // Should get 404 (not found) not 401 (unauthorized)
      expect(response.statusCode).toBe(404);
    });

    it('should allow API requests with valid token in X-Auth-Token header', async () => {
      server = new WebServer({ port: 0, authManager });
      await server.start();

      const http = await import('http');
      const port = server.getPort();

      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${port}/api/test`,
          { headers: { 'X-Auth-Token': validToken } },
          (res) => {
            res.resume();
            res.on('end', () => {
              resolve({ statusCode: res.statusCode! });
            });
          }
        );
        req.on('error', reject);
      });

      // Should get 404 (not found) not 401 (unauthorized)
      expect(response.statusCode).toBe(404);
    });

    it('should allow API requests with valid token in query parameter', async () => {
      server = new WebServer({ port: 0, authManager });
      await server.start();

      const http = await import('http');
      const port = server.getPort();

      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/test?token=${validToken}`, (res) => {
          res.resume();
          res.on('end', () => {
            resolve({ statusCode: res.statusCode! });
          });
        });
        req.on('error', reject);
      });

      // Should get 404 (not found) not 401 (unauthorized)
      expect(response.statusCode).toBe(404);
    });
  });
});
