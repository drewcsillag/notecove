/**
 * API Route Registration
 *
 * Registers all REST API routes with the Fastify server.
 */

import { FastifyInstance } from 'fastify';
import { registerNoteRoutes } from './notes';
import { registerFolderRoutes } from './folders';
import { registerTagRoutes } from './tags';
import { registerStorageDirectoryRoutes } from './storage-directories';
import { registerHistoryRoutes } from './history';
import { registerDiagnosticsRoutes } from './diagnostics';

/**
 * API version info
 */
export interface ApiInfo {
  version: string;
  api: string;
  features: string[];
}

/**
 * Get API info
 */
export function getApiInfo(): ApiInfo {
  return {
    version: '0.1.0',
    api: 'v1',
    features: ['notes', 'folders', 'tags', 'search', 'history', 'diagnostics'],
  };
}

/**
 * Register all API routes
 */
export function registerRoutes(fastify: FastifyInstance): void {
  // API info endpoint
  fastify.get('/api/info', () => {
    return getApiInfo();
  });

  // Register route modules
  registerNoteRoutes(fastify);
  registerFolderRoutes(fastify);
  registerTagRoutes(fastify);
  registerStorageDirectoryRoutes(fastify);
  registerHistoryRoutes(fastify);
  registerDiagnosticsRoutes(fastify);
}
