/**
 * Storage Directory API Routes
 *
 * REST endpoints for storage directory operations.
 * Read-only for browser clients.
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import { getServices, hasServices, sendError, handleServiceError } from './context';

/**
 * Register storage directory routes
 */
export function registerStorageDirectoryRoutes(fastify: FastifyInstance): void {
  // List all storage directories
  fastify.get('/api/storage-directories', async (_request, reply: FastifyReply) => {
    if (!hasServices()) {
      return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
    }

    try {
      const services = getServices();
      const directories = await services.sdList();
      return directories;
    } catch (err) {
      return handleServiceError(reply, err);
    }
  });

  // Get active storage directory
  fastify.get('/api/storage-directories/active', async (_request, reply: FastifyReply) => {
    if (!hasServices()) {
      return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
    }

    try {
      const services = getServices();
      const activeId = await services.sdGetActive();
      return { id: activeId };
    } catch (err) {
      return handleServiceError(reply, err);
    }
  });
}
