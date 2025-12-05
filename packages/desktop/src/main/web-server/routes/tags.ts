/**
 * Tag API Routes
 *
 * REST endpoints for tag operations.
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import { getServices, hasServices, sendError, handleServiceError } from './context';

/**
 * Register tag routes
 */
export function registerTagRoutes(fastify: FastifyInstance): void {
  // List all tags
  fastify.get('/api/tags', async (_request, reply: FastifyReply) => {
    if (!hasServices()) {
      return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
    }

    try {
      const services = getServices();
      const tags = await services.tagGetAll();
      return tags;
    } catch (err) {
      return handleServiceError(reply, err);
    }
  });
}
