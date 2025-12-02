/**
 * Web Server for browser access
 *
 * Provides HTTP/HTTPS server using Fastify that allows browser clients
 * to access NoteCove over the local network.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { TLSCredentials } from './tls';
import { AuthManager, RequestHeaders, QueryParams } from './auth';
import { registerRoutes } from './routes';

/**
 * Web server configuration
 */
export interface WebServerConfig {
  /** Port to listen on (default: 8765) */
  port: number;
  /** Host to bind to (default: '0.0.0.0' for all interfaces) */
  host: string;
  /** Enable HTTPS (default: false) */
  https?: boolean;
  /** TLS credentials (required when https is true) */
  tlsCredentials?: TLSCredentials;
  /** Auth manager for protecting API routes */
  authManager?: AuthManager;
}

/**
 * Default configuration
 */
export const DEFAULT_WEB_SERVER_CONFIG: WebServerConfig = {
  port: 8765,
  host: '0.0.0.0',
  https: false,
};

/**
 * Server address info returned after start
 */
export interface ServerAddress {
  port: number;
  host: string;
  family: string;
}

/**
 * Web server class that manages the HTTP server lifecycle
 */
export class WebServer {
  private fastify: FastifyInstance | null = null;
  private config: WebServerConfig;
  private running = false;
  private address: ServerAddress | null = null;
  private connectedClients: Set<WebSocket> = new Set();

  constructor(config: Partial<WebServerConfig> = {}) {
    this.config = { ...DEFAULT_WEB_SERVER_CONFIG, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<WebServerConfig> {
    return { ...this.config };
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the current port (null if not running)
   */
  getPort(): number | null {
    return this.address?.port ?? null;
  }

  /**
   * Get the server URL (null if not running)
   */
  getUrl(): string | null {
    if (!this.running || !this.address) {
      return null;
    }
    const protocol = this.config.https ? 'https' : 'http';
    const host = this.address.host === '0.0.0.0' ? 'localhost' : this.address.host;
    return `${protocol}://${host}:${this.address.port}`;
  }

  /**
   * Start the web server
   */
  async start(): Promise<ServerAddress> {
    if (this.running) {
      throw new Error('Server is already running');
    }

    // Check for TLS credentials when HTTPS is enabled
    if (this.config.https && !this.config.tlsCredentials) {
      throw new Error('TLS credentials required when HTTPS is enabled');
    }

    // Create Fastify instance with HTTPS if credentials provided
    if (this.config.https && this.config.tlsCredentials) {
      this.fastify = Fastify({
        logger: false,
        https: {
          key: this.config.tlsCredentials.key,
          cert: this.config.tlsCredentials.cert,
        },
      });
    } else {
      this.fastify = Fastify({
        logger: false,
      });
    }

    // Register CORS for browser requests
    await this.fastify.register(cors, {
      origin: true, // Allow all origins for local network access
      credentials: true,
    });

    // Register WebSocket support
    await this.fastify.register(websocket);

    // Add authentication middleware for /api/* routes
    if (this.config.authManager) {
      this.fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        // Skip auth for non-API routes
        if (!request.url.startsWith('/api')) {
          return;
        }

        const authManager = this.config.authManager;
        if (!authManager) {
          reply
            .status(500)
            .send({ error: 'Internal Server Error', message: 'Auth manager not configured' });
          return reply;
        }

        const headers = request.headers as RequestHeaders;
        const query = request.query as QueryParams;

        const token = authManager.extractToken(headers, query);

        if (!token || !authManager.validateToken(token)) {
          reply
            .status(401)
            .send({ error: 'Unauthorized', message: 'Invalid or missing authentication token' });
          return reply;
        }
      });
    }

    // Health check endpoint
    this.fastify.get('/health', () => {
      return { status: 'ok', timestamp: Date.now() };
    });

    // WebSocket endpoint with authentication
    // Use preValidation to reject connections before upgrade
    const authManager = this.config.authManager;
    this.fastify.get(
      '/ws',
      {
        websocket: true,
        preValidation: async (request, reply) => {
          if (authManager) {
            const headers = request.headers as RequestHeaders;
            const query = request.query as QueryParams;
            const token = authManager.extractToken(headers, query);

            if (!token || !authManager.validateToken(token)) {
              reply.code(401).send({ error: 'Unauthorized' });
              throw new Error('Unauthorized');
            }
          }
        },
      },
      (socket) => {
        // Track connected client
        this.connectedClients.add(socket);

        // Handle client disconnect
        socket.on('close', () => {
          this.connectedClients.delete(socket);
        });

        socket.on('error', () => {
          this.connectedClients.delete(socket);
        });
      }
    );

    // Register API routes
    registerRoutes(this.fastify);

    // Start listening
    const address = await this.fastify.listen({
      port: this.config.port,
      host: this.config.host,
    });

    // Parse the address
    const addressInfo = this.fastify.server.address();
    if (typeof addressInfo === 'string' || !addressInfo) {
      throw new Error('Failed to get server address');
    }

    this.address = {
      port: addressInfo.port,
      host: addressInfo.address,
      family: addressInfo.family,
    };

    this.running = true;
    console.log(`[WebServer] Started on ${address}`);

    return this.address;
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    if (!this.running || !this.fastify) {
      return;
    }

    // Disconnect all WebSocket clients first
    this.disconnectAllClients();

    await this.fastify.close();
    this.fastify = null;
    this.running = false;
    this.address = null;
    console.log('[WebServer] Stopped');
  }

  /**
   * Get the Fastify instance (for registering routes)
   * Returns null if server is not started
   */
  getFastify(): FastifyInstance | null {
    return this.fastify;
  }

  /**
   * Get the number of connected WebSocket clients
   */
  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Broadcast a message to all connected WebSocket clients
   */
  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const client of this.connectedClients) {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(data);
      }
    }
  }

  /**
   * Disconnect all connected WebSocket clients
   */
  disconnectAllClients(): void {
    for (const client of this.connectedClients) {
      client.close(1000, 'Server shutdown');
    }
    this.connectedClients.clear();
  }
}
