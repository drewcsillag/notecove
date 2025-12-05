/**
 * @jest-environment node
 */

/**
 * Tests for WebSocket Support
 */

import { WebServer } from '../server';
import { AuthManager } from '../auth';
import { WebSocket } from 'ws';

describe('WebSocket Support', () => {
  let server: WebServer;
  let authManager: AuthManager;
  let validToken: string;
  let port: number;

  beforeEach(async () => {
    authManager = new AuthManager();
    validToken = authManager.regenerateToken();
    server = new WebServer({ port: 0, authManager });
    await server.start();
    port = server.getPort()!;
  });

  afterEach(async () => {
    // Disconnect all clients first to ensure clean shutdown
    server.disconnectAllClients();
    if (server.isRunning()) {
      await server.stop();
    }
  }, 10000);

  describe('Connection', () => {
    it('should accept WebSocket connection with valid token in query', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${validToken}`);

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (err: Error) => {
        done(err);
      });
    });

    it('should accept WebSocket connection with valid token in header', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (err: Error) => {
        done(err);
      });
    });

    it('should reject WebSocket connection with invalid token', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=invalid-token`);
      let handled = false;

      ws.on('open', () => {
        if (!handled) {
          handled = true;
          done(new Error('Should not have connected'));
        }
      });

      ws.on('error', () => {
        // Expected - connection refused at HTTP level (401)
        if (!handled) {
          handled = true;
          done();
        }
      });

      ws.on('close', () => {
        // Connection closed without upgrade - this is expected
        if (!handled) {
          handled = true;
          done();
        }
      });
    });

    it('should reject WebSocket connection without token', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let handled = false;

      ws.on('open', () => {
        if (!handled) {
          handled = true;
          done(new Error('Should not have connected'));
        }
      });

      ws.on('error', () => {
        // Expected - connection refused at HTTP level (401)
        if (!handled) {
          handled = true;
          done();
        }
      });

      ws.on('close', () => {
        // Connection closed without upgrade - this is expected
        if (!handled) {
          handled = true;
          done();
        }
      });
    });
  });

  describe('Client Tracking', () => {
    it('should track connected clients', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${validToken}`);

      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          resolve();
        });
      });

      expect(server.getConnectedClientCount()).toBe(1);

      ws.close();

      // Wait for close to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(server.getConnectedClientCount()).toBe(0);
    });

    it('should track multiple connected clients', async () => {
      const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${validToken}`);
      const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${validToken}`);

      await Promise.all([
        new Promise<void>((resolve) =>
          ws1.on('open', () => {
            resolve();
          })
        ),
        new Promise<void>((resolve) =>
          ws2.on('open', () => {
            resolve();
          })
        ),
      ]);

      expect(server.getConnectedClientCount()).toBe(2);

      ws1.close();

      // Wait for close to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(server.getConnectedClientCount()).toBe(1);

      ws2.close();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(server.getConnectedClientCount()).toBe(0);
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast message to all connected clients', async () => {
      const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${validToken}`);
      const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${validToken}`);

      await Promise.all([
        new Promise<void>((resolve) =>
          ws1.on('open', () => {
            resolve();
          })
        ),
        new Promise<void>((resolve) =>
          ws2.on('open', () => {
            resolve();
          })
        ),
      ]);

      const messages1: string[] = [];
      const messages2: string[] = [];

      ws1.on('message', (data: Buffer) => {
        messages1.push(data.toString());
      });
      ws2.on('message', (data: Buffer) => {
        messages2.push(data.toString());
      });

      // Broadcast a message
      server.broadcast({ type: 'note:updated', noteId: 'note-1' });

      // Wait for messages
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages1).toHaveLength(1);
      expect(messages2).toHaveLength(1);

      const msg1 = JSON.parse(messages1[0]!);
      const msg2 = JSON.parse(messages2[0]!);

      expect(msg1).toEqual({ type: 'note:updated', noteId: 'note-1' });
      expect(msg2).toEqual({ type: 'note:updated', noteId: 'note-1' });

      ws1.close();
      ws2.close();
    });

    it('should not fail when broadcasting with no connected clients', () => {
      expect(() => {
        server.broadcast({ type: 'test' });
      }).not.toThrow();
    });
  });

  describe('Disconnect', () => {
    it('should handle client disconnect gracefully', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${validToken}`);

      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          resolve();
        });
      });

      expect(server.getConnectedClientCount()).toBe(1);

      // Forcefully terminate
      ws.terminate();

      // Wait for disconnect to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(server.getConnectedClientCount()).toBe(0);
    }, 10000);

    it('should allow server to disconnect a specific client', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${validToken}`);
      let closed = false;

      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          resolve();
        });
      });

      ws.on('close', () => {
        closed = true;
      });

      expect(server.getConnectedClientCount()).toBe(1);

      // Disconnect all clients
      server.disconnectAllClients();

      // Wait for disconnect
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(server.getConnectedClientCount()).toBe(0);
      expect(closed).toBe(true);
    }, 10000);
  });
});
